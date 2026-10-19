import {
  UprBestPractices,
  UprChallengesOpportunities,
  UprFutureGoal,
  UprInitiative,
  UPRReport,
} from '../database/entities';
import { ChallengeOpportunityType } from './enums';
import { readFile } from 'node:fs/promises';
import { getFontPath, getTemplatePath } from './helper';
import * as fontkit from '@pdf-lib/fontkit';
import {
  layoutMultilineText,
  layoutSinglelineText,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFFont,
  PDFForm,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFString,
  PDFTextField,
} from 'pdf-lib';
import { StreamableFile } from '@nestjs/common';

/**
 * One report as the PDF needs it: the header row plus each repeating section, already ordered
 * the way it should appear on the form.
 */
export interface Report {
  basic_information: UPRReport;
  initiatives: UprInitiative[];
  best_practices: UprBestPractices[];
  challenge_opportunities: UprChallengesOpportunities[];
  future_goals: UprFutureGoal[];
}

/** How many rows each repeating section of the template offers. */
interface RowCapacity {
  initiatives: number;
  best_practices: number;
  challenges: number;
  opportunities: number;
  future_goals: number;
}

/** A filled template field: text for the text fields, a tick state for the quarter boxes. */
type FormFields = Record<string, string | boolean>;

/** The date style the printed form uses — "July 15, 2026". */
const REPORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(value?: Date | null): string {
  return value ? REPORT_DATE.format(value) : '';
}

function fullName(user?: { firstName?: string; lastName?: string }): string {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

/**
 * Maps a report onto the template's field names.
 *
 * The repeating sections are numbered from 1 and stop at the template's own row count: a
 * report with more initiatives than the form has rows loses the overflow rather than writing
 * into fields that do not exist, and the caller is told how many were dropped.
 */
function toFormFields(
  report: Report,
  capacity: RowCapacity,
): { fields: FormFields; dropped: string[] } {
  const basic = report.basic_information;
  const fields: FormFields = {
    'Fiscal Year': String(basic.fiscal_year),
    Name: fullName(basic.prepared_by),
    s1_name: basic.office_name,
    s1_unit_profile: basic.unit_office_profile,
    s1_quality_objective: basic.quality_objective,

    // The form carries one tick box per quarter rather than a quarter field.
    s1_quarter_1: basic.quarter === 1,
    s1_quarter_2: basic.quarter === 2,
    s1_quarter_3: basic.quarter === 3,
    s1_quarter_4: basic.quarter === 4,

    prepared_signature: fullName(basic.prepared_by),
    prepared_designation_office: basic.office_name,
    designation_date_1: formatDate(basic.updated_at ?? basic.created_at),
  };

  // The approver block is deliberately left blank: nothing on UPRReport records who approved
  // a report, so printing the preparer there would be a false signature line.

  const dropped: string[] = [];
  const take = <T>(rows: T[], limit: number, section: string): T[] => {
    if (rows.length > limit) {
      dropped.push(`${section}: ${rows.length - limit} of ${rows.length}`);
    }
    return rows.slice(0, limit);
  };

  take(report.initiatives, capacity.initiatives, 'initiatives').forEach(
    (initiative, index) => {
      const row = index + 1;
      fields[`s2_row_${row}`] = String(row);
      fields[`s2_title_${row}`] = initiative.title;
      fields[`s2_conducted_${row}`] = formatDate(initiative.date_conducted);
      fields[`s2_description_${row}`] = initiative.description;
      // The means of verification is whichever evidence the initiative carries: the uploaded
      // file if there is one, otherwise the link that stands in for it.
      fields[`s2_mov_${row}`] =
        initiative.attachment?.original_filename ?? initiative.drive_link ?? '';
    },
  );

  take(
    report.best_practices,
    capacity.best_practices,
    'best practices',
  ).forEach((practice, index) => {
    const row = index + 1;
    fields[`s3_row_${row}`] = String(row);
    fields[`s3_content_${row}`] = practice.description;
  });

  // One table in the entity, two columns on the form, each numbered from 1 on its own.
  const challenges = report.challenge_opportunities.filter(
    (item) => item.item_type === ChallengeOpportunityType.CHALLENGE,
  );
  const opportunities = report.challenge_opportunities.filter(
    (item) => item.item_type === ChallengeOpportunityType.OPPORTUNITY,
  );

  take(challenges, capacity.challenges, 'challenges').forEach((item, index) => {
    const row = index + 1;
    fields[`s4_challenge_row_${row}`] = String(row);
    fields[`s4_challenge_${row}`] = item.description;
  });

  take(opportunities, capacity.opportunities, 'opportunities').forEach(
    (item, index) => {
      const row = index + 1;
      fields[`s4_opportunities_row_${row}`] = String(row);
      fields[`s4_opportunities_${row}`] = item.description;
    },
  );

  take(report.future_goals, capacity.future_goals, 'future goals').forEach(
    (goal, index) => {
      const row = index + 1;
      fields[`s5_row_${row}`] = String(row);
      fields[`s5_initiative_${row}`] = goal.initiative;
      fields[`s5_target_${row}`] = formatDate(goal.target_date_of_completion);
      fields[`s5_outcome_${row}`] = (goal.outcomes ?? []).join('; ');
    },
  );

  return { fields, dropped };
}

/**
 * How many rows the template offers for a section, counted from its own field names so a
 * revised template with more or fewer rows needs no change here.
 */
function rowCapacity(byKey: Map<string, string>, prefix: string): number {
  let rows = 0;
  while (byKey.has(`${prefix}_${rows + 1}`)) rows += 1;
  return rows;
}

// The template declares `/Helv 0 Tf` on nearly every field. The zero means auto-size, and
// pdf-lib reads that as "grow the text until it fills the widget": a one-line answer in a
// full-page box comes out as headline text, while a long answer in a table cell is shrunk to
// 4pt. Rendering against a fixed size range is what keeps the filled form looking like the
// printed one.
const BASE_FONT_SIZE = 10;
// Below this the text stops being readable in print, so an over-long answer is allowed to
// overflow its box instead of shrinking further — that at least shows the author it did not fit.
const MIN_FONT_SIZE = 6;
// The inset pdf-lib itself applies between a widget's border and its text.
const WIDGET_PADDING = 1;

// Whitespace the layout needs and the font has no glyph for, so it must skip the glyph check
// below rather than be replaced.
const LAYOUT_WHITESPACE = new Set(
  ['\n', '\r', '\t', ' '].map((c) => c.charCodeAt(0)),
);

// Invisible characters that survive a copy-paste out of Word or a browser and would otherwise
// be measured as if they were real text. Written as code points because the characters
// themselves are unreadable in source.
const CHARACTER_FIXES = new Map<number, string>([
  [0x200b, ''], // zero width space
  [0x200c, ''], // zero width non-joiner
  [0x200d, ''], // zero width joiner
  [0xfeff, ''], // byte order mark
  [0x00a0, ' '], // no-break space
  [0x2007, ' '], // figure space
  [0x202f, ' '], // narrow no-break space
  [0x2028, '\n'], // line separator
  [0x2029, '\n'], // paragraph separator
]);

// The embedded font is read once per process: it is half a megabyte, and every report renders
// from the same file.
let fontBytesCache: Promise<Buffer> | null = null;

function loadFontBytes(): Promise<Buffer> {
  if (!fontBytesCache) {
    fontBytesCache = readFile(getFontPath());
  }
  return fontBytesCache;
}

/** A form field value as text, with anything the font cannot draw taken out. */
function toFieldText(
  value: unknown,
  supportsCodePoint: (cp: number) => boolean,
): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  const text = typeof value === 'string' ? value : String(value);

  // Arimo covers Latin, the typographic punctuation and the peso sign, but not everything a
  // user can paste — an emoji or a check mark would come out as a blank box. A visible '?' says
  // plainly that a character was dropped.
  return Array.from(text)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      const fix = CHARACTER_FIXES.get(codePoint);
      if (fix !== undefined) return fix;
      if (LAYOUT_WHITESPACE.has(codePoint)) return character;
      return supportsCodePoint(codePoint) ? character : '?';
    })
    .join('');
}

