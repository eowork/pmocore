<script setup lang="ts">
import { type CsuPersonnelRow, type ContractorPersonnelRow, type OthersPersonnelRow, type StagedQueue } from '~/utils/coiFormState'
import CiPersonnelAccessCard from '~/components/coi/CiPersonnelAccessCard.vue'
import CiAttachmentHub from '~/components/coi/CiAttachmentHub.vue'
import CiScrollToTopFab from '~/components/coi/CiScrollToTopFab.vue'
import { useMachine } from '@xstate/vue'
import { fromPromise } from 'xstate'
import {
  projectMachine,
  PROJECT_TAB_ORDER,
  type ProjectTabId,
  type SubmitResult,
  type TabValidity,
} from '~/machines/project.machine'
definePageMeta({
  middleware: ['auth', 'permission'],
})

// TC: Defense-in-depth behind TB middleware â€" contractors must never access project creation
const { isContractor } = usePermissions()
if (isContractor.value) {
  await navigateTo('/dashboard')
}

const router = useRouter()
const api = useApi()
const toast = useToast()

const loading = ref(false)
// `submitting` is derived from the wizard machine below — see snapshot.matches('submitting').

// Phase AO: Staff users for assignment dropdown
const staffUsers = ref<{ id: string; first_name: string; last_name: string }[]>([])

// MG (2026-05-21): Form state restructured to match BasicInfoFormState interface.
// Status default updated to PROPOSAL (PLANNING removed in MF normalization).
const form = ref({
  // Identity
  project_code: '',
  title: '',
  description: '',
  campus: '',
  status: 'PROPOSAL',
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
  // Objectives (dynamic, MG)
  objectives_list: [] as string[],
  // Beneficiaries (MG â€" aggregate count removed per ECO directive 2026-05-21)
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
  // Schedule â€" Primary Dates (Schedule tab)
  start_date: '',
  target_completion_date: '',
  actual_completion_date: '',
  project_duration: '',
  project_duration_days: null as number | null,
  // Schedule â€" Revision Orders (MH)
  original_start_date: '',
  revised_start_date: '',
  original_completion_date: '',
  revised_completion_date: '',
  revised_project_duration: '',
  original_contract_duration: '',
  implementation_period: '',
  // Progress targets
  target_physical_progress: 100 as number,
  target_financial_progress: 100 as number,
  // MI: Progress & Financial Status
  physical_progress: null as number | null,
  financial_progress: null as number | null,
  as_of_date: '',
  cost_incurred_to_date: null as number | null,
  date_completed: '',
  // MI: Chronological remarks log entries (local-staged; mapped to backend remarks_log JSONB)
  // OK-B: type widened to match CiRemarksLog RemarkEntry interface
  remarks_log_entries: [] as Array<{ id?: string; text: string; author?: string; createdAt: string; updatedAt?: string; updatedBy?: string }>,
  // Personnel (still on Personnel tab)
  project_manager: '',
  assigned_user_ids: [] as string[],
  // Legacy fields kept (no longer rendered, kept for back-compat hydration)
  summary: '',
  objectives: '',
  key_features: '',
  scope: '',
  facilities: '',
  number_of_floors: null as number | null,
  latitude: null as number | null,
  longitude: null as number | null,
  contractor_id: '',
  contract_number: '',
  contract_amount: null as number | null,
  beneficiaries: null as number | null,
  project_status_category: '',
})

// KE-AA: JSONB row arrays for Profile sections (now in Basic Info)
const statusUpdateRows  = ref<Array<{ date: string; text: string }>>([])
const readinessDocRows  = ref<Array<{ type: string; status: string; remarks: string }>>([])
const signatoryRows     = ref<Array<{ name: string; position: string; date: string }>>([])
// LX-A: Others tab â€" mirrors edit-[id].vue administrative records
// BBB-B: incidentLogRows removed per R-055
// XXX-M: riskRegisterRows/escalationRows removed — Project Governance section removed
// MJ: Non-system personnel group rows (JSONB)
const csuPersonnelRows        = ref<CsuPersonnelRow[]>([])
const contractorPersonnelRows = ref<ContractorPersonnelRow[]>([])
const othersPersonnelRows     = ref<OthersPersonnelRow[]>([])

// Lookup data
const fundingSources = ref<{ id: string; name: string; type?: string }[]>([])
const contractors = ref<{ id: string; name: string }[]>([])

// MG: Relaxed project code validation â€" free-form per ECO directive.
const rules = {
  required: (v: string) => !!v || 'This field is required',
  positiveNumber: (v: number | null) => v === null || v >= 0 || 'Must be a positive number',
}

// MH: Date helpers + per-field menu state for Vuetify date pickers
function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoToDate(iso: string): Date | null {
  return iso ? new Date(iso + 'T00:00:00') : null
}
const startDateMenu              = ref(false)
const targetCompletionMenu       = ref(false)
const actualCompletionMenu       = ref(false)
const origStartDateMenu          = ref(false)
const revStartDateMenu           = ref(false)
const origCompletionDateMenu     = ref(false)
const revCompletionDateMenu      = ref(false)
// BBB-D: progAsOfDateMenu/progDateCompletedMenu removed — progress tab now uses type="date" text inputs

// LX-A: Others tab helpers â€" mirrors edit-[id].vue
function addStatusUpdate()            { statusUpdateRows.value.push({ date: '', text: '' }) }
function removeStatusUpdate(i: number){ statusUpdateRows.value.splice(i, 1) }
function addReadinessDoc()            { readinessDocRows.value.push({ type: '', status: '', remarks: '' }) }
function removeReadinessDoc(i: number){ readinessDocRows.value.splice(i, 1) }
function addSignatory()               { signatoryRows.value.push({ name: '', position: '', date: '' }) }
function removeSignatory(i: number)   { signatoryRows.value.splice(i, 1) }

