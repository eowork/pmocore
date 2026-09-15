import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import type { FilterQuery } from '@mikro-orm/core';
import { createPaginatedResponse, PaginatedResponse } from '../common/dto';
import {
  CreateStudentParityDto,
  CreateFacultyParityDto,
  CreateStaffParityDto,
  CreatePwdParityDto,
  CreateIndigenousParityDto,
  ReviewParityDto,
  CreateGpbAccomplishmentDto,
  CreateBudgetPlanDto,
  QueryParityDto,
  QueryPlanningDto,
} from './dto';
import {
  GadStudentParityData,
  GadFacultyParityData,
  GadStaffParityData,
  GadPwdParityData,
  GadIndigenousParityData,
  GadGpbAccomplishment,
  GadBudgetPlan,
} from '../database/entities';

@Injectable()
export class GadService {
  private readonly logger = new Logger(GadService.name);

  constructor(
    @InjectRepository(GadStudentParityData)
    private readonly studentRepo: EntityRepository<GadStudentParityData>,
    @InjectRepository(GadFacultyParityData)
    private readonly facultyRepo: EntityRepository<GadFacultyParityData>,
    @InjectRepository(GadStaffParityData)
    private readonly staffRepo: EntityRepository<GadStaffParityData>,
    @InjectRepository(GadPwdParityData)
    private readonly pwdRepo: EntityRepository<GadPwdParityData>,
    @InjectRepository(GadIndigenousParityData)
    private readonly indigenousRepo: EntityRepository<GadIndigenousParityData>,
    @InjectRepository(GadGpbAccomplishment)
    private readonly gpbRepo: EntityRepository<GadGpbAccomplishment>,
    @InjectRepository(GadBudgetPlan)
    private readonly budgetRepo: EntityRepository<GadBudgetPlan>,
    private readonly em: EntityManager,
  ) {}

  // --- Generic helpers ---
  private async findAllWithPagination<T extends object>(
    repo: EntityRepository<T>,
    where: FilterQuery<T>,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<T>> {
    const [items, total] = await repo.findAndCount(where, {
      limit,
      offset: (page - 1) * limit,
      orderBy: { createdAt: 'desc' } as any,
    });
    return createPaginatedResponse(items, total, page, limit);
  }

  private async findOneOrFail<T extends object>(
    repo: EntityRepository<T>,
    id: string,
    label: string,
  ): Promise<T> {
    const entity = await repo.findOne({ id } as FilterQuery<T>);
    if (!entity) throw new NotFoundException(`${label} ${id} not found`);
    return entity;
  }

  private async softDelete<T extends { deletedAt?: Date }>(
    repo: EntityRepository<T>,
    id: string,
    label: string,
  ): Promise<void> {
    const entity = await this.findOneOrFail(repo, id, label);
    entity.deletedAt = new Date();
    await this.em.flush();
    this.logger.log(`GAD_PARITY_DELETED: ${label}, id=${id}`);
  }

  private async reviewEntity<
    T extends { status?: string; reviewedBy?: string; reviewedAt?: Date },
  >(
    repo: EntityRepository<T>,
    id: string,
    dto: ReviewParityDto,
    userId: string,
    label: string,
  ): Promise<T> {
    const entity = await this.findOneOrFail(repo, id, label);
    entity.status = dto.status;
    entity.reviewedBy = userId;
    entity.reviewedAt = new Date();
    await this.em.flush();
    this.logger.log(
      `GAD_PARITY_REVIEWED: ${label}, id=${id}, status=${dto.status}, by=${userId}`,
    );
    return entity;
  }

  // --- Student Parity ---
  findStudentParity(query: QueryParityDto) {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadStudentParityData> = {};
    if (query.academic_year) where.academicYear = query.academic_year;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.studentRepo, where, page, limit);
  }

