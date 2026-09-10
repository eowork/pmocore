<script setup lang="ts">
import { adaptProjectDetail, type UIProjectDetail, type BackendProjectDetail } from '~/utils/adapters'
import { PERSONNEL_GROUPS, PERSONNEL_CATEGORY_OPTIONS, KEY_DOC_TYPECODES, COI_PROJECT_TABS, type CsuPersonnelRow, type ContractorPersonnelRow, type OthersPersonnelRow } from '~/utils/coiFormState'
import CiBasicInfoForm from '~/components/coi/CiBasicInfoForm.vue'
import CiDocumentChecklist from '~/components/coi/CiDocumentChecklist.vue'
import CiAttachmentHub from '~/components/coi/CiAttachmentHub.vue'
import CiMovEvidenceSection from '~/components/coi/CiMovEvidenceSection.vue'
import CiMovPendingSection, { type PendingMovEntry } from '~/components/coi/CiMovPendingSection.vue'
import CiBatchMilestoneDialog from '~/components/coi/CiBatchMilestoneDialog.vue'
import CiBatchDiaryDialog from '~/components/coi/CiBatchDiaryDialog.vue'
import CiRemarksLog from '~/components/coi/CiRemarksLog.vue'
import CiPersonnelAccessCard from '~/components/coi/CiPersonnelAccessCard.vue'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const { openMovSafely } = useMovSafe()
const { canEdit, isAdmin } = usePermissions()
// OE: current user name for CiRemarksLog author stamping (client-side display only;
// server also stamps author from JWT on PATCH — see construction-projects.service.ts OE-C).
const authStore = useAuthStore()
const currentUserName = computed(() => authStore.userFullName || authStore.userEmail || '')

const loading = ref(true)
const submitting = ref(false)
const personnelCardRef = ref<InstanceType<typeof CiPersonnelAccessCard>>()

// PR-B: raw project for useCoiAccess project-level permission gates
const rawProject = ref<UIProjectDetail | null>(null)
const {
  canEditCurrentProject: _canEditFromAccess,
  effectivePermissions,
  isOwnerOrAssigned,
  myAssignment,
  isContractor: isContractorUser,
  accessResolved,
  canViewTab,
  canEditMilestones: canEditMilestonesFromAccess,
  canEditWorkLog: canEditWorkLogFromAccess,
  canEditPersonnel: canEditPersonnelFromAccess,
  canUploadDocuments,
  canDeleteResources,
  canCreateResources,
} = useCoiAccess(rawProject)

// XD-A: Defense-in-depth — redirect contractors to the read-only detail page.
// Primary guard is the middleware (XC). This covers direct URL navigation or stale middleware state.
if (import.meta.client) {
  watchEffect(() => {
    if (isContractorUser.value && authStore.user) {
      router.replace(`/coi/detail-${route.params.id}`)
    }
  })
}

// JX-B: merge module-level + project-level edit permission
const canEditCurrentProject = computed(() =>
  canEdit('coi') && (isAdmin.value || _canEditFromAccess.value)
)
// PHASE BBBD (Track 7, R-331): module access but NOT assigned to THIS project → read-only + notice.
// Presentation only — the project-level authorization (useCoiAccess) is unchanged.
const showNotAssignedNotice = computed(
  () => accessResolved.value && !canEditCurrentProject.value && !isContractorUser.value,
)
// PR-B: per-tab edit flags now respect project-level effectivePermissions
const canEditMilestones = computed(() => canEditMilestonesFromAccess.value)
const canEditWorkLog    = computed(() => canEditWorkLogFromAccess.value)
const canEditPersonnel  = computed(() => canEditPersonnelFromAccess.value)

// ACE-R15 Tier 3: Direct ID extraction (no computed, no watchEffect)
const projectId = route.params.id as string

// Validate ID immediately - redirect if missing
if (!projectId) {
  console.error('[COI Edit] No project ID in route, redirecting to list')
  router.push('/coi')
}

// MG (2026-05-21): Extended form state with new sectioned fields.
const form = ref({
  // Identity
  project_code: '',
  title: '',
  description: '',
  campus: '',
  status: '',
  // Location (MG)
  spatial_coverage: '',
  municipality: '',
  province: '',
  // Implementation Agencies (MG)
  implementing_agency: '',
  co_implementing_agency: '',
  attached_agency: '',
  // Funding hybrid (MG) + AAAK two-level funding
  primary_funding_source: '',
  funding_source_description: '',
  funding_source_id: '',
  funding_source_type: '',
  additional_funding_sources: [] as { type: string; name: string; notes?: string }[],
  cost_amount: null as number | null,
  // Contractor as free-text (MG)
  contractor: '',
  // Objectives (dynamic — MG)
  objectives_list: [] as string[],
  // Beneficiaries (MG — aggregate count removed per ECO directive 2026-05-21)
  beneficiary_list: [] as string[],
  // Strategic Alignment (MG)
  rdp_alignment: [] as string[],
  socioeconomic_agenda: [] as string[],
  csu_likha_goals: [] as string[],
  sdg_goals: [] as string[],
  rdp2017_alignment: [] as string[],
  point_agenda_10: [] as string[],
  strategic_alignment: '',
  // NC: Migrated from textareas to bullet lists
  output_indicators_list: [] as string[],
  outcome_indicators_list: [] as string[],
  // Legacy back-compat
  output_indicators: '',
  outcome_indicators: '',
  // Other attributes
  project_engineer: '',
  building_type: '',
  floor_area: null as number | null,
  // Schedule — Primary Dates (Schedule tab)
  start_date: '',
  target_completion_date: '',
  actual_completion_date: '',
  project_duration: '',
  project_duration_days: null as number | null,
  // Schedule — Revision Orders (MH)
  original_start_date: '',
  revised_start_date: '',
  original_completion_date: '',
  revised_completion_date: '',
  revised_project_duration: '',
  original_contract_duration: '',
  implementation_period: '',
  // Progress / financial (existing tabs)
  physical_progress: null as number | null,
  financial_progress: null as number | null,
  target_physical_progress: 100 as number,
  target_financial_progress: 100 as number,
  // MI: Progress & Financial Status (new tab)
  as_of_date: '',
  cost_incurred_to_date: null as number | null,
  date_completed: '',
  // MI: Chronological remarks log (mapped to backend remarks_log JSONB)
  // OE: Extended with id/updatedAt/updatedBy for per-entry inline edit tracking.
  remarks_log_entries: [] as Array<{
    id?: string
    text: string
    author?: string
    createdAt: string
    updatedAt?: string
    updatedBy?: string
  }>,
  // Personnel (Personnel tab)
  project_manager: '',
  assigned_user_ids: [] as string[],
  // Legacy fields (hydrated from server, no longer rendered in Basic Info)
  objectives: '',
  key_features: '',
  scope: '',
  facilities: '',
  summary: '',
  number_of_floors: null as number | null,
  latitude: null as number | null,
  longitude: null as number | null,
  contractor_id: '',
  contract_number: '',
  contract_amount: null as number | null,
  beneficiaries: null as number | null,
  project_status_category: '',
})

// Phase JW-E: per-user assignment metadata (role/department/phone).
// Keyed by user_id. Lives outside `form` to keep payload normalization simple.
const assignmentMetadata = ref<Record<string, { role: string; department: string; phone: string; personnelCategory: string }>>({})

// KD-D: Personnel category options
// KC-C: Structured JSONB arrays — live outside form for row-level reactivity
const statusUpdateRows = ref<Array<{ date: string; text: string }>>([])
const readinessDocRows = ref<Array<{ type: string; status: string; remarks: string }>>([])
const signatoryRows = ref<Array<{ name: string; position: string; date: string }>>([])
// PA: Raw assigned_users from backend — fed into CiPersonnelAccessCard
const currentAssignedUsers = ref<any[]>([])
// MJ: Non-system personnel group rows (JSONB)
const csuPersonnelRows        = ref<CsuPersonnelRow[]>([])
const contractorPersonnelRows = ref<ContractorPersonnelRow[]>([])
const othersPersonnelRows     = ref<OthersPersonnelRow[]>([])

// LL-B: ISO date string ↔ Date object conversion for VDatePicker (VuetifyDateAdapter returns Date objects)
function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoToDate(iso: string): Date | null {
  return iso ? new Date(iso + 'T00:00:00') : null
}

function addStatusUpdate() { statusUpdateRows.value.push({ date: '', text: '' }) }
function removeStatusUpdate(i: number) { statusUpdateRows.value.splice(i, 1) }
function addReadinessDoc() { readinessDocRows.value.push({ type: '', status: '', remarks: '' }) }
function removeReadinessDoc(i: number) { readinessDocRows.value.splice(i, 1) }
function addSignatory() { signatoryRows.value.push({ name: '', position: '', date: '' }) }
function removeSignatory(i: number) { signatoryRows.value.splice(i, 1) }

// KW-F4: Project monitoring log rows
// BBB-B: incidentLogRows removed — Incident Log removed from Others tab per R-055
// XXX-M: riskRegisterRows/escalationRows removed — Project Governance section removed

// GGG-E: Others-tab data banking
const notesAdditional       = ref('')
const notesSpecial          = ref('')
const notesReferences       = ref<Array<{ label: string; url: string; notes: string }>>([])
const notesHistorical       = ref<Array<{ date: string; description: string }>>([])
const notesMetadataRows     = ref<Array<{ key: string; value: string }>>([])
function addNoteReference()       { notesReferences.value.push({ label: '', url: '', notes: '' }) }
function removeNoteReference(i: number) { notesReferences.value.splice(i, 1) }
function addNoteHistorical()      { notesHistorical.value.push({ date: '', description: '' }) }
function removeNoteHistorical(i: number) { notesHistorical.value.splice(i, 1) }
function addNoteMetadata()        { notesMetadataRows.value.push({ key: '', value: '' }) }
function removeNoteMetadata(i: number) { notesMetadataRows.value.splice(i, 1) }

// ZZZ-D Ext: Lessons Learned (Site Observation Log removed per BBB-B/R-055)
const LESSON_PHASES = ['PLANNING', 'MOBILIZATION', 'CIVIL_WORKS', 'FINISHING', 'CLOSEOUT', 'OTHER']
const lessonsLearned = ref<Array<{ phase: string; observation: string; recommendation: string; addedBy?: string; addedAt?: string }>>([])

function addLesson()      { lessonsLearned.value.push({ phase: 'OTHER', observation: '', recommendation: '', addedBy: currentUserName.value, addedAt: new Date().toISOString() }) }
function removeLesson(i: number) { lessonsLearned.value.splice(i, 1) }

function ensureAssignmentMetadata(userId: string) {
  if (!assignmentMetadata.value[userId]) {
    assignmentMetadata.value[userId] = { role: '', department: '', phone: '', personnelCategory: '' }
  }
}

function personnelCardColor(uid: string): string {
  const cat = assignmentMetadata.value[uid]?.personnelCategory
  return (PERSONNEL_GROUPS.find(g => g.code === cat)?.color ?? 'grey') as string
}

function personnelCardIcon(uid: string): string {
  const cat = assignmentMetadata.value[uid]?.personnelCategory
  return PERSONNEL_GROUPS.find(g => g.code === cat)?.icon ?? 'mdi-account'
}

// KH-B: group assigned users by personnel category for visual hierarchy
const groupedAssignments = computed(() =>
  PERSONNEL_GROUPS.map(group => ({
    ...group,
    userIds: group.code === '__UNCATEGORIZED__'
      ? form.value.assigned_user_ids.filter(uid => {
          const cat = assignmentMetadata.value[uid]?.personnelCategory
          return !cat || !PERSONNEL_CATEGORY_OPTIONS.some(o => o.value === cat)
        })
      : form.value.assigned_user_ids.filter(
          uid => assignmentMetadata.value[uid]?.personnelCategory === group.code
        ),
  }))
)

// Dropdown options
const campusOptions = [
  { title: 'Main Campus', value: 'MAIN' },
  { title: 'Cabadbaran Campus', value: 'CABADBARAN' },
  { title: 'Both Campuses', value: 'BOTH' },
]

// MG / MF: Updated status taxonomy. Legacy PLANNING/COMPLETED rows normalized
// by Migration20260521050000_NormalizeProjectStatusData.
const statusOptions = [
  { title: 'Proposal',  value: 'PROPOSAL'  },
  { title: 'Ongoing',   value: 'ONGOING'   },
  { title: 'Complete',  value: 'COMPLETE'  },
  { title: 'On Hold',   value: 'ON_HOLD'   },
  { title: 'Cancelled', value: 'CANCELLED' },
]

// Lookup data
const fundingSources = ref<{ id: string; name: string; type?: string }[]>([])
const contractors = ref<{ id: string; name: string }[]>([])
const staffUsers = ref<{ id: string; first_name: string; last_name: string }[]>([])

// MG: Relaxed project code validation — free-form per ECO directive.
const rules = {
  required: (v: string) => !!v || 'This field is required',
  positiveNumber: (v: number | null) => v === null || v >= 0 || 'Must be a positive number',
  percentage: (v: number | null) => v === null || (v >= 0 && v <= 100) || 'Must be between 0 and 100',
}

// JV-A: Tab navigation state — KV-F: 8 tabs (Others added for supplementary records)
// JV-B: Read ?tab= query param synchronously to avoid flicker (codebase precedent: university-operations/physical/index.vue)
// NI (2026-05-21): `financial` tab removed (ConstructionProjectFinancial entity
// archived). Chronological tracking now lives in `progress` tab via progress reports.
const tabOrder = ['basic', 'schedule', 'progress', 'personnel', 'documents', 'others'] as const
const initialTab = (() => {
  const q = route.query.tab as string | undefined
  return q && (tabOrder as readonly string[]).includes(q) ? q : 'basic'
})()
const activeTab = ref<string>(initialTab)