// AAA-E: Others tab — Data Banking + Institutional Knowledge (mirrors edit-[id].vue)
const notesAdditional   = ref('')
const notesSpecial      = ref('')
const notesReferences   = ref<Array<{ label: string; url: string; notes: string }>>([])
const notesHistorical   = ref<Array<{ date: string; description: string }>>([])
const notesMetadataRows = ref<Array<{ key: string; value: string }>>([])
function addNoteReference()       { notesReferences.value.push({ label: '', url: '', notes: '' }) }
function removeNoteReference(i: number) { notesReferences.value.splice(i, 1) }
function addNoteHistorical()      { notesHistorical.value.push({ date: '', description: '' }) }
function removeNoteHistorical(i: number) { notesHistorical.value.splice(i, 1) }
function addNoteMetadata()        { notesMetadataRows.value.push({ key: '', value: '' }) }
function removeNoteMetadata(i: number) { notesMetadataRows.value.splice(i, 1) }

const authStore = useAuthStore()
const currentUserName = computed(() => authStore.userFullName || authStore.userEmail || '')
const LESSON_PHASES = ['PLANNING', 'MOBILIZATION', 'CIVIL_WORKS', 'FINISHING', 'CLOSEOUT', 'OTHER']
const lessonsLearned = ref<Array<{ phase: string; observation: string; recommendation: string; addedBy?: string; addedAt?: string }>>([])
// BBB-B: siteObservations removed per R-055
function addLesson()      { lessonsLearned.value.push({ phase: 'OTHER', observation: '', recommendation: '', addedBy: currentUserName.value, addedAt: new Date().toISOString() }) }
function removeLesson(i: number) { lessonsLearned.value.splice(i, 1) }

// MH-MOV: Revision Order Means of Verification staging (new project workflow).
// File uploads queued into pendingDocs (documentType='revision_order_mov');
// links queued into pendingLinks (documentType='revision_order_mov').
interface StagedRevisionMov { link?: string; file?: File }
const revisionMovLink = ref('')
const revisionMovFile = ref<File | null>(null)
const stagedRevisionMov = ref<StagedRevisionMov[]>([])
function stageRevisionMov() {
  const link = revisionMovLink.value.trim()
  const file = revisionMovFile.value
  if (!link && !file) return
  stagedRevisionMov.value.push({ link: link || undefined, file: file || undefined })
  if (file) {
    pendingDocs.value.push({
      file,
      documentType: 'revision_order_mov',
      description: 'Variation Order MOV',
    })
  }
  if (link) {
    pendingLinks.value.push({
      url: link,
      title: 'Variation Order MOV',
      description: 'Documentary means of verification for variation orders',
    })
  }
  revisionMovLink.value = ''
  revisionMovFile.value = null
}

// Fetch lookup data
async function fetchLookups() {
  loading.value = true
  try {
    const [fundingRes, contractorRes] = await Promise.all([
      api.get<{ data: { id: string; name: string }[] }>('/api/funding-sources'),
      api.get<{ data: { id: string; name: string }[] }>('/api/contractors'),
    ])
    fundingSources.value = fundingRes.data || []
    contractors.value = contractorRes.data || []
  } catch (err) {
    console.error('Failed to fetch lookup data:', err)
  } finally {
    loading.value = false
  }
}

// Tab navigation is owned by the XState wizard machine (see machines/project.machine.ts).
// `tabOrder` is re-exported from there so the sequence has a single source of truth.
const tabOrder = PROJECT_TAB_ORDER

// JO-D: Pending uploads (staged in browser memory until project is created)
interface PendingDoc { file: File; documentType: string; description: string }
interface PendingImage { file: File; caption: string; category: string }
interface PendingLink { url: string; title: string; description: string }
const pendingDocs = ref<PendingDoc[]>([])
const pendingImages = ref<PendingImage[]>([])
const pendingLinks = ref<PendingLink[]>([])

// ZZ-B: Bridge the staging queue between CiAttachmentHub and the existing
// pending* refs. The refs are shared with the revision-order MOV staging flow,
// so they stay; the hub reads/writes them through this proxy.
const pendingQueue = computed<StagedQueue>(() => ({
  docs: pendingDocs.value,
  images: pendingImages.value,
  links: pendingLinks.value,
}))
function onQueueUpdate(q: StagedQueue) {
  pendingDocs.value = q.docs
  pendingImages.value = q.images
  pendingLinks.value = q.links
}

// Input bindings for the documents tab
const newDocFile = ref<File | null>(null)
const newDocType = ref('attachment')
const newDocDescription = ref('')
const newImageFile = ref<File | null>(null)
const newImageCategory = ref('IN_PROGRESS')
const newImageCaption = ref('')
const newLinkUrl = ref('')
const newLinkTitle = ref('')
const newLinkDescription = ref('')

const EXTERNAL_URL_REGEX = /^https?:\/\/.+/i

function addPendingDoc() {
  if (!newDocFile.value) return
  if (newDocFile.value.size > 20 * 1024 * 1024) {
    toast.error('File exceeds 20 MB. Use an external link instead.')
    return
  }
  pendingDocs.value.push({
    file: newDocFile.value,
    documentType: newDocType.value,
    description: newDocDescription.value,
  })
  newDocFile.value = null
  newDocType.value = 'attachment'
  newDocDescription.value = ''
}