  async createStudentParity(dto: CreateStudentParityDto, userId: string) {
    const entity = this.studentRepo.create({
      academicYear: dto.academic_year,
      program: dto.program,
      admissionMale: dto.admission_male ?? 0,
      admissionFemale: dto.admission_female ?? 0,
      graduationMale: dto.graduation_male ?? 0,
      graduationFemale: dto.graduation_female ?? 0,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `GAD_PARITY_CREATED: student, id=${entity.id}, by=${userId}`,
    );
    return entity;
  }

  async updateStudentParity(
    id: string,
    dto: Partial<CreateStudentParityDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(
      this.studentRepo,
      id,
      'Student parity',
    );
    if (dto.academic_year !== undefined)
      entity.academicYear = dto.academic_year;
    if (dto.program !== undefined) entity.program = dto.program;
    if (dto.admission_male !== undefined)
      entity.admissionMale = dto.admission_male;
    if (dto.admission_female !== undefined)
      entity.admissionFemale = dto.admission_female;
    if (dto.graduation_male !== undefined)
      entity.graduationMale = dto.graduation_male;
    if (dto.graduation_female !== undefined)
      entity.graduationFemale = dto.graduation_female;
    await this.em.flush();
    this.logger.log(`GAD_PARITY_UPDATED: student, id=${id}, by=${userId}`);
    return entity;
  }

  removeStudentParity(id: string) {
    return this.softDelete(this.studentRepo, id, 'Student parity');
  }
  reviewStudentParity(id: string, dto: ReviewParityDto, userId: string) {
    return this.reviewEntity(
      this.studentRepo,
      id,
      dto,
      userId,
      'Student parity',
    );
  }

  // --- Faculty Parity ---
  findFacultyParity(query: QueryParityDto) {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadFacultyParityData> = {};
    if (query.academic_year) where.academicYear = query.academic_year;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.facultyRepo, where, page, limit);
  }

  async createFacultyParity(dto: CreateFacultyParityDto, userId: string) {
    const entity = this.facultyRepo.create({
      academicYear: dto.academic_year,
      college: dto.college,
      category: dto.category,
      totalFaculty: dto.total_faculty ?? 0,
      maleCount: dto.male_count ?? 0,
      femaleCount: dto.female_count ?? 0,
      genderBalance: dto.gender_balance,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `GAD_PARITY_CREATED: faculty, id=${entity.id}, by=${userId}`,
    );
    return entity;
  }

  async updateFacultyParity(
    id: string,
    dto: Partial<CreateFacultyParityDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(
      this.facultyRepo,
      id,
      'Faculty parity',
    );
    if (dto.academic_year !== undefined)
      entity.academicYear = dto.academic_year;
    if (dto.college !== undefined) entity.college = dto.college;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.total_faculty !== undefined)
      entity.totalFaculty = dto.total_faculty;
    if (dto.male_count !== undefined) entity.maleCount = dto.male_count;
    if (dto.female_count !== undefined) entity.femaleCount = dto.female_count;
    if (dto.gender_balance !== undefined)
      entity.genderBalance = dto.gender_balance;
    await this.em.flush();
    this.logger.log(`GAD_PARITY_UPDATED: faculty, id=${id}, by=${userId}`);
    return entity;
  }

  removeFacultyParity(id: string) {
    return this.softDelete(this.facultyRepo, id, 'Faculty parity');
  }
  reviewFacultyParity(id: string, dto: ReviewParityDto, userId: string) {
    return this.reviewEntity(
      this.facultyRepo,
      id,
      dto,
      userId,
      'Faculty parity',
    );
  }