// WB-B: presentation map derived from the canonical tab source (single source of truth)
const EDIT_TAB_PERM_MAP: Record<string, string> = Object.fromEntries(
  COI_PROJECT_TABS.map(t => [t.tabValue, t.permKey]),
)

// WB-B: tabs resolved by the centralized engine (useCoiAccess.canViewTab).
// Fail-closed: returns [] until accessResolved so no chip mounts during hydration.
const visibleTabOrder = computed<string[]>(() => {
  if (!accessResolved.value) return []
  return (tabOrder as readonly string[]).filter(tab => {
    const permKey = EDIT_TAB_PERM_MAP[tab]
    return permKey ? canViewTab(permKey) : true
  })
})

// SC-A: redirect activeTab when it becomes hidden after permissions load.
// XA-A: removed `tabs.length > 0 &&` guard — when visibleTabOrder = [] (contractor with no
// visible tabs), activeTab must be cleared to '' so no v-window-item matches.
watch(visibleTabOrder, (tabs) => {
  if (!tabs.includes(activeTab.value)) {
    activeTab.value = tabs[0] ?? ''
  }
}, { immediate: false })

async function fetchData() {
  if (!projectId) {
    toast.error('Invalid project ID')
    loading.value = false
    return
  }

  loading.value = true

  try {
    const [fundingRes, contractorRes, projectRes] = await Promise.all([
      api.get<{ data: { id: string; name: string }[] }>('/api/funding-sources'),
      api.get<{ data: { id: string; name: string }[] }>('/api/contractors'),
      api.get<BackendProjectDetail>(`/api/construction-projects/${projectId}`),
    ])

    fundingSources.value = fundingRes.data || []
    contractors.value = contractorRes.data || []

    const p = projectRes
    // PR-B: populate rawProject for useCoiAccess project-level permission gates
    rawProject.value = adaptProjectDetail(p)

    // MG (2026-05-21): Hydrate new sectioned fields.
    const pAny = p as any
    form.value = {
      // Identity
      project_code: p.project_code || '',
      title: p.title || '',
      description: p.description || '',
      campus: p.campus || '',
      status: p.status || '',
      // Location (MG)
      spatial_coverage: pAny.spatial_coverage || '',
      municipality: pAny.municipality || '',
      province: pAny.province || '',
      // Implementation Agencies (MG)
      implementing_agency: p.implementing_agency || '',
      co_implementing_agency: pAny.co_implementing_agency || '',
      attached_agency: pAny.attached_agency || '',
      // Funding hybrid (MG) + AAAK two-level funding
      primary_funding_source: pAny.primary_funding_source || '',
      funding_source_description: pAny.funding_source_description || '',
      funding_source_id: p.funding_source_id || '',
      funding_source_type: pAny.funding_source_type || '',
      additional_funding_sources: Array.isArray(pAny.additional_funding_sources)
        ? pAny.additional_funding_sources
        : [],
      cost_amount: pAny.cost_amount != null
        ? Number(pAny.cost_amount)
        : (p.contract_amount != null ? Number(p.contract_amount) : null),
      // Contractor (free text — MG)
      contractor: pAny.contractor || '',
      // Objectives (dynamic — MG)
      objectives_list: Array.isArray(p.objectives) ? p.objectives.map(String) : [],
      // Beneficiaries (MG — aggregate count moved to legacy block)
      beneficiary_list: Array.isArray(pAny.beneficiary_list) ? pAny.beneficiary_list.map(String) : [],
      // Strategic Alignment (MG)
      rdp_alignment: Array.isArray(pAny.rdp_alignment) ? pAny.rdp_alignment : [],
      socioeconomic_agenda: Array.isArray(pAny.socioeconomic_agenda) ? pAny.socioeconomic_agenda : [],
      csu_likha_goals: Array.isArray(pAny.csu_likha_goals) ? pAny.csu_likha_goals : [],
      sdg_goals: Array.isArray(pAny.sdg_goals ?? pAny.sdgGoals) ? (pAny.sdg_goals ?? pAny.sdgGoals) : [],
      // XXX-K: Historical Planning Frameworks (2017-2022)
      rdp2017_alignment: Array.isArray(pAny.rdp2017_alignment) ? pAny.rdp2017_alignment : [],
      point_agenda_10: Array.isArray(pAny.point_agenda_10) ? pAny.point_agenda_10 : [],
      strategic_alignment: p.strategic_alignment || '',
      // NC: hydrate both array (canonical) and legacy textarea fields
      output_indicators_list: Array.isArray(p.output_indicators) ? p.output_indicators.map(String) : [],
      outcome_indicators_list: Array.isArray(p.outcome_indicators) ? p.outcome_indicators.map(String) : [],
      output_indicators: Array.isArray(p.output_indicators) ? p.output_indicators.join('\n') : '',
      outcome_indicators: Array.isArray(p.outcome_indicators) ? p.outcome_indicators.join('\n') : '',
      // Other attributes
      project_engineer: p.project_engineer || '',
      building_type: p.building_type || '',
      floor_area: p.floor_area || null,
      // Schedule — Primary Dates
      start_date: p.start_date ? p.start_date.split('T')[0] : '',
      target_completion_date: p.target_completion_date ? p.target_completion_date.split('T')[0] : '',
      actual_completion_date: p.actual_completion_date ? p.actual_completion_date.split('T')[0] : '',
      project_duration: p.project_duration || '',
      // MH: parse "365 days" → 365; fallback to null if non-numeric text.
      project_duration_days: (() => {
        const m = (p.project_duration || '').match(/(\d+)/)
        return m ? Number(m[1]) : null
      })(),
      // Schedule — Revision Orders (MH)
      original_start_date: pAny.original_start_date ? String(pAny.original_start_date).split('T')[0] : '',
      revised_start_date: pAny.revised_start_date ? String(pAny.revised_start_date).split('T')[0] : '',
      original_completion_date: pAny.original_completion_date ? String(pAny.original_completion_date).split('T')[0] : '',
      revised_completion_date: pAny.revised_completion_date ? String(pAny.revised_completion_date).split('T')[0] : '',
      revised_project_duration: pAny.revised_project_duration || '',
      original_contract_duration: p.original_contract_duration || '',
      // XXX-K: Implementation Period (free-text, R-222)
      implementation_period: pAny.implementation_period || '',
      // Progress / financial
      physical_progress: p.physical_progress ?? null,
      financial_progress: p.financial_progress ?? null,
      target_physical_progress: p.target_physical_progress ?? 100,
      target_financial_progress: p.target_financial_progress ?? 100,
      // MI: Progress & Financial Status
      as_of_date: pAny.as_of_date ? String(pAny.as_of_date).split('T')[0] : '',
      cost_incurred_to_date: pAny.cost_incurred_to_date != null ? Number(pAny.cost_incurred_to_date) : null,
      date_completed: p.actual_completion_date ? p.actual_completion_date.split('T')[0] : '',
      // MI: Remarks log (parse JSONB array; tolerate snake_case + camelCase keys)
      // OE: pass-through id/updatedAt/updatedBy if present
      remarks_log_entries: Array.isArray(pAny.remarks_log)
        ? pAny.remarks_log.map((r: any) => ({
            id: r.id || undefined,
            text: String(r.text || ''),
            author: r.author || undefined,
            createdAt: r.created_at || r.createdAt || new Date().toISOString(),
            updatedAt: r.updated_at || r.updatedAt || undefined,
            updatedBy: r.updated_by || r.updatedBy || undefined,
          }))
        : [],
      // Personnel
      project_manager: p.project_manager || '',
      assigned_user_ids: ((p as any).assigned_users || []).map((u: { id: string }) => u.id),
      // Legacy back-compat fields
      objectives: Array.isArray(p.objectives) ? p.objectives.join('\n') : '',
      key_features: Array.isArray(p.key_features) ? p.key_features.join('\n') : '',
      scope: p.scope || '',
      facilities: p.facilities || '',
      summary: p.summary || '',
      number_of_floors: p.number_of_floors || null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      contractor_id: p.contractor_id || '',
      contract_number: p.contract_number || '',
      contract_amount: p.contract_amount || null,
      beneficiaries: p.beneficiaries ? Number(p.beneficiaries) : null,
      project_status_category: p.project_status_category || '',
    }

    // PV-B: populate raw assignment objects for CiPersonnelAccessCard
    currentAssignedUsers.value = (p as any).assigned_users || []

    // JW-E: populate per-assignment metadata map from API response
    const assignedUsers = ((p as any).assigned_users || []) as Array<{
      id: string
      role?: string | null
      department?: string | null
      phone?: string | null
    }>
    assignmentMetadata.value = {}
    for (const u of assignedUsers) {
      assignmentMetadata.value[u.id] = {
        role: u.role || '',
        department: u.department || '',
        phone: u.phone || '',
        personnelCategory: (u as any).personnel_category || (u as any).personnelCategory || '',
      }
    }

    // KC-C: hydrate structured JSONB arrays
    statusUpdateRows.value = Array.isArray((p as any).status_updates)
      ? (p as any).status_updates.map((r: any) => ({ date: r.date || '', text: r.text || '' }))
      : []
    readinessDocRows.value = Array.isArray((p as any).readiness_documents)
      ? (p as any).readiness_documents.map((r: any) => ({ type: r.type || '', status: r.status || '', remarks: r.remarks || '' }))
      : []
    signatoryRows.value = Array.isArray((p as any).signatories)
      ? (p as any).signatories.map((r: any) => ({ name: r.name || '', position: r.position || '', date: r.date || '' }))
      : []

    // BBB-B: incidentLogRows hydration removed
    // XXX-M: riskRegisterRows/escalationRows hydration removed — Project Governance section removed
    // GGG-E: hydrate notes banking
    const nb = (p as any).project_notes_banking || {}
    notesAdditional.value   = nb.additionalNotes || ''
    notesSpecial.value      = nb.specialInstructions || ''
    notesReferences.value   = Array.isArray(nb.projectReferences) ? nb.projectReferences.map((r: any) => ({ label: r.label || '', url: r.url || '', notes: r.notes || '' })) : []
    notesHistorical.value   = Array.isArray(nb.historicalReferences) ? nb.historicalReferences.map((r: any) => ({ date: r.date || '', description: r.description || '' })) : []
    notesMetadataRows.value = nb.customMetadata && typeof nb.customMetadata === 'object' ? Object.entries(nb.customMetadata).map(([key, value]) => ({ key, value: String(value) })) : []
    // ZZZ-D Ext: hydrate Lessons Learned + Site Observations
    lessonsLearned.value = Array.isArray((nb as any).lessonsLearned)
      ? (nb as any).lessonsLearned.map((l: any) => ({ phase: l.phase || 'OTHER', observation: l.observation || '', recommendation: l.recommendation || '', addedBy: l.addedBy || '', addedAt: l.addedAt || '' }))
      : []
    // BBB-B: siteObservations hydration removed per R-055
    // MJ: Hydrate personnel_groups; fall back to legacy text fields for CSU rows
    const pg = (p as any).personnel_groups || {}
    csuPersonnelRows.value = (pg.csu && pg.csu.length)
      ? pg.csu
      : [
          ...((p as any).project_engineer ? [{ name: (p as any).project_engineer, position: 'Project Engineer', role: '' }] : []),
          ...((p as any).project_manager  ? [{ name: (p as any).project_manager,  position: 'Project Manager',  role: '' }] : []),
        ]
    contractorPersonnelRows.value = pg.contractor || []
    othersPersonnelRows.value = pg.others || []

    const usersRes = await api.get<{ id: string; first_name: string; last_name: string }[]>(
      '/api/users/eligible-for-assignment'
    )
    staffUsers.value = Array.isArray(usersRes) ? usersRes : []
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to load project data')
    console.error('[COI Edit] Failed to fetch:', err)
  } finally {
    loading.value = false
  }
}

// JP-D: Engagement-based completion (checkmark = user filled at least one field in tab)
// JP-D: Engagement-based completion
const tabCompletion = computed(() => ({
  basic: !!(form.value.project_code && form.value.title && form.value.campus && form.value.status),
  schedule: !!(
    form.value.start_date ||
    form.value.target_completion_date ||
    form.value.actual_completion_date ||
    form.value.project_duration ||
    form.value.original_contract_duration
  ),
  // MI: Progress completion gated on any status field touched
  progress: !!(
    (form.value.physical_progress != null && form.value.physical_progress !== 0) ||
    form.value.as_of_date ||
    (form.value.cost_incurred_to_date != null) ||
    form.value.date_completed ||
    (form.value.remarks_log_entries && form.value.remarks_log_entries.length > 0)
  ),
  // PQ-A: personnel gated on currentAssignedUsers (managed by CiPersonnelAccessCard)
  personnel: currentAssignedUsers.value.length > 0,
  documents: existingDocs.value.length > 0,
  others: statusUpdateRows.value.length > 0 || readinessDocRows.value.length > 0 || signatoryRows.value.length > 0,
}))

// JP-D: Required-field validity for navigation gating
// KE-D: only basic requires completion; all other tabs are optional
const tabRequired = computed(() => ({
  basic: !!(form.value.project_code && form.value.title && form.value.campus && form.value.status),
  schedule: true,
  progress: true,
  // NI: financial removed
  personnel: true,
  documents: true,
  others: true,
}))

