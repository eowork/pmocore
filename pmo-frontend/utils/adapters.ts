/**
 * Data Adapters - Backend DTO → Frontend UI transformation
 *
 * Per research_summary.md Section 16 (Gap Re-Classification):
 * These adapters resolve field naming mismatches between backend DTOs
 * and frontend UI expectations without requiring backend changes.
 */

// Publication status type for draft governance
export type PublicationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'

// HHH-E: Recursive folder tree node (backed by construction_document_folders table)
// nodeType values must match backend DTO: CONTAINER | FORM | TEMPLATE | SUBMISSIONS
export interface FolderNode {
  id: string
  projectId: string
  parentId: string | null
  folderName: string
  groupCode: string | null
  nodeType: 'CONTAINER' | 'FORM' | 'TEMPLATE' | 'SUBMISSIONS' | string
  sortOrder: number
  children: FolderNode[]
  createdAt: string
  updatedAt: string
}

// Approval metadata interface for draft governance workflow
export interface ApprovalMetadata {
  createdBy: string | null
  createdByName: string | null
  createdAt: string | null
  submittedBy: string | null
  submittedByName: string | null
  submittedAt: string | null
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNotes: string | null
}

// Types matching backend DTOs (flat fields from SQL JOIN)
export interface BackendProject {
  id: string
  title: string
  campus?: string
  status: string
  contract_amount?: number
  physical_progress?: number
  funding_source_id?: string
  funding_source_name?: string
  // AAAK: Two-Level Funding
  primary_funding_source?: string
  funding_source_description?: string
  contractor_id?: string
  contractor_name?: string
  start_date?: string
  end_date?: string
  // LLL-C: list endpoint now also returns these for advanced index filtering
  project_code?: string
  original_start_date?: string
  revised_start_date?: string
  original_completion_date?: string
  revised_completion_date?: string
  project_duration?: string
  publication_status?: PublicationStatus
  created_by?: string
  created_by_name?: string
  created_at: string
  updated_at: string
  // Approval metadata fields
  submitted_by?: string
  submitted_by_name?: string
  submitted_at?: string
  reviewed_by?: string
  reviewed_by_name?: string
  reviewed_at?: string
  review_notes?: string
  // Phase AE: Record-level delegation (legacy single)
  assigned_to?: string
  assigned_to_name?: string
  // Phase AW: Multi-select assignment
  assigned_users?: {
    id: string
    name: string
    email?: string | null
    role?: string | null
    department?: string | null
    phone?: string | null
    personnel_category?: string | null
    project_role?: string | null
    permissions?: Record<string, any> | null
    user_role?: string | null
  }[]
}

export interface BackendUser {
  id: string
  email: string
  first_name: string
  last_name: string
  is_superadmin: boolean
  permissions: string[]
  module_overrides?: Record<string, boolean>
  module_levels?: Record<string, string>  // PHASE BBBC: per-module CRUD level
  module_assignments?: string[]
  pillar_assignments?: string[]  // Phase HN: pillar-based tab access
  rank_level?: number
  campus?: string  // Phase Y: Office-scoped visibility
  role?: { name: string }
  // NNN-F/H: surfaced from /api/auth/me for avatar + profile page
  avatar_url?: string
  phone?: string
  display_name?: string
  // PHASE BBBD (Track 3): unified profile fields
  username?: string
  position?: string
  office?: string
  last_login_at?: string
  last_password_change_at?: string
  is_sso?: boolean
  must_change_password?: boolean  // PHASE BBBC: forced first-login change
  profile_completed?: boolean  // PHASE BBBD: first-login onboarding
}

// Frontend UI-expected shapes
export interface UIProject {
  id: string
  projectName: string
  campus: string
  status: string
  totalContractAmount: number
  physicalAccomplishment: number
  fundSource: string
  // AAAK: Two-Level Funding — Level 1 (controlled category) + Level 2 (free-text description)
  primaryFundingSource: string
  fundingSourceDescription: string
  contractor: string
  startDate: string
  endDate: string
  // LLL-C: surfaced on the list type for advanced index filtering
  projectCode: string
  originalStartDate: string
  revisedStartDate: string
  originalCompletionDate: string
  revisedCompletionDate: string
  projectDuration: string
  publicationStatus: PublicationStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  approvalMetadata: ApprovalMetadata
  // Phase AE: Record-level delegation (legacy)
  delegatedTo: string
  delegatedToName: string
  // Phase AW: Multi-select assignment
  assignedUsers: {
    id: string
    name: string
    email?: string | null
    role?: string | null
    department?: string | null
    phone?: string | null
    personnelCategory?: string | null
    personnel_category?: string | null
    projectRole?: string | null
    permissions?: Record<string, any> | null
  }[]
}

export interface UIUser {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  isSuperAdmin: boolean
  permissions: string[]
  moduleOverrides: Record<string, boolean>
  moduleLevels: Record<string, string>  // PHASE BBBC: per-module CRUD level
  moduleAssignments: string[]
  pillarAssignments: string[]  // Phase HN: pillar-based tab access
  rankLevel: number
  campus: string  // Phase Y: Office-scoped visibility
  roleName: string
  // NNN-F/H: avatar + profile fields
  avatarUrl: string
  phone: string
  displayName: string
  lastLoginAt: string
  lastPasswordChangeAt: string
  isSso: boolean
  mustChangePassword: boolean  // PHASE BBBC: forced first-login change
  profileCompleted: boolean  // PHASE BBBD: first-login onboarding
  // PHASE BBBD (Track 3): unified profile fields
  username: string
  position: string
  office: string
}

