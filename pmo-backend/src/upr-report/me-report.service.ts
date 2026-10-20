import {
  Injectable,
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
import { readFile } from 'node:fs/promises';
import {
  PDFDocument,
  PDFDropdown,
  PDFForm,
  PDFOptionList,
  PDFRadioGroup,
} from 'pdf-lib';
import { Report, renderPdfReport } from './pdf-renderer';
import { ChallengeOpportunityType } from './enums';
import { basename } from 'node:path';
import { getTemplatePath } from './helper';

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
 * Static sample used by the test-generate endpoint, shaped like a stored report so it goes
 * through the same renderer as a real one. It exists to exercise the template — a field that
 * moved or was renamed shows up here without needing a report in the database.
 */
const SAMPLE_REPORT: Report = {
  basic_information: {
    office_name: 'Project Management Office',
    fiscal_year: 2026,
    quarter: 3,
    unit_office_profile:
      'The Project Management Office oversees planning, monitoring and evaluation of all university infrastructure and operations programs across the four campuses.',
    quality_objective:
      'Deliver 90% of programmed infrastructure projects on schedule and within the approved contract cost.',
    prepared_by: { firstName: 'Juan', lastName: 'Dela Cruz' },
    created_at: new Date('2026-10-12T00:00:00Z'),
  },
  initiatives: [
    {
      title: 'Quarterly Infrastructure Review',
      date_conducted: new Date('2026-07-15T00:00:00Z'),
      description:
        'Review of physical and financial accomplishment for all ongoing construction projects.',
      attachment: { original_filename: 'minutes-and-attendance.pdf' },
    },
    {
      title: 'Operations Indicator Validation',
      date_conducted: new Date('2026-08-08T00:00:00Z'),
      description:
        'Validation of campus-submitted quarterly data against supporting documents.',
      drive_link: 'https://drive.example/validation-report',
    },
    {
      title: 'Internal Quality Audit',
      date_conducted: new Date('2026-09-22T00:00:00Z'),
      description:
        'Audit of document control and records retention for the office.',
    },
  ],
  best_practices: [
    {
      description:
        'Eighteen of twenty programmed projects reached their target physical accomplishment for the quarter.',
    },
    {
      description:
        'Disbursement reached 87% of the quarterly allotment, up from 74% last quarter.',
    },
    {
      description:
        'All four campuses submitted their operations indicators before the cut-off date.',
    },
  ],
  challenge_opportunities: [
    {
      item_type: ChallengeOpportunityType.CHALLENGE,
      description:
        'Delayed delivery of structural steel pushed back two building projects by three weeks.',
    },
    {
      item_type: ChallengeOpportunityType.CHALLENGE,
      description:
        'Incomplete supporting documents on first submission required repeated follow-up.',
    },
    {
      item_type: ChallengeOpportunityType.OPPORTUNITY,
      description:
        'Framework agreements with pre-qualified suppliers can shorten procurement lead time.',
    },
    {
      item_type: ChallengeOpportunityType.OPPORTUNITY,
      description:
        'A checklist built into the submission form would catch missing documents at entry.',
    },
  ],
  future_goals: [
    {
      initiative: 'Digitized progress reporting for construction projects',
      target_date_of_completion: new Date('2026-12-31T00:00:00Z'),
      outcomes: ['Reporting turnaround reduced from ten days to three days'],
    },
    {
      initiative: 'Campus-level data entry for operations indicators',
      target_date_of_completion: new Date('2027-03-31T00:00:00Z'),
      outcomes: ['Each campus accountable for its own quarterly figures'],
    },
  ],
};

@Injectable()
export class MeReportService {
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
   * Fill the template with the static sample above and hand back the PDF.
   *
   * It goes through renderPdfReport, the same path a stored report takes, so this endpoint
   * exercises the real field mapping, font and sizing rather than a second copy of them that
   * could drift. Flattening is on by default so the result reads as a finished report; pass
   * flatten=false to get a document whose form fields are still editable.
   */
  async generateTestReport(flatten = true): Promise<StreamableFile> {
    return renderPdfReport(SAMPLE_REPORT, flatten);
  }
}