function addPendingImage() {
  if (!newImageFile.value) return
  if (newImageFile.value.size > 10 * 1024 * 1024) {
    toast.error('Image exceeds 10 MB.')
    return
  }
  pendingImages.value.push({
    file: newImageFile.value,
    caption: newImageCaption.value,
    category: newImageCategory.value,
  })
  newImageFile.value = null
  newImageCaption.value = ''
  newImageCategory.value = 'IN_PROGRESS'
}

function addPendingLink() {
  if (!newLinkUrl.value) return
  if (!EXTERNAL_URL_REGEX.test(newLinkUrl.value)) {
    toast.error('Must be a valid URL starting with http:// or https://')
    return
  }
  pendingLinks.value.push({
    url: newLinkUrl.value,
    title: newLinkTitle.value,
    description: newLinkDescription.value,
  })
  newLinkUrl.value = ''
  newLinkTitle.value = ''
  newLinkDescription.value = ''
}

// JO-B: Engagement-based completion (checkmark = user filled at least one field in tab)
// KG-A: 4-tab structure; funding_source_id now required in basic
// FIX: gate on primary_funding_source, NOT funding_source_id. The AAAK two-level
// funding refactor replaced the funding_source_id picker with the controlled
// `primary_funding_source` select (CiBasicInfoForm.vue), leaving funding_source_id
// with no input anywhere in the create flow — so this condition could never become
// true and the Next button was permanently dead. funding_source_id remains in the
// payload for back-compat (see coiFormState.ts: "legacy (optional)").
const tabCompletion = computed(() => ({
  basic: !!(form.value.project_code && form.value.title && form.value.campus && form.value.status && form.value.primary_funding_source),
  schedule: !!(
    form.value.start_date ||
    form.value.target_completion_date ||
    form.value.actual_completion_date ||
    form.value.project_duration_days ||
    form.value.original_contract_duration
  ),
  progress: !!(
    (form.value.physical_progress != null && form.value.physical_progress !== 0) ||
    form.value.as_of_date ||
    (form.value.cost_incurred_to_date != null) ||
    form.value.date_completed ||
    (form.value.remarks_log_entries && form.value.remarks_log_entries.length > 0)
  ),
  personnel: !!(
    form.value.project_engineer ||
    form.value.project_manager ||
    (form.value.assigned_user_ids && form.value.assigned_user_ids.length > 0)
  ),
  documents:
    pendingDocs.value.length + pendingImages.value.length + pendingLinks.value.length > 0,
  // LX-A: others tab completion
  others: statusUpdateRows.value.length > 0 || readinessDocRows.value.length > 0 || signatoryRows.value.length > 0,
}))

// JO-B: Required-field validity for navigation gating (separate from engagement)
// FIX: see tabCompletion above — must match the field the UI actually binds.
const tabRequired = computed<TabValidity>(() => ({
  basic: !!(form.value.project_code && form.value.title && form.value.campus && form.value.status && form.value.primary_funding_source),
  schedule: true,
  progress: true,
  personnel: true,
  documents: true,
  others: true,
}))

// ── XState wizard machine ────────────────────────────────────────────────────
// The machine owns *flow* (active step, whether NEXT is allowed, submit lifecycle).
// Field data stays in `form` so v-model, autosave and draft restore are untouched.
// The submit side effect is injected here so the machine file has no api/toast/router deps.
const TAB_LABELS: Record<ProjectTabId, string> = {
  basic: 'Project Profile',
  schedule: 'Dates & Duration',
  progress: 'Progress Report',
  personnel: 'Personnel',
  documents: 'Attachments',
  others: 'Others',
}

const { snapshot, send, actorRef } = useMachine(
  projectMachine.provide({
    actors: {
      // `runSubmit` is a hoisted function declaration, so referencing it here — before
      // its definition below — is safe; it is only ever called on the SUBMIT event.
      submitProject: fromPromise<SubmitResult, void>(() => runSubmit()),
    },
  }),
)

// Bridge the machine state to the existing `activeTab` template bindings. Reads come
// from the machine; writes (clicking a tab header) go back in as a GOTO event, so the
// machine stays the single authority on which step is active.
const activeTab = computed<ProjectTabId>({
  // `submitting` and `submitted` are real machine states but not tabs — fall back to the
  // last step so v-window keeps rendering (and the user keeps their place) instead of
  // going blank while the request is in flight.
  get: () => {
    const state = snapshot.value.value as string
    return (PROJECT_TAB_ORDER as readonly string[]).includes(state)
      ? (state as ProjectTabId)
      : 'others'
  },
  set: (tab) => send({ type: 'GOTO', tab }),
})

const submitting = computed(() => snapshot.value.matches('submitting'))
const blockedTab = computed(() => snapshot.value.context.blockedTab)

// Names the exact fields still missing, so a blocked Next says *what* to fix rather
// than just refusing. Mirrors the tabRequired.basic condition — keep both in sync.
const REQUIRED_BASIC_FIELDS: { key: keyof typeof form.value; label: string }[] = [
  { key: 'title',                  label: 'Project Title' },
  { key: 'project_code',           label: 'Project Code' },
  { key: 'campus',                 label: 'Campus' },
  { key: 'status',                 label: 'Project Status' },
  { key: 'primary_funding_source', label: 'Funding Source' },
]
const missingBasicFields = computed(() =>
  REQUIRED_BASIC_FIELDS.filter(f => !form.value[f.key]).map(f => f.label),
)