const currentStepIndex = computed(() =>
  visibleTabOrder.value.indexOf(activeTab.value)
)
const completionPercentage = computed(() => {
  const completed = Object.values(tabCompletion.value).filter(Boolean).length
  return Math.round((completed / visibleTabOrder.value.length) * 100)
})

function nextTab() {
  const order = visibleTabOrder.value
  const cur = activeTab.value
  if (!tabRequired.value[cur as typeof tabOrder[number]]) {
    toast.error(`Please complete required fields in "${cur}" before continuing`)
    return
  }
  const idx = order.indexOf(cur)
  if (idx < order.length - 1) activeTab.value = order[idx + 1]
}

function prevTab() {
  const order = visibleTabOrder.value
  const idx = order.indexOf(activeTab.value)
  if (idx > 0) activeTab.value = order[idx - 1]
}

// Map raw API errors to user-friendly messages
function mapApiError(err: unknown): string {
  const msg: string = (err as { message?: string })?.message ?? ''
  if (/duplicate key|already exists|already in use|project_code/i.test(msg)) {
    return 'This project code is already in use. Please choose a different code.'
  }
  if (/validation failed|bad request/i.test(msg)) {
    return 'Some fields have invalid values. Please check the form and try again.'
  }
  if (/unauthorized|forbidden/i.test(msg)) {
    return 'You do not have permission to perform this action.'
  }
  if (/network|failed to fetch|econnrefused/i.test(msg)) {
    return 'Cannot reach the server. Please check your connection and try again.'
  }
  return 'Something went wrong. Please try again or contact support.'
}

// Submit form
async function handleSubmit() {
  // JP-D: Full-form gate — jump to first invalid required tab
  const incomplete = (Object.keys(tabRequired.value) as Array<keyof typeof tabRequired.value>)
    .filter(k => !tabRequired.value[k])
  if (incomplete.length > 0) {
    activeTab.value = incomplete[0]
    toast.error(`Required fields incomplete in: ${incomplete.join(', ')}`)
    return
  }

  submitting.value = true

  try {
    // MG: Objectives now sourced from dynamic bullet list (preferred); legacy
    // textarea retained as fallback for back-compat.
    const objectivesArr = (form.value.objectives_list && form.value.objectives_list.length > 0)
      ? form.value.objectives_list.map(s => s.trim()).filter(Boolean)
      : (form.value.objectives
          ? form.value.objectives.split('\n').map(s => s.trim()).filter(Boolean)
          : undefined)
    const keyFeaturesArr = form.value.key_features
      ? form.value.key_features.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined
    const beneficiaryArr = (form.value.beneficiary_list && form.value.beneficiary_list.length > 0)
      ? form.value.beneficiary_list.map(s => s.trim()).filter(Boolean)
      : undefined

    const payload = {
      // Identity
      project_code: form.value.project_code,
      title: form.value.title,
      description: form.value.description || undefined,
      objectives: objectivesArr,
      key_features: keyFeaturesArr,
      campus: form.value.campus,
      status: form.value.status,
      // Location (MG)
      spatial_coverage: form.value.spatial_coverage || undefined,
      municipality: form.value.municipality || undefined,
      province: form.value.province || undefined,
      // Implementation Agencies (MG)
      implementing_agency: form.value.implementing_agency || undefined,
      co_implementing_agency: form.value.co_implementing_agency || undefined,
      attached_agency: form.value.attached_agency || undefined,
      // Funding hybrid (MG) — cost_amount canonical; backend remaps to contract_amount
      // AAAK two-level funding: primary (controlled) required, description (free text) optional
      primary_funding_source: form.value.primary_funding_source || undefined,
      funding_source_description: form.value.funding_source_description || undefined,
      funding_source_id: form.value.funding_source_id || undefined,
      funding_source_type: form.value.funding_source_type || undefined,
      additional_funding_sources: form.value.additional_funding_sources?.length
        ? form.value.additional_funding_sources
        : undefined,
      cost_amount: form.value.cost_amount ?? form.value.contract_amount ?? undefined,
      // Contractor (text — MG)
      contractor: form.value.contractor || undefined,
      // Beneficiaries (MG — aggregate count removed)
      beneficiary_list: beneficiaryArr,
      // Strategic Alignment (MG)
      rdp_alignment: form.value.rdp_alignment?.length ? form.value.rdp_alignment : undefined,
      socioeconomic_agenda: form.value.socioeconomic_agenda?.length ? form.value.socioeconomic_agenda : undefined,
      csu_likha_goals: form.value.csu_likha_goals?.length ? form.value.csu_likha_goals : undefined,
      sdg_goals: form.value.sdg_goals?.length ? form.value.sdg_goals : undefined,
      // XXX-K: Historical Planning Frameworks (2017-2022)
      rdp2017_alignment: form.value.rdp2017_alignment?.length ? form.value.rdp2017_alignment : undefined,
      point_agenda_10: form.value.point_agenda_10?.length ? form.value.point_agenda_10 : undefined,
      // Other attributes
      project_engineer: form.value.project_engineer || undefined,
      project_manager: form.value.project_manager || undefined,
      building_type: form.value.building_type || undefined,
      floor_area: form.value.floor_area || undefined,
      // Schedule — Primary Dates
      start_date: form.value.start_date || undefined,
      target_completion_date: form.value.target_completion_date || undefined,
      actual_completion_date: form.value.actual_completion_date || undefined,
      // MH: prefer days-integer; coerce to existing `project_duration` text column
      project_duration: form.value.project_duration_days != null
        ? `${form.value.project_duration_days} days`
        : (form.value.project_duration || undefined),
      // Schedule — Revision Orders (MH)
      original_start_date: form.value.original_start_date || undefined,
      revised_start_date: form.value.revised_start_date || undefined,
      original_completion_date: form.value.original_completion_date || undefined,
      revised_completion_date: form.value.revised_completion_date || undefined,
      revised_project_duration: form.value.revised_project_duration || undefined,
      original_contract_duration: form.value.original_contract_duration || undefined,
      // XXX-K: Implementation Period (free-text, R-222)
      implementation_period: form.value.implementation_period || undefined,
      // Legacy supplementary (still persisted)
      contractor_id: form.value.contractor_id || undefined,
      contract_number: form.value.contract_number || undefined,
      number_of_floors: form.value.number_of_floors || undefined,
      latitude: form.value.latitude ?? undefined,
      longitude: form.value.longitude ?? undefined,
      summary: form.value.summary || undefined,
      scope: form.value.scope || undefined,
      facilities: form.value.facilities || undefined,
      // Progress / financial
      physical_progress: form.value.physical_progress ?? undefined,
      financial_progress: form.value.financial_progress ?? undefined,
      target_physical_progress: form.value.target_physical_progress ?? undefined,
      target_financial_progress: form.value.target_financial_progress ?? undefined,
      // MI: Progress & Financial Status
      as_of_date: form.value.as_of_date || undefined,
      cost_incurred_to_date: form.value.cost_incurred_to_date ?? undefined,
      // MI/OE: Remarks log — full fields; server stamps author from JWT on new entries (OE-C)
      remarks_log: form.value.remarks_log_entries?.length
        ? form.value.remarks_log_entries.map(r => ({
            id: r.id || undefined,
            text: r.text,
            created_at: r.createdAt,
            updated_at: r.updatedAt || undefined,
            updated_by: r.updatedBy || undefined,
            ...(r.author ? { author: r.author } : {}),
          }))
        : undefined,
      // PW-B: include live personnel draft in unified save.
      // getDraftAssignments() reads CiPersonnelAccessCard's live draft at save time — same
      // payload shape as saveAssignments(). Resolves PQ-A staleness concern by reading the
      // current draft rather than the last-fetched currentAssignedUsers snapshot.
      // If Personnel tab not yet rendered, ref is undefined → assignments omitted → backend
      // skips assignment update, preserving existing DB state (PW-D5 safe fallback).
      assignments: personnelCardRef.value?.getDraftAssignments(),
      // Strategic narrative + indicators (MG section 5)
      // NOTE: implementing_agency moved into Implementation Agencies block above
      strategic_alignment: form.value.strategic_alignment || undefined,
      // NC: prefer bullet-list arrays (canonical); fallback to legacy textarea
      output_indicators: form.value.output_indicators_list?.length
        ? form.value.output_indicators_list.map(s => s.trim()).filter(Boolean)
        : (form.value.output_indicators
            ? form.value.output_indicators.split('\n').map(s => s.trim()).filter(Boolean)
            : undefined),
      outcome_indicators: form.value.outcome_indicators_list?.length
        ? form.value.outcome_indicators_list.map(s => s.trim()).filter(Boolean)
        : (form.value.outcome_indicators
            ? form.value.outcome_indicators.split('\n').map(s => s.trim()).filter(Boolean)
            : undefined),
      project_status_category: form.value.project_status_category || undefined,
      // LD-A: send explicit arrays (including empty []) so clears propagate to DB
      status_updates: statusUpdateRows.value,
      readiness_documents: readinessDocRows.value,
      signatories: signatoryRows.value,
      // KW-F4: project monitoring logs
      // BBB-B: incident_log removed from save payload
      // XXX-M: risk_register/escalation_records removed — Project Governance section removed
      // GGG-E: Others-tab data banking
      project_notes_banking: {
        additionalNotes: notesAdditional.value || undefined,
        specialInstructions: notesSpecial.value || undefined,
        projectReferences: notesReferences.value.filter(r => r.label.trim()),
        historicalReferences: notesHistorical.value.filter(r => r.description.trim()),
        customMetadata: Object.fromEntries(notesMetadataRows.value.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value])),
        // ZZZ-D Ext: lightweight construction-project support functions
        lessonsLearned: lessonsLearned.value.filter(l => l.observation.trim()),
        // BBB-B: siteObservations removed from save payload
      },
      personnel_groups: {
        csu: csuPersonnelRows.value,
        contractor: contractorPersonnelRows.value,
        others: othersPersonnelRows.value,
      },
    }

    await api.patch(`/api/construction-projects/${projectId}`, payload)
    clearDraft(); hasUnsavedChanges.value = false
    toast.success('Project updated successfully')
    router.push(`/coi/detail-${projectId}`)
  } catch (err: unknown) {
    toast.error(mapApiError(err))
    console.error('[COI Edit] Failed to update:', err)
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push(`/coi/detail-${projectId}`)
}

// ===========================================================
// JO-E + JP-C: Documents tab (immediate upload to existing project)
// ===========================================================
interface EditDocItem {
  id: string
  documentType: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  description?: string
  // KO-G: additional metadata surfaced from Document entity
  category?: string
  createdAt?: string
  version?: number
  lifecycleStatus?: string
}

// KO-F: KB-E document type taxonomy item
interface DocumentTypeOption {
  id: string
  typeCode: string
  typeLabel: string
  groupCode: string
  groupLabel: string
}
const existingDocs = ref<EditDocItem[]>([])
const loadingDocs = ref(false)

// ===========================================================
// JV-A: Milestone state
// ===========================================================
interface EditMilestoneItem {
  id: string
  title: string
  description?: string
  status: string
  category?: string
  startDate?: string
  targetDate?: string
  actualStartDate?: string
  actualDate?: string
  progress: number
  remarks?: string
}
const existingMilestones = ref<EditMilestoneItem[]>([])
const loadingMilestones = ref(false)
const deletingMilestone = ref<Record<string, boolean>>({})

const milestoneDialog = ref(false)
const milestoneDialogMode = ref<'create' | 'edit'>('create')
const milestoneEditingId = ref<string | null>(null)
const milestoneSubmitting= ref(false)
const milestoneForm = ref({
  title: '',
  description: '',
  status: 'PENDING',
  category: '',
  start_date: '',
  target_date: '',
  actual_start_date: '',
  actual_date: '',
  progress: 0,
  remarks: '',
})

// LH-C: Pending MOV queue for milestone create mode
const pendingMilestoneMovs = ref<PendingMovEntry[]>([])

// LL-C: Date picker menu state for milestone form
const msStartDateMenu       = ref(false)
const msTargetDateMenu      = ref(false)
const msActualStartDateMenu = ref(false)
const msActualDateMenu      = ref(false)
// MH: Date picker menu state for Schedule tab (primary + revision orders)
const scStartDateMenu              = ref(false)
const scTargetCompletionMenu       = ref(false)
const scActualCompletionMenu       = ref(false)
const scOrigStartDateMenu          = ref(false)
const scRevStartDateMenu           = ref(false)
const scOrigCompletionDateMenu     = ref(false)
const scRevCompletionDateMenu      = ref(false)

// MI: Progress tab date menus
const progAsOfDateMenu       = ref(false)
const progDateCompletedMenu  = ref(false)
// OE: Remarks helpers removed — handled by CiRemarksLog component

// MH: Revision Order MOV upload state (immediate POST since project exists)
const revisionMovLink         = ref('')
const revisionMovFile         = ref<File | null>(null)
const uploadingRevisionMov    = ref(false)
async function uploadRevisionMov() {
  if (!revisionMovLink.value && !revisionMovFile.value) return
  uploadingRevisionMov.value = true
  try {
    if (revisionMovFile.value) {
      const fd = new FormData()
      fd.append('file', revisionMovFile.value)
      fd.append('documentType', 'revision_order_mov')
      fd.append('description', 'Variation Order MOV')
      await api.upload(`/api/construction-projects/${projectId}/documents`, fd)
    }
    if (revisionMovLink.value.trim()) {
      await api.post(`/api/construction-projects/${projectId}/documents`, {
        documentType: 'revision_order_mov',
        externalLink: revisionMovLink.value.trim(),
        title: 'Variation Order MOV',
        description: 'Documentary means of verification for variation orders',
      })
    }
    toast.success('Variation Order MOV uploaded')
    revisionMovLink.value = ''
    revisionMovFile.value = null
    // Refresh attached docs cache (function declared further below — hoisted)
    try { await fetchDocs() } catch { /* non-blocking */ }
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to upload MOV')
  } finally {
    uploadingRevisionMov.value = false
  }
}