/**
 * Transform backend project DTO to frontend UI shape
 */
export function adaptProject(backend: BackendProject): UIProject {
  return {
    id: backend.id,
    projectName: backend.title,
    campus: backend.campus || '',
    status: backend.status,
    totalContractAmount: Number(backend.contract_amount) || 0,
    physicalAccomplishment: Number(backend.physical_progress) || 0,
    fundSource: backend.funding_source_name || '',
    // AAAK: Two-Level Funding
    primaryFundingSource: backend.primary_funding_source || '',
    fundingSourceDescription: backend.funding_source_description || '',
    contractor: backend.contractor_name || '',
    startDate: backend.start_date || '',
    endDate: backend.end_date || '',
    // LLL-C: list-level fields for advanced index filtering
    projectCode: backend.project_code || '',
    originalStartDate: backend.original_start_date || '',
    revisedStartDate: backend.revised_start_date || '',
    originalCompletionDate: backend.original_completion_date || '',
    revisedCompletionDate: backend.revised_completion_date || '',
    projectDuration: backend.project_duration || '',
    publicationStatus: backend.publication_status || 'PUBLISHED',
    createdBy: backend.created_by || '',
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    approvalMetadata: {
      createdBy: backend.created_by || null,
      createdByName: backend.created_by_name || null,
      createdAt: backend.created_at || null,
      submittedBy: backend.submitted_by || null,
      submittedByName: backend.submitted_by_name || null,
      submittedAt: backend.submitted_at || null,
      reviewedBy: backend.reviewed_by || null,
      reviewedByName: backend.reviewed_by_name || null,
      reviewedAt: backend.reviewed_at || null,
      reviewNotes: backend.review_notes || null,
    },
    // Phase AE: Record-level delegation (legacy)
    delegatedTo: backend.assigned_to || '',
    delegatedToName: backend.assigned_to_name || '',
    // Phase AW: Multi-select assignment
    assignedUsers: backend.assigned_users || [],
  }
}

/**
 * Transform array of backend projects
 */
export function adaptProjects(backendProjects: BackendProject[]): UIProject[] {
  return backendProjects.map(adaptProject)
}

/**
 * Transform backend user DTO to frontend UI shape
 */
export function adaptUser(backend: BackendUser): UIUser {
  return {
    id: backend.id,
    email: backend.email,
    firstName: backend.first_name,
    lastName: backend.last_name,
    fullName: `${backend.first_name} ${backend.last_name}`,
    isSuperAdmin: backend.is_superadmin,
    permissions: backend.permissions || [],
    moduleOverrides: backend.module_overrides || {},
    moduleLevels: backend.module_levels || {},
    moduleAssignments: backend.module_assignments || [],
    pillarAssignments: backend.pillar_assignments || [],
    rankLevel: backend.rank_level ?? 100,
    campus: backend.campus || '',  // Phase Y: Office-scoped visibility
    roleName: backend.role?.name || '',
    // NNN-F/H: avatar + profile fields
    avatarUrl: backend.avatar_url || '',
    phone: backend.phone || '',
    displayName: backend.display_name || '',
    lastLoginAt: backend.last_login_at || '',
    lastPasswordChangeAt: backend.last_password_change_at || '',
    isSso: backend.is_sso ?? false,
    mustChangePassword: backend.must_change_password ?? false,
    profileCompleted: backend.profile_completed ?? true,
    username: backend.username || '',
    position: backend.position || '',
    office: backend.office || '',
  }
}

/**
 * Transform frontend UI project back to backend DTO for POST/PUT
 */
export function reverseAdaptProject(ui: Partial<UIProject>): Partial<BackendProject> {
  const result: Partial<BackendProject> = {}

  if (ui.projectName !== undefined) result.title = ui.projectName
  if (ui.status !== undefined) result.status = ui.status
  if (ui.totalContractAmount !== undefined) result.contract_amount = ui.totalContractAmount
  if (ui.physicalAccomplishment !== undefined) result.physical_progress = ui.physicalAccomplishment
  if (ui.startDate !== undefined) result.start_date = ui.startDate
  if (ui.endDate !== undefined) result.end_date = ui.endDate

  return result
}

// ============================================================
// CONSTRUCTION PROJECT DETAIL (Full DTO)
// ============================================================

