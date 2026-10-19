import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { QueryOrder } from '@mikro-orm/core';
import {
  UprBestPractices,
  UprChallengesOpportunities,
  UprFutureGoal,
  UprInitiative,
  UPRReport,
} from '../database/entities';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFForm,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';
import { createReportTypography, renderPdfReport } from './pdf-renderer';

/** One AcroForm field as the inspection endpoint reports it. */
export interface PdfFieldInfo {
  /** The field name exactly as the template stores it. */
  name: string;
  /** The name trimmed of stray whitespace, which is the key the filler matches on. */
  key: string;
  type: string;
  /** Present only for the field types that offer a fixed set of values. */
  options?: string[];
}

export interface PdfFieldReport {
  template: string;
  hasXFA: boolean;
  count: number;
  fields: PdfFieldInfo[];
}

/**
 * Static sample used by the test-generate endpoint. Keys are the field names
 * the pdf-fields endpoint reports. Replace this with database-backed data once
 * the M&E report tables exist.
 */
const SAMPLE_REPORT: Record<string, string | boolean> = {
  'Fiscal Year': '2026',
  Name: 'Juan D. Dela Cruz',

  s1_name: 'Project Management Office',
  s1_quater_1: false,
  s1_quarter_2: false,
  s1_quarter_3: true,
  s1_quater_4: false,
  s1_unit_profile:
    'The Project Management Office oversees planning, monitoring and evaluation of all university infrastructure and operations programs across the four campuses.',
  s1_quality_objective:
    'Deliver 90% of programmed infrastructure projects on schedule and within the approved contract cost.',

  s2_row_1: '1',
  s2_title_1: 'Quarterly Infrastructure Review',
  s2_conducted_1: 'July 15, 2026',
  s2_description_1:
    'Review of physical and financial accomplishment for all ongoing construction projects.',
  s2_mov_1: 'Minutes of the meeting, attendance sheet',

  s2_row_2: '2',
  s2_title_2: 'Operations Indicator Validation',
  s2_conducted_2: 'August 8, 2026',
  s2_description_2:
    'Validation of campus-submitted quarterly data against supporting documents.',
  s2_mov_2: 'Validation report, signed summary sheet',

  s2_row_3: '3',
  s2_title_3: 'Internal Quality Audit',
  s2_conducted_3: 'September 22, 2026',
  s2_description_3:
    'Audit of document control and records retention for the office.',
  s2_mov_3: 'Audit findings report',

  s3_row_1: '1',
  s3_content_1:
    'Eighteen of twenty programmed projects reached their target physical accomplishment for the quarter.',
  s3_row_2: '2',
  s3_content_2:
    'Disbursement reached 87% of the quarterly allotment, up from 74% last quarter.',
  s3_row_3: '3',
  s3_content_3:
    'All four campuses submitted their operations indicators before the cut-off date.',

  s4_challenge_row_1: '1',
  s4_challenge_1:
    'Delayed delivery of structural steel pushed back two building projects by three weeks.',
  s4_opportunities_row_1: '1',
  s4_opportunities_1:
    'Framework agreements with pre-qualified suppliers can shorten procurement lead time.',

  s4_challenge_row_2: '2',
  s4_challenge_2:
    'Incomplete supporting documents on first submission required repeated follow-up.',
  s4_opportunities_row_2: '2',
  s4_opportunities_2:
    'A checklist built into the submission form would catch missing documents at entry.',

  s5_row_1: '1',
  s5_initiative_1: 'Digitized progress reporting for construction projects',
  s5_target_1: 'Q4 2026',
  s5_outcome_1: 'Reporting turnaround reduced from ten days to three days',

  s5_row_2: '2',
  s5_initiative_2: 'Campus-level data entry for operations indicators',
  s5_target_2: 'Q1 2027',
  s5_outcome_2: 'Each campus accountable for its own quarterly figures',

  prepared_signature: 'Maria L. Santos',
  prepared_designation_office: 'Planning Officer III, PMO',
  designation_date_1: 'October 12, 2026',

  approved_signature: 'Roberto A. Villanueva',
  approved_designation_office: 'Vice President for Administration',
  designation_date_2: 'October 12, 2026',
};

@Injectable()
export class MeReportService {
  private static readonly TEMPLATE_FILE = 'me-quartely-report.pdf';