const deleteMilestoneDialog = ref(false)
const deleteMilestoneTarget = ref<EditMilestoneItem | null>(null)

// LJ-A: Edit page timeline search / filter / sort / pagination refs — MUST precede LJ-B/C computeds
const milestoneEditSearch = ref('')
const milestoneEditStatus = ref('')
const milestoneEditSort   = ref<'asc' | 'desc'>('asc')
const milestoneEditPage   = ref(1)
const milestoneViewMode   = ref<'card' | 'list' | 'table'>('card')
const workLogEditSearch   = ref('')
const workLogEditType     = ref('')
const workLogEditSort     = ref<'asc' | 'desc'>('desc')
const workLogEditPage     = ref(1)
const editItemsPerPage    = 5

// LJ-B: Filtered + paged milestones for edit page timeline
const editFilteredMilestones = computed(() => {
  let ms = [...existingMilestones.value]
  if (milestoneEditSearch.value.trim())
    ms = ms.filter(m => m.title.toLowerCase().includes(milestoneEditSearch.value.toLowerCase()))
  if (milestoneEditStatus.value)
    ms = ms.filter(m => m.status === milestoneEditStatus.value)
  ms = ms.sort((a, b) => {
    const da = new Date(a.targetDate ?? 0).getTime()
    const db = new Date(b.targetDate ?? 0).getTime()
    return milestoneEditSort.value === 'asc' ? da - db : db - da
  })
  return ms
})
const pagedEditMilestones = computed(() => {
  const start = (milestoneEditPage.value - 1) * editItemsPerPage
  return editFilteredMilestones.value.slice(start, start + editItemsPerPage)
})
const milestoneEditTotalPages = computed(() =>
  Math.ceil(editFilteredMilestones.value.length / editItemsPerPage)
)

// LJ-C: Filtered + paged work log for edit page timeline
const editFilteredWorkLogs = computed(() => {
  let items = [...existingDiaryEntries.value]
  if (workLogEditSearch.value.trim())
    items = items.filter(e =>
      (e.title ?? '').toLowerCase().includes(workLogEditSearch.value.toLowerCase()) ||
      (e.description ?? '').toLowerCase().includes(workLogEditSearch.value.toLowerCase())
    )
  if (workLogEditType.value)
    items = items.filter(e => e.entryType === workLogEditType.value)
  items = items.sort((a, b) => {
    const da = new Date(a.entryDate ?? 0).getTime()
    const db = new Date(b.entryDate ?? 0).getTime()
    return workLogEditSort.value === 'asc' ? da - db : db - da
  })
  return items
})
const pagedEditWorkLogs = computed(() => {
  const start = (workLogEditPage.value - 1) * editItemsPerPage
  return editFilteredWorkLogs.value.slice(start, start + editItemsPerPage)
})
const workLogEditTotalPages = computed(() =>
  Math.ceil(editFilteredWorkLogs.value.length / editItemsPerPage)
)

// LJ: Reset pages on filter change
watch([milestoneEditSearch, milestoneEditStatus, milestoneEditSort], () => { milestoneEditPage.value = 1 })
watch([workLogEditSearch, workLogEditType, workLogEditSort], () => { workLogEditPage.value = 1 })

// LK-G: Batch dialog open state
const batchMilestoneOpen = ref(false)
const batchDiaryOpen     = ref(false)

const milestoneStatusOptions = [
  { title: 'Pending', value: 'PENDING' },
  { title: 'In Progress', value: 'IN_PROGRESS' },
  { title: 'Completed', value: 'COMPLETED' },
  { title: 'Delayed', value: 'DELAYED' },
  { title: 'Cancelled', value: 'CANCELLED' },
]

// JW-G: Timeline diary entries (per-period work log) state + CRUD
interface EditDiaryEntry {
  id: string
  entryType: string
  entryDate: string
  periodLabel?: string
  title: string
  description?: string
  weather?: string
  manpowerCount?: number
  equipmentUsed?: string
  workAccomplished?: string
  issuesEncountered?: string
}
const existingDiaryEntries = ref<EditDiaryEntry[]>([])
const loadingDiary = ref(false)
const deletingDiary = ref<Record<string, boolean>>({})

const diaryDialog = ref(false)
const diaryDialogMode = ref<'create' | 'edit'>('create')
const diaryEditingId = ref<string | null>(null)
const diarySubmitting= ref(false)
const diaryForm = ref({
  entry_type: 'WEEKLY',
  entry_date: '',
  period_label: '',
  title: '',
  description: '',
  weather: '',
  manpower_count: null as number | null,
  equipment_used: '',
  work_accomplished: '',
  issues_encountered: '',
  // LC-D: who filed this entry
  reporter_type: '' as string,
})

// LH-G: Pending MOV queue for diary create mode
const pendingDiaryMovs = ref<PendingMovEntry[]>([])

// (LJ-A refs declared before LJ-B/C computeds above)

// LL-D: Date picker menu state for diary form
const diaryEntryDateMenu = ref(false)

const deleteDiaryDialog = ref(false)
const deleteDiaryTarget = ref<EditDiaryEntry | null>(null)

const diaryEntryTypeOptions = [
  { title: 'Daily', value: 'DAILY' },
  { title: 'Weekly', value: 'WEEKLY' },
  { title: 'Monthly', value: 'MONTHLY' },
  { title: 'Quarterly', value: 'QUARTERLY' },
]

function formatMilestoneDate(d?: string | Date | null): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getMilestoneStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'grey',
    IN_PROGRESS: 'primary',
    COMPLETED: 'success',
    DELAYED: 'warning',
    CANCELLED: 'error',
  }
  return map[status] || 'grey'
}

const docFile = ref<File | null>(null)
const docType = ref('attachment')
// KO-F: Additional upload form fields (title + category alongside description)
const docTitle = ref('')
const docCategory = ref('')
const docDescription = ref('')
const docUploading = ref(false)

// KO-F: KB-E document type taxonomy
const documentTypes = ref<DocumentTypeOption[]>([])
async function fetchDocumentTypes() {
  try {
    const res = await api.get<DocumentTypeOption[] | { data: DocumentTypeOption[] }>(
      '/api/construction-projects/document-types',
    )
    documentTypes.value = Array.isArray(res) ? res : (res?.data || [])
  } catch (err) {
    console.error('[COI Edit] Failed to load KB-E document types:', err)
    documentTypes.value = []
  }
}
const documentTypeOptions = computed(() => {
  if (documentTypes.value.length === 0) {
    // Fallback to legacy hardcoded list when taxonomy not yet loaded / empty
    return [
      { title: 'Attachment', value: 'attachment' },
      { title: 'MOV', value: 'mov' },
      { title: 'Specification', value: 'specification' },
      { title: 'Contract', value: 'contract' },
      { title: 'Other', value: 'other' },
    ]
  }
  return documentTypes.value.map(t => ({
    title: `[${t.groupLabel}] ${t.typeLabel}`,
    value: t.typeCode,
  }))
})

// KQ-C: Map typeCode → human-readable label for section headers
const typeCodeToLabel = computed(() => {
  const map: Record<string, string> = {}
  documentTypes.value.forEach(t => { map[t.typeCode] = `[${t.groupLabel}] ${t.typeLabel}` })
  return map
})

// KQ-C: Auto-derive category (groupCode) when documentType selection changes
watch(docType, (newType) => {
  const match = documentTypes.value.find(t => t.typeCode === newType)
  docCategory.value = match?.groupCode ?? ''
})

// KV-E2: Key docs vs Other docs split
const keyDocTypeSet = new Set(KEY_DOC_TYPECODES as readonly string[])
const keyDocs = computed(() => existingDocs.value.filter(d => keyDocTypeSet.has(d.documentType ?? '')))
const otherDocs = computed(() => existingDocs.value.filter(d => !keyDocTypeSet.has(d.documentType ?? '')))

// ZP: Global attachment filter
const attachmentFilter = ref('')
function attachmentMatches(text: string | undefined): boolean {
  if (!attachmentFilter.value) return true
  return (text ?? '').toLowerCase().includes(attachmentFilter.value.toLowerCase())
}
const filteredKeyDocs = computed(() => keyDocs.value.filter(d => attachmentMatches(d.fileName)))
const filteredOtherDocs = computed(() => otherDocs.value.filter(d => attachmentMatches(d.fileName)))
const filteredProfileGallery = computed(() => existingGallery.value.filter(g => g.category === 'PROFILE' && attachmentMatches(g.caption ?? g.category)))
const filteredGeneralGallery = computed(() => existingGallery.value.filter(g => g.category !== 'PROFILE' && attachmentMatches(g.caption ?? g.category)))
const keyDocTypeOptions = computed(() => documentTypeOptions.value.filter(o => keyDocTypeSet.has(o.value)))
const otherDocTypeOptions = computed(() => documentTypeOptions.value.filter(o => !keyDocTypeSet.has(o.value)))
// LA-B: Static fallback when taxonomy not seeded (keyDocTypeOptions would be empty)
const keyDocFallbackOptions = [
  { title: 'Project Profile', value: 'PROJECT_PROFILE' },
  { title: 'Feasibility Study', value: 'FEASIBILITY_STUDY' },
  { title: 'HGDG Form', value: 'HGDG_FORM' },
  { title: 'Floor Plan', value: 'FLOOR_PLAN' },
  { title: 'Program of Works (POW)', value: 'POW' },
]

// KW-A1: Gallery inner tab model (fixes unlinked v-tabs / v-window in Attachments tab)
const galleryActiveTab = ref<'profile' | 'general'>('profile')

// KV-G: Fullscreen modal state per section
const keyDocsFullscreen = ref(false)
const galleryFullscreen = ref(false)
const checklistFullscreen = ref(false)
const otherDocsFullscreen = ref(false)

// KW-A2: Separate upload refs for Key Documents (isolated from Other Attachments)
const keyDocFile      = ref<File | null>(null)
const keyDocType      = ref('')
const keyDocTitle     = ref('')
const keyDocUploading = ref(false)

// KW-A2: Key Documents upload function (isolated refs, no collision with Other Attachments)
async function uploadKeyDoc() {
  if (!keyDocFile.value) return
  if (keyDocFile.value.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB'); return }
  keyDocUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', keyDocFile.value)
    fd.append('documentType', keyDocType.value || 'other')
    if (keyDocTitle.value) fd.append('title', keyDocTitle.value)
    await api.upload(`/api/construction-projects/${projectId}/documents`, fd)
    toast.success('Key document uploaded')
    keyDocFile.value = null
    keyDocType.value = ''
    keyDocTitle.value = ''
    await fetchDocs()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Upload failed')
  } finally {
    keyDocUploading.value = false
  }
}

// ZP: Drag-and-drop upload handler for Key Documents and Other Attachments
async function handleKeyDocDrop(event: DragEvent) {
  if (!canUploadDocuments.value) return
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (!files.length) return
  const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip']
  const valid = files.filter(f => allowed.some(ext => f.name.toLowerCase().endsWith(ext)))
  if (!valid.length) { toast.error('No valid file types. Accepted: PDF, DOCX, XLSX, ZIP'); return }
  for (const file of valid) {
    if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} exceeds 20 MB`); continue }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('documentType', 'other')
    try { await api.upload(`/api/construction-projects/${projectId}/documents`, fd) }
    catch { toast.error(`Upload failed: ${file.name}`) }
  }
  await fetchDocs()
  toast.success(`${valid.length} file(s) uploaded`)
}

async function handleOtherDocDrop(event: DragEvent) {
  if (!canUploadDocuments.value) return
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (!files.length) return
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} exceeds 20 MB`); continue }
    const fd = new FormData()
    fd.append('file', file)
    try { await api.upload(`/api/construction-projects/${projectId}/documents`, fd) }
    catch { toast.error(`Upload failed: ${file.name}`) }
  }
  await fetchDocs()
  toast.success(`${files.length} file(s) uploaded`)
}

// KW-G: MOV evidence aggregated view
const movEntries = ref<any[]>([])
async function fetchMovEntries() {
  try {
    const res = await api.get<any>(`/api/construction-projects/${projectId}/mov-entries`)
    movEntries.value = Array.isArray(res) ? res : (res?.data || [])
  } catch {
    movEntries.value = []
  }
}

// KV-D: Group remarks handler
async function handleRemarksUpdate(groupCode: string, remarks: string) {
  try {
    await api.patch(`/api/construction-projects/${projectId}/document-remarks`, { groupCode, remarks })
  } catch (err) {
    console.error('[COI Edit] Failed to save checklist remarks:', err)
  }
}

const profileImageFile = ref<File | null>(null)
const profileImageCaption = ref('')
// LD-B: optional photo capture date for profile uploads
const profileImageTakenDate = ref('')
const profileUploading = ref(false)

const galleryImageFile = ref<File | null>(null)
const galleryImageCaption = ref('')
const imageCategory = ref('IN_PROGRESS')
// LB-C: user-supplied photo capture date
const galleryImageTakenDate = ref('')
const imageUploading = ref(false)

const linkUrl = ref('')
const linkTitle = ref('')
const linkDescription = ref('')
const linkSubmitting = ref(false)