/**
 * The largest size at or below BASE_FONT_SIZE at which this field's text still fits its widget.
 *
 * pdf-lib's own auto-sizing is asked for the best fit (by passing 0) and then used only to
 * shrink, never to grow, so every field reads at the same size unless its box forces otherwise.
 */
function fitFontSize(field: PDFTextField, font: PDFFont): number {
  const text = field.getText() ?? '';
  if (!text.trim()) return BASE_FONT_SIZE;

  let fitted = BASE_FONT_SIZE;
  for (const widget of field.acroField.getWidgets()) {
    const rectangle = widget.getRectangle();
    const borderWidth = widget.getBorderStyle()?.getWidth() ?? 0;
    const inset = borderWidth + WIDGET_PADDING;
    const bounds = {
      x: inset,
      y: inset,
      width: rectangle.width - inset * 2,
      height: rectangle.height - inset * 2,
    };
    if (bounds.width <= 0 || bounds.height <= 0) continue;

    const options = {
      alignment: field.getAlignment(),
      fontSize: 0,
      font,
      bounds,
    };
    const layout = field.isMultiline()
      ? layoutMultilineText(text, options)
      : layoutSinglelineText(text, options);
    fitted = Math.min(fitted, layout.fontSize);
  }

  return Math.max(fitted, MIN_FONT_SIZE);
}

// The font-size token inside a default-appearance string, e.g. `/Helv 12 Tf` — captured so it
// can be rewritten without disturbing the colour operators around it.
const DEFAULT_APPEARANCE_SIZE = /(\/[^\s/]+)\s+(\d*\.?\d+)\s+Tf/;

/**
 * Writes the size into any default appearance the widgets carry themselves.
 *
 * A widget's own /DA wins over the field's in pdf-lib, so for the few fields in this template
 * that have one, setFontSize is read straight past and the widget keeps auto-sizing — which is
 * how s2_conducted_3 and s4_opportunities_2 still came out at 14pt and 13pt. Only the size
 * token is replaced, so a widget-specific colour survives.
 */