// Push the derived per-tab required-field validity into the machine whenever it
// changes; the NEXT/SUBMIT guards read it from context.
watch(
  tabRequired,
  (validity) => send({ type: 'SET_VALIDITY', validity }),
  { immediate: true, deep: true },
)

// One-off UI notifications. Emitted (not stored in context) so each occurrence fires
// exactly one toast — a watched context value would need a nonce to do the same.
actorRef.on('blocked', ({ tab }) => {
  toast.error(`Please complete the required fields in "${TAB_LABELS[tab]}" before continuing`)
})
actorRef.on('submitFailed', ({ message }) => {
  toast.error(message)
})
actorRef.on('submitSucceeded', ({ result }) => {
  if (result.failed.length > 0) {
    toast.error(
      `Project created. ${result.failed.length} of ${result.total} uploads failed (retry from detail page).`,
    )
  } else if (result.uploaded > 0) {
    toast.success(`Project created with ${result.uploaded} attachment(s)`)
  } else {
    toast.success('Project created successfully')
  }
  // Draft is only cleared once the server has the project — a failed submit keeps it.
  clearDraft()
  hasUnsavedChanges.value = false
  router.push(result.projectId ? `/coi/detail-${result.projectId}` : '/coi')
})

// JN-B: Step progress indicators
const currentStepIndex = computed(() => tabOrder.indexOf(activeTab.value))
const completionPercentage = computed(() => {
  const completed = Object.values(tabCompletion.value).filter(Boolean).length
  return Math.round((completed / tabOrder.length) * 100)
})

// JO-C: Guarded navigation — the guard now lives in the machine, not here.
function nextTab() { send({ type: 'NEXT' }) }
function prevTab() { send({ type: 'PREV' }) }

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

// Submit is split in two: `handleSubmit` only fires the event — the machine owns the
// all-tabs-valid gate and the jump-to-first-invalid-tab behaviour that used to live
// here. `runSubmit` is the pure side effect the machine invokes, and it reports its
// outcome by returning a SubmitResult (or throwing); toasts and navigation happen in
// the emitted-event handlers above, so this function does no UI work.
function handleSubmit() {
  send({ type: 'SUBMIT' })
}