const EDIT_EXTERNAL_URL_REGEX = /^https?:\/\/.+/i

// KH-A: docsByCategory groups existing documents by documentType for grouped display
const docsByCategory = computed(() => {
  const groups: Record<string, EditDocItem[]> = {}
  for (const doc of existingDocs.value) {
    const key = doc.documentType || 'other'
    if (!groups[key]) groups[key] = []
    groups[key].push(doc)
  }
  return groups
})

// KV-E7: external links (google-drive MIME type) separated from file docs
const documentLinks = computed(() => existingDocs.value.filter(d => d.mimeType === 'application/x-google-drive-link'))
interface EditGalleryItem {
  id: string
  imageUrl: string   // KX-A: was filePath — backend ConstructionGallery entity uses imageUrl
  caption?: string
  category?: string
}
const existingGallery = ref<EditGalleryItem[]>([])
const loadingGallery = ref(false)
const deletingGallery = ref<Record<string, boolean>>({})
const deletingDoc = ref<Record<string, boolean>>({})

// KF-AB: Separate PROFILE images from general gallery (max 3 PROFILE per project)
const profileGalleryImages = computed(() => existingGallery.value.filter(g => g.category === 'PROFILE'))
const generalGalleryImages = computed(() => existingGallery.value.filter(g => g.category !== 'PROFILE'))

async function fetchGallery() {
  if (!projectId) return
  loadingGallery.value = true
  try {
    const res = await api.get<{ data: EditGalleryItem[] }>(
      `/api/construction-projects/${projectId}/gallery`
    )
    existingGallery.value = res.data || []
  } catch (err) {
    console.error('[COI Edit] Failed to fetch gallery:', err)
  } finally {
    loadingGallery.value = false
  }
}

async function deleteGalleryItem(galleryId: string) {
  deletingGallery.value[galleryId] = true
  try {
    await api.del(`/api/construction-projects/${projectId}/gallery/${galleryId}`)
    existingGallery.value = existingGallery.value.filter(img => img.id !== galleryId)
    toast.success('Image removed')
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to remove image')
  } finally {
    deletingGallery.value[galleryId] = false
  }
}

async function deleteDocument(docId: string) {
  deletingDoc.value[docId] = true
  try {
    await api.del(`/api/construction-projects/${projectId}/documents/${docId}`)
    existingDocs.value = existingDocs.value.filter(d => d.id !== docId)
    toast.success('Attachment removed')
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to remove attachment')
  } finally {
    deletingDoc.value[docId] = false
  }
}

async function fetchDocs() {
  if (!projectId) return
  loadingDocs.value = true
  try {
    const res = await api.get<{ data: EditDocItem[] }>(
      `/api/construction-projects/${projectId}/documents`
    )
    existingDocs.value = res.data || []
  } catch (err) {
    console.error('[COI Edit] Failed to fetch documents:', err)
  } finally {
    loadingDocs.value = false
  }
}

// ===========================================================
// JV-A: Milestone CRUD handlers
// ===========================================================
async function fetchMilestones() {
  if (!projectId) return
  loadingMilestones.value = true
  try {
    const res = await api.get<EditMilestoneItem[] | { data: EditMilestoneItem[] }>(
      `/api/construction-projects/${projectId}/milestones`
    )
    const milestoneList = Array.isArray(res) ? res : (res?.data || [])
    existingMilestones.value = milestoneList.map(m => ({
      ...m,
      progress: typeof m.progress === 'string' ? parseFloat(m.progress) : (m.progress ?? 0),
    }))
  } catch (err) {
    console.error('[COI Edit] Failed to fetch milestones:', err)
  } finally {
    loadingMilestones.value = false
  }
}

function resetMilestoneForm() {
  milestoneForm.value = {
    title: '',
    description: '',
    status: 'PENDING',
    category: '',
    start_date: '',
    target_date: '',
    actual_start_date: '',
    actual_date: '',
    progress: 0,
    remarks: '',
  }
  milestoneEditingId.value = null
}

function openCreateMilestone() {
  resetMilestoneForm()
  milestoneDialogMode.value = 'create'
  milestoneDialog.value = true
}

function openEditMilestone(m: EditMilestoneItem) {
  milestoneForm.value = {
    title: m.title,
    description: m.description || '',
    status: m.status || 'PENDING',
    category: m.category || '',
    start_date: m.startDate ? String(m.startDate).split('T')[0] : '',
    target_date: m.targetDate ? String(m.targetDate).split('T')[0] : '',
    actual_start_date: m.actualStartDate ? String(m.actualStartDate).split('T')[0] : '',
    actual_date: m.actualDate ? String(m.actualDate).split('T')[0] : '',
    progress: typeof m.progress === 'number' ? m.progress : parseFloat(String(m.progress)) || 0,
    remarks: m.remarks || '',
  }
  milestoneEditingId.value = m.id
  milestoneDialogMode.value = 'edit'
  milestoneDialog.value = true
}

async function saveMilestone() {
  if (!milestoneForm.value.title.trim()) {
    toast.error('Title is required')
    return
  }
  milestoneSubmitting.value = true
  try {
    const payload = {
      title: milestoneForm.value.title.trim(),
      description: milestoneForm.value.description || undefined,
      status: milestoneForm.value.status || undefined,
      category: milestoneForm.value.category || undefined,
      start_date: milestoneForm.value.start_date || undefined,
      target_date: milestoneForm.value.target_date || undefined,
      actual_start_date: milestoneForm.value.actual_start_date || undefined,
      actual_date: milestoneForm.value.actual_date || undefined,
      progress: milestoneForm.value.progress ?? undefined,
      remarks: milestoneForm.value.remarks || undefined,
    }
    if (milestoneDialogMode.value === 'create') {
      const created = await api.post<{ id: string }>(`/api/construction-projects/${projectId}/milestones`, payload)
      const createdId = (created as any)?.id as string
      // LH-D / LM-E / LM-B: Drain pending MOV queue — fire-and-forget; failures do not rollback entity
      const movFailures: string[] = []
      for (const mov of pendingMilestoneMovs.value) {
        if (!mov.title.trim()) continue
        try {
          const movRes = await api.post<any>(`/api/construction-projects/${projectId}/mov-entries`, {
            related_entity_type: 'MILESTONE',
            related_entity_id: createdId,
            mov_title: mov.title.trim(),
            ...(mov.link.trim()        ? { mov_link: mov.link.trim() }               : {}),
            ...(mov.entryDate          ? { entry_date: mov.entryDate }                : {}),
            ...(mov.category           ? { evidence_category: mov.category }          : {}),
            ...(mov.description.trim() ? { mov_description: mov.description.trim() }  : {}),
            ...(mov.remarks.trim()     ? { remarks: mov.remarks.trim() }              : {}),
          })
          // LM-B-2: Upload file if present (non-blocking — failure shows toast)
          const movId = (movRes as any)?.id ?? (movRes as any)?.data?.id
          if (mov.file && movId) {
            try {
              const fd = new FormData()
              fd.append('file', mov.file)
              await api.post(
                `/api/construction-projects/${projectId}/mov-entries/${movId}/upload-file`,
                fd,
              )
            } catch {
              toast.warning(`MOV entry "${mov.title}" created but file upload failed — attach manually`)
            }
          }
        } catch {
          movFailures.push(mov.title)
        }
      }
      if (movFailures.length) {
        toast.error(`Milestone saved but ${movFailures.length} MOV item(s) failed to attach`)
      } else {
        toast.success('Milestone added')
      }
      // LH-E: Close dialog + reset — no edit-mode transition
      milestoneDialog.value = false
      pendingMilestoneMovs.value = []
      resetMilestoneForm()
    } else if (milestoneEditingId.value) {
      await api.patch(
        `/api/construction-projects/${projectId}/milestones/${milestoneEditingId.value}`,
        payload
      )
      toast.success('Milestone updated')
      milestoneDialog.value = false
      resetMilestoneForm()
    }
    await fetchMilestones()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to save milestone')
  } finally {
    milestoneSubmitting.value = false
  }
}

function confirmDeleteMilestone(m: EditMilestoneItem) {
  deleteMilestoneTarget.value = m
  deleteMilestoneDialog.value = true
}

async function executeDeleteMilestone() {
  if (!deleteMilestoneTarget.value) return
  const id = deleteMilestoneTarget.value.id
  deletingMilestone.value[id] = true
  try {
    await api.del(`/api/construction-projects/${projectId}/milestones/${id}`)
    existingMilestones.value = existingMilestones.value.filter(m => m.id !== id)
    toast.success('Milestone deleted')
    deleteMilestoneDialog.value = false
    deleteMilestoneTarget.value = null
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to delete milestone')
  } finally {
    deletingMilestone.value[id] = false
  }
}

function formatCurrency(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (Number.isNaN(n)) return '₱0.00'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

// JW-G: Diary CRUD
async function fetchDiaryEntries() {
  if (!projectId) return
  loadingDiary.value = true
  try {
    const res = await api.get<EditDiaryEntry[] | { data: EditDiaryEntry[] }>(
      `/api/construction-projects/${projectId}/timeline-entries`
    )
    const list = Array.isArray(res) ? res : (res?.data || [])
    existingDiaryEntries.value = list.map((e: any) => ({
      id: e.id,
      entryType: e.entryType || e.entry_type || 'WEEKLY',
      entryDate: typeof e.entryDate === 'string' ? e.entryDate : (e.entryDate ? new Date(e.entryDate).toISOString().slice(0, 10) : ''),
      periodLabel: e.periodLabel || e.period_label,
      title: e.title,
      description: e.description,
      weather: e.weather,
      manpowerCount: e.manpowerCount ?? e.manpower_count,
      equipmentUsed: e.equipmentUsed || e.equipment_used,
      workAccomplished: e.workAccomplished || e.work_accomplished,
      issuesEncountered: e.issuesEncountered || e.issues_encountered,
    }))
  } catch (err: unknown) {
    console.error('[COI Edit] Failed to fetch timeline entries:', err)
  } finally {
    loadingDiary.value = false
  }
}

function openCreateDiary() {
  diaryForm.value = {
    entry_type: 'WEEKLY',
    entry_date: new Date().toISOString().slice(0, 10),
    period_label: '',
    title: '',
    description: '',
    weather: '',
    manpower_count: null,
    equipment_used: '',
    work_accomplished: '',
    issues_encountered: '',
    reporter_type: '',
  }
  diaryEditingId.value = null
  diaryDialogMode.value = 'create'
  diaryDialog.value = true
}

function openEditDiary(e: EditDiaryEntry) {
  diaryForm.value = {
    entry_type: e.entryType,
    entry_date: e.entryDate || '',
    period_label: e.periodLabel || '',
    title: e.title,
    description: e.description || '',
    weather: e.weather || '',
    manpower_count: e.manpowerCount ?? null,
    equipment_used: e.equipmentUsed || '',
    work_accomplished: e.workAccomplished || '',
    issues_encountered: e.issuesEncountered || '',
    reporter_type: (e as any).reporterType || '',
  }
  diaryEditingId.value = e.id
  diaryDialogMode.value = 'edit'
  diaryDialog.value = true
}

async function saveDiary() {
  if (!diaryForm.value.title.trim()) {
    toast.error('Title is required')
    return
  }
  if (!diaryForm.value.entry_date) {
    toast.error('Entry date is required')
    return
  }
  diarySubmitting.value = true
  try {
    const payload: Record<string, unknown> = {
      entry_type: diaryForm.value.entry_type || 'WEEKLY',
      entry_date: diaryForm.value.entry_date,
      title: diaryForm.value.title.trim(),
      period_label: diaryForm.value.period_label || undefined,
      description: diaryForm.value.description || undefined,
      weather: diaryForm.value.weather || undefined,
      manpower_count: diaryForm.value.manpower_count ?? undefined,
      equipment_used: diaryForm.value.equipment_used || undefined,
      work_accomplished: diaryForm.value.work_accomplished || undefined,
      issues_encountered: diaryForm.value.issues_encountered || undefined,
      reporter_type: diaryForm.value.reporter_type || undefined,
    }
    if (diaryDialogMode.value === 'create') {
      const created = await api.post<{ id: string }>(`/api/construction-projects/${projectId}/timeline-entries`, payload)
      const createdId = (created as any)?.id as string
      // LH-H / LM-E / LM-B: Drain pending MOV queue — fire-and-forget; failures do not rollback entity
      const movFailures: string[] = []
      for (const mov of pendingDiaryMovs.value) {
        if (!mov.title.trim()) continue
        try {
          const movRes = await api.post<any>(`/api/construction-projects/${projectId}/mov-entries`, {
            related_entity_type: 'TIMELINE_ENTRY',
            related_entity_id: createdId,
            mov_title: mov.title.trim(),
            ...(mov.link.trim()        ? { mov_link: mov.link.trim() }               : {}),
            ...(mov.entryDate          ? { entry_date: mov.entryDate }                : {}),
            ...(mov.category           ? { evidence_category: mov.category }          : {}),
            ...(mov.description.trim() ? { mov_description: mov.description.trim() }  : {}),
            ...(mov.remarks.trim()     ? { remarks: mov.remarks.trim() }              : {}),
          })
          // LM-B-2: Upload file if present (non-blocking)
          const movId = (movRes as any)?.id ?? (movRes as any)?.data?.id
          if (mov.file && movId) {
            try {
              const fd = new FormData()
              fd.append('file', mov.file)
              await api.post(
                `/api/construction-projects/${projectId}/mov-entries/${movId}/upload-file`,
                fd,
              )
            } catch {
              toast.warning(`MOV entry "${mov.title}" created but file upload failed — attach manually`)
            }
          }
        } catch {
          movFailures.push(mov.title)
        }
      }
      if (movFailures.length) {
        toast.error(`Entry saved but ${movFailures.length} MOV item(s) failed to attach`)
      } else {
        toast.success('Diary entry added')
      }
      // LH-I: Close dialog + reset — no edit-mode transition
      diaryDialog.value = false
      pendingDiaryMovs.value = []
      diaryEditingId.value = null
    } else if (diaryEditingId.value) {
      await api.patch(
        `/api/construction-projects/${projectId}/timeline-entries/${diaryEditingId.value}`,
        payload,
      )
      toast.success('Diary entry updated')
      diaryDialog.value = false
      diaryEditingId.value = null
    }
    await fetchDiaryEntries()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to save diary entry')
  } finally {
    diarySubmitting.value = false
  }
}

function confirmDeleteDiary(e: EditDiaryEntry) {
  deleteDiaryTarget.value = e
  deleteDiaryDialog.value = true
}

async function executeDeleteDiary() {
  if (!deleteDiaryTarget.value) return
  const id = deleteDiaryTarget.value.id
  deletingDiary.value[id] = true
  try {
    await api.del(`/api/construction-projects/${projectId}/timeline-entries/${id}`)
    existingDiaryEntries.value = existingDiaryEntries.value.filter(e => e.id !== id)
    toast.success('Diary entry deleted')
    deleteDiaryDialog.value = false
    deleteDiaryTarget.value = null
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to delete diary entry')
  } finally {
    deletingDiary.value[id] = false
  }
}

function getEntryTypeColor(entryType: string): string {
  const map: Record<string, string> = {
    DAILY: 'info',
    WEEKLY: 'primary',
    MONTHLY: 'success',
    QUARTERLY: 'warning',
  }
  return map[entryType] || 'grey'
}

async function uploadEditDoc() {
  if (!docFile.value) return
  if (docFile.value.size > 20 * 1024 * 1024) {
    toast.error('File exceeds 20 MB. Use an external link instead.')
    return
  }
  docUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', docFile.value)
    fd.append('documentType', docType.value)
    // KO-F: forward optional title + category to backend
    if (docTitle.value) fd.append('title', docTitle.value)
    if (docCategory.value) fd.append('category', docCategory.value)
    if (docDescription.value) fd.append('description', docDescription.value)
    await api.upload(`/api/construction-projects/${projectId}/documents`, fd)
    toast.success('Document uploaded')
    docFile.value = null
    docType.value = 'attachment'
    docTitle.value = ''
    docCategory.value = ''
    docDescription.value = ''
    await fetchDocs()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to upload document')
  } finally {
    docUploading.value = false
  }
}

