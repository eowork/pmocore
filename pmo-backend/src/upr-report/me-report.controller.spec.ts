import { Test, TestingModule } from '@nestjs/testing';
import { MeReportController } from './me-report.controller';

describe('MeReportController', () => {
  let controller: MeReportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeReportController],
    }).compile();

    controller = module.get<MeReportController>(MeReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