async function runSubmit(): Promise<SubmitResult> {
  {
    // Do NOT send project_id - backend will create base projects record and generate ID
    // MG: Objectives is now a dynamic bullet list (objectives_list); fall back
    // to legacy textarea split for back-compat.
    const objectivesArr = (form.value.objectives_list || []).map(s => s.trim()).filter(Boolean)
    const beneficiaryArr = (form.value.beneficiary_list || []).map(s => s.trim()).filter(Boolean)

    const payload = {
      // Identity
      project_code: form.value.project_code,
      title: form.value.title,
      description: form.value.description || undefined,
      campus: form.value.campus,
      status: form.value.status,
      // Objectives (dynamic)
      objectives: objectivesArr.length > 0 ? objectivesArr : undefined,
      // Location (MG)
      spatial_coverage: form.value.spatial_coverage || undefined,
      municipality: form.value.municipality || undefined,
      province: form.value.province || undefined,
      // Implementation Agencies (MG)
      implementing_agency: form.value.implementing_agency || undefined,
      co_implementing_agency: form.value.co_implementing_agency || undefined,
      attached_agency: form.value.attached_agency || undefined,
      // Funding hybrid (MG) â€" cost_amount is the canonical field; backend remaps to contract_amount
      // AAAK two-level funding: primary (controlled) required, description (free text) optional
      primary_funding_source: form.value.primary_funding_source || undefined,
      funding_source_description: form.value.funding_source_description || undefined,
      funding_source_id: form.value.funding_source_id || undefined,
      funding_source_type: form.value.funding_source_type || undefined,
      additional_funding_sources: form.value.additional_funding_sources?.length
        ? form.value.additional_funding_sources
        : undefined,
      cost_amount: form.value.cost_amount ?? undefined,
      // Contractor (text â€" MG)
      contractor: form.value.contractor || undefined,
      // Beneficiaries (MG â€" aggregate count removed)
      beneficiary_list: beneficiaryArr.length > 0 ? beneficiaryArr : undefined,
      // Strategic Alignment (MG)
      rdp_alignment: form.value.rdp_alignment?.length ? form.value.rdp_alignment : undefined,
      socioeconomic_agenda: form.value.socioeconomic_agenda?.length ? form.value.socioeconomic_agenda : undefined,
      csu_likha_goals: form.value.csu_likha_goals?.length ? form.value.csu_likha_goals : undefined,
      sdg_goals: form.value.sdg_goals?.length ? form.value.sdg_goals : undefined,
      // XXX-K: Historical Planning Frameworks (2017-2022)
      rdp2017_alignment: form.value.rdp2017_alignment?.length ? form.value.rdp2017_alignment : undefined,
      point_agenda_10: form.value.point_agenda_10?.length ? form.value.point_agenda_10 : undefined,
      strategic_alignment: form.value.strategic_alignment || undefined,
      // NC: Indicators now sourced from bullet-list arrays
      output_indicators: form.value.output_indicators_list?.length
        ? form.value.output_indicators_list.map(s => s.trim()).filter(Boolean)
        : (form.value.output_indicators ? form.value.output_indicators.split('\n').map(s => s.trim()).filter(Boolean) : undefined),
      outcome_indicators: form.value.outcome_indicators_list?.length
        ? form.value.outcome_indicators_list.map(s => s.trim()).filter(Boolean)
        : (form.value.outcome_indicators ? form.value.outcome_indicators.split('\n').map(s => s.trim()).filter(Boolean) : undefined),
      // Other attributes
      project_engineer: form.value.project_engineer || undefined,
      building_type: form.value.building_type || undefined,
      floor_area: form.value.floor_area || undefined,
      // Schedule â€" Primary Dates
      start_date: form.value.start_date || undefined,
      target_completion_date: form.value.target_completion_date || undefined,
      actual_completion_date: form.value.actual_completion_date || undefined,
      // MH: prefer days-integer; coerce to existing `project_duration` text column
      project_duration: form.value.project_duration_days != null
        ? `${form.value.project_duration_days} days`
        : (form.value.project_duration || undefined),
      // Schedule â€" Revision Orders (MH)
      original_start_date: form.value.original_start_date || undefined,
      revised_start_date: form.value.revised_start_date || undefined,
      original_completion_date: form.value.original_completion_date || undefined,
      revised_completion_date: form.value.revised_completion_date || undefined,
      revised_project_duration: form.value.revised_project_duration || undefined,
      original_contract_duration: form.value.original_contract_duration || undefined,
      // XXX-K: Implementation Period (free-text, R-222)
      implementation_period: form.value.implementation_period || undefined,
      target_physical_progress: form.value.target_physical_progress ?? undefined,
      target_financial_progress: form.value.target_financial_progress ?? undefined,
      // MI: Progress & Financial Status
      physical_progress: form.value.physical_progress ?? undefined,
      financial_progress: form.value.financial_progress ?? undefined,
      as_of_date: form.value.as_of_date || undefined,
      cost_incurred_to_date: form.value.cost_incurred_to_date ?? undefined,
      // MI: Remarks log â€" strip UI-only author resolution; server sets it from JWT
      remarks_log: form.value.remarks_log_entries?.length
        ? form.value.remarks_log_entries.map(r => ({ text: r.text, created_at: r.createdAt }))
        : undefined,
      // Personnel
      project_manager: form.value.project_manager || undefined,
      assigned_user_ids: form.value.assigned_user_ids.length > 0 ? form.value.assigned_user_ids : undefined,
      // Administrative records
      status_updates: statusUpdateRows.value.length > 0 ? statusUpdateRows.value : undefined,
      readiness_documents: readinessDocRows.value.length > 0 ? readinessDocRows.value : undefined, // FFF-A: was readiness_docs (typo — caused 400 on creation with docs)
      signatories: signatoryRows.value.length > 0 ? signatoryRows.value : undefined,
      // LX-A: others tab fields
      // BBB-B: incident_log removed from create payload per R-055
      // XXX-M: risk_register/escalation_records removed — Project Governance section removed
      // AAA-E: Others tab — Data Banking + Institutional Knowledge
      project_notes_banking: (
        notesAdditional.value || notesSpecial.value ||
        notesReferences.value.length || notesHistorical.value.length ||
        notesMetadataRows.value.length || lessonsLearned.value.length
      )
        ? {
            additionalNotes: notesAdditional.value || undefined,
            specialInstructions: notesSpecial.value || undefined,
            projectReferences: notesReferences.value.filter(r => r.label.trim()),
            historicalReferences: notesHistorical.value.filter(r => r.description.trim()),
            customMetadata: Object.fromEntries(notesMetadataRows.value.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value])),
            lessonsLearned: lessonsLearned.value.filter(l => l.observation.trim()),
            // BBB-B: siteObservations removed from create payload
          }
        : undefined,
      personnel_groups: {
        csu: csuPersonnelRows.value,
        contractor: contractorPersonnelRows.value,
        others: othersPersonnelRows.value,
      },
    }

    console.log('[COI Create] Submitting:', payload)
    // Creation failure is the machine's business: let it throw so the invoke lands in
    // onError. mapApiError runs here so the emitted message is already user-friendly.
    let created: { id?: string; project_id?: string }
    try {
      created = await api.post<{ id?: string; project_id?: string }>('/api/construction-projects', payload)
    } catch (err: unknown) {
      console.error('[COI Create] Failed:', err)
      throw new Error(mapApiError(err))
    }
    // NNN-B: resolve the new project id with a fallback; warn (don't silently succeed) if absent
    const projectId = created?.id ?? created?.project_id
    if (!projectId) {
      console.warn('[COI Create] Project created but no id returned — staged uploads skipped.', created)
      return { projectId: null, uploaded: 0, failed: [], total: 0 }
    }

    // JO-D Stage 2: best-effort upload of staged files. Upload failures are NOT fatal —
    // the project exists, so this resolves successfully and reports partials instead.
    const totalAttachments =
      pendingDocs.value.length + pendingImages.value.length + pendingLinks.value.length
    if (totalAttachments === 0) {
      return { projectId, uploaded: 0, failed: [], total: 0 }
    }

    const failures: string[] = []
    let successCount = 0
    for (const d of pendingDocs.value) {
      try {
        const fd = new FormData()
        fd.append('file', d.file)
        fd.append('documentType', d.documentType)
        if (d.description) fd.append('description', d.description)
        await api.upload(`/api/construction-projects/${projectId}/documents`, fd)
        successCount++
      } catch (e: unknown) {
        failures.push(`${d.file.name}: ${(e as { message?: string })?.message || 'failed'}`)
      }
    }
    for (const im of pendingImages.value) {
      try {
        const fd = new FormData()
        fd.append('file', im.file)
        if (im.caption) fd.append('caption', im.caption)
        fd.append('category', im.category)
        await api.upload(`/api/construction-projects/${projectId}/gallery`, fd)
        successCount++
      } catch (e: unknown) {
        failures.push(`${im.file.name}: ${(e as { message?: string })?.message || 'failed'}`)
      }
    }
    for (const lk of pendingLinks.value) {
      try {
        await api.post(`/api/construction-projects/${projectId}/documents`, {
          documentType: 'link',
          externalLink: lk.url,
          title: lk.title || undefined,
          description: lk.description || undefined,
        })
        successCount++
      } catch (e: unknown) {
        failures.push(`${lk.url}: ${(e as { message?: string })?.message || 'failed'}`)
      }
    }

    if (failures.length > 0) {
      console.warn('[COI Create] Upload failures:', failures)
    }
    return {
      projectId,
      uploaded: successCount,
      failed: failures,
      total: totalAttachments,
    }
  }
}

