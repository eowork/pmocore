import { Test, TestingModule } from '@nestjs/testing';
import { MeReportService } from './me-report.service';

describe('MeReportService', () => {
  let service: MeReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeReportService],
    }).compile();

    service = module.get<MeReportService>(MeReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