async function uploadProfileImage() {
  if (!profileImageFile.value) return
  if (profileImageFile.value.size > 10 * 1024 * 1024) {
    toast.error('Image exceeds 10 MB.')
    return
  }
  profileUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', profileImageFile.value)
    if (profileImageCaption.value) fd.append('caption', profileImageCaption.value)
    fd.append('category', 'PROFILE')
    // LD-B: include optional photo capture date
    if (profileImageTakenDate.value) fd.append('image_taken_date', profileImageTakenDate.value)
    await api.upload(`/api/construction-projects/${projectId}/gallery`, fd)
    toast.success('Profile image uploaded')
    profileImageFile.value = null
    profileImageCaption.value = ''
    profileImageTakenDate.value = ''
    await fetchGallery()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to upload image')
  } finally {
    profileUploading.value = false
  }
}

async function uploadGalleryImage() {
  if (!galleryImageFile.value) return
  if (galleryImageFile.value.size > 10 * 1024 * 1024) {
    toast.error('Image exceeds 10 MB.')
    return
  }
  imageUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', galleryImageFile.value)
    if (galleryImageCaption.value) fd.append('caption', galleryImageCaption.value)
    fd.append('category', imageCategory.value)
    // LB-C: send user-supplied photo capture date when provided
    if (galleryImageTakenDate.value) fd.append('image_taken_date', galleryImageTakenDate.value)
    await api.upload(`/api/construction-projects/${projectId}/gallery`, fd)
    toast.success('Image uploaded')
    galleryImageFile.value = null
    galleryImageCaption.value = ''
    imageCategory.value = 'IN_PROGRESS'
    galleryImageTakenDate.value = ''
    await fetchGallery()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to upload image')
  } finally {
    imageUploading.value = false
  }
}

async function submitEditLink() {
  if (!linkUrl.value || !EDIT_EXTERNAL_URL_REGEX.test(linkUrl.value)) {
    toast.error('Must be a valid URL starting with https://')
    return
  }
  linkSubmitting.value = true
  try {
    await api.post(`/api/construction-projects/${projectId}/documents`, {
      documentType: 'link',
      externalLink: linkUrl.value,
      title: linkTitle.value || undefined,
      description: linkDescription.value || undefined,
    })
    toast.success('External link added')
    linkUrl.value = ''
    linkTitle.value = ''
    linkDescription.value = ''
    await fetchDocs()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to add link')
  } finally {
    linkSubmitting.value = false
  }
}

// WWW-D: Autosave — localStorage draft + beforeunload warning (edit page)
const hasUnsavedChanges = ref(false)
const draftRestoreSnackbar = ref(false)
const DRAFT_KEY = computed(() => `coi-draft-${projectId}`)

// XXX-C: lastSavedAt tracks when the draft was last auto-saved for display
const lastSavedAt = ref<number | null>(null)
const lastSavedLabel = computed(() => {
  if (!lastSavedAt.value) return null
  const diff = Math.floor((Date.now() - lastSavedAt.value) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
})
let elapsedTick: ReturnType<typeof setInterval> | null = null

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY.value, JSON.stringify({ ts: Date.now(), form: JSON.parse(JSON.stringify(form.value)) }))
    lastSavedAt.value = Date.now()  // XXX-C
  } catch { /* quota exceeded — silently skip */ }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY.value)
}

let draftDebounce: ReturnType<typeof setTimeout> | null = null
watch(form, () => {
  hasUnsavedChanges.value = true
  if (draftDebounce) clearTimeout(draftDebounce)
  draftDebounce = setTimeout(saveDraft, 2000)
}, { deep: true })

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) { e.preventDefault(); e.returnValue = '' }
}

function restoreDraft() {
  try {
    const saved = localStorage.getItem(DRAFT_KEY.value)
    if (saved) {
      const { form: savedForm } = JSON.parse(saved)
      Object.assign(form.value, savedForm)
      // EEE-C: restored draft is NOT yet saved to the server — keep the unsaved flag
      hasUnsavedChanges.value = true
      toast.success('Draft restored. Note: file attachments are not recoverable — re-attach if needed.')
    }
  } catch { toast.error('Could not restore draft') }
  draftRestoreSnackbar.value = false
}