export interface BackendProjectDetail extends BackendProject {
  project_code: string
  description?: string
  beneficiaries?: number | string | null
  summary?: string | null
  scope?: string | null
  facilities?: string | null
  objectives?: string[]
  key_features?: string[]
  contract_number?: string
  target_completion_date?: string
  actual_completion_date?: string
  project_duration?: string
  project_engineer?: string
  project_manager?: string
  building_type?: string
  floor_area?: number
  number_of_floors?: number
  latitude?: number
  longitude?: number
  original_contract_duration?: string
  // MG: Location
  spatial_coverage?: string
  municipality?: string
  province?: string
  // MG: Implementation agencies (additional)
  co_implementing_agency?: string
  attached_agency?: string
  // MG: Funding + beneficiaries
  additional_funding_sources?: { type: string; name: string; notes?: string }[]
  beneficiary_list?: string[]
  // MH: Revision orders
  original_start_date?: string
  revised_start_date?: string
  original_completion_date?: string
  revised_completion_date?: string
  revised_project_duration?: string
  // MI: Progress snapshot
  as_of_date?: string
  cost_incurred_to_date?: number | null
  cost_incurred_this_period?: number | null
  date_completed?: string
  remarks_log?: { text: string; author?: string; created_at?: string }[]
  physical_progress?: number
  financial_progress?: number
  target_physical_progress?: number
  target_financial_progress?: number
  subcategory?: { id: string; name: string }
  milestones?: BackendMilestone[]
  financials?: BackendFinancial[]
  // AAA-A: latest-first progress reports (nested by findOne) — source of cost_incurred_this_period
  progress_reports?: Array<{
    id: string
    cost_incurred_this_period?: string | number | null
    cost_incurred_to_date?: string | number | null
    report_date?: string
    report_number?: string | null
  }>
  // KC-C: Project Profile fields
  strategic_alignment?: string
  output_indicators?: string[]
  outcome_indicators?: string[]
  implementing_agency?: string
  project_status_category?: string
  status_updates?: Record<string, any>[]
  readiness_documents?: Record<string, any>[]
  signatories?: Record<string, any>[]
  // LA-A: monitoring fields added to BackendProjectDetail (were missing, causing TypeScript errors)
  document_checklist_remarks?: Record<string, string>
  custom_key_sections?: { id: string; label: string; typeCode: string }[]
  custom_supporting_sections?: { id: string; label: string; typeCode: string }[]
  incident_log?: Record<string, any>[]
  // XXX-M: risk_register/escalation_records removed — Project Governance section removed
  // OU-A: strategic planning arrays
  rdp_alignment?: any[]
  socioeconomic_agenda?: any[]
  csu_likha_goals?: any[]
  sdg_goals?: string[]
  // XXX-K: Historical Planning Frameworks (2017-2022) + Implementation Period
  rdp2017_alignment?: any[]
  point_agenda_10?: any[]
  implementation_period?: string
  personnel_groups?: {
    csu?: { name: string; position: string; role: string }[]
    contractor?: { name: string; position: string; company: string }[]
    others?: { name: string; position: string; affiliation: string }[]
  } | null
}

export interface BackendMilestone {
  id: string
  title: string
  description?: string
  targetDate?: string
  actualDate?: string
  status: string
  remarks?: string
  createdAt?: string
  startDate?: string
  actualStartDate?: string
  progress?: string | number
  category?: string
}