  private readonly logger = new Logger(MeReportService.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Generate the PDF for a stored report.
   *
   * The sections are fetched separately rather than through `populate` because each one is a
   * plain list that has to come back in its own `sort_order` — the order the rows carry is the
   * order they were given on the form, and it is what the printed table has to show.
   */
  async generateReport(
    reportId: string,
    flatten = true,
  ): Promise<StreamableFile> {
    const basic_information = await this.em.findOne(
      UPRReport,
      { id: reportId },
      { populate: ['prepared_by'] },
    );
    if (!basic_information) {
      throw new NotFoundException(`UPR report ${reportId} not found`);
    }

    const where = { report: basic_information };
    const orderBy = { sort_order: QueryOrder.ASC } as const;
    const [initiatives, best_practices, challenge_opportunities, future_goals] =
      await Promise.all([
        this.em.find(UprInitiative, where, {
          populate: ['attachment'],
          orderBy,
        }),
        this.em.find(UprBestPractices, where, { orderBy }),
        this.em.find(UprChallengesOpportunities, where, { orderBy }),
        this.em.find(UprFutureGoal, where, { orderBy }),
      ]);

    return renderPdfReport(
      {
        basic_information,
        initiatives,
        best_practices,
        challenge_opportunities,
        future_goals,
      },
      flatten,
    );
  }

  /**
   * Resolve the template. The compiled service runs from dist/upr-report and
   * nest-cli copies the template to dist/me-pdf/template; the src path is kept
   * as a fallback so the file is still found when running from source.
   */
  private templatePath(): string {
    const candidates = [
      join(
        __dirname,
        '..',
        'me-pdf',
        'template',
        MeReportService.TEMPLATE_FILE,
      ),
      join(
        process.cwd(),
        'src',
        'me-pdf',
        'template',
        MeReportService.TEMPLATE_FILE,
      ),
    ];
    const found = candidates.find((path) => existsSync(path));
    if (!found) {
      throw new InternalServerErrorException(
        `M&E report template not found: ${MeReportService.TEMPLATE_FILE}`,
      );
    }
    return found;
  }

  private async loadForm(): Promise<{ pdfDoc: PDFDocument; form: PDFForm }> {
    const bytes = await readFile(this.templatePath());
    const pdfDoc = await PDFDocument.load(bytes);
    return { pdfDoc, form: pdfDoc.getForm() };
  }

  /** Every AcroForm field in the template, with its type and any fixed options. */
  async getPdfFields(): Promise<PdfFieldReport> {
    const { form } = await this.loadForm();

    const fields = form.getFields().map((field) => {
      const name = field.getName();
      const info: PdfFieldInfo = {
        name,
        key: name.trim(),
        type: field.constructor.name,
      };
      if (
        field instanceof PDFDropdown ||
        field instanceof PDFOptionList ||
        field instanceof PDFRadioGroup
      ) {
        info.options = field.getOptions();
      }
      return info;
    });

    return {
      template: MeReportService.TEMPLATE_FILE,
      hasXFA: form.hasXFA(),
      count: fields.length,
      fields,
    };
  }

  /**
   * Fill the template with the static sample above and hand back the PDF.
   * Flattening is on by default so the result reads as a finished report; pass
   * flatten=false to get a document whose form fields are still editable.
   */
  async generateTestReport(flatten = true): Promise<StreamableFile> {
    const { pdfDoc, form } = await this.loadForm();
    // Without this the template's own `/Helv 0 Tf` is honoured, which means auto-size: pdf-lib
    // grows the text until it fills the widget, so the two full-page narrative boxes come out
    // at around 90pt while a crowded table cell drops to 4pt.
    const typography = await createReportTypography(pdfDoc);

    // Match on the trimmed name so a field that picks up stray whitespace in a
    // later revision of the template still resolves.
    const byKey = new Map<string, string>();
    for (const field of form.getFields()) {
      byKey.set(field.getName().trim(), field.getName());
    }

    const skipped: string[] = [];
    for (const [key, value] of Object.entries(SAMPLE_REPORT)) {
      const name = byKey.get(key);
      if (!name) {
        skipped.push(key);
        continue;
      }

      const field = form.getField(name);
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
      // Not fatal: the sample is a stand-in and the template may still be revised.
      this.logger.warn(`Sample keys not applied: ${skipped.join(', ')}`);
    }

    typography.apply(form);

    if (flatten) {
      // The appearances were just drawn with the embedded font; letting flatten redraw them
      // would fall back to pdf-lib's built-in Helvetica and undo the sizing above.
      form.flatten({ updateFieldAppearances: false });
    }

    const bytes = await pdfDoc.save({ updateFieldAppearances: false });
    return new StreamableFile(Buffer.from(bytes), {
      type: 'application/pdf',
      disposition: 'attachment; filename="me-quarterly-report-test.pdf"',
    });
  }
}