onMounted(() => {
  fetchData()
  fetchDocs()
  fetchGallery()
  fetchMilestones()  // JV-A
  fetchDiaryEntries()  // JW-G
  fetchDocumentTypes()  // KO-F: load KB-E taxonomy for upload form
  fetchMovEntries()  // KW-G: MOV evidence aggregation
  window.addEventListener('beforeunload', handleBeforeUnload)
  // XXX-C: poll to refresh "X ago" label every 30s
  elapsedTick = setInterval(() => { if (lastSavedAt.value) lastSavedAt.value = lastSavedAt.value }, 30_000)
  // Check for saved draft
  const saved = localStorage.getItem(DRAFT_KEY.value)
  if (saved) {
    try {
      const { ts } = JSON.parse(saved)
      if (Date.now() - ts < 24 * 60 * 60 * 1000) draftRestoreSnackbar.value = true
      else clearDraft()
    } catch { clearDraft() }
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (draftDebounce) clearTimeout(draftDebounce)
  if (elapsedTick) clearInterval(elapsedTick)  // XXX-C
})
</script>

<template>
  <div>
    <!-- WWW-D: Draft restore notification -->
    <v-snackbar v-model="draftRestoreSnackbar" :timeout="-1" color="info" location="bottom left">
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-content-save-outline" />
        <span>Unsaved form draft found. Restore? (File attachments cannot be restored.)</span>
      </div>
      <template #actions>
        <v-btn variant="text" @click="restoreDraft">Restore</v-btn>
        <v-btn variant="text" @click="draftRestoreSnackbar = false; clearDraft()">Dismiss</v-btn>
      </template>
    </v-snackbar>

    <!-- Header -->
    <div class="d-flex align-center ga-3 mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          Edit Project
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          {{ form.project_code }} - {{ form.title }}
        </p>
      </div>
    </div>

    <!-- PHASE BBBD (Track 7): project-level access notice (presentation only; authZ unchanged) -->
    <v-alert
      v-if="showNotAssignedNotice"
      type="warning"
      variant="tonal"
      class="mb-4"
      icon="mdi-account-lock-outline"
    >
      You have module access but are not assigned to this project. Please contact your administrator.
    </v-alert>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article" />
    </v-card>

    <!-- WB-C: filter-before-render — defer the entire form until RBAC is resolved.
         No tab/window mounts during the auth/project hydration window. -->
    <v-card v-else-if="!accessResolved" class="pa-6">
      <v-skeleton-loader type="article" />
    </v-card>

    <!-- Form (JP-D: Tabbed Layout — mirrors new.vue) -->
    <v-form v-else @submit.prevent="handleSubmit">
      <!-- Step progress indicator -->
      <v-card class="mb-2 pa-3">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 font-weight-medium">
            Step {{ currentStepIndex + 1 }} of {{ visibleTabOrder.length }}
          </span>
          <v-chip
            size="small"
            :color="completionPercentage === 100 ? 'success' : 'primary'"
            variant="tonal"
          >
            {{ completionPercentage }}% complete
          </v-chip>
        </div>
        <v-progress-linear
          :model-value="completionPercentage"
          :color="completionPercentage === 100 ? 'success' : 'primary'"
          height="6"
          rounded
        />
      </v-card>

      <!-- KD-B: Guide card -->
      <CiProjectGuideCard
        page-key="edit"
        title="Editing Project"
        :content="[
          '8 tabs — Contract &amp; Funding fields are in Basic Info; supplementary records in Others',
          'Progress reports, milestones, and timelogs are in the Progress Report tab',
          'All tabs are optional — save partial progress at any time',
        ]"
      />

      <!-- Tab Navigation Header -->
      <v-card class="mb-4">
        <!-- PR-C: tabs gated by visibleTabOrder — single source of truth (EDIT_TAB_PERM_MAP) -->
        <v-tabs v-model="activeTab" color="primary" grow>
          <v-tab v-if="visibleTabOrder.includes('basic')" value="basic">
            <v-icon start>mdi-information-outline</v-icon>
            Project Profile
            <v-icon v-if="tabCompletion.basic" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab v-if="visibleTabOrder.includes('schedule')" value="schedule">
            <v-icon start>mdi-calendar-range</v-icon>
            Dates &amp; Duration
            <v-icon v-if="tabCompletion.schedule" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab v-if="visibleTabOrder.includes('progress')" value="progress">
            <v-icon start>mdi-chart-line</v-icon>
            Progress Report
            <v-icon v-if="tabCompletion.progress" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab v-if="visibleTabOrder.includes('personnel')" value="personnel">
            <v-icon start>mdi-account-group</v-icon>
            Personnel
            <v-icon v-if="tabCompletion.personnel" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab v-if="visibleTabOrder.includes('documents')" value="documents">
            <v-icon start>mdi-paperclip</v-icon>
            Attachments
            <v-icon v-if="tabCompletion.documents" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab v-if="visibleTabOrder.includes('others')" value="others">
            <v-icon start>mdi-dots-horizontal-circle-outline</v-icon>
            Others
            <v-icon v-if="tabCompletion.others" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
        </v-tabs>
      </v-card>

      <!-- XB-A: v-window unmounts entirely when no tabs are visible (contractor deny-all).
           Prevents any window-item content from rendering without a visible tab chip. -->
      <v-window v-if="visibleTabOrder.length > 0" v-model="activeTab">
        <!-- ============= TAB 1: BASIC INFO (KE-AA: merged Basic + Profile) ============= -->
        <!-- XB-B: v-if mirrors the <v-tab> guard — content unmounts when tab chip is hidden -->
        <v-window-item v-if="visibleTabOrder.includes('basic')" value="basic">
          <!-- AAA-I: tab guidance banner -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
            Complete the project identity, location, funding, objectives, and strategic alignment. Title, Project Code, Campus, Status, and Funding Source are required to save.
          </v-alert>
          <!-- PT-A: readOnly gates list-type + hierarchical selector fields for non-editors -->
          <CiBasicInfoForm
            v-model="form"
            :funding-sources="fundingSources"
            :contractors="contractors"
            :rules="rules"
            :read-only="!canEditCurrentProject"
          />
        </v-window-item>

        <!-- ============= TAB 3: SCHEDULE (KE-D: renamed to Dates & Duration) ============= -->
        <v-window-item v-if="visibleTabOrder.includes('schedule')" value="schedule">
          <!-- AAA-I: tab guidance banner -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
            Record contract dates, original and revised durations, and project completion dates. These dates drive the analytics timeline and WAR/MPR period calculations.
          </v-alert>
          <!-- MH: Primary Project Dates -->
          <v-card class="mb-4" elevation="2" rounded="lg">
            <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
              <v-icon size="small" icon="mdi-calendar-clock" color="primary" />
              <span class="text-subtitle-1 font-weight-medium">Primary Project Dates</span>
            </v-card-title>
            <v-card-subtitle class="pt-2 pb-2 text-body-2 text-grey-darken-1" style="white-space: normal;">
              Initial planned project schedule. Target dates reflect the original schedule; Project Duration (Days) is the planned contract period.
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="py-3">
              <v-row dense>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="scStartDateMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.start_date"
                        label="Target Start Date"
                        prepend-inner-icon="mdi-calendar"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.start_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.start_date)"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.start_date = toIsoDate(v); scStartDateMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="scTargetCompletionMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.target_completion_date"
                        label="Target Completion Date"
                        prepend-inner-icon="mdi-calendar-check"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.target_completion_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.target_completion_date)"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.target_completion_date = toIsoDate(v); scTargetCompletionMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-text-field
                    v-model.number="form.project_duration_days"
                    label="Project Duration (Days)"
                    type="number" min="0"
                    placeholder="e.g., 365"
                    prepend-inner-icon="mdi-timer-sand"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="scActualCompletionMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.actual_completion_date"
                        label="Actual Completion Date"
                        prepend-inner-icon="mdi-flag-checkered"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.actual_completion_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.actual_completion_date)"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.actual_completion_date = toIsoDate(v); scActualCompletionMenu = false }"
                    />
                  </v-menu>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <v-card class="mb-3" elevation="2" rounded="lg">
            <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
              <v-icon size="small" icon="mdi-file-document-edit-outline" color="warning" />
              <span class="text-subtitle-1 font-weight-medium">Variation Orders</span>
              <v-chip size="x-small" variant="tonal" color="warning" class="ml-1">VOR / CTE</v-chip>
            </v-card-title>
            <v-card-subtitle class="pt-2 pb-2 text-body-2 text-grey-darken-1" style="white-space: normal;">
              Contract-time and schedule amendments (VOR, CTE). Each entry requires a Means of Verification (MOV). Date governance is centralized here in Dates &amp; Duration.
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="pt-3">
              <CiRevisionOrdersTable
                :project-id="projectId"
                :can-delete="canDeleteResources"
                :can-create="canCreateResources"
                class="mb-1"
              />
            </v-card-text>
          </v-card>

        </v-window-item>


        <!-- ============= TAB: PROGRESS REPORT (MI → NG refactor) ============= -->
        <v-window-item v-if="visibleTabOrder.includes('progress')" value="progress">

          <!-- ── SECTION 1: Progress Reports ── -->
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon icon="mdi-chart-line" color="primary" size="small" />
            <span class="text-subtitle-1 font-weight-semibold">Progress Reports</span>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-3">Monthly and weekly progress reports tracking physical and financial accomplishment, slippage, and cost per reporting period.</p>
          <CiProgressReportTab
            :project-id="projectId"
            :can-delete="canDeleteResources"
            class="mb-3"
          />

          <!-- DDD-E: Milestone Management CRUD removed — data layer preserved. -->


          <v-divider class="my-6" />

          <!-- ── SECTION 3: Timelogs ── -->
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon icon="mdi-clock-time-four-outline" color="warning" size="small" />
            <span class="text-subtitle-1 font-weight-semibold">Timelogs</span>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-3">Weekly and monthly site work logs — work accomplished, issues encountered, manpower, weather, and equipment. Aligned to WAR/MPR reporting workflows.</p>

          <!-- FFF-G/HHH-B: Timelogs container — CRUD enabled on edit page -->
          <CiTimelogsContainer
            v-if="projectId"
            :project-id="projectId"
            :read-only="false"
            :can-delete="canDeleteResources"
          />

        </v-window-item>

        <!-- NI (2026-05-21): Financial Records window-item REMOVED. -->

        <!-- ============= TAB 5: PERSONNEL ============= -->
        <v-window-item v-if="visibleTabOrder.includes('personnel')" value="personnel">
          <!-- PW-C: Unified save awareness note -->
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
            icon="mdi-information-outline"
          >
            Personnel changes are included when you click <strong>Save Changes</strong> below.
            Use <strong>Save Personnel</strong> within this card to save only personnel modifications.
          </v-alert>
          <!-- PA (2026-05-22): Unified Personnel & Access Control — replaces dual-track MJ cards -->
          <CiPersonnelAccessCard
            ref="personnelCardRef"
            :project-id="projectId"
            :assigned-users="currentAssignedUsers"
            @assignments-updated="fetchData"
          />
        </v-window-item>

        <!-- ============= TAB 7: ATTACHMENTS (KV-E: Enterprise layout) ============= -->
        <v-window-item v-if="visibleTabOrder.includes('documents')" value="documents">
          <!-- AAA-I: tab guidance banner -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
            Upload and manage project documents, compliance files, and gallery images. Use the repository cards to file documents by category.
          </v-alert>
          <!-- ZZ-B: Attachment tab fully delegated to CiAttachmentHub (single renderer) -->
          <CiAttachmentHub
            :project-id="projectId"
            mode="edit"
            :can-upload="canUploadDocuments"
            :can-delete="canDeleteResources"
            :can-edit-remarks="canEditCurrentProject"
            :custom-key-sections="rawProject?.customKeySections ?? []"
            :custom-supporting-sections="rawProject?.customSupportingSections ?? []"
          />
        </v-window-item>

        <!-- ============= TAB 8: OTHERS — CCC-B 4-Section UX Restructure ============= -->
        <v-window-item v-if="visibleTabOrder.includes('others')" value="others">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
            Record governance data, administrative records, institutional knowledge, and project notes. All data is preserved across sessions.
          </v-alert>

          

          <!-- ── SECTION B: Administrative Management ── -->
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon size="18" color="info">mdi-folder-text-outline</v-icon>
            <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Administrative Management</span>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-3">Manage project administrative and readiness documentation.</p>
          <v-row dense class="mb-4">
            <v-col cols="12" md="4">
              <!-- Status Updates -->
              <v-card class="h-100">
                <v-card-title class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center ga-2">
                    <v-icon icon="mdi-update" size="small" color="primary" />
                    Status Updates
                    <v-chip v-if="statusUpdateRows.length" size="x-small" color="primary" variant="tonal" class="ml-1">{{ statusUpdateRows.length }}</v-chip>
                  </div>
                  <v-btn size="x-small" color="primary" prepend-icon="mdi-plus" variant="tonal" @click="addStatusUpdate">Add</v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <div v-if="statusUpdateRows.length === 0" class="text-center text-grey text-caption pa-3">None recorded.</div>
                  <v-row v-for="(row, i) in statusUpdateRows" :key="'su'+i" dense align="center" class="mb-1">
                    <v-col cols="12" sm="4"><v-text-field v-model="row.date" label="Date" type="date" variant="outlined" density="compact" /></v-col>
                    <v-col cols="10" sm="7"><v-text-field v-model="row.text" label="Update" variant="outlined" density="compact" /></v-col>
                    <v-col cols="2" sm="1" class="d-flex justify-center"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeStatusUpdate(i)" /></v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <!-- Readiness Documents -->
              <v-card class="h-100">
                <v-card-title class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center ga-2">
                    <v-icon icon="mdi-file-check-outline" size="small" color="success" />
                    Readiness Documents
                    <v-chip v-if="readinessDocRows.length" size="x-small" color="success" variant="tonal" class="ml-1">{{ readinessDocRows.length }}</v-chip>
                  </div>
                  <v-btn size="x-small" color="success" prepend-icon="mdi-plus" variant="tonal" @click="addReadinessDoc">Add</v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <div v-if="readinessDocRows.length === 0" class="text-center text-grey text-caption pa-3">None listed.</div>
                  <!-- EEE-C: balanced layout — type/status/delete in one row, remarks below -->
                  <div v-for="(row, i) in readinessDocRows" :key="'rd'+i" class="mb-2 pa-2 rounded bg-grey-lighten-5">
                    <v-row dense align="center" class="mb-1">
                      <v-col cols="12" sm="5"><v-text-field v-model="row.type" label="Document Type" variant="outlined" density="compact" hide-details /></v-col>
                      <v-col cols="8" sm="4"><v-select v-model="row.status" label="Status" :items="['SUBMITTED','PENDING','APPROVED','MISSING']" variant="outlined" density="compact" hide-details /></v-col>
                      <v-col cols="4" sm="3" class="d-flex justify-end"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeReadinessDoc(i)" /></v-col>
                    </v-row>
                    <v-text-field v-model="row.remarks" label="Remarks (optional)" variant="outlined" density="compact" hide-details />
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <!-- Signatories -->
              <v-card class="h-100">
                <v-card-title class="d-flex align-center justify-space-between">
                  <div class="d-flex align-center ga-2">
                    <v-icon icon="mdi-pen" size="small" color="purple" />
                    Signatories
                    <v-chip v-if="signatoryRows.length" size="x-small" color="purple" variant="tonal" class="ml-1">{{ signatoryRows.length }}</v-chip>
                  </div>
                  <v-btn size="x-small" color="purple" prepend-icon="mdi-plus" variant="tonal" @click="addSignatory">Add</v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                  <div v-if="signatoryRows.length === 0" class="text-center text-grey text-caption pa-3">None listed.</div>
                  <div v-for="(row, i) in signatoryRows" :key="'si'+i" class="mb-2 pa-2 rounded bg-grey-lighten-5">
                    <v-row dense align="center">
                      <v-col cols="10"><v-text-field v-model="row.name" label="Name" variant="outlined" density="compact" hide-details /></v-col>
                      <v-col cols="2" class="d-flex justify-center"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeSignatory(i)" /></v-col>
                    </v-row>
                    <v-text-field v-model="row.position" label="Position" variant="outlined" density="compact" class="mt-1 mb-1" hide-details />
                    <v-text-field v-model="row.date" label="Date" type="date" variant="outlined" density="compact" hide-details />
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- ── SECTION C: Project Knowledge Bank ── -->
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon size="18" color="primary">mdi-database-outline</v-icon>
            <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Project Knowledge Bank</span>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-3">Capture institutional knowledge, references, and project context.</p>
          <v-card class="mb-4">
            <v-card-text>
              <v-textarea v-model="notesAdditional" label="Additional Notes" rows="2" auto-grow variant="outlined" density="compact" class="mb-3" hide-details />
              <v-textarea v-model="notesSpecial" label="Special Instructions" rows="2" auto-grow variant="outlined" density="compact" class="mb-3" hide-details />

              <div class="d-flex align-center justify-space-between mb-1">
                <span class="text-caption font-weight-medium text-uppercase text-grey">Project References</span>
                <v-btn size="x-small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addNoteReference">Add</v-btn>
              </div>
              <div v-for="(row, i) in notesReferences" :key="'ref'+i" class="mb-2">
                <v-row dense>
                  <v-col cols="12" sm="4"><v-text-field v-model="row.label" label="Label" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="12" sm="5"><v-text-field v-model="row.url" label="URL" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="10" sm="2"><v-text-field v-model="row.notes" label="Notes" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="2" sm="1" class="d-flex justify-center"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeNoteReference(i)" /></v-col>
                </v-row>
              </div>

              <div class="d-flex align-center justify-space-between mb-1 mt-2">
                <span class="text-caption font-weight-medium text-uppercase text-grey">Historical References</span>
                <v-btn size="x-small" color="blue-grey" variant="tonal" prepend-icon="mdi-plus" @click="addNoteHistorical">Add</v-btn>
              </div>
              <div v-for="(row, i) in notesHistorical" :key="'hist'+i" class="mb-2">
                <v-row dense>
                  <v-col cols="12" sm="3"><v-text-field v-model="row.date" label="Date" type="date" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="10" sm="8"><v-text-field v-model="row.description" label="Description" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="2" sm="1" class="d-flex justify-center"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeNoteHistorical(i)" /></v-col>
                </v-row>
              </div>

              <div class="d-flex align-center justify-space-between mb-1 mt-2">
                <span class="text-caption font-weight-medium text-uppercase text-grey">Custom Metadata</span>
                <v-btn size="x-small" color="secondary" variant="tonal" prepend-icon="mdi-plus" @click="addNoteMetadata">Add</v-btn>
              </div>
              <div v-for="(row, i) in notesMetadataRows" :key="'meta'+i" class="mb-2">
                <v-row dense>
                  <v-col cols="5"><v-text-field v-model="row.key" label="Key" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="6"><v-text-field v-model="row.value" label="Value" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="1" class="d-flex justify-center"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeNoteMetadata(i)" /></v-col>
                </v-row>
              </div>
            </v-card-text>
          </v-card>

          <!-- ── SECTION D: Lessons Learned ── -->
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon size="18" color="amber-darken-2">mdi-lightbulb-on-outline</v-icon>
            <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Lessons Learned</span>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-3">Document experiences and recommendations for future projects.</p>
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-lightbulb-on-outline" size="small" color="amber-darken-2" />
                Lessons Learned
                <v-chip v-if="lessonsLearned.length" size="x-small" color="amber-darken-2" variant="tonal" class="ml-1">{{ lessonsLearned.length }}</v-chip>
              </div>
              <v-btn size="x-small" color="amber-darken-2" prepend-icon="mdi-plus" variant="tonal" @click="addLesson">Add</v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text>
              <div v-if="lessonsLearned.length === 0" class="text-center text-grey text-caption pa-3">No lessons recorded. Capture what worked, what didn't, and recommendations for future projects.</div>
              <div v-for="(row, i) in lessonsLearned" :key="'lesson'+i" class="mb-3 pa-3 rounded bg-grey-lighten-5">
                <v-row dense align="center" class="mb-1">
                  <v-col cols="12" sm="6"><v-select v-model="row.phase" label="Phase" :items="LESSON_PHASES" variant="outlined" density="compact" hide-details /></v-col>
                  <v-col cols="12" sm="6" class="d-flex justify-end"><v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="removeLesson(i)" /></v-col>
                </v-row>
                <v-textarea v-model="row.observation" label="Observation" rows="2" auto-grow variant="outlined" density="compact" class="mb-2" hide-details />
                <v-textarea v-model="row.recommendation" label="Recommendation" rows="2" auto-grow variant="outlined" density="compact" hide-details />
              </div>
            </v-card-text>
          </v-card>

        </v-window-item>

      </v-window>

      <!-- PV-C: Unified action footer — [Previous]  [Cancel] [Save Changes] [Next] -->
      <div class="d-flex align-center justify-space-between mt-4 pt-3" style="border-top: 1px solid rgba(0,0,0,0.08)">
        <v-btn
          v-if="activeTab !== visibleTabOrder[0]"
          variant="text"
          :disabled="submitting"
          @click="prevTab"
        >
          <v-icon start>mdi-arrow-left</v-icon>
          Previous
        </v-btn>
        <v-spacer />
        <!-- XXX-C: Draft save status indicator -->
        <div class="d-flex align-center ga-2 text-caption text-grey mr-3">
          <v-chip v-if="hasUnsavedChanges" size="x-small" color="warning" variant="tonal" prepend-icon="mdi-circle-medium">
            Unsaved changes
          </v-chip>
          <span v-if="lastSavedLabel" class="d-flex align-center ga-1">
            <v-icon size="14">mdi-content-save-check-outline</v-icon>
            Draft saved {{ lastSavedLabel }}
          </span>
        </div>
        <div class="d-flex ga-2">
          <v-btn variant="outlined" :disabled="submitting" @click="goBack">Cancel</v-btn>
          <v-btn
            type="submit"
            color="primary"
            :loading="submitting"
            :disabled="submitting"
            prepend-icon="mdi-content-save"
          >
            Save Changes
          </v-btn>
          <v-btn
            v-if="activeTab !== visibleTabOrder[visibleTabOrder.length - 1]"
            color="primary"
            variant="tonal"
            :disabled="submitting"
            @click="nextTab"
          >
            Next
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </div>
      </div>
    </v-form>

    <!-- ============= JV-A: Milestone Add/Edit Dialog ============= -->
    <v-dialog v-model="milestoneDialog" max-width="640" persistent>
      <v-card>
        <v-card-title>
          {{ milestoneDialogMode === 'create' ? 'Add Milestone' : 'Edit Milestone' }}
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="milestoneForm.title"
                label="Title *"
                variant="outlined"
                density="comfortable"
                :rules="[rules.required]"
                required
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="milestoneForm.status"
                label="Status"
                :items="milestoneStatusOptions"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="milestoneForm.category"
                label="Category"
                placeholder="e.g., Foundation, Roofing"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <!-- LL-C: Vuetify date pickers for milestone date fields -->
            <v-col cols="12" sm="6">
              <v-menu v-model="msStartDateMenu" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="milestoneForm.start_date"
                    label="Start Date"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    clearable
                    variant="outlined"
                    density="comfortable"
                    @click:clear="milestoneForm.start_date = ''"
                  />
                </template>
                <v-date-picker
                  :model-value="isoToDate(milestoneForm.start_date)"
                  min="1900-01-01"
                  max="2100-12-31"
                  hide-actions
                  @update:model-value="(v: any) => { milestoneForm.start_date = toIsoDate(v); msStartDateMenu = false }"
                />
              </v-menu>
            </v-col>
            <v-col cols="12" sm="6">
              <v-menu v-model="msTargetDateMenu" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="milestoneForm.target_date"
                    label="Target Date"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    clearable
                    variant="outlined"
                    density="comfortable"
                    @click:clear="milestoneForm.target_date = ''"
                  />
                </template>
                <v-date-picker
                  :model-value="isoToDate(milestoneForm.target_date)"
                  min="1900-01-01"
                  max="2100-12-31"
                  hide-actions
                  @update:model-value="(v: any) => { milestoneForm.target_date = toIsoDate(v); msTargetDateMenu = false }"
                />
              </v-menu>
            </v-col>
            <v-col cols="12" sm="6">
              <v-menu v-model="msActualStartDateMenu" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="milestoneForm.actual_start_date"
                    label="Actual Start Date"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    clearable
                    variant="outlined"
                    density="comfortable"
                    @click:clear="milestoneForm.actual_start_date = ''"
                  />
                </template>
                <v-date-picker
                  :model-value="isoToDate(milestoneForm.actual_start_date)"
                  min="1900-01-01"
                  max="2100-12-31"
                  hide-actions
                  @update:model-value="(v: any) => { milestoneForm.actual_start_date = toIsoDate(v); msActualStartDateMenu = false }"
                />
              </v-menu>
            </v-col>
            <v-col cols="12" sm="6">
              <v-menu v-model="msActualDateMenu" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="milestoneForm.actual_date"
                    label="Actual End Date"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    clearable
                    variant="outlined"
                    density="comfortable"
                    @click:clear="milestoneForm.actual_date = ''"
                  />
                </template>
                <v-date-picker
                  :model-value="isoToDate(milestoneForm.actual_date)"
                  min="1900-01-01"
                  max="2100-12-31"
                  hide-actions
                  @update:model-value="(v: any) => { milestoneForm.actual_date = toIsoDate(v); msActualDateMenu = false }"
                />
              </v-menu>
            </v-col>
            <v-col cols="12">
              <v-slider
                v-model="milestoneForm.progress"
                label="Progress"
                min="0"
                max="100"
                step="1"
                thumb-label="always"
                color="primary"
              >
                <template #append>
                  <v-text-field
                    v-model.number="milestoneForm.progress"
                    density="compact"
                    style="width: 90px"
                    hide-details
                    variant="outlined"
                    suffix="%"
                    type="number"
                    min="0"
                    max="100"
                  />
                </template>
              </v-slider>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="milestoneForm.description"
                label="Description"
                rows="2"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="milestoneForm.remarks"
                label="Remarks"
                rows="2"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <!-- MOV section and actions — edit mode (also shown after add-save when dialog transitions to edit) -->
        <template v-if="milestoneDialogMode === 'edit' && milestoneEditingId">
          <v-divider />
          <v-card-text>
            <div class="text-subtitle-2 font-weight-medium mb-2 d-flex align-center ga-1">
              <v-icon size="small" color="teal">mdi-link-variant</v-icon>
              MOV Evidence
            </div>
            <CiMovEvidenceSection
              :project-id="projectId"
              related-entity-type="MILESTONE"
              :related-entity-id="milestoneEditingId"
              :can-edit="canEditCurrentProject"
              :open-key="`milestone-edit-${milestoneEditingId}`"
            />
          </v-card-text>
          <v-divider />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="milestoneSubmitting" @click="milestoneDialog = false; resetMilestoneForm()">Cancel</v-btn>
            <v-btn color="primary" :loading="milestoneSubmitting" @click="saveMilestone">Save</v-btn>
          </v-card-actions>
        </template>
        <template v-else>
          <!-- LH-B: Live MOV pending queue in create mode — drains on save -->
          <v-divider />
          <v-card-text>
            <CiMovPendingSection v-model="pendingMilestoneMovs" />
          </v-card-text>
          <v-divider />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="milestoneSubmitting" @click="milestoneDialog = false; pendingMilestoneMovs = []">Cancel</v-btn>
            <v-btn color="primary" :loading="milestoneSubmitting" @click="saveMilestone">Add</v-btn>
          </v-card-actions>
        </template>
      </v-card>
    </v-dialog>

    <!-- ============= JV-A: Milestone Delete Confirm Dialog ============= -->
    <v-dialog v-model="deleteMilestoneDialog" max-width="420">
      <v-card>
        <v-card-title>Delete milestone?</v-card-title>
        <v-card-text>
          <p class="mb-2">
            This will permanently delete the milestone
            <strong>"{{ deleteMilestoneTarget?.title }}"</strong>.
          </p>
          <p class="text-caption text-grey">This action cannot be undone.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteMilestoneDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            :loading="deleteMilestoneTarget ? deletingMilestone[deleteMilestoneTarget.id] : false"
            @click="executeDeleteMilestone"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ============= JW-G: Diary Add/Edit Dialog ============= -->
    <v-dialog v-model="diaryDialog" max-width="720" persistent>
      <v-card>
        <v-card-title>
          {{ diaryDialogMode === 'create' ? 'Add Diary Entry' : 'Edit Diary Entry' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pt-4">
          <v-row dense>
            <v-col cols="12" sm="4">
              <v-select
                v-model="diaryForm.entry_type"
                :items="diaryEntryTypeOptions"
                item-title="title"
                item-value="value"
                label="Entry Type"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <!-- LL-D: Vuetify date picker for diary entry date -->
            <v-col cols="12" sm="4">
              <v-menu v-model="diaryEntryDateMenu" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="diaryForm.entry_date"
                    label="Entry Date *"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    clearable
                    variant="outlined"
                    density="comfortable"
                    @click:clear="diaryForm.entry_date = ''"
                  />
                </template>
                <v-date-picker
                  :model-value="isoToDate(diaryForm.entry_date)"
                  min="1900-01-01"
                  max="2100-12-31"
                  hide-actions
                  @update:model-value="(v: any) => { diaryForm.entry_date = toIsoDate(v); diaryEntryDateMenu = false }"
                />
              </v-menu>
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="diaryForm.period_label"
                label="Period Label"
                placeholder="Week 12, Q1, Aug 2026…"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="diaryForm.title"
                label="Title / Activity *"
                placeholder="Foundation pour, plumbing rough-in…"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="diaryForm.description"
                label="Description"
                rows="2"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="diaryForm.weather"
                label="Weather"
                placeholder="Sunny, Light rain…"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="diaryForm.manpower_count"
                label="Manpower (workers on site)"
                type="number"
                min="0"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="diaryForm.equipment_used"
                label="Equipment Used"
                rows="2"
                placeholder="Backhoe, concrete mixer, scaffolding…"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="diaryForm.work_accomplished"
                label="Work Accomplished"
                rows="3"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="diaryForm.issues_encountered"
                label="Issues Encountered"
                rows="2"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <!-- LC-D: Reporter Type -->
            <v-col cols="12" sm="6">
              <v-select
                v-model="diaryForm.reporter_type"
                :items="[
                  {title:'Constructor', value:'CONSTRUCTOR'},
                  {title:'Evaluator', value:'EVALUATOR'},
                  {title:'Inspector', value:'INSPECTOR'},
                  {title:'Admin', value:'ADMIN'},
                ]"
                label="Reporter Type"
                clearable
                variant="outlined"
                density="comfortable"
                hint="Who filed this entry?"
                persistent-hint
              />
            </v-col>
          </v-row>
        </v-card-text>
        <!-- MOV section and actions — edit mode (also shown after add-save when dialog transitions to edit) -->
        <template v-if="diaryDialogMode === 'edit' && diaryEditingId">
          <v-divider />
          <v-card-text>
            <div class="text-subtitle-2 font-weight-medium mb-2 d-flex align-center ga-1">
              <v-icon size="small" color="teal">mdi-link-variant</v-icon>
              MOV Evidence
            </div>
            <CiMovEvidenceSection
              :project-id="projectId"
              related-entity-type="TIMELINE_ENTRY"
              :related-entity-id="diaryEditingId"
              :can-edit="canEditCurrentProject"
              :open-key="`diary-edit-${diaryEditingId}`"
            />
          </v-card-text>
          <v-divider />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="diarySubmitting" @click="diaryDialog = false; diaryEditingId = null">Cancel</v-btn>
            <v-btn color="primary" :loading="diarySubmitting" @click="saveDiary">Save</v-btn>
          </v-card-actions>
        </template>
        <template v-else>
          <!-- LH-F: Live MOV pending queue in create mode — drains on save -->
          <v-divider />
          <v-card-text>
            <CiMovPendingSection v-model="pendingDiaryMovs" />
          </v-card-text>
          <v-divider />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="diarySubmitting" @click="diaryDialog = false; pendingDiaryMovs = []">Cancel</v-btn>
            <v-btn color="primary" :loading="diarySubmitting" @click="saveDiary">Add</v-btn>
          </v-card-actions>
        </template>
      </v-card>
    </v-dialog>

    <!-- ============= JW-G: Diary Delete Confirm Dialog ============= -->
    <v-dialog v-model="deleteDiaryDialog" max-width="420">
      <v-card>
        <v-card-title>Delete diary entry?</v-card-title>
        <v-card-text>
          <p class="mb-2">
            This will permanently delete the entry
            <strong>"{{ deleteDiaryTarget?.title }}"</strong>.
          </p>
          <p class="text-caption text-grey">This action cannot be undone.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDiaryDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            :loading="deleteDiaryTarget ? deletingDiary[deleteDiaryTarget.id] : false"
            @click="executeDeleteDiary"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- LK-G: Batch Add dialogs -->
    <CiBatchMilestoneDialog
      v-model="batchMilestoneOpen"
      :project-id="projectId"
      @saved="fetchMilestones"
    />
    <CiBatchDiaryDialog
      v-model="batchDiaryOpen"
      :project-id="projectId"
      @saved="fetchDiaryEntries"
    />

    <!-- KD-B: Scroll-to-top FAB -->
    <CiScrollToTopFab />
  </div>
</template>