  // --- Staff Parity ---
  findStaffParity(query: QueryParityDto) {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadStaffParityData> = {};
    if (query.academic_year) where.academicYear = query.academic_year;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.staffRepo, where, page, limit);
  }

  async createStaffParity(dto: CreateStaffParityDto, userId: string) {
    const entity = this.staffRepo.create({
      academicYear: dto.academic_year,
      department: dto.department,
      staffCategory: dto.staff_category,
      totalStaff: dto.total_staff ?? 0,
      maleCount: dto.male_count ?? 0,
      femaleCount: dto.female_count ?? 0,
      genderBalance: dto.gender_balance,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(`GAD_PARITY_CREATED: staff, id=${entity.id}, by=${userId}`);
    return entity;
  }

  async updateStaffParity(
    id: string,
    dto: Partial<CreateStaffParityDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(this.staffRepo, id, 'Staff parity');
    if (dto.academic_year !== undefined)
      entity.academicYear = dto.academic_year;
    if (dto.department !== undefined) entity.department = dto.department;
    if (dto.staff_category !== undefined)
      entity.staffCategory = dto.staff_category;
    if (dto.total_staff !== undefined) entity.totalStaff = dto.total_staff;
    if (dto.male_count !== undefined) entity.maleCount = dto.male_count;
    if (dto.female_count !== undefined) entity.femaleCount = dto.female_count;
    if (dto.gender_balance !== undefined)
      entity.genderBalance = dto.gender_balance;
    await this.em.flush();
    this.logger.log(`GAD_PARITY_UPDATED: staff, id=${id}, by=${userId}`);
    return entity;
  }

  removeStaffParity(id: string) {
    return this.softDelete(this.staffRepo, id, 'Staff parity');
  }
  reviewStaffParity(id: string, dto: ReviewParityDto, userId: string) {
    return this.reviewEntity(this.staffRepo, id, dto, userId, 'Staff parity');
  }

  // --- PWD Parity ---
  findPwdParity(query: QueryParityDto) {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadPwdParityData> = {};
    if (query.academic_year) where.academicYear = query.academic_year;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.pwdRepo, where, page, limit);
  }

  async createPwdParity(dto: CreatePwdParityDto, userId: string) {
    const entity = this.pwdRepo.create({
      academicYear: dto.academic_year,
      pwdCategory: dto.pwd_category,
      subcategory: dto.subcategory,
      totalBeneficiaries: dto.total_beneficiaries ?? 0,
      maleCount: dto.male_count ?? 0,
      femaleCount: dto.female_count ?? 0,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(`GAD_PARITY_CREATED: pwd, id=${entity.id}, by=${userId}`);
    return entity;
  }

  async updatePwdParity(
    id: string,
    dto: Partial<CreatePwdParityDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(this.pwdRepo, id, 'PWD parity');
    if (dto.academic_year !== undefined)
      entity.academicYear = dto.academic_year;
    if (dto.pwd_category !== undefined) entity.pwdCategory = dto.pwd_category;
    if (dto.subcategory !== undefined) entity.subcategory = dto.subcategory;
    if (dto.total_beneficiaries !== undefined)
      entity.totalBeneficiaries = dto.total_beneficiaries;
    if (dto.male_count !== undefined) entity.maleCount = dto.male_count;
    if (dto.female_count !== undefined) entity.femaleCount = dto.female_count;
    await this.em.flush();
    this.logger.log(`GAD_PARITY_UPDATED: pwd, id=${id}, by=${userId}`);
    return entity;
  }

  removePwdParity(id: string) {
    return this.softDelete(this.pwdRepo, id, 'PWD parity');
  }
  reviewPwdParity(id: string, dto: ReviewParityDto, userId: string) {
    return this.reviewEntity(this.pwdRepo, id, dto, userId, 'PWD parity');
  }

  // --- Indigenous Parity ---
  findIndigenousParity(query: QueryParityDto) {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadIndigenousParityData> = {};
    if (query.academic_year) where.academicYear = query.academic_year;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.indigenousRepo, where, page, limit);
  }

  async createIndigenousParity(dto: CreateIndigenousParityDto, userId: string) {
    const entity = this.indigenousRepo.create({
      academicYear: dto.academic_year,
      indigenousCategory: dto.indigenous_category,
      subcategory: dto.subcategory,
      totalParticipants: dto.total_participants ?? 0,
      maleCount: dto.male_count ?? 0,
      femaleCount: dto.female_count ?? 0,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `GAD_PARITY_CREATED: indigenous, id=${entity.id}, by=${userId}`,
    );
    return entity;
  }

  async updateIndigenousParity(
    id: string,
    dto: Partial<CreateIndigenousParityDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(
      this.indigenousRepo,
      id,
      'Indigenous parity',
    );
    if (dto.academic_year !== undefined)
      entity.academicYear = dto.academic_year;
    if (dto.indigenous_category !== undefined)
      entity.indigenousCategory = dto.indigenous_category;
    if (dto.subcategory !== undefined) entity.subcategory = dto.subcategory;
    if (dto.total_participants !== undefined)
      entity.totalParticipants = dto.total_participants;
    if (dto.male_count !== undefined) entity.maleCount = dto.male_count;
    if (dto.female_count !== undefined) entity.femaleCount = dto.female_count;
    await this.em.flush();
    this.logger.log(`GAD_PARITY_UPDATED: indigenous, id=${id}, by=${userId}`);
    return entity;
  }

  removeIndigenousParity(id: string) {
    return this.softDelete(this.indigenousRepo, id, 'Indigenous parity');
  }
  reviewIndigenousParity(id: string, dto: ReviewParityDto, userId: string) {
    return this.reviewEntity(
      this.indigenousRepo,
      id,
      dto,
      userId,
      'Indigenous parity',
    );
  }

  // --- GPB Accomplishments ---
  findGpbAccomplishments(
    query: QueryPlanningDto,
  ): Promise<PaginatedResponse<GadGpbAccomplishment>> {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadGpbAccomplishment> = {};
    if (query.year) where.year = query.year;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.gpbRepo, where, page, limit);
  }

  async createGpbAccomplishment(
    dto: CreateGpbAccomplishmentDto,
    userId: string,
  ) {
    const entity = this.gpbRepo.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      priority: dto.priority,
      status: dto.status,
      targetBeneficiaries: dto.target_beneficiaries,
      actualBeneficiaries: dto.actual_beneficiaries,
      targetBudget:
        dto.target_budget != null ? String(dto.target_budget) : undefined,
      actualBudget:
        dto.actual_budget != null ? String(dto.actual_budget) : undefined,
      year: dto.year,
      responsible: dto.responsible,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(
      `GPB_ACCOMPLISHMENT_CREATED: id=${entity.id}, by=${userId}`,
    );
    return entity;
  }

  async updateGpbAccomplishment(
    id: string,
    dto: Partial<CreateGpbAccomplishmentDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(
      this.gpbRepo,
      id,
      'GPB accomplishment',
    );
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.priority !== undefined) entity.priority = dto.priority;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.target_beneficiaries !== undefined)
      entity.targetBeneficiaries = dto.target_beneficiaries;
    if (dto.actual_beneficiaries !== undefined)
      entity.actualBeneficiaries = dto.actual_beneficiaries;
    if (dto.target_budget !== undefined)
      entity.targetBudget =
        dto.target_budget != null ? String(dto.target_budget) : undefined;
    if (dto.actual_budget !== undefined)
      entity.actualBudget =
        dto.actual_budget != null ? String(dto.actual_budget) : undefined;
    if (dto.year !== undefined) entity.year = dto.year;
    if (dto.responsible !== undefined) entity.responsible = dto.responsible;
    await this.em.flush();
    this.logger.log(`GPB_ACCOMPLISHMENT_UPDATED: id=${id}, by=${userId}`);
    return entity;
  }

  // --- Budget Plans ---
  findBudgetPlans(
    query: QueryPlanningDto,
  ): Promise<PaginatedResponse<GadBudgetPlan>> {
    const { page = 1, limit = 20 } = query;
    const where: FilterQuery<GadBudgetPlan> = {};
    if (query.year) where.year = query.year;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    return this.findAllWithPagination(this.budgetRepo, where, page, limit);
  }

  async createBudgetPlan(dto: CreateBudgetPlanDto, userId: string) {
    const entity = this.budgetRepo.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      priority: dto.priority,
      status: dto.status,
      budgetAllocated:
        dto.budget_allocated != null ? String(dto.budget_allocated) : undefined,
      budgetUtilized:
        dto.budget_utilized != null ? String(dto.budget_utilized) : undefined,
      targetBeneficiaries: dto.target_beneficiaries,
      startDate: dto.start_date ? new Date(dto.start_date) : undefined,
      endDate: dto.end_date ? new Date(dto.end_date) : undefined,
      year: dto.year,
      responsible: dto.responsible,
      submittedBy: userId,
    });
    await this.em.persist(entity).flush();
    this.logger.log(`BUDGET_PLAN_CREATED: id=${entity.id}, by=${userId}`);
    return entity;
  }

  async updateBudgetPlan(
    id: string,
    dto: Partial<CreateBudgetPlanDto>,
    userId: string,
  ) {
    const entity = await this.findOneOrFail(this.budgetRepo, id, 'Budget plan');
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.priority !== undefined) entity.priority = dto.priority;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.budget_allocated !== undefined)
      entity.budgetAllocated =
        dto.budget_allocated != null ? String(dto.budget_allocated) : undefined;
    if (dto.budget_utilized !== undefined)
      entity.budgetUtilized =
        dto.budget_utilized != null ? String(dto.budget_utilized) : undefined;
    if (dto.target_beneficiaries !== undefined)
      entity.targetBeneficiaries = dto.target_beneficiaries;
    if (dto.start_date !== undefined)
      entity.startDate = dto.start_date ? new Date(dto.start_date) : undefined;
    if (dto.end_date !== undefined)
      entity.endDate = dto.end_date ? new Date(dto.end_date) : undefined;
    if (dto.year !== undefined) entity.year = dto.year;
    if (dto.responsible !== undefined) entity.responsible = dto.responsible;
    await this.em.flush();
    this.logger.log(`BUDGET_PLAN_UPDATED: id=${id}, by=${userId}`);
    return entity;
  }
}