export interface BackendFinancial {
  id: string
  projectId: string
  fiscalYear: number
  appropriation: string
  obligation: string
  disbursement: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export interface BackendGalleryItem {
  id: string
  projectId: string
  imageUrl: string
  caption?: string
  category: string
  isFeatured: boolean
  uploadedAt: string
  // LB-C: user-supplied photo capture date (may come as snake_case or camelCase)
  image_taken_date?: string
  imageTakenDate?: string
}

export interface UIProjectDetail extends UIProject {
  projectCode: string
  description: string
  beneficiaries: number | null
  summary: string
  scope: string
  facilities: string
  objectives: string[]
  keyFeatures: string[]
  contractNumber: string
  targetCompletionDate: string
  actualCompletionDate: string
  projectDuration: string
  originalContractDuration: string
  // MG: Location
  spatialCoverage: string
  municipality: string
  province: string
  // MG: Implementation agencies (additional)
  coImplementingAgency: string
  attachedAgency: string
  // MG: Funding + beneficiaries
  additionalFundingSources: { type: string; name: string; notes?: string }[]
  beneficiaryList: string[]
  // MH: Revision orders
  originalStartDate: string
  revisedStartDate: string
  originalCompletionDate: string
  revisedCompletionDate: string
  revisedProjectDuration: string
  // MI: Progress snapshot
  asOfDate: string
  costIncurredToDate: number | null
  costIncurredThisPeriod: number | null
  // AAA-A: source reference for the latest progress report (analytics drill-down)
  latestProgressReportId: string | null
  latestProgressReportDate: string | null
  dateCompleted: string
  remarksLog: { text: string; author?: string; createdAt?: string }[]
  projectEngineer: string
  projectManager: string
  buildingType: string
  floorArea: number
  numberOfFloors: number
  latitude: number | null
  longitude: number | null
  physicalProgress: number
  financialProgress: number
  targetPhysicalProgress: number
  targetFinancialProgress: number
  subcategory: string
  milestones: UIMilestone[]
  financials: UIFinancial[]
  gallery: UIGalleryItem[]
  // KC-C: Project Profile fields
  strategicAlignment: string
  outputIndicators: string[]
  outcomeIndicators: string[]
  rdpAlignment: any[]
  socioeconomicAgenda: any[]
  csuLikhaGoals: any[]
  sdgGoals: string[]
  // XXX-K: Historical Planning Frameworks (2017-2022) + Implementation Period
  rdp2017Alignment: any[]
  pointAgenda10: any[]
  implementationPeriod: string
  implementingAgency: string
  projectStatusCategory: string
  statusUpdates: Record<string, any>[]
  readinessDocuments: Record<string, any>[]
  signatories: Record<string, any>[]
  documentChecklistRemarks: Record<string, string>
  customKeySections: { id: string; label: string; typeCode: string }[]
  customSupportingSections: { id: string; label: string; typeCode: string }[]
  incidentLog: Record<string, any>[]
  // XXX-M: riskRegister/escalationRecords removed — Project Governance section removed
  projectNotesBanking: {
    additionalNotes?: string
    projectReferences?: { label: string; url?: string; notes?: string }[]
    specialInstructions?: string
    historicalReferences?: { date: string; description: string }[]
    customMetadata?: Record<string, string>
    // ZZZ-D Extension: lightweight construction-project support functions
    lessonsLearned?: { phase: string; observation: string; recommendation: string; addedBy?: string; addedAt?: string }[]
    siteObservations?: { date: string; observer: string; observation: string; location?: string; actionRequired: boolean }[]
  } | null
  personnelGroups: {
    csu: { name: string; position: string; role: string }[]
    contractor: { name: string; position: string; company: string }[]
    others: { name: string; position: string; affiliation: string }[]
  }
}

export interface UIMilestone {
  id: string
  name: string
  description: string
  targetDate: string
  actualDate: string
  status: string
  remarks: string
  startDate: string
  actualStartDate: string
  progress: number
  category: string
}

export interface UIFinancial {
  id: string
  fiscalYear: number
  appropriation: number
  obligation: number
  disbursement: number
  utilizationRate: number
  disbursementRate: number
}

export interface UIGalleryItem {
  id: string
  imageUrl: string
  caption: string
  category: string
  isFeatured: boolean
  uploadedAt: string
  // LB-C: user-supplied photo capture date
  imageTakenDate?: string
}

export function adaptProjectDetail(backend: BackendProjectDetail): UIProjectDetail {
  return {
    ...adaptProject(backend),
    projectCode: backend.project_code || '',
    description: backend.description || '',
    beneficiaries: backend.beneficiaries == null || backend.beneficiaries === ''
      ? null
      : Number(backend.beneficiaries),
    summary: backend.summary || '',
    scope: backend.scope || '',
    facilities: backend.facilities || '',
    objectives: backend.objectives || [],
    keyFeatures: backend.key_features || [],
    contractNumber: backend.contract_number || '',
    targetCompletionDate: backend.target_completion_date || '',
    actualCompletionDate: backend.actual_completion_date || '',
    projectDuration: backend.project_duration || '',
    originalContractDuration: backend.original_contract_duration || '',
    spatialCoverage: backend.spatial_coverage || '',
    municipality: backend.municipality || '',
    province: backend.province || '',
    coImplementingAgency: backend.co_implementing_agency || '',
    attachedAgency: backend.attached_agency || '',
    additionalFundingSources: backend.additional_funding_sources || [],
    beneficiaryList: backend.beneficiary_list || [],
    originalStartDate: backend.original_start_date || '',
    revisedStartDate: backend.revised_start_date || '',
    originalCompletionDate: backend.original_completion_date || '',
    revisedCompletionDate: backend.revised_completion_date || '',
    revisedProjectDuration: backend.revised_project_duration || '',
    asOfDate: backend.as_of_date || '',
    costIncurredToDate: backend.cost_incurred_to_date ?? null,
    // CCC-A: progress_reports are MikroORM entities (camelCase) at runtime, not snake_case.
    // Read camelCase first, snake_case as fallback (covers both ORM and any future raw-SQL path).
    costIncurredThisPeriod: (() => {
      const r0 = Array.isArray(backend.progress_reports) && backend.progress_reports.length > 0
        ? (backend.progress_reports[0] as any)
        : null
      const val = r0?.costIncurredThisPeriod ?? r0?.cost_incurred_this_period
      return val != null ? Number(val) : null
    })(),
    latestProgressReportId: (() => {
      const r0 = Array.isArray(backend.progress_reports) && backend.progress_reports.length > 0
        ? (backend.progress_reports[0] as any)
        : null
      return r0?.id ?? null
    })(),
    latestProgressReportDate: (() => {
      const r0 = Array.isArray(backend.progress_reports) && backend.progress_reports.length > 0
        ? (backend.progress_reports[0] as any)
        : null
      if (!r0) return null
      // MikroORM returns reportDate as a JS Date object; raw-SQL path returns a string
      const d = r0.reportDate ?? r0.report_date
      return d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null
    })(),
    dateCompleted: backend.date_completed || '',
    remarksLog: (backend.remarks_log || []).map((r: any) => ({
      text: r.text || '',
      author: r.author || r.updated_by || '',
      createdAt: r.created_at || r.createdAt || '',
    })),
    projectEngineer: backend.project_engineer || '',
    projectManager: backend.project_manager || '',
    buildingType: backend.building_type || '',
    floorArea: backend.floor_area || 0,
    numberOfFloors: backend.number_of_floors || 0,
    latitude: typeof backend.latitude === 'number' ? backend.latitude : (backend.latitude ? Number(backend.latitude) : null),
    longitude: typeof backend.longitude === 'number' ? backend.longitude : (backend.longitude ? Number(backend.longitude) : null),
    physicalProgress: typeof backend.physical_progress === 'number' ? backend.physical_progress : Number(backend.physical_progress || 0),
    financialProgress: typeof backend.financial_progress === 'number' ? backend.financial_progress : Number(backend.financial_progress || 0),
    targetPhysicalProgress: typeof backend.target_physical_progress === 'number' ? backend.target_physical_progress : Number(backend.target_physical_progress || 100),
    targetFinancialProgress: typeof backend.target_financial_progress === 'number' ? backend.target_financial_progress : Number(backend.target_financial_progress || 100),
    subcategory: backend.subcategory?.name || '',
    milestones: (backend.milestones || []).map(adaptMilestone),
    financials: (backend.financials || []).map(adaptFinancial),
    gallery: [],
    strategicAlignment: backend.strategic_alignment || '',
    outputIndicators: backend.output_indicators || [],
    outcomeIndicators: backend.outcome_indicators || [],
    rdpAlignment: backend.rdp_alignment || [],
    socioeconomicAgenda: backend.socioeconomic_agenda || [],
    csuLikhaGoals: backend.csu_likha_goals || [],
    sdgGoals: backend.sdg_goals || [],
    rdp2017Alignment: backend.rdp2017_alignment || [],
    pointAgenda10: backend.point_agenda_10 || [],
    implementationPeriod: backend.implementation_period || '',
    implementingAgency: backend.implementing_agency || '',
    projectStatusCategory: backend.project_status_category || '',
    statusUpdates: (backend.status_updates || []).filter((r: any) => r && typeof r === 'object' && !Array.isArray(r)),
    readinessDocuments: (backend.readiness_documents || []).filter((r: any) => r && typeof r === 'object' && !Array.isArray(r)),
    signatories: (backend.signatories || []).filter((r: any) => r && typeof r === 'object' && !Array.isArray(r)),
    documentChecklistRemarks: backend.document_checklist_remarks || {},
    customKeySections: backend.custom_key_sections || [],
    customSupportingSections: backend.custom_supporting_sections || [],
    // KY-B2: filter out non-object items (guards against [[]] double-wrap corruption)
    incidentLog: (backend.incident_log || []).filter((r: any) => r && typeof r === 'object' && !Array.isArray(r)),
    // XXX-M: riskRegister/escalationRecords removed — Project Governance section removed
    projectNotesBanking: (backend as any).project_notes_banking || null,
    personnelGroups: {
      csu: (backend.personnel_groups?.csu || []) as { name: string; position: string; role: string }[],
      contractor: (backend.personnel_groups?.contractor || []) as { name: string; position: string; company: string }[],
      others: (backend.personnel_groups?.others || []) as { name: string; position: string; affiliation: string }[],
    },
  }
}

export function adaptMilestone(backend: BackendMilestone): UIMilestone {
  return {
    id: backend.id,
    name: backend.title || '',
    description: backend.description || '',
    targetDate: backend.targetDate || '',
    actualDate: backend.actualDate || '',
    status: backend.status || 'PENDING',
    remarks: backend.remarks || '',
    startDate: backend.startDate || '',
    actualStartDate: backend.actualStartDate || '',
    progress: backend.progress != null ? Number(backend.progress) : 0,
    category: backend.category || '',
  }
}

export function adaptFinancial(backend: BackendFinancial): UIFinancial {
  const appropriation = parseFloat(backend.appropriation || '0')
  const obligation = parseFloat(backend.obligation || '0')
  const disbursement = parseFloat(backend.disbursement || '0')
  return {
    id: backend.id,
    fiscalYear: backend.fiscalYear,
    appropriation,
    obligation,
    disbursement,
    utilizationRate: appropriation > 0 ? (obligation / appropriation) * 100 : 0,
    disbursementRate: obligation > 0 ? (disbursement / obligation) * 100 : 0,
  }
}

// Prepends apiBase to backend-relative asset paths (/uploads/, /templates/).
// In dev mode apiBase is '' so devProxy continues to handle them.
// In Docker production apiBase is 'http://localhost:3000' (set via NUXT_PUBLIC_API_BASE).
export function qualifyBackendUrl(path: string | null | undefined, apiBase: string): string {
  if (!path) return ''
  if (path.startsWith('/uploads/') || path.startsWith('/templates/')) {
    return `${apiBase}${path}`
  }
  return path
}

export function adaptGalleryItem(backend: BackendGalleryItem, apiBase = ''): UIGalleryItem {
  return {
    id: backend.id,
    imageUrl: qualifyBackendUrl(backend.imageUrl, apiBase),
    caption: backend.caption || '',
    category: backend.category || 'IN_PROGRESS',
    isFeatured: backend.isFeatured || false,
    uploadedAt: backend.uploadedAt || '',
    // LB-C: accept either snake_case (raw SQL result) or camelCase (ORM result)
    imageTakenDate: backend.imageTakenDate ?? backend.image_taken_date ?? undefined,
  }
}

// ============================================================
// UNIVERSITY OPERATIONS
// ============================================================

export interface BackendUniversityOperation {
  id: string
  operation_code: string
  title: string
  description?: string
  operation_type: string
  campus: string
  academic_year: string
  semester?: string
  status: string
  start_date?: string
  end_date?: string
  target_value?: number
  actual_value?: number
  budget_allocated?: number
  budget_utilized?: number
  publication_status?: PublicationStatus
  created_by?: string
  created_by_name?: string
  created_at: string
  updated_at: string
  // Approval metadata fields
  submitted_by?: string
  submitted_by_name?: string
  submitted_at?: string
  reviewed_by?: string
  reviewed_by_name?: string
  reviewed_at?: string
  review_notes?: string
  // Phase AE: Record-level delegation (legacy single)
  assigned_to?: string
  assigned_to_name?: string
  // Phase AW: Multi-select assignment
  assigned_users?: { id: string; name: string; role?: string | null; department?: string | null; phone?: string | null }[]
}

export interface UIUniversityOperation {
  id: string
  operationCode: string
  title: string
  description: string
  operationType: string
  campus: string
  academicYear: string
  semester: string
  status: string
  startDate: string
  endDate: string
  targetValue: number
  actualValue: number
  budgetAllocated: number
  budgetUtilized: number
  publicationStatus: PublicationStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  approvalMetadata: ApprovalMetadata
  // Phase AE: Record-level delegation (legacy)
  delegatedTo: string
  delegatedToName: string
  // Phase AW: Multi-select assignment
  assignedUsers: { id: string; name: string; role?: string | null; department?: string | null; phone?: string | null }[]
}

export function adaptUniversityOperation(backend: BackendUniversityOperation): UIUniversityOperation {
  return {
    id: backend.id,
    operationCode: backend.operation_code,
    title: backend.title,
    description: backend.description || '',
    operationType: backend.operation_type,
    campus: backend.campus,
    academicYear: backend.academic_year,
    semester: backend.semester || '',
    status: backend.status,
    startDate: backend.start_date || '',
    endDate: backend.end_date || '',
    targetValue: backend.target_value || 0,
    actualValue: backend.actual_value || 0,
    budgetAllocated: backend.budget_allocated || 0,
    budgetUtilized: backend.budget_utilized || 0,
    publicationStatus: backend.publication_status || 'PUBLISHED',
    createdBy: backend.created_by || '',
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    approvalMetadata: {
      createdBy: backend.created_by || null,
      createdByName: backend.created_by_name || null,
      createdAt: backend.created_at || null,
      submittedBy: backend.submitted_by || null,
      submittedByName: backend.submitted_by_name || null,
      submittedAt: backend.submitted_at || null,
      reviewedBy: backend.reviewed_by || null,
      reviewedByName: backend.reviewed_by_name || null,
      reviewedAt: backend.reviewed_at || null,
      reviewNotes: backend.review_notes || null,
    },
    // Phase AE: Record-level delegation (legacy)
    delegatedTo: backend.assigned_to || '',
    delegatedToName: backend.assigned_to_name || '',
    // Phase AW: Multi-select assignment
    assignedUsers: backend.assigned_users || [],
  }
}

export function adaptUniversityOperations(backendOps: BackendUniversityOperation[]): UIUniversityOperation[] {
  return backendOps.map(adaptUniversityOperation)
}

// ============================================================
// REPAIR PROJECTS
// ============================================================

export interface BackendRepairProject {
  id: string
  project_code: string
  title: string
  description?: string
  location: string
  campus: string
  urgency_level: string
  status: string
  reported_date?: string
  inspection_date?: string
  approval_date?: string
  start_date?: string
  end_date?: string
  budget?: number
  actual_cost?: number
  created_by?: string
  created_by_name?: string
  // Approval metadata fields
  submitted_by?: string
  submitted_by_name?: string
  submitted_at?: string
  reviewed_by?: string
  reviewed_by_name?: string
  reviewed_at?: string
  review_notes?: string
  reported_by?: string
  assigned_technician?: string
  physical_progress?: number
  financial_progress?: number
  publication_status?: PublicationStatus
  created_at: string
  updated_at: string
  // Phase AE: Record-level delegation (legacy single)
  assigned_to?: string
  assigned_to_name?: string
  // Phase AW: Multi-select assignment
  assigned_users?: { id: string; name: string; role?: string | null; department?: string | null; phone?: string | null }[]
}

export interface UIRepairProject {
  id: string
  repairCode: string
  title: string
  description: string
  location: string
  campus: string
  urgencyLevel: string
  status: string
  reportedDate: string
  inspectionDate: string
  approvalDate: string
  startDate: string
  completionDate: string
  estimatedCost: number
  actualCost: number
  reportedBy: string
  assignedTo: string
  physicalProgress: number
  financialProgress: number
  publicationStatus: PublicationStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  approvalMetadata: ApprovalMetadata
  // Phase AE: Record-level delegation (legacy)
  delegatedTo: string
  delegatedToName: string
  // Phase AW: Multi-select assignment
  assignedUsers: { id: string; name: string; role?: string | null; department?: string | null; phone?: string | null }[]
}

export function adaptRepairProject(backend: BackendRepairProject): UIRepairProject {
  return {
    id: backend.id,
    repairCode: backend.project_code,
    title: backend.title,
    description: backend.description || '',
    location: backend.location,
    campus: backend.campus,
    urgencyLevel: backend.urgency_level,
    status: backend.status,
    reportedDate: backend.reported_date || '',
    inspectionDate: backend.inspection_date || '',
    approvalDate: backend.approval_date || '',
    startDate: backend.start_date || '',
    completionDate: backend.end_date || '',
    estimatedCost: backend.budget || 0,
    actualCost: backend.actual_cost || 0,
    reportedBy: backend.reported_by || '',
    assignedTo: backend.assigned_technician || '',
    physicalProgress: Number(backend.physical_progress) || 0,
    financialProgress: Number(backend.financial_progress) || 0,
    publicationStatus: backend.publication_status || 'PUBLISHED',
    createdBy: backend.created_by || '',
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    approvalMetadata: {
      createdBy: backend.created_by || null,
      createdByName: backend.created_by_name || null,
      createdAt: backend.created_at || null,
      submittedBy: backend.submitted_by || null,
      submittedByName: backend.submitted_by_name || null,
      submittedAt: backend.submitted_at || null,
      reviewedBy: backend.reviewed_by || null,
      reviewedByName: backend.reviewed_by_name || null,
      reviewedAt: backend.reviewed_at || null,
      reviewNotes: backend.review_notes || null,
    },
    // Phase AE: Record-level delegation (legacy)
    delegatedTo: backend.assigned_to || '',
    delegatedToName: backend.assigned_to_name || '',
    // Phase AW: Multi-select assignment
    assignedUsers: backend.assigned_users || [],
  }
}

export function adaptRepairProjects(backendRepairs: BackendRepairProject[]): UIRepairProject[] {
  return backendRepairs.map(adaptRepairProject)
}

// ============================================================
// REPAIR PROJECT DETAIL (Extended with nested objects for edit forms)
// ============================================================

export interface BackendRepairProjectDetail extends BackendRepairProject {
  repair_type_id?: string
  repair_type_name?: string
  building_name?: string
  floor_number?: string
  room_number?: string
  specific_location?: string
  is_emergency?: boolean
}

export interface UIRepairDetail {
  id: string
  project_code: string
  title: string
  description: string
  building_name: string
  floor_number: string
  room_number: string
  specific_location: string
  repair_type_id: string
  urgency_level: string
  is_emergency: boolean
  campus: string
  status: string
  reported_by: string
  inspection_date: string
  start_date: string
  end_date: string
  budget: number | null
  actual_cost: number | null
  assigned_technician: string
  // Draft governance fields (for detail view)
  repairCode: string
  createdBy: string
  publicationStatus: PublicationStatus
  approvalMetadata: ApprovalMetadata
  // Phase AE: Record-level delegation (legacy)
  delegatedTo: string
  delegatedToName: string
  // Phase AW: Multi-select assignment
  assignedUsers: { id: string; name: string; role?: string | null; department?: string | null; phone?: string | null }[]
  assignedUserIds: string[]
}

/**
 * Transform backend repair detail to frontend form shape
 * Used for edit forms to extract nested object IDs
 */
export function adaptRepairDetail(backend: BackendRepairProjectDetail): UIRepairDetail {
  return {
    id: backend.id,
    project_code: backend.project_code || '',
    title: backend.title || '',
    description: backend.description || '',
    building_name: backend.building_name || backend.location || '',
    floor_number: backend.floor_number || '',
    room_number: backend.room_number || '',
    specific_location: backend.specific_location || '',
    repair_type_id: backend.repair_type_id || '',
    urgency_level: backend.urgency_level || '',
    is_emergency: backend.is_emergency || false,
    campus: backend.campus || '',
    status: backend.status || '',
    reported_by: backend.reported_by || '',
    inspection_date: backend.inspection_date ? backend.inspection_date.split('T')[0] : '',
    start_date: backend.start_date ? backend.start_date.split('T')[0] : '',
    end_date: backend.end_date ? backend.end_date.split('T')[0] : '',
    budget: backend.budget || null,
    actual_cost: backend.actual_cost || null,
    assigned_technician: backend.assigned_technician || '',
    // Draft governance fields
    repairCode: backend.project_code || '',
    createdBy: backend.created_by || '',
    publicationStatus: backend.publication_status || 'PUBLISHED',
    approvalMetadata: {
      createdBy: backend.created_by || null,
      createdByName: backend.created_by_name || null,
      createdAt: backend.created_at || null,
      submittedBy: backend.submitted_by || null,
      submittedByName: backend.submitted_by_name || null,
      submittedAt: backend.submitted_at || null,
      reviewedBy: backend.reviewed_by || null,
      reviewedByName: backend.reviewed_by_name || null,
      reviewedAt: backend.reviewed_at || null,
      reviewNotes: backend.review_notes || null,
    },
    // Phase AE: Record-level delegation (legacy)
    delegatedTo: backend.assigned_to || '',
    delegatedToName: backend.assigned_to_name || '',
    // Phase AW: Multi-select assignment
    assignedUsers: (backend as any).assigned_users || [],
    assignedUserIds: ((backend as any).assigned_users || []).map((u: { id: string }) => u.id),
  }
}

// ============================================================
// GAD PARITY
// ============================================================

export interface BackendGADParity {
  id: string
  academic_year: string
  semester: string
  campus: string
  category: string
  male_count: number
  female_count: number
  total_count: number
  parity_index?: number
  created_at: string
  updated_at: string
}

export interface UIGADParity {
  id: string
  academicYear: string
  semester: string
  campus: string
  category: string
  maleCount: number
  femaleCount: number
  totalCount: number
  parityIndex: number
  createdAt: string
  updatedAt: string
}

export function adaptGADParity(backend: BackendGADParity): UIGADParity {
  return {
    id: backend.id,
    academicYear: backend.academic_year,
    semester: backend.semester,
    campus: backend.campus,
    category: backend.category,
    maleCount: backend.male_count,
    femaleCount: backend.female_count,
    totalCount: backend.total_count,
    parityIndex: backend.parity_index || 0,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
  }
}

export function adaptGADParityList(backendList: BackendGADParity[]): UIGADParity[] {
  return backendList.map(adaptGADParity)
}

// ============================================================
// CONTRACTORS (Reference Data)
// ============================================================

export interface BackendContractor {
  id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  tin_number?: string
  registration_number?: string
  validity_date?: string
  status: string
  created_at: string
  updated_at: string
}

export interface UIContractor {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  tinNumber: string
  registrationNumber: string
  validityDate: string
  status: string
  createdAt: string
  updatedAt: string
}

export function adaptContractor(backend: BackendContractor): UIContractor {
  return {
    id: backend.id,
    name: backend.name,
    contactPerson: backend.contact_person || '',
    email: backend.email || '',
    phone: backend.phone || '',
    address: backend.address || '',
    tinNumber: backend.tin_number || '',
    registrationNumber: backend.registration_number || '',
    validityDate: backend.validity_date ? backend.validity_date.split('T')[0] : '',
    status: backend.status,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
  }
}

export function adaptContractors(backendList: BackendContractor[]): UIContractor[] {
  return backendList.map(adaptContractor)
}

export function reverseAdaptContractor(ui: Partial<UIContractor>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (ui.name !== undefined) result.name = ui.name
  if (ui.contactPerson !== undefined) result.contact_person = ui.contactPerson || undefined
  if (ui.email !== undefined) result.email = ui.email || undefined
  if (ui.phone !== undefined) result.phone = ui.phone || undefined
  if (ui.address !== undefined) result.address = ui.address || undefined
  if (ui.tinNumber !== undefined) result.tin_number = ui.tinNumber || undefined
  if (ui.registrationNumber !== undefined) result.registration_number = ui.registrationNumber || undefined
  if (ui.validityDate !== undefined) result.validity_date = ui.validityDate || undefined
  if (ui.status !== undefined) result.status = ui.status

  return result
}

// ============================================================
// FUNDING SOURCES (Reference Data)
// ============================================================

export interface BackendFundingSource {
  id: string
  name: string
  description?: string
  source_type?: string
  created_at: string
  updated_at: string
}

export interface UIFundingSource {
  id: string
  name: string
  description: string
  sourceType: string
  createdAt: string
  updatedAt: string
}

export function adaptFundingSource(backend: BackendFundingSource): UIFundingSource {
  return {
    id: backend.id,
    name: backend.name,
    description: backend.description || '',
    sourceType: backend.source_type || '',
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
  }
}

export function adaptFundingSources(backendList: BackendFundingSource[]): UIFundingSource[] {
  return backendList.map(adaptFundingSource)
}

export function reverseAdaptFundingSource(ui: Partial<UIFundingSource>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (ui.name !== undefined) result.name = ui.name
  if (ui.description !== undefined) result.description = ui.description || undefined
  if (ui.sourceType !== undefined) result.source_type = ui.sourceType || undefined

  return result
}

// ============================================================
// USERS (User Management)
// ============================================================

export interface BackendUserRole {
  id: string
  name: string
  is_superadmin: boolean
}

export interface BackendUserList {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  last_login_at?: string
  rank_level?: number
  campus?: string
  created_at: string
  updated_at: string
  roles: BackendUserRole[]
}

export interface UIUserList {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  phone: string
  avatarUrl: string
  isActive: boolean
  lastLoginAt: string
  rankLevel: number
  campus: string
  createdAt: string
  updatedAt: string
  roles: string[]
  isSuperAdmin: boolean
}

export function adaptUserList(backend: BackendUserList): UIUserList {
  const roleNames = backend.roles?.map(r => r.name) || []
  // PHASE BBBD (Track 1c): SuperAdmin = the is_superadmin flag OR rank 10 (unified with auth, R-321).
  const isSuperAdmin =
    (backend.roles?.some(r => r.is_superadmin) || false) ||
    (backend.rank_level != null && backend.rank_level <= 10)

  return {
    id: backend.id,
    email: backend.email,
    firstName: backend.first_name,
    lastName: backend.last_name,
    fullName: `${backend.first_name} ${backend.last_name}`,
    phone: backend.phone || '',
    avatarUrl: backend.avatar_url || '',
    isActive: backend.is_active,
    lastLoginAt: backend.last_login_at || '',
    rankLevel: backend.rank_level || 100,
    campus: backend.campus || '',
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    roles: roleNames,
    isSuperAdmin,
  }
}

export function adaptUsersList(backendList: BackendUserList[]): UIUserList[] {
  return backendList.map(adaptUserList)
}

// PHASE BBBD (Track 10c): shared user-management interfaces (single source per CLAUDE.md #3).
// Consumed by users/new, users/edit-[id], users/detail-[id] (replacing their inline copies).
export interface Role {
  id: string
  name: string
  description?: string
}

export interface UserRoleRef {
  id: string
  name: string
  is_superadmin: boolean
  assigned_at?: string
}

export interface UserPermissionRef {
  id: string
  name: string
  resource: string
  action: string
}

/** Full user detail (superset) returned by GET /api/users/:id. */
export interface BackendUserDetail {
  id: string
  email: string
  username?: string
  first_name: string
  middle_name?: string
  last_name: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  rank_level?: number
  campus?: string
  last_login_at?: string
  last_password_change_at?: string
  failed_login_attempts: number
  account_locked_until?: string
  metadata?: Record<string, any>
  created_at?: string
  updated_at?: string
  roles: UserRoleRef[]
  permissions?: UserPermissionRef[]
  // PHASE BBCH (Track 2): effective module grants from approved access requests
  module_overrides?: Record<string, boolean>
  module_levels?: Record<string, string>
}
