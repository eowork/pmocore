/**
 * KE-AA: Shared form state type for COI Create/Edit pages.
 * Both new.vue and edit-[id].vue use CiBasicInfoForm with this interface
 * so any field added to one page automatically appears on the other.
 */

/**
 * MG (2026-05-21): Major refactor of Basic Info form state. New sectioned
 * architecture: Identity / Location / Agencies / Funding (hybrid) /
 * Objectives (dynamic) / Beneficiaries (dynamic) / Strategic Alignment /
 * Other Attributes.
 *
 * Removed from Basic Info (per ECO directive): contract_number, summary,
 * key_features, scope, facilities. Legacy fields kept in interface as optional
 * for back-compat with existing edit flows that still hydrate them; they are
 * no longer rendered in CiBasicInfoForm.
 */
export interface BasicInfoFormState {
  // ── Identity ────────────────────────────────────────────────
  project_code: string
  campus: string
  title: string
  status: string
  description: string

  // ── Location (MG-A) ─────────────────────────────────────────
  spatial_coverage: string
  municipality: string
  province: string

  // ── Implementation Agencies (MG-A) ──────────────────────────
  implementing_agency: string
  co_implementing_agency: string
  attached_agency: string

  // ── Funding (MG-A hybrid) ───────────────────────────────────
  // AAAK: Two-Level Funding — primary_funding_source (controlled Level-1, required) +
  // funding_source_description (free-text Level-2). funding_source_id is legacy (optional).
  primary_funding_source: string
  funding_source_description: string
  funding_source_id: string
  funding_source_type: string
  additional_funding_sources: { type: string; name: string; notes?: string }[]
  cost_amount: number | null

  // ── Contractor (free text — MG-A) ───────────────────────────
  contractor: string

  // ── Objectives (dynamic bullets — MG-A) ─────────────────────
  objectives_list: string[]

  // ── Beneficiaries (dynamic bullets — MG-A; aggregate count removed per ECO directive 2026-05-21) ──
  beneficiary_list: string[]

  // ── Strategic Alignment (multi-select — MG-A) ───────────────
  rdp_alignment: string[]
  socioeconomic_agenda: string[]
  csu_likha_goals: string[]
  sdg_goals: string[]            // QQQ: UN Sustainable Development Goals
  rdp2017_alignment: string[]    // XXX-K: RDP 2017-2022 (historical)
  point_agenda_10: string[]      // XXX-K: 0+10 Point Agenda (historical)
  strategic_alignment: string // legacy free-text narrative

  // ── Indicators (NC: migrated from textareas to dynamic bullet arrays) ──
  output_indicators_list: string[]
  outcome_indicators_list: string[]
  // Legacy textarea fields kept optional for back-compat hydration
  output_indicators?: string
  outcome_indicators?: string

  // ── Other Attributes (MG-A) ─────────────────────────────────
  project_engineer: string
  building_type: string
  floor_area: number | null

  // ── Legacy / supplementary fields (no longer in Basic Info UI) ──
  // Kept on form state so edit page hydration / payload mapping keeps working.
  // These will continue to be persisted but are not rendered.
  summary?: string
  objectives?: string
  key_features?: string
  scope?: string
  facilities?: string
  number_of_floors?: number | null
  latitude?: number | null
  longitude?: number | null
  contractor_id?: string
  contract_number?: string
  contract_amount?: number | null // legacy alias; cost_amount is canonical
  original_contract_duration?: string
  project_manager?: string
  project_status_category?: string
  beneficiaries?: number | null // legacy aggregate count — no longer rendered

  // ── MH: Dates and Duration — Revision Orders ──
  original_start_date?: string
  revised_start_date?: string
  original_completion_date?: string
  revised_completion_date?: string
  revised_project_duration?: string
  project_duration_days?: number | null
  implementation_period?: string // XXX-K: free-text implementation period (R-222)
}

