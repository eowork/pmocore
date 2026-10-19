import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MeReportService, PdfFieldReport } from './me-report.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

@ApiTags('M&E Report')
@ApiBearerAuth('JWT-auth')
@Controller('upr-report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeReportController {
  constructor(private readonly service: MeReportService) {}

  // Inspection helper: lists the AcroForm field names the template exposes, so
  // the report data can be mapped onto them once the tables exist.
  @Get('pdf-fields')
  @Roles()
  @ApiOperation({
    summary: 'List every AcroForm field in the M&E PDF template',
  })
  getPdfFields(): Promise<PdfFieldReport> {
    return this.service.getPdfFields();
  }

  // Fills the template with a static sample. Temporary: there is no database
  // behind the M&E report yet.
  @Get('test-generate')
  @Roles()
  @ApiOperation({ summary: 'Generate the M&E PDF from static sample data' })
  @ApiQuery({
    name: 'flatten',
    required: false,
    enum: ['true', 'false'],
    description:
      'false keeps the AcroForm fields editable; anything else flattens them.',
  })
  // Swagger needs the media type and a binary schema to describe the body, and
  // Swagger UI only offers a download link when Content-Disposition says
  // attachment (or the type is application/octet-stream) — with inline it prints
  // the raw PDF as text instead.
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'The filled M&E quarterly report',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Header('Content-Type', 'application/pdf')
  @Header(
    'Content-Disposition',
    'attachment; filename="me-quarterly-report-test.pdf"',
  )
  testGenerate(@Query('flatten') flatten?: string): Promise<StreamableFile> {
    return this.service.generateTestReport(flatten !== 'false');
  }

  // The real thing: a stored report rendered onto the same template.
  @Get(':id/pdf')
  @Roles()
  @ApiOperation({ summary: 'Generate the M&E PDF for a stored UPR report' })
  @ApiParam({ name: 'id', description: 'UPR report id' })
  @ApiQuery({
    name: 'flatten',
    required: false,
    enum: ['true', 'false'],
    description:
      'false keeps the AcroForm fields editable; anything else flattens them.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'The filled M&E quarterly report',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  // Content-Disposition is deliberately not set here the way it is above: the renderer names
  // the file after the report's year and quarter, and a header set on the route would win over
  // the one the StreamableFile carries.
  @Header('Content-Type', 'application/pdf')
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('flatten') flatten?: string,
  ): Promise<StreamableFile> {
    return this.service.generateReport(id, flatten !== 'false');
  }
}