function setWidgetFontSize(field: PDFTextField, size: number): void {
  for (const widget of field.acroField.getWidgets()) {
    const appearance = widget.dict.get(PDFName.of('DA'));
    if (!(appearance instanceof PDFString)) continue;

    const updated = appearance
      .asString()
      .replace(DEFAULT_APPEARANCE_SIZE, `$1 ${size} Tf`);
    widget.dict.set(PDFName.of('DA'), PDFString.of(updated));
  }
}

/**
 * Sets a readable size on every filled text field and redraws the widgets with the embedded
 * font. Must run after the fields are filled, because the size each one gets depends on how
 * much text it ended up holding.
 */
function applyFieldSizes(form: PDFForm, font: PDFFont): void {
  for (const field of form.getFields()) {
    // Combed fields are the one case where auto-sizing is right: the size has to follow the
    // cell grid drawn on the template, not our own scale.
    if (!(field instanceof PDFTextField) || field.isCombed()) continue;
    if (!field.getText()?.trim()) continue;

    // The signature fields in the template carry no default appearance at all, and setFontSize
    // refuses to edit one that is missing, so write a baseline before adjusting it.
    if (field.acroField.getDefaultAppearance() === undefined) {
      field.acroField.setDefaultAppearance(
        `/${font.name} ${BASE_FONT_SIZE} Tf 0 g`,
      );
    }
    const size = fitFontSize(field, font);
    field.setFontSize(size);
    setWidgetFontSize(field, size);
  }

  // Draws every widget with the embedded font rather than leaving pdf-lib to fall back to its
  // built-in Helvetica at save time, which would also undo the sizes set above.
  form.updateFieldAppearances(font);
}

/**
 * Everything a filler needs to put text into this template and have it come out readable.
 *
 * Shared rather than private to renderPdfReport because the template is filled from more than
 * one place (see MeReportService): a filler that skips this gets pdf-lib's auto-sizing, which
 * grows a short answer in a full-page box to 90pt and more.
 */
export interface ReportTypography {
  /** The embedded font every field is drawn with. */
  font: PDFFont;
  /** A value as text this font can actually draw. */
  text(value: unknown): string;
  /** Size and redraw every filled field. Call once, after the form is filled. */
  apply(form: PDFForm): void;
}

export async function createReportTypography(
  pdfDoc: PDFDocument,
): Promise<ReportTypography> {
  const fontBytes = await loadFontBytes();
  pdfDoc.registerFontkit(fontkit);
  // Subset so only the glyphs this report actually uses are written into the file; the whole
  // face would add half a megabyte to every download.
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const probe = fontkit.create(fontBytes);
  const supportsCodePoint = (codePoint: number) =>
    probe.hasGlyphForCodePoint(codePoint);

  return {
    font,
    text: (value: unknown) => toFieldText(value, supportsCodePoint),
    apply: (form: PDFForm) => applyFieldSizes(form, font),
  };
}

export async function renderPdfReport(
  report: Report,
  is_flatten: boolean = false,
) {
  const path = getTemplatePath();
  const bytes = await readFile(path);

  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const typography = await createReportTypography(pdfDoc);

  const byKey = new Map<string, string>();
  for (const field of form.getFields()) {
    byKey.set(field.getName().trim(), field.getName());
  }

  const { fields, dropped } = toFormFields(report, {
    initiatives: rowCapacity(byKey, 's2_row'),
    best_practices: rowCapacity(byKey, 's3_row'),
    challenges: rowCapacity(byKey, 's4_challenge_row'),
    opportunities: rowCapacity(byKey, 's4_opportunities_row'),
    future_goals: rowCapacity(byKey, 's5_row'),
  });

  if (dropped.length > 0) {
    console.warn(
      `Rows that did not fit the template — ${dropped.join(', ')}. ` +
        'The form has a fixed number of rows per section.',
    );
  }

  const skipped: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const fieldName = byKey.get(key);
    if (!fieldName) {
      skipped.push(key);
      continue;
    }
    const field = form.getField(fieldName);
    if (field instanceof PDFTextField) {
      field.setText(typography.text(value));
    } else if (field instanceof PDFCheckBox) {
      if (value) {
        field.check();
      } else {
        field.uncheck();
      }
    } else if (
      field instanceof PDFDropdown ||
      field instanceof PDFOptionList ||
      field instanceof PDFRadioGroup
    ) {
      field.select(String(value));
    } else {
      skipped.push(key);
    }
  }

  if (skipped.length > 0) {
    console.warn(`Skipped fields: ${skipped.join(', ')}`);
  }

  typography.apply(form);

  if (is_flatten) {
    form.flatten({ updateFieldAppearances: false });
  }

  const save_bytes = await pdfDoc.save({ updateFieldAppearances: false });
  const basic = report.basic_information;
  const filename = `upr-report-${basic.fiscal_year}-Q${basic.quarter}.pdf`;
  return new StreamableFile(Buffer.from(save_bytes), {
    type: 'application/pdf',
    disposition: `attachment; filename="${filename}"`,
  });
}