// ── JSONB row types (managed as separate refs in parents) ────────────
export interface StatusUpdateRow { date: string; text: string }
export interface ReadinessDocRow { type: string; status: string; remarks: string }
export interface SignatoryRow    { name: string; position: string; date: string }
export interface CsuPersonnelRow        { name: string; position: string; role: string }
export interface ContractorPersonnelRow { name: string; position: string; company: string }
export interface OthersPersonnelRow     { name: string; position: string; affiliation: string }

// ── Personnel category groups (shared across Edit + Detail pages) ────
export const PERSONNEL_GROUPS = [
  { code: 'IMPLEMENTING',         label: 'Implementing Personnel',   icon: 'mdi-hammer-wrench',    color: 'primary' },
  { code: 'MONITORING',           label: 'Monitoring Personnel',     icon: 'mdi-eye-outline',      color: 'info' },
  { code: 'UNIVERSITY_OFFICIAL',  label: 'University Officials',     icon: 'mdi-school-outline',   color: 'success' },
  { code: 'OVERSIGHT',            label: 'Oversight',                icon: 'mdi-shield-check',     color: 'warning' },
  { code: '__UNCATEGORIZED__',    label: 'Other Assigned Personnel', icon: 'mdi-account-multiple', color: 'grey' },
] as const

export const PERSONNEL_CATEGORY_OPTIONS = [
  { title: 'Implementing',        value: 'IMPLEMENTING' },
  { title: 'Monitoring',          value: 'MONITORING' },
  { title: 'University Official', value: 'UNIVERSITY_OFFICIAL' },
  { title: 'Oversight',           value: 'OVERSIGHT' },
]

// RA-A: Centralized COI tab config — single source of truth for tab keys, labels, and permission defaults.
// permKey maps to FullPermissions in CiPersonnelAccessCard; tabValue maps to edit-[id].vue tabOrder.
export const COI_PROJECT_TABS = [
  { permKey: 'tabProjectProfile', tabValue: 'basic',     label: 'Project Profile',  defaultOn: true },
  { permKey: 'tabDatesDuration',  tabValue: 'schedule',  label: 'Dates & Duration', defaultOn: true },
  { permKey: 'tabProgressReport', tabValue: 'progress',  label: 'Progress Report',  defaultOn: true },
  { permKey: 'tabPersonnel',      tabValue: 'personnel', label: 'Personnel',        defaultOn: false },
  { permKey: 'tabAttachments',    tabValue: 'documents', label: 'Attachments',      defaultOn: true },
  { permKey: 'tabOthers',         tabValue: 'others',    label: 'Others',           defaultOn: false },
] as const

export type TabPermKey = typeof COI_PROJECT_TABS[number]['permKey']

// PA/PV: per-assignment record-level permission object stored in
// record_assignments.permissions (JSONB). This is the Layer 4 authority for a
// specific project — distinct from the Layer 3 module-level tier (Viewer/
// Contributor/Approver/Manager in usePermissions.ts) even though the names
// overlap; accessLevel here has its own 5-value set (Editor/Admin replace
// Approver in the record-level scheme). Single source of truth — components/
// pages must import this rather than redeclaring the shape locally.
export interface FullPermissions {
  // Section A: Actions
  canCreate: boolean; canEdit: boolean; canDelete: boolean
  canUpload: boolean; canReview: boolean; canApprove: boolean
  // Section B: Tab Access — exactly matches COI_PROJECT_TABS permKeys
  tabProjectProfile: boolean; tabDatesDuration: boolean
  tabProgressReport: boolean
  tabPersonnel: boolean; tabAttachments: boolean; tabOthers: boolean
  // Section C: preset label
  accessLevel: 'Viewer' | 'Contributor' | 'Editor' | 'Manager' | 'Admin'
}

// KV-E1: Key executive document type codes — shared between detail and edit pages
export const KEY_DOC_TYPECODES = ['PROJECT_PROFILE', 'FEASIBILITY_STUDY', 'HGDG_FORM', 'FLOOR_PLAN', 'POW'] as const

// ZZ-B: Staging queue shape shared by CiAttachmentHub (staging mode) and new.vue.
export interface StagedQueue {
  docs: { file: File; documentType: string; description: string }[]
  images: { file: File; caption: string; category: string }[]
  links: { url: string; title: string; description: string }[]
}