// Navigation
function goBack() {
  router.push('/coi')
}

// Phase AV: Fetch eligible staff once on mount (global, no campus filter)
async function fetchEligibleStaff() {
  try {
    const res = await api.get<{ id: string; first_name: string; last_name: string }[]>(
      '/api/users/eligible-for-assignment'
    )
    staffUsers.value = Array.isArray(res) ? res : []
  } catch (err) {
    console.error('[COI Create] Failed to fetch eligible staff:', err)
    staffUsers.value = []
  }
}

// WWW-D: Autosave — localStorage draft + beforeunload warning
const hasUnsavedChanges = ref(false)
const draftRestoreSnackbar = ref(false)
const DRAFT_KEY = 'coi-draft-new'

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
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ts: Date.now(), form: JSON.parse(JSON.stringify(form.value)) }))
    lastSavedAt.value = Date.now()  // XXX-C
  } catch { /* quota exceeded — silently skip */ }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
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
    const saved = localStorage.getItem(DRAFT_KEY)
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
  fetchLookups()
  fetchEligibleStaff()
  window.addEventListener('beforeunload', handleBeforeUnload)
  // XXX-C: poll to refresh "X ago" label every 30s
  elapsedTick = setInterval(() => { if (lastSavedAt.value) lastSavedAt.value = lastSavedAt.value }, 30_000)
  // Check for saved draft
  const saved = localStorage.getItem(DRAFT_KEY)
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
          New Construction Project
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Create a new construction project
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article" />
    </v-card>

    <!-- Form (JJ-D: Tabbed Layout) -->
    <v-form v-else @submit.prevent="handleSubmit">
      <!-- JN-B: Step progress indicator -->
      <v-card class="mb-2 pa-3">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 font-weight-medium">
            Step {{ currentStepIndex + 1 }} of {{ tabOrder.length }}
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
        page-key="create"
        title="Creating a New Project"
        :content="[
          '6 tabs to complete',
          'Basic Info is required to save',
          'Milestones and Timelogs are available after saving',
          'You can return and edit other tabs later',
        ]"
      />

      <!-- Tab Navigation Header -->
      <v-card class="mb-4">
        <v-tabs v-model="activeTab" color="primary" grow>
          <v-tab value="basic">
            <v-icon start>mdi-information-outline</v-icon>
            Project Profile
            <v-icon v-if="tabCompletion.basic" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab value="schedule">
            <v-icon start>mdi-calendar-range</v-icon>
            Dates &amp; Duration
            <v-icon v-if="tabCompletion.schedule" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab value="progress">
            <v-icon start>mdi-chart-line</v-icon>
            Progress Report
            <v-icon v-if="tabCompletion.progress" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab value="personnel">
            <v-icon start>mdi-account-group</v-icon>
            Personnel
            <v-icon v-if="tabCompletion.personnel" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <v-tab value="documents">
            <v-icon start>mdi-paperclip</v-icon>
            Attachments
            <v-icon v-if="tabCompletion.documents" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
          <!-- LX-A: Others tab â€" mirrors edit-[id].vue (timeline intentionally absent until after save) -->
          <v-tab value="others">
            <v-icon start>mdi-dots-horizontal-circle-outline</v-icon>
            Others
            <v-icon v-if="tabCompletion.others" end color="success" size="small">mdi-check-circle</v-icon>
          </v-tab>
        </v-tabs>
      </v-card>

      <v-window v-model="activeTab">
        <!-- ============= TAB 1: BASIC INFO (KE-AA: uses shared CiBasicInfoForm) ============= -->
        <v-window-item value="basic">
          <!-- AAA-I: tab guidance banner -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
            Complete the project identity, location, funding, objectives, and strategic alignment. Title, Project Code, Campus, Status, and Funding Source are required to save.
          </v-alert>
          <!-- Names the still-missing required fields when the machine refuses NEXT,
               instead of only flashing a toast that disappears. -->
          <v-alert
            v-if="blockedTab === 'basic' && missingBasicFields.length"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
            icon="mdi-alert-circle-outline"
          >
            <span class="font-weight-medium">Cannot continue —</span>
            these required fields are still empty:
            <strong>{{ missingBasicFields.join(', ') }}</strong>
          </v-alert>
          <CiBasicInfoForm
            v-model="form"
            :funding-sources="fundingSources"
            :contractors="contractors"
            :rules="rules"
          />
        </v-window-item>

        <!-- ============= TAB 2: DATES AND DURATION (MH) ============= -->
        <v-window-item value="schedule">
          <!-- AAA-I: tab guidance banner -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
            Record contract dates, original and revised durations, and project completion dates. These dates drive the analytics timeline and WAR/MPR period calculations.
          </v-alert>
          <!-- Row 1: Primary Project Dates -->
          <v-card class="mb-3" elevation="2" rounded="lg">
            <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
              <v-icon size="small" icon="mdi-calendar-clock" color="primary" />
              <span class="text-subtitle-1 font-weight-medium">Primary Project Dates</span>
            </v-card-title>
            <v-card-subtitle class="pt-2 pb-1 text-body-2 text-grey-darken-1" style="white-space: normal;">
              Initial planned project schedule. Target dates reflect the original schedule; Project Duration (Days) is the planned contract period.
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="py-3">
              <v-row dense>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="startDateMenu" :close-on-content-click="false">
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
                      @update:model-value="(v: any) => { form.start_date = toIsoDate(v); startDateMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="targetCompletionMenu" :close-on-content-click="false">
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
                      @update:model-value="(v: any) => { form.target_completion_date = toIsoDate(v); targetCompletionMenu = false }"
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
                  <v-menu v-model="actualCompletionMenu" :close-on-content-click="false">
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
                      @update:model-value="(v: any) => { form.actual_completion_date = toIsoDate(v); actualCompletionMenu = false }"
                    />
                  </v-menu>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Row 2: Revision Orders (audit-tracked) -->
          <v-card class="mb-3" elevation="2" rounded="lg">
            <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
              <v-icon size="small" icon="mdi-file-document-edit-outline" color="warning" />
              <span class="text-subtitle-1 font-weight-medium">Variation Orders</span>
              <v-chip size="x-small" variant="tonal" color="warning" class="ml-1">VOR / CTE history</v-chip>
            </v-card-title>
            <v-card-subtitle class="pt-2 pb-1 text-body-2 text-grey-darken-1" style="white-space: normal;">
              Track Variation Orders (VOR) and Contract Time Extensions (CTE). Original vs Revised dates preserve audit history.
              <strong>Documentary MOV is required</strong> — attach the signed VO / TE Order file or paste a Drive/SharePoint link.
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="py-3">
              <v-row dense>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="origStartDateMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.original_start_date"
                        label="Original Start Date"
                        prepend-inner-icon="mdi-calendar"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.original_start_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.original_start_date || '')"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.original_start_date = toIsoDate(v); origStartDateMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="revStartDateMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.revised_start_date"
                        label="Revised Start Date"
                        prepend-inner-icon="mdi-calendar-refresh"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.revised_start_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.revised_start_date || '')"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.revised_start_date = toIsoDate(v); revStartDateMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="origCompletionDateMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.original_completion_date"
                        label="Original Completion Date"
                        prepend-inner-icon="mdi-calendar-check"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.original_completion_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.original_completion_date || '')"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.original_completion_date = toIsoDate(v); origCompletionDateMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6" md="3">
                  <v-menu v-model="revCompletionDateMenu" :close-on-content-click="false">
                    <template #activator="{ props: mp }">
                      <v-text-field
                        v-bind="mp"
                        :model-value="form.revised_completion_date"
                        label="Revised Completion Date"
                        prepend-inner-icon="mdi-calendar-refresh"
                        readonly clearable
                        density="compact" variant="outlined" hide-details="auto"
                        @click:clear="form.revised_completion_date = ''"
                      />
                    </template>
                    <v-date-picker
                      :model-value="isoToDate(form.revised_completion_date || '')"
                      min="1900-01-01" max="2100-12-31" hide-actions
                      @update:model-value="(v: any) => { form.revised_completion_date = toIsoDate(v); revCompletionDateMenu = false }"
                    />
                  </v-menu>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.original_contract_duration"
                    label="Original Contract Duration"
                    placeholder="e.g., 365 calendar days"
                    prepend-inner-icon="mdi-timer-outline"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.revised_project_duration"
                    label="Revised Project Duration"
                    placeholder="e.g., 425 calendar days"
                    prepend-inner-icon="mdi-timer-sync-outline"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
              </v-row>

              <v-divider class="my-3" />

              <!-- MH: Means of Verification (MOV) for the revision -->
              <p class="text-caption text-grey font-weight-medium text-uppercase mb-2">
                <v-icon size="x-small" color="warning">mdi-paperclip-check</v-icon>
                Means of Verification (MOV) â€" required for any revision
              </p>
              <v-row dense align="end">
                <v-col cols="12" md="5">
                  <v-text-field
                    v-model="revisionMovLink"
                    label="MOV Link (Drive / SharePoint / URL)"
                    placeholder="https://drive.google.com/..."
                    prepend-inner-icon="mdi-link-variant"
                    clearable
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="5">
                  <v-file-input
                    v-model="revisionMovFile"
                    label="Upload MOV File (PDF/DOCX/Image, â‰¤ 20 MB)"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    prepend-icon="mdi-paperclip"
                    show-size
                    clearable
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-btn
                    color="warning"
                    variant="tonal"
                    block
                    prepend-icon="mdi-content-save-edit"
                    :disabled="!revisionMovLink && !revisionMovFile"
                    @click="stageRevisionMov"
                  >
                    Stage MOV
                  </v-btn>
                </v-col>
                <v-col v-if="stagedRevisionMov.length" cols="12">
                  <div class="d-flex flex-wrap ga-1 mt-2">
                    <v-chip
                      v-for="(mov, i) in stagedRevisionMov"
                      :key="i"
                      size="small"
                      closable
                      color="warning"
                      variant="tonal"
                      @click:close="stagedRevisionMov.splice(i, 1)"
                    >
                      <v-icon start size="x-small">{{ mov.file ? 'mdi-file' : 'mdi-link' }}</v-icon>
                      {{ mov.file?.name || mov.link }}
                    </v-chip>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Row 3: Progress Targets (compact) -->
          <v-card elevation="2" rounded="lg">
            <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
              <v-icon size="small" icon="mdi-target" color="success" />
              <span class="text-subtitle-1 font-weight-medium">Progress Targets</span>
            </v-card-title>
            <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
              Default 100% â€" represents full physical/financial completion. Adjust only if the project targets partial completion (e.g., Phase 1 of multi-phase work).
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="py-3">
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.target_physical_progress"
                    label="Target Physical Progress (%)"
                    type="number" min="0" max="100" suffix="%"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.target_financial_progress"
                    label="Target Financial Progress (%)"
                    type="number" min="0" max="100" suffix="%"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-window-item>

        <!-- ============= TAB: PROGRESS & FINANCIAL (BBB-D) ============= -->
        <v-window-item value="progress">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
            Progress reports, timelogs, and variation orders become available after saving the project.
            Set an initial snapshot below — these can be updated in the edit page at any time.
          </v-alert>

          <!-- BBB-D: Compact initial snapshot card (replaces two separate Physical/Financial cards) -->
          <v-card class="mb-4" elevation="1" rounded="lg">
            <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
              <v-icon size="small" icon="mdi-chart-timeline-variant" color="primary" />
              <span class="text-subtitle-1 font-weight-medium">Initial Project Snapshot</span>
            </v-card-title>
            <v-card-subtitle class="pt-2 pb-1 text-body-2 text-grey-darken-1" style="white-space: normal;">
              Set the current project status at creation time. Full progress reporting (WAR/MPR, timelogs, variation orders) is available after saving.
            </v-card-subtitle>
            <v-divider />
            <v-card-text class="py-3">
              <v-row dense>
                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="form.physical_progress"
                    label="Physical %" type="number" min="0" max="100" suffix="%"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="form.financial_progress"
                    label="Financial %" type="number" min="0" max="100" suffix="%"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="form.cost_incurred_to_date"
                    label="Cost to Date (PHP)" type="number" min="0" prefix="PHP"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model="form.as_of_date"
                    label="As of Date" type="date"
                    density="compact" variant="outlined" hide-details="auto"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- BBB-D: Post-save capability previews (informational, no project ID available yet) -->
          <v-row dense>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="pa-4 text-center" rounded="lg">
                <v-icon size="36" color="grey-lighten-2">mdi-chart-line</v-icon>
                <p class="text-body-2 text-grey mt-2 mb-0 font-weight-medium">Progress Reports</p>
                <p class="text-caption text-grey">WAR/MPR, slippage, cost tracking — available after saving</p>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined" class="pa-4 text-center" rounded="lg">
                <v-icon size="36" color="grey-lighten-2">mdi-clipboard-text-clock-outline</v-icon>
                <p class="text-body-2 text-grey mt-2 mb-0 font-weight-medium">Timelogs &amp; Variation Orders</p>
                <p class="text-caption text-grey">Weekly/monthly site logs — available after saving</p>
              </v-card>
            </v-col>
          </v-row>
        </v-window-item>

        <!-- ============= TAB 5: PERSONNEL & ASSIGNMENT ============= -->
        <v-window-item value="personnel">
          <!-- PA (2026-05-22): Unified Personnel & Access Control -->
          <!-- project-id is empty on new.vue â€" component shows placeholder -->
          <CiPersonnelAccessCard project-id="" />
        </v-window-item>

        <!-- ============= TAB 6: DOCUMENTS (JO-D) ============= -->
        <v-window-item value="documents">
          <!-- AAA-I: tab guidance banner -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
            Stage project documents and gallery images. Files upload automatically once the project is created.
          </v-alert>
          <!-- ZZ-B: Attachment staging delegated to CiAttachmentHub (staging mode) -->
          <CiAttachmentHub
            mode="staging"
            :can-upload="true"
            :can-delete="true"
            :model-value="pendingQueue"
            @update:model-value="onQueueUpdate"
          />
          <!-- Submit / Cancel actions moved to Others (last tab) -->
        </v-window-item>

        <!-- ============= TAB 6: OTHERS (CCC-B: 4-Section UX Restructure) ============= -->
        <v-window-item value="others">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            <strong>Milestones &amp; Timelogs</strong> will be available after saving. Record administrative, knowledge, and project notes data below.
          </v-alert>

          <!-- ── SECTION B: Administrative Management ── -->
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon size="18" color="info">mdi-folder-text-outline</v-icon>
            <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Administrative Management</span>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-3">Manage project administrative and readiness documentation.</p>
          <v-row dense class="mb-4">
            <v-col cols="12" md="4">
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

      <!-- PV-C: Unified action footer — [Previous]  [Cancel] [Create Project / Next] -->
      <div class="d-flex align-center justify-space-between mt-4 pt-3" style="border-top: 1px solid rgba(0,0,0,0.08)">
        <v-btn
          v-if="activeTab !== 'basic'"
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
            v-if="activeTab === 'others'"
            type="submit"
            color="primary"
            :loading="submitting"
            :disabled="submitting"
            prepend-icon="mdi-plus-circle"
          >
            Create Project
          </v-btn>
          <v-btn
            v-if="activeTab !== 'others'"
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

    <!-- AAA-E: Scroll-to-top FAB (parity with edit-[id].vue) -->
    <CiScrollToTopFab />
  </div>
</template>
