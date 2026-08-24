<script setup lang="ts">
import { adaptProjects, type UIProject, type BackendProject, type PublicationStatus } from '~/utils/adapters'
import { getStatusColor, getPublicationStatusColor, STATUS_HEX } from '~/utils/status-colors'
import { formatDate } from '~/utils/userFormat'
import { formatRelativeDate } from '~/utils/date-utils'
import { PRIMARY_FUNDING_SOURCE_OPTIONS, labelForPrimaryFundingSource } from '~/utils/coiHierarchies'
import VueApexCharts from 'vue3-apexcharts'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const api = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { canAdd, canEdit, canDelete, isAdmin, isStaff, isSuperAdmin, canApprove } = usePermissions()

const projects = ref<UIProject[]>([])
const search = ref('')
const loading = ref(true)
const deleting = ref(false)
const deleteDialog = ref(false)
const projectToDelete = ref<UIProject | null>(null)

// Reject dialog state
const rejectDialog = ref(false)
const rejectNotes = ref('')
const projectToReject = ref<UIProject | null>(null)
const rejecting = ref(false)

// Action state
const actionLoading = ref<string | null>(null)

// OOO-G: Table page-size and sort — persisted in localStorage.
// Phase AAAF-1: default page size 5 (content-adaptive table view).
const itemsPerPage = ref(5)
// Phase AAAF-2: current page, drives content-adaptive tableHeight.
const page = ref(1)
const sortBy = ref<Array<{ key: string; order: 'asc' | 'desc' }>>([{ key: 'projectName', order: 'asc' }])

// LLL-B/C: Table headers + Column Manager.
// `optional: true` columns can be toggled via the column manager (localStorage-persisted).
// Default-hidden optional columns keep the default view focused (brief-required set visible).
const ALL_COLUMNS = [
  { title: 'Project Name',    key: 'projectName',           sortable: true, fixed: true, width: '260px' },
  { title: 'Project Code',    key: 'projectCode',           sortable: true, optional: true },
  { title: 'Campus',          key: 'campus',                sortable: true },
  { title: 'Status',          key: 'status',                sortable: true },
  { title: 'Publication',     key: 'publicationStatus',     sortable: true },
  { title: 'Fund Source',     key: 'fundSource',            sortable: true },
  { title: 'Orig. End',       key: 'originalCompletionDate', sortable: true, optional: true },
  { title: 'Contract Amount', key: 'totalContractAmount',   sortable: true, align: 'end' as const },
  { title: 'Progress',        key: 'physicalAccomplishment', sortable: true, align: 'center' as const },
  { title: 'Original Start',  key: 'originalStartDate',     sortable: true, optional: true },
  { title: 'Revised End',     key: 'revisedCompletionDate', sortable: true, optional: true },
  { title: 'Contractor',      key: 'contractor',            sortable: true, optional: true },
  { title: 'Revised Start',   key: 'revisedStartDate',      sortable: true, optional: true },
  { title: 'Duration',        key: 'projectDuration',       sortable: false, optional: true },
  { title: 'Created',         key: 'createdAt',             sortable: true, optional: true },
  { title: 'Updated',         key: 'updatedAt',             sortable: true, optional: true },
  { title: 'Actions',         key: 'actions',               sortable: false, align: 'center' as const },
]
const optionalColumns = ALL_COLUMNS.filter(c => (c as any).optional)
// Brief-required columns visible by default; supplementary optionals hidden until toggled on.
const DEFAULT_HIDDEN = ['originalStartDate', 'revisedCompletionDate', 'contractor', 'createdAt', 'revisedStartDate', 'projectDuration', 'updatedAt']
const hiddenColumns = ref<Set<string>>(new Set(DEFAULT_HIDDEN))

// MMM-H: filter instructional banner dismiss state
const filterBannerDismissed = ref(false)
function dismissFilterBanner() {
  filterBannerDismissed.value = true
  if (import.meta.client) localStorage.setItem('coi_filter_banner_dismissed', 'true')
}

onMounted(() => {
  if (!import.meta.client) return
  const stored = localStorage.getItem('coi_hidden_columns')
  if (stored) {
    try { hiddenColumns.value = new Set(JSON.parse(stored)) } catch { /* keep default */ }
  }
  filterBannerDismissed.value = localStorage.getItem('coi_filter_banner_dismissed') === 'true'
  // Phase AAAF-1: read from a new key so the stale `25` default doesn't suppress the new `5`
  const savedPageSize = localStorage.getItem('coi_items_per_page_v2')
  if (savedPageSize) itemsPerPage.value = parseInt(savedPageSize, 10) || 5
  const savedSort = localStorage.getItem('coi_sort_by')
  if (savedSort) { try { sortBy.value = JSON.parse(savedSort) } catch { /* keep default */ } }
})

watch(hiddenColumns, (v) => {
  if (import.meta.client) localStorage.setItem('coi_hidden_columns', JSON.stringify([...v]))
}, { deep: true })
watch(itemsPerPage, (v) => {
  if (import.meta.client) localStorage.setItem('coi_items_per_page_v2', String(v))
})
watch(sortBy, (v) => {
  if (import.meta.client) localStorage.setItem('coi_sort_by', JSON.stringify(v))
}, { deep: true })

function toggleColumn(key: string, visible: boolean | null) {
  if (visible) hiddenColumns.value.delete(key)
  else hiddenColumns.value.add(key)
}

const headers = computed(() =>
  ALL_COLUMNS.filter(c => !(c as any).optional || !hiddenColumns.value.has(c.key)),
)

// Publication status label mapping
function getPublicationStatusLabel(status: PublicationStatus): string {
  const labels: Record<PublicationStatus, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending',
    PUBLISHED: 'Published',
    REJECTED: 'Rejected',
  }
  return labels[status] || status
}

// Navigation
function viewProject(project: UIProject) {
  router.push(`/coi/detail-${project.id}`)
}

// Vuetify data-table row click handler — `row` is `{ item: T, ... }`.
function onRowClick(_event: Event, row: { item: UIProject }) {
  viewProject(row.item)
}

function editProject(project: UIProject) {
  router.push(`/coi/edit-${project.id}`)
}

function createProject() {
  router.push('/coi/new')
}

// Delete confirmation
function confirmDelete(project: UIProject) {
  projectToDelete.value = project
  deleteDialog.value = true
}

// --- Meatball Menu Action Visibility ---

// Check if current user is record owner, delegate, or assigned (Phase BJ)
function isOwnerOrAssigned(project: UIProject): boolean {
  const userId = authStore.user?.id
  if (!userId) return false
  return (
    project.createdBy === userId
    || project.delegatedTo === userId
    || project.assignedUsers?.some(u => u.id === userId) || false
  )
}

// Edit: Owner/assigned can edit own record, Admin can edit any. Editing PENDING_REVIEW auto-reverts to DRAFT.
function canEditItem(project: UIProject): boolean {
  if (isAdmin.value) return true
  return isOwnerOrAssigned(project)
}

// Submit/Resubmit for Review: Owner/assigned + DRAFT or REJECTED status
// PHASE BBCH (Track 1, R-372): owner/assigned + (Staff system role OR contribute-capable level).
function canSubmitForReview(project: UIProject): boolean {
  if (!isOwnerOrAssigned(project)) return false
  if (!(isStaff.value || canEdit('coi'))) return false
  return project.publicationStatus === 'DRAFT' || project.publicationStatus === 'REJECTED'
}

// Withdraw: Original submitter + PENDING_REVIEW status only
function canWithdraw(project: UIProject): boolean {
  if (project.publicationStatus !== 'PENDING_REVIEW') return false
  // Check if user is the original submitter
  return project.approvalMetadata?.submittedBy === authStore.user?.id
}

// Approve: approval authority (Admin OR Approver/Manager level) + PENDING_REVIEW + NOT self-submitted.
// PHASE BBCH (Track 1, R-372): was isAdmin-only — now recognizes Layer 3 module levels.
// Self-approval prevention: UI hides button if user is the submitter (backend also enforces).
function canApproveItem(project: UIProject): boolean {
  if (!canApprove('coi')) return false
  if (project.publicationStatus !== 'PENDING_REVIEW') return false
  // Prevent self-approval - hide button for own submissions (SuperAdmin excluded from this check)
  const currentUserId = authStore.user?.id
  if (!isSuperAdmin.value && project.approvalMetadata?.submittedBy === currentUserId) {
    return false
  }
  return true
}

// Reject: approval authority + PENDING_REVIEW status only
function canRejectItem(project: UIProject): boolean {
  return canApprove('coi') && project.publicationStatus === 'PENDING_REVIEW'
}

// --- Meatball Menu Actions ---

async function submitForReview(project: UIProject) {
  actionLoading.value = project.id
  try {
    await api.post(`/api/construction-projects/${project.id}/submit-for-review`, {})
    toast.success(`"${project.projectName}" submitted for review`)
    await fetchProjects()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to submit for review')
  } finally {
    actionLoading.value = null
  }
}

async function withdrawSubmission(project: UIProject) {
  actionLoading.value = project.id
  try {
    await api.post(`/api/construction-projects/${project.id}/withdraw`, {})
    toast.success(`"${project.projectName}" withdrawn successfully`)
    await fetchProjects()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to withdraw submission')
  } finally {
    actionLoading.value = null
  }
}

async function approveItem(project: UIProject) {
  actionLoading.value = project.id
  try {
    await api.post(`/api/construction-projects/${project.id}/publish`, {})
    toast.success(`"${project.projectName}" published successfully`)
    await fetchProjects()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to publish')
  } finally {
    actionLoading.value = null
  }
}

function openRejectDialog(project: UIProject) {
  projectToReject.value = project
  rejectNotes.value = ''
  rejectDialog.value = true
}

async function rejectItem() {
  if (!projectToReject.value) return
  rejecting.value = true
  try {
    await api.post(`/api/construction-projects/${projectToReject.value.id}/reject`, {
      notes: rejectNotes.value || 'Rejected by administrator',
    })
    toast.success(`"${projectToReject.value.projectName}" rejected`)
    rejectDialog.value = false
    await fetchProjects()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to reject')
  } finally {
    rejecting.value = false
    projectToReject.value = null
    rejectNotes.value = ''
  }
}

async function deleteProject() {
  if (!projectToDelete.value) return
  deleting.value = true
  try {
    await api.del(`/api/construction-projects/${projectToDelete.value.id}`)
    const deletedName = projectToDelete.value.projectName
    projects.value = projects.value.filter(p => p.id !== projectToDelete.value!.id)
    toast.success(`Project "${deletedName}" deleted successfully`)
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to delete project')
    console.error('Failed to delete project:', err)
  } finally {
    deleting.value = false
    deleteDialog.value = false
    projectToDelete.value = null
  }
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Phase JB + III-B/C: KPI stats + filter bar + view modes + date/sort
const filterStatus   = ref('')
const filterCampus   = ref('')
const filterFundingSource = ref('') // AAAK: Level-1 primary funding source filter
const filterDateFrom = ref('')
const filterDateTo   = ref('')
const sortKey        = ref<'projectName'|'startDate'|'endDate'|'physicalAccomplishment'|'totalContractAmount'>('projectName')
const sortDir        = ref<'asc'|'desc'>('asc')
const viewMode       = ref<'table'|'list'|'card'>('table')

// LLL-E: 3-tier filters. Primary (search/status/campus) always visible; a simplified
// advanced panel (project code + start-date range); and a full-search dialog holding the
// complete original/revised date-range field set for power users.
const showAdvancedFilters = ref(false)
const showFullSearch      = ref(false)
const filterProjectCode   = ref('')
const filterOrigStartFrom = ref('')
const filterOrigStartTo   = ref('')
const filterOrigEndFrom   = ref('')
const filterOrigEndTo     = ref('')
const filterRevStartFrom  = ref('')
const filterRevStartTo    = ref('')
const filterRevEndFrom    = ref('')
const filterRevEndTo      = ref('')

const sortOptions = [
  { title: 'Project Name', value: 'projectName' },
  { title: 'Start Date',   value: 'startDate' },
  { title: 'End Date',     value: 'endDate' },
  { title: 'Progress %',   value: 'physicalAccomplishment' },
  { title: 'Budget',       value: 'totalContractAmount' },
]

function clearFilters() {
  filterStatus.value   = ''
  filterCampus.value   = ''
  filterFundingSource.value = ''
  filterDateFrom.value = ''
  filterDateTo.value   = ''
  search.value         = ''
  // LLL-C2: advanced filters
  filterProjectCode.value   = ''
  filterOrigStartFrom.value = ''
  filterOrigStartTo.value   = ''
  filterOrigEndFrom.value   = ''
  filterOrigEndTo.value     = ''
  filterRevStartFrom.value  = ''
  filterRevStartTo.value    = ''
  filterRevEndFrom.value    = ''
  filterRevEndTo.value      = ''
}

const hasActiveFilters = computed(() =>
  !!(filterStatus.value || filterCampus.value || filterFundingSource.value || filterDateFrom.value || filterDateTo.value ||
     search.value || filterProjectCode.value ||
     filterOrigStartFrom.value || filterOrigStartTo.value ||
     filterOrigEndFrom.value || filterOrigEndTo.value ||
     filterRevStartFrom.value || filterRevStartTo.value ||
     filterRevEndFrom.value || filterRevEndTo.value)
)

const activeFilterChips = computed(() => {
  const chips: Array<{ label: string; key: string }> = []
  if (filterStatus.value)        chips.push({ label: `Status: ${filterStatus.value}`, key: 'status' })
  if (filterCampus.value)        chips.push({ label: `Campus: ${filterCampus.value}`, key: 'campus' })
  if (filterFundingSource.value) chips.push({ label: `Funding: ${labelForPrimaryFundingSource(filterFundingSource.value)}`, key: 'fundingSource' })
  if (filterDateFrom.value)      chips.push({ label: `Start ≥ ${filterDateFrom.value}`, key: 'dateFrom' })
  if (filterDateTo.value)        chips.push({ label: `Start ≤ ${filterDateTo.value}`, key: 'dateTo' })
  if (search.value)              chips.push({ label: `Search: "${search.value}"`, key: 'search' })
  if (filterProjectCode.value)   chips.push({ label: `Code: ${filterProjectCode.value}`, key: 'projectCode' })
  if (filterOrigStartFrom.value) chips.push({ label: `Orig Start ≥ ${filterOrigStartFrom.value}`, key: 'origStartFrom' })
  if (filterOrigStartTo.value)   chips.push({ label: `Orig Start ≤ ${filterOrigStartTo.value}`, key: 'origStartTo' })
  if (filterOrigEndFrom.value)   chips.push({ label: `Orig End ≥ ${filterOrigEndFrom.value}`, key: 'origEndFrom' })
  if (filterOrigEndTo.value)     chips.push({ label: `Orig End ≤ ${filterOrigEndTo.value}`, key: 'origEndTo' })
  if (filterRevStartFrom.value)  chips.push({ label: `Rev Start ≥ ${filterRevStartFrom.value}`, key: 'revStartFrom' })
  if (filterRevStartTo.value)    chips.push({ label: `Rev Start ≤ ${filterRevStartTo.value}`, key: 'revStartTo' })
  if (filterRevEndFrom.value)    chips.push({ label: `Rev End ≥ ${filterRevEndFrom.value}`, key: 'revEndFrom' })
  if (filterRevEndTo.value)      chips.push({ label: `Rev End ≤ ${filterRevEndTo.value}`, key: 'revEndTo' })
  return chips
})

function removeFilterChip(key: string) {
  const actions: Record<string, () => void> = {
    status:       () => { filterStatus.value = '' },
    campus:       () => { filterCampus.value = '' },
    fundingSource:() => { filterFundingSource.value = '' },
    dateFrom:     () => { filterDateFrom.value = '' },
    dateTo:       () => { filterDateTo.value = '' },
    search:       () => { search.value = '' },
    projectCode:  () => { filterProjectCode.value = '' },
    origStartFrom:() => { filterOrigStartFrom.value = '' },
    origStartTo:  () => { filterOrigStartTo.value = '' },
    origEndFrom:  () => { filterOrigEndFrom.value = '' },
    origEndTo:    () => { filterOrigEndTo.value = '' },
    revStartFrom: () => { filterRevStartFrom.value = '' },
    revStartTo:   () => { filterRevStartTo.value = '' },
    revEndFrom:   () => { filterRevEndFrom.value = '' },
    revEndTo:     () => { filterRevEndTo.value = '' },
  }
  actions[key]?.()
}

// MG / MF: Updated status taxonomy.
const statusFilterOptions = [
  { title: 'All',       value: ''          },
  { title: 'Proposal',  value: 'PROPOSAL'  },
  { title: 'Ongoing',   value: 'ONGOING'   },
  { title: 'Complete',  value: 'COMPLETE'  },
  { title: 'On Hold',   value: 'ON_HOLD'   },
  { title: 'Cancelled', value: 'CANCELLED' },
]
const campusFilterOptions = [
  { title: 'All Campuses', value: '' },
  { title: 'Main Campus', value: 'MAIN' },
  { title: 'Cabadbaran', value: 'CABADBARAN' },
]
// AAAK: Level-1 funding source filter options ("All" + 8 controlled categories)
const fundingSourceFilterOptions = [
  { title: 'All Funding', value: '' },
  ...PRIMARY_FUNDING_SOURCE_OPTIONS,
]

const stats = ref({
  total: 0,
  ongoing: 0,
  completed: 0,
  onHold: 0,
  pendingReview: 0,
  totalContractValue: 0,
  costUtilized: 0,
  avgProgress: 0,
})

// LLL-D3: Client-side fallback. Authoritative values come from the backend
// analytics/summary endpoint (DB aggregates) via syncStatsFromAnalytics(); this
// runs only until analytics arrives, and as a fallback if the endpoint fails.
function computeStats(projectList: UIProject[]) {
  if (analyticsSummary.value) return // backend values are authoritative once loaded
  stats.value.total = projectList.length
  stats.value.ongoing = projectList.filter(p => p.status === 'ONGOING' || p.status?.toLowerCase() === 'ongoing').length
  // MG / MF: Count COMPLETE (new) + COMPLETED (legacy, not yet migrated edge cases).
  stats.value.completed = projectList.filter(p => {
    const s = (p.status || '').toUpperCase()
    return s === 'COMPLETE' || s === 'COMPLETED'
  }).length
  stats.value.onHold = projectList.filter(p => (p.status || '').toUpperCase() === 'ON_HOLD').length
  stats.value.pendingReview = projectList.filter(p => p.publicationStatus === 'PENDING_REVIEW').length
  stats.value.totalContractValue = projectList.reduce((sum, p) => sum + (p.totalContractAmount || 0), 0)
  stats.value.avgProgress = projectList.length > 0
    ? projectList.reduce((sum, p) => sum + (Number(p.physicalAccomplishment) || 0), 0) / projectList.length
    : 0
}

// LLL-D3: Sync KPI stat cards from backend DB-aggregated analytics (authoritative).
function syncStatsFromAnalytics() {
  const a = analyticsSummary.value
  if (!a) return
  const byStatus = (a.by_status || []) as Array<{ status: string; count: number }>
  const findCount = (...names: string[]) =>
    byStatus.filter(s => names.includes((s.status || '').toUpperCase()))
      .reduce((sum, s) => sum + (Number(s.count) || 0), 0)
  stats.value.total = a.total ?? projects.value.length
  stats.value.ongoing = findCount('ONGOING')
  stats.value.completed = findCount('COMPLETE', 'COMPLETED')
  stats.value.onHold = findCount('ON_HOLD')
  stats.value.totalContractValue = a.total_contract_value ?? 0
  stats.value.costUtilized = financialSummary.value?.total_obligation ?? 0
  stats.value.avgProgress = a.avg_progress ?? 0
  // pendingReview stays client-derived (publication_status, not in summary status dist)
  stats.value.pendingReview = projects.value.filter(p => p.publicationStatus === 'PENDING_REVIEW').length
}

// LLL-A: Published count — prefer DB aggregate, fall back to client-side publication status.
const publishedCount = computed(() => {
  const pub = (analyticsSummary.value?.by_publication_status || []) as Array<{ publication_status: string; count: number }>
  const found = pub.find(p => p.publication_status === 'PUBLISHED')
  if (found) return Number(found.count) || 0
  return projects.value.filter(p => p.publicationStatus === 'PUBLISHED').length
})

// MMM-I: data-driven KPI cards with contextual tooltips (R-113)
const kpiCards = computed(() => [
  { key: 'total',     label: 'Total Projects',  value: stats.value.total,         icon: 'mdi-office-building', color: 'blue-lighten-1',  tooltip: 'Total infrastructure projects in the portfolio, across all publication statuses.' },
  { key: 'published', label: 'Published',        value: publishedCount.value,      icon: 'mdi-check-decagram',  color: 'green-lighten-1', tooltip: 'Projects approved and visible on the public portal.' },
  { key: 'ongoing',   label: 'Ongoing',          value: stats.value.ongoing,       icon: 'mdi-progress-clock',  color: 'info',    tooltip: 'Active construction projects currently in progress.' },
  { key: 'completed', label: 'Completed',        value: stats.value.completed,     icon: 'mdi-check-circle',    color: 'teal',    tooltip: 'Projects where construction has been fully completed.' },
  { key: 'pending',   label: 'Pending Review',   value: stats.value.pendingReview, icon: 'mdi-clipboard-clock', color: 'warning', tooltip: 'Projects submitted for publication approval, awaiting an admin decision.' },
])

// Role-gated recent activity (DDD-D5: admin endpoint — hidden for Staff/Viewer).
const canViewActivity = computed(() => isAdmin.value || isSuperAdmin.value)
const recentActivity = ref<Array<{ id: string; userName: string; action: string; entityType: string; createdAt: string }>>([])
const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: 'created', UPDATE: 'updated', DELETE: 'deleted', SUBMIT: 'submitted', PUBLISH: 'published',
  REJECT: 'rejected', WITHDRAW: 'withdrew', UPLOAD: 'uploaded', REMOVE_ATTACHMENT: 'removed an attachment',
  DOWNLOAD: 'downloaded', BATCH_UPLOAD: 'batch-uploaded', REMARKS_UPDATE: 'updated remarks', TEMPLATE_UPLOAD: 'uploaded a template',
}
function activityLabel(a: string): string { return ACTIVITY_LABELS[a] ?? a.toLowerCase() }
function formatActivityDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
async function fetchRecentActivity() {
  if (!canViewActivity.value) return
  try {
    const res = await api.get<any>('/api/activity-logs?entityType=CONSTRUCTION_PROJECT&pageSize=8')
    recentActivity.value = Array.isArray(res) ? res : (res?.data ?? [])
  } catch {
    recentActivity.value = []
  }
}

// LLL-D: Recent Activity is an admin-only collapsible (default collapsed); logs are
// fetched lazily on first expand to avoid an unnecessary request on initial page load.
const activityExpanded = ref<number[]>([])
watch(activityExpanded, (v) => {
  if (v.length && !recentActivity.value.length) fetchRecentActivity()
})

// Filtered + sorted projects (search + status + campus + date + sort)
const filteredProjects = computed(() => {
  let result = projects.value
  if (filterStatus.value) result = result.filter(p => p.status?.toUpperCase() === filterStatus.value)
  if (filterCampus.value) result = result.filter(p => p.campus?.toUpperCase() === filterCampus.value)
  if (filterFundingSource.value) result = result.filter(p => p.primaryFundingSource === filterFundingSource.value)
  if (search.value) {
    const term = search.value.toLowerCase()
    result = result.filter(p =>
      p.projectName.toLowerCase().includes(term) ||
      p.campus.toLowerCase().includes(term) ||
      p.status.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term)
    )
  }
  if (filterDateFrom.value) result = result.filter(p => (p.startDate || '') >= filterDateFrom.value)
  if (filterDateTo.value)   result = result.filter(p => (p.startDate || '') <= filterDateTo.value)
  // LLL-C4: advanced filters — project code + original/revised date ranges
  if (filterProjectCode.value) {
    const code = filterProjectCode.value.toLowerCase()
    result = result.filter(p => (p.projectCode || '').toLowerCase().includes(code))
  }
  if (filterOrigStartFrom.value) result = result.filter(p => (p.originalStartDate || '') >= filterOrigStartFrom.value)
  if (filterOrigStartTo.value)   result = result.filter(p => (p.originalStartDate || '') <= filterOrigStartTo.value)
  if (filterOrigEndFrom.value)   result = result.filter(p => (p.originalCompletionDate || '') >= filterOrigEndFrom.value)
  if (filterOrigEndTo.value)     result = result.filter(p => (p.originalCompletionDate || '') <= filterOrigEndTo.value)
  if (filterRevStartFrom.value)  result = result.filter(p => (p.revisedStartDate || '') >= filterRevStartFrom.value)
  if (filterRevStartTo.value)    result = result.filter(p => (p.revisedStartDate || '') <= filterRevStartTo.value)
  if (filterRevEndFrom.value)    result = result.filter(p => (p.revisedCompletionDate || '') >= filterRevEndFrom.value)
  if (filterRevEndTo.value)      result = result.filter(p => (p.revisedCompletionDate || '') <= filterRevEndTo.value)
  // Sort for list/card modes (table view uses its own column sorting)
  if (viewMode.value !== 'table') {
    result = [...result].sort((a, b) => {
      const va = (a as any)[sortKey.value] ?? ''
      const vb = (b as any)[sortKey.value] ?? ''
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return result
})

async function fetchProjects() {
  loading.value = true
  try {
    const response = await api.get<{ data: BackendProject[] }>('/api/construction-projects')
    projects.value = adaptProjects(response.data || [])
    computeStats(projects.value)
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to load projects')
    console.error('Failed to fetch projects:', err)
  } finally {
    loading.value = false
  }
}

// --- Phase JF: Analytics ---
const activeTab = ref('projects')
const analyticsLoading = ref(false)
const analyticsSummary = ref<any>(null)
const financialSummary = ref<any>(null)
const analyticsError = ref<string | null>(null)

async function fetchAnalytics() {
  analyticsLoading.value = true
  analyticsError.value = null
  try {
    const [summary, financial] = await Promise.all([
      api.get<any>('/api/construction-projects/analytics/summary'),
      api.get<any>('/api/construction-projects/analytics/financial-summary'),
    ])
    analyticsSummary.value = summary
    financialSummary.value = financial
    syncStatsFromAnalytics() // LLL-D3: backend DB aggregates are authoritative for KPI cards
  } catch (err: any) {
    console.error('[COI Analytics] Failed to fetch:', err)
    analyticsError.value = err?.message || 'Failed to load analytics data'
  } finally {
    analyticsLoading.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'analytics' && !analyticsSummary.value && !analyticsLoading.value) fetchAnalytics()
})

// EEE-A: Tier 1 analytics derived from the (now mount-fetched) analytics endpoints.
const analyticsReady = computed(() => !!analyticsSummary.value && !!financialSummary.value)

const campusBars = computed(() => {
  const data = (analyticsSummary.value?.by_campus || []) as Array<{ campus: string; count: number; avg_progress: number }>
  const max = Math.max(...data.map(d => d.count), 1)
  return [...data].sort((a, b) => b.count - a.count).map(d => ({
    ...d,
    pct: (d.count / max) * 100,
    avg_progress: parseFloat(String(d.avg_progress)) || 0,
  }))
})

const budgetGauge = computed(() => {
  const a = financialSummary.value?.total_appropriation || 0
  const o = financialSummary.value?.total_obligation || 0
  const d = financialSummary.value?.total_disbursement || 0
  return {
    appropriation: a,
    obligationPct: a ? Math.min((o / a) * 100, 100) : 0,
    disbursementPct: a ? Math.min((d / a) * 100, 100) : 0,
  }
})

// QQQ-B2: On Hold projects — always-meaningful executive metric (replaces the
// near-always-empty "Completing in 30 Days" card; infrastructure projects span years).
const onHoldProjects = computed(() =>
  projects.value
    .filter(p => (p.status || '').toUpperCase() === 'ON_HOLD')
    .slice(0, 5)
)

// Phase AAAF-2: Content-adaptive table height. Fit the rows actually shown on the current
// page — short pages render naturally (no internal scroll, no blank space); tall pages
// (large page sizes) cap and scroll with a fixed header. Supersedes QQQ-B3 / AAAB-B-1,
// which sized off the TOTAL filtered count and cramped real (taller) rows into ~2 visible.
const tableHeight = computed<number | undefined>(() => {
  const total = filteredProjects.value.length
  if (total === 0) return undefined            // let #no-data render naturally
  const perPage = itemsPerPage.value === -1 ? total : itemsPerPage.value
  const remaining = total - (page.value - 1) * perPage
  const shownOnPage = Math.min(perPage, Math.max(remaining, 0)) || perPage

  const VISIBLE_ROW_LIMIT = 8                   // rows before internal scroll engages
  if (shownOnPage <= VISIBLE_ROW_LIMIT) return undefined   // natural fit

  const ROW_PX = 64                             // realistic row height (chips + wrap + padding)
  const HEAD_PX = 56
  return VISIBLE_ROW_LIMIT * ROW_PX + HEAD_PX   // capped → fixed-header scroll
})

const statusChartOptions = computed(() => ({
  chart: {
    type: 'donut' as const,
    toolbar: { show: false },
    events: {
      dataPointSelection: (_e: any, _ctx: any, config: any) => {
        const status = (analyticsSummary.value?.by_status || [])[config.dataPointIndex]?.status
        if (status) drillToStatus(status)
      },
    },
  },
  labels: (analyticsSummary.value?.by_status || []).map((s: any) => s.status),
  legend: { position: 'bottom' as const },
  colors: ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'],
}))

const statusChartSeries = computed(() =>
  (analyticsSummary.value?.by_status || []).map((s: any) => s.count)
)

const campusChartOptions = computed(() => ({
  chart: {
    type: 'bar' as const,
    toolbar: { show: false },
    events: {
      dataPointSelection: (_e: any, _ctx: any, config: any) => {
        const campus = (analyticsSummary.value?.by_campus || [])[config.dataPointIndex]?.campus
        if (campus) drillToCampus(campus)
      },
    },
  },
  xaxis: { categories: (analyticsSummary.value?.by_campus || []).map((c: any) => c.campus || 'Unknown') },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
  colors: ['#059669'],
  dataLabels: { enabled: false },
}))

const campusChartSeries = computed(() => [{
  name: 'Projects',
  data: (analyticsSummary.value?.by_campus || []).map((c: any) => c.count),
}])

function formatCurrencyShort(amount: number): string {
  if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`
  return `₱${amount.toLocaleString()}`
}

function drillToCampus(campus: string) {
  filterCampus.value = campus?.toUpperCase() || ''
  activeTab.value = 'projects'
}

function drillToStatus(status: string) {
  filterStatus.value = status?.toUpperCase() || ''
  activeTab.value = 'projects'
}

const progressDistChart = computed(() => {
  const buckets = [0, 0, 0, 0]
  projects.value.forEach(p => {
    const pct = Number(p.physicalAccomplishment) || 0
    if (pct < 25) buckets[0]++
    else if (pct < 50) buckets[1]++
    else if (pct < 75) buckets[2]++
    else buckets[3]++
  })
  return {
    series: [{ name: 'Projects', data: buckets }],
    options: {
      chart: { type: 'bar' as const, toolbar: { show: false } },
      xaxis: { categories: ['0–24%', '25–49%', '50–74%', '75–100%'] },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      colors: ['#f59e0b'],
      dataLabels: { enabled: true },
    },
  }
})

// III-E: Upgraded fundingSourceChart — prefers backend by_funding_source, falls back to client-side
const fundingSourceChart = computed(() => {
  const backendData = (analyticsSummary.value?.by_funding_source || []) as Array<{
    funding_source_name: string; count: number
  }>
  if (backendData.length) {
    return {
      series: backendData.map(d => d.count),
      options: {
        chart: { type: 'donut' as const, toolbar: { show: false } },
        labels: backendData.map(d => d.funding_source_name || 'Unknown'),
        legend: { position: 'bottom' as const },
      },
    }
  }
  const map: Record<string, number> = {}
  projects.value.forEach(p => {
    // AAAK: group by Level-1 category label (falls back to legacy fundSource then Unknown)
    const fs = p.primaryFundingSource ? labelForPrimaryFundingSource(p.primaryFundingSource) : (p.fundSource || 'Unknown')
    map[fs] = (map[fs] || 0) + 1
  })
  return {
    series: Object.values(map),
    options: {
      chart: { type: 'donut' as const, toolbar: { show: false } },
      labels: Object.keys(map),
      legend: { position: 'bottom' as const },
    },
  }
})

// III-C: Per-campus avg progress horizontal bar chart
const campusProgressChart = computed(() => {
  const data = (analyticsSummary.value?.by_campus || []) as Array<{ campus: string; avg_progress: number }>
  const sorted = [...data].sort((a, b) =>
    (parseFloat(String(b.avg_progress)) || 0) - (parseFloat(String(a.avg_progress)) || 0)
  )
  return {
    series: [{ name: 'Avg Progress %', data: sorted.map(d => +((parseFloat(String(d.avg_progress)) || 0).toFixed(1))) }],
    options: {
      chart: { type: 'bar' as const, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      xaxis: { categories: sorted.map(d => d.campus || 'Unknown') },
      yaxis: { max: 100, labels: { formatter: (v: any) => `${v}%` } },
      colors: ['#7c3aed'],
      dataLabels: { enabled: true, formatter: (v: any) => `${Number(v).toFixed(1)}%` },
    },
  }
})

// III-D: Budget by campus donut
const budgetByCampusChart = computed(() => {
  const data = (analyticsSummary.value?.by_campus || []) as Array<{ campus: string; total_contract: number }>
  const fmt = (v: number) => {
    if (v >= 1_000_000_000) return `₱${(v / 1_000_000_000).toFixed(1)}B`
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`
    return `₱${v.toLocaleString()}`
  }
  return {
    series: data.map(d => parseFloat(String(d.total_contract || 0))),
    options: {
      chart: { type: 'donut' as const, toolbar: { show: false } },
      labels: data.map(d => d.campus || 'Unknown'),
      legend: { position: 'bottom' as const },
      tooltip: { y: { formatter: fmt } },
    },
  }
})

// III-D: Contract value by status donut
const contractByStatusChart = computed(() => {
  const data = (analyticsSummary.value?.by_status || []) as Array<{ status: string; total_contract: number }>
  const fmt = (v: number) => {
    if (v >= 1_000_000_000) return `₱${(v / 1_000_000_000).toFixed(1)}B`
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`
    return `₱${v.toLocaleString()}`
  }
  return {
    series: data.map(d => parseFloat(String(d.total_contract || 0))),
    options: {
      chart: { type: 'donut' as const, toolbar: { show: false } },
      labels: data.map(d => d.status),
      colors: data.map(d => STATUS_HEX[d.status] || '#9ca3af'),
      legend: { position: 'bottom' as const },
      tooltip: { y: { formatter: fmt } },
    },
  }
})

// QQQ-C2: Publication Status donut (replaces low-value chip row; balances grid symmetry)
const publicationStatusChart = computed(() => {
  const data = (analyticsSummary.value?.by_publication_status || []) as Array<{ publication_status: string; count: number }>
  const labelMap: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    PUBLISHED: 'Published',
    REJECTED: 'Rejected',
  }
  const colorMap: Record<string, string> = {
    DRAFT: '#9e9e9e',
    PENDING_REVIEW: '#f59e0b',
    PUBLISHED: '#059669',
    REJECTED: '#ef4444',
  }
  return {
    series: data.map(d => Number(d.count) || 0),
    options: {
      chart: { type: 'donut' as const, toolbar: { show: false } },
      labels: data.map(d => labelMap[d.publication_status] || d.publication_status),
      colors: data.map(d => colorMap[d.publication_status] || '#9e9e9e'),
      legend: { position: 'bottom' as const },
      dataLabels: { enabled: true },
    },
  }
})

// III-E: Projects by contractor horizontal bar
const contractorChart = computed(() => {
  const backendData = (analyticsSummary.value?.by_contractor || []) as Array<{ contractor_name: string; count: number }>
  const data = backendData.length
    ? backendData
    : (() => {
        const map: Record<string, number> = {}
        projects.value.forEach(p => { if (p.contractor) { map[p.contractor] = (map[p.contractor] || 0) + 1 } })
        return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 10)
          .map(([contractor_name, count]) => ({ contractor_name, count }))
      })()
  const truncate = (s: string) => s.length > 28 ? s.slice(0, 26) + '…' : s
  return {
    series: [{ name: 'Projects', data: data.map(d => d.count) }],
    options: {
      chart: { type: 'bar' as const, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      xaxis: { categories: data.map(d => truncate(d.contractor_name || '')) },
      colors: ['#0ea5e9'],
      dataLabels: { enabled: false },
    },
  }
})

onMounted(() => { fetchProjects(); fetchAnalytics() })
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          Infrastructure Projects
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Manage and monitor infrastructure projects
        </p>
      </div>
      <v-btn v-if="canAdd('coi')" color="primary" prepend-icon="mdi-plus" @click="createProject">
        New Project
      </v-btn>
    </div>

    <!-- Tab Navigation (Phase JF) -->
    <v-tabs v-model="activeTab" class="mb-4" color="primary">
      <v-tab value="projects" prepend-icon="mdi-format-list-bulleted">Projects</v-tab>
      <v-tab value="analytics" prepend-icon="mdi-chart-bar">Analytics</v-tab>
    </v-tabs>

    <v-window v-model="activeTab">

    <!-- Projects Tab -->
    <v-window-item value="projects">

    <!-- LLL-F / NNN-J: Portfolio Summary section banner -->
    <div class="mb-3">
      <div class="d-flex align-center ga-2 mb-1">
        <v-icon size="16" color="grey-darken-2">mdi-chart-box</v-icon>
        <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase coi-section-label">Portfolio Summary</span>
        <v-divider class="flex-grow-1 ml-1" />
      </div>
      <div class="text-caption text-grey-darken-1">Real-time overview of infrastructure project metrics across all campuses.</div>
    </div>

    <!-- LLL-A / MMM-I / OOO-F: KPI Stats Panel — responsive grid, contextual tooltips -->
    <v-row dense class="mb-4">
      <v-col
        v-for="kpi in kpiCards"
        :key="kpi.key"
        cols="6"
        sm="4"
        lg="auto"
        class="flex-lg-grow-1"
      >
        <v-tooltip
          :text="kpi.tooltip"
          location="bottom"
          max-width="240"
          open-on-focus
        >
          <template #activator="{ props: tipProps }">
            <v-card
              v-bind="tipProps"
              :color="kpi.color"
              variant="tonal"
              class="pa-3 d-flex align-center ga-3 h-100 kpi-card"
              tabindex="0"
              role="img"
              :aria-label="`${kpi.label}: ${kpi.value}. ${kpi.tooltip}`"
            >
              <v-icon :icon="kpi.icon" size="20" />
              <div>
                <p class="text-caption text-grey-darken-1">{{ kpi.label }}</p>
                <p class="text-h6 font-weight-bold">{{ kpi.value }}</p>
              </div>
            </v-card>
          </template>
        </v-tooltip>
      </v-col>
    </v-row>

    <!-- PPP-B5: Executive Overview section label -->
    <div v-if="analyticsReady" class="d-flex align-center ga-2 mb-2 mt-1">
      <v-icon size="16" color="grey-darken-2">mdi-view-dashboard-outline</v-icon>
      <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase coi-section-label">Executive Overview</span>
      <v-divider class="flex-grow-1 ml-1" />
    </div>

    <!-- LLL-G/H: Executive overview — Cost Utilization + Campus bars + Upcoming Completions
         (hero strip, Needs Attention, and Slow-Moving negative panels removed → analytics tab) -->
    <template v-if="analyticsReady">
      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <v-card elevation="1" rounded="lg" class="h-100 pa-3">
            <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase mb-2">Cost Utilization</div>
            <div class="mb-2">
              <div class="d-flex justify-space-between text-caption mb-1">
                <span>Appropriation</span><span>{{ formatCurrencyShort(budgetGauge.appropriation) }}</span>
              </div>
              <v-progress-linear :model-value="100" height="8" rounded color="teal" />
            </div>
            <div>
              <div class="d-flex justify-space-between text-caption mb-1">
                <span>Cost Incurred</span><span>{{ budgetGauge.obligationPct.toFixed(1) }}%</span>
              </div>
              <v-progress-linear :model-value="budgetGauge.obligationPct" height="8" rounded color="info" />
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card elevation="1" rounded="lg" class="h-100 pa-3">
            <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase mb-2">Projects by Campus</div>
            <div
              v-for="campus in campusBars"
              :key="campus.campus"
              class="mb-3"
              style="cursor:pointer"
              @click="drillToCampus(campus.campus)"
            >
              <div class="d-flex justify-space-between text-caption mb-1">
                <span class="text-primary font-weight-medium">{{ campus.campus || 'Unknown' }}</span>
                <span>{{ campus.count }} project{{ campus.count !== 1 ? 's' : '' }}</span>
              </div>
              <v-progress-linear :model-value="campus.pct" height="6" rounded color="primary" class="mb-1" />
              <div class="d-flex justify-space-between text-caption mb-1" style="opacity:0.75">
                <span>Avg Progress</span><span>{{ campus.avg_progress.toFixed(1) }}%</span>
              </div>
              <v-progress-linear :model-value="campus.avg_progress" height="4" rounded color="deep-purple" />
            </div>
            <div v-if="!campusBars.length" class="text-caption text-grey">No campus data.</div>
            <div v-if="campusBars.length" class="text-caption text-grey mt-2">
              <v-icon size="12" class="mr-1">mdi-cursor-default-click</v-icon>Click to filter projects
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card elevation="1" rounded="lg" class="h-100 pa-3">
            <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase mb-2">
              <v-icon icon="mdi-pause-circle-outline" size="small" color="warning" class="mr-1" />On Hold
            </div>
            <div v-if="!onHoldProjects.length" class="text-caption text-grey py-2">No projects currently on hold.</div>
            <v-list v-else density="compact" class="pa-0">
              <v-list-item
                v-for="p in onHoldProjects"
                :key="p.id"
                class="px-0 cursor-pointer"
                @click="router.push(`/coi/detail-${p.id}`)"
              >
                <v-list-item-title class="text-caption font-weight-medium text-truncate">{{ p.projectName }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption text-grey">
                  {{ p.campus }} · {{ (Number(p.physicalAccomplishment) || 0).toFixed(0) }}% complete
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>
    </template>
    <v-row v-else-if="analyticsLoading" dense class="mb-3">
      <v-col v-for="n in 3" :key="n" cols="12" md="4"><v-skeleton-loader type="card" height="140" /></v-col>
    </v-row>

    <!-- PPP-B4: Filters section label (breathing room after Executive Overview) -->
    <div class="d-flex align-center ga-2 mb-2 mt-5">
      <v-icon size="16" color="grey-darken-2">mdi-filter-variant</v-icon>
      <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase coi-section-label">Filters</span>
      <v-divider class="flex-grow-1 ml-1" />
    </div>

    <!-- MMM-H: Filter instructional banner (dismissible, localStorage-persisted) -->
    <v-alert
      v-if="!filterBannerDismissed"
      type="info"
      variant="tonal"
      density="compact"
      icon="mdi-filter-variant"
      closable
      class="mb-3"
      @click:close="dismissFilterBanner"
    >
      Filter projects by status, campus, funding source, and timeline to refine portfolio analysis.
    </v-alert>

    <!-- Filter Bar (III-B/C: extended with view modes, date filters, sort) -->
    <v-card elevation="1" rounded="lg" class="mb-3 pa-3">
      <!-- LLL-B: Primary filter bar — single compact row -->
      <v-row dense align="center">
        <v-col cols="12" sm="5" md="3">
          <v-text-field
            v-model="search"
            placeholder="Search project name, code, campus…"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            hide-details
            single-line
          />
        </v-col>
        <v-col cols="6" sm="3" md="2">
          <v-select
            v-model="filterStatus"
            :items="statusFilterOptions"
            label="Status"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-select
            v-model="filterCampus"
            :items="campusFilterOptions"
            label="Campus"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-select
            v-model="filterFundingSource"
            :items="fundingSourceFilterOptions"
            label="Funding Source"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="12" md="3" class="d-flex align-center justify-end flex-wrap ga-1">
          <!-- LLL-C: Column Manager (table view only) -->
          <v-menu v-if="viewMode === 'table'" :close-on-content-click="false">
            <template #activator="{ props: mp }">
              <v-btn
                v-bind="mp"
                icon="mdi-table-column-plus-after"
                size="small"
                variant="text"
                color="grey-darken-1"
                title="Manage columns"
              />
            </template>
            <v-list density="compact" min-width="220">
              <v-list-subheader>Toggle Columns</v-list-subheader>
              <v-list-item v-for="col in optionalColumns" :key="col.key">
                <template #prepend>
                  <v-checkbox
                    :model-value="!hiddenColumns.has(col.key)"
                    density="compact"
                    hide-details
                    color="primary"
                    @update:model-value="v => toggleColumn(col.key, v)"
                  />
                </template>
                <v-list-item-title class="text-body-2">{{ col.title }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-btn
            :color="showAdvancedFilters ? 'primary' : 'grey-darken-1'"
            :variant="showAdvancedFilters ? 'tonal' : 'text'"
            size="small"
            prepend-icon="mdi-filter-variant"
            @click="showAdvancedFilters = !showAdvancedFilters"
          >
            Advanced
          </v-btn>
          <v-btn
            v-if="hasActiveFilters"
            variant="text"
            size="small"
            icon="mdi-filter-off"
            color="grey-darken-1"
            title="Clear all filters"
            @click="clearFilters"
          />
          <v-divider vertical class="mx-1" />
          <v-select
            v-model="sortKey"
            :items="sortOptions"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 150px"
          />
          <v-btn
            :icon="sortDir === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending'"
            size="small"
            variant="text"
            color="grey-darken-1"
            :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
            @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
          />
        </v-col>
      </v-row>

      <!-- Project count + active filter chips -->
      <div class="text-body-2 text-grey-darken-1 mt-1 mb-1">
        {{ filteredProjects.length }} project{{ filteredProjects.length !== 1 ? 's' : '' }}
      </div>
      <div v-if="activeFilterChips.length" class="d-flex flex-wrap align-center ga-2 mt-1">
        <span class="text-caption text-grey-darken-1 font-weight-medium">Active filters:</span>
        <v-chip
          v-for="chip in activeFilterChips"
          :key="chip.key"
          size="small"
          closable
          color="primary"
          variant="tonal"
          @click:close="removeFilterChip(chip.key)"
        >{{ chip.label }}</v-chip>
        <v-btn size="x-small" variant="text" color="error" @click="clearFilters">Clear all</v-btn>
      </div>

      <!-- LLL-E: Simplified advanced panel — 3 fields + full-search trigger -->
      <v-expand-transition>
        <div v-if="showAdvancedFilters">
          <v-divider class="my-3" />
          <div class="d-flex align-center justify-space-between mb-2 flex-wrap ga-2">
            <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase">
              <v-icon icon="mdi-filter-cog-outline" size="small" class="mr-1" />Advanced Filters
            </div>
            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-tune-variant" @click="showFullSearch = true">
              Full Search
            </v-btn>
          </div>
          <v-row dense>
            <v-col cols="12" sm="6" md="4">
              <v-text-field
                v-model="filterProjectCode"
                label="Project Code / ID"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                prepend-inner-icon="mdi-identifier"
              />
            </v-col>
            <v-col cols="6" sm="3" md="4">
              <v-text-field v-model="filterDateFrom" type="date" label="Start From" variant="outlined" density="compact" hide-details clearable />
            </v-col>
            <v-col cols="6" sm="3" md="4">
              <v-text-field v-model="filterDateTo" type="date" label="Start To" variant="outlined" density="compact" hide-details clearable />
            </v-col>
          </v-row>
        </div>
      </v-expand-transition>
    </v-card>

    <!-- LLL-F / NNN-J: Project List section banner + view switcher -->
    <div class="mb-2">
      <div class="d-flex align-center ga-2 mb-2 flex-wrap">
        <v-icon size="16" color="grey-darken-2">mdi-format-list-bulleted</v-icon>
        <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase coi-section-label pa-0">Project List</span>
        <v-divider class="flex-grow-1 ml-1 mr-2" style="min-width:20px" />
        <v-btn-toggle
          v-model="viewMode"
          variant="outlined"
          mandatory
          color="primary"
          class="flex-shrink-2 mb-1 pa-0 ga-1"
        >
          <v-btn value="list" size="small" prepend-icon="mdi-format-list-bulleted" rounded class="px-2">List</v-btn>
          <v-btn value="card" size="small" prepend-icon="mdi-view-grid-outline" rounded class="px-2">Card</v-btn>
          <v-btn value="table" size="small" prepend-icon="mdi-table" rounded class="px-2">Table</v-btn>
        </v-btn-toggle>
      </div>
      <div class="text-caption text-grey-darken-1">
        {{ filteredProjects.length }} project{{ filteredProjects.length !== 1 ? 's' : '' }} — use filters to narrow results.
      </div>
    </div>

    <!-- ── LIST VIEW ── -->
    <div v-if="viewMode === 'list'" class="d-flex flex-column ga-2 mb-4">
      <div v-if="loading" class="d-flex justify-center py-8"><v-progress-circular indeterminate color="primary" /></div>
      <div v-else-if="!filteredProjects.length" class="text-center py-12 text-grey">
        <v-icon size="60" color="grey-lighten-2">mdi-folder-open-outline</v-icon>
        <div class="text-body-1 mt-2">No projects match your filters.</div>
      </div>
      <v-card
        v-else
        v-for="p in filteredProjects"
        :key="p.id"
        elevation="1"
        border
        rounded="lg"
        class="overflow-hidden cursor-pointer"
        :style="`border-left: 3px solid rgba(var(--v-theme-${getStatusColor(p.status)}), 0.7)`"
        @click="viewProject(p)"
      >
        <v-row no-gutters align="center" class="pa-3">
          <v-col cols="12" sm="2" class="d-flex flex-column ga-1 pr-3">
            <v-chip size="small" :color="getStatusColor(p.status)" variant="tonal" class="align-self-start">{{ p.status }}</v-chip>
            <v-chip size="x-small" :color="getPublicationStatusColor(p.publicationStatus)" variant="tonal" class="align-self-start">{{ getPublicationStatusLabel(p.publicationStatus) }}</v-chip>
            <div v-if="p.campus" class="text-caption text-grey">{{ p.campus }}</div>
          </v-col>
          <v-col cols="12" sm="6" class="pr-3">
            <div class="text-subtitle-2 font-weight-medium mb-1">{{ p.projectName }}</div>
            <div class="d-flex align-center ga-2 mb-1">
              <v-progress-linear :model-value="Number(p.physicalAccomplishment) || 0" :color="(Number(p.physicalAccomplishment) || 0) >= 100 ? 'success' : 'primary'" height="6" rounded style="max-width: 160px" />
              <span class="text-body-2 font-weight-medium">{{ (Number(p.physicalAccomplishment) || 0).toFixed(1) }}%</span>
            </div>
            <div class="text-body-2 text-grey-darken-1">{{ formatCurrencyShort(p.totalContractAmount) }}</div>
          </v-col>
          <v-col cols="12" sm="4" class="d-flex justify-end align-center">
            <v-menu location="start" @click.stop>
              <template #activator="{ props: mp }">
                <v-btn v-bind="mp" icon="mdi-dots-vertical" size="small" variant="text" color="grey-darken-1" @click.stop />
              </template>
              <v-list density="compact" min-width="180">
                <v-list-item prepend-icon="mdi-eye" title="View" @click.stop="viewProject(p)" />
                <v-list-item v-if="canEditItem(p)" prepend-icon="mdi-pencil" title="Edit" @click.stop="editProject(p)" />
                <v-list-item v-if="canSubmitForReview(p)" prepend-icon="mdi-send" title="Submit for Review" @click.stop="submitForReview(p)" />
                <v-list-item v-if="canWithdraw(p)" prepend-icon="mdi-undo" title="Withdraw" class="text-orange" @click.stop="withdrawSubmission(p)" />
                <v-list-item v-if="canApproveItem(p)" prepend-icon="mdi-check-circle" title="Approve" class="text-success" @click.stop="approveItem(p)" />
                <v-list-item v-if="canRejectItem(p)" prepend-icon="mdi-close-circle" title="Reject" class="text-warning" @click.stop="openRejectDialog(p)" />
                <v-divider v-if="canDelete('coi')" class="my-1" />
                <v-list-item v-if="canDelete('coi')" prepend-icon="mdi-delete" title="Delete" class="text-error" @click.stop="confirmDelete(p)" />
              </v-list>
            </v-menu>
          </v-col>
        </v-row>
      </v-card>
    </div>

    <!-- ── CARD VIEW ── -->
    <div v-else-if="viewMode === 'card'" class="mb-4">
      <div v-if="loading" class="d-flex justify-center py-8"><v-progress-circular indeterminate color="primary" /></div>
      <div v-else-if="!filteredProjects.length" class="text-center py-12 text-grey">
        <v-icon size="60" color="grey-lighten-2">mdi-folder-open-outline</v-icon>
        <div class="text-body-1 mt-2">No projects match your filters.</div>
      </div>
      <v-row v-else dense>
        <v-col v-for="p in filteredProjects" :key="p.id" cols="12" sm="6" lg="4">
          <v-card elevation="1" border rounded="lg" class="h-100" :style="`border-top: 3px solid rgba(var(--v-theme-${getStatusColor(p.status)}), 0.8)`">
            <v-card-title class="d-flex align-center ga-2 py-2 px-3 bg-grey-lighten-5">
              <v-chip size="x-small" :color="getStatusColor(p.status)" variant="tonal">{{ p.status }}</v-chip>
              <v-chip size="x-small" :color="getPublicationStatusColor(p.publicationStatus)" variant="tonal">{{ getPublicationStatusLabel(p.publicationStatus) }}</v-chip>
              <v-spacer />
              <v-menu location="bottom end" @click.stop>
                <template #activator="{ props: mp }">
                  <v-btn v-bind="mp" icon="mdi-dots-vertical" size="x-small" variant="text" color="grey-darken-1" @click.stop />
                </template>
                <v-list density="compact" min-width="170">
                  <v-list-item prepend-icon="mdi-eye" title="View" @click="viewProject(p)" />
                  <v-list-item v-if="canEditItem(p)" prepend-icon="mdi-pencil" title="Edit" @click="editProject(p)" />
                  <v-list-item v-if="canSubmitForReview(p)" prepend-icon="mdi-send" title="Submit for Review" @click="submitForReview(p)" />
                  <v-list-item v-if="canWithdraw(p)" prepend-icon="mdi-undo" title="Withdraw" class="text-orange" @click="withdrawSubmission(p)" />
                  <v-list-item v-if="canApproveItem(p)" prepend-icon="mdi-check-circle" title="Approve" class="text-success" @click="approveItem(p)" />
                  <v-list-item v-if="canRejectItem(p)" prepend-icon="mdi-close-circle" title="Reject" class="text-warning" @click="openRejectDialog(p)" />
                  <v-divider v-if="canDelete('coi')" class="my-1" />
                  <v-list-item v-if="canDelete('coi')" prepend-icon="mdi-delete" title="Delete" class="text-error" @click="confirmDelete(p)" />
                </v-list>
              </v-menu>
            </v-card-title>
            <v-card-text class="pt-3 pb-2 cursor-pointer" @click="viewProject(p)">
              <div class="text-subtitle-2 font-weight-medium mb-1 text-truncate" :title="p.projectName">{{ p.projectName }}</div>
              <div class="text-body-2 text-grey-darken-1 mb-2">{{ p.campus }}</div>
              <div class="text-body-2 font-weight-medium text-teal-darken-1 mb-3">{{ formatCurrencyShort(p.totalContractAmount) }}</div>
              <div class="d-flex align-center ga-2">
                <v-progress-linear :model-value="Number(p.physicalAccomplishment) || 0" :color="(Number(p.physicalAccomplishment) || 0) >= 100 ? 'success' : 'primary'" height="8" rounded />
                <span class="text-body-2 font-weight-medium" style="white-space:nowrap">{{ (Number(p.physicalAccomplishment) || 0).toFixed(1) }}%</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- ── TABLE VIEW (existing) ── -->
    <v-card v-else class="pa-0" elevation="1" rounded="lg">
      <!-- LLL-C: horizontal scroll wrapper for optional/many columns -->
      <div style="overflow-x:auto">
      <v-data-table
        :key="projects.length"
        :headers="headers"
        :items="filteredProjects"
        :loading="loading"
        :search="search"
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        v-model:sort-by="sortBy"
        :items-per-page-options="[{ value: 5, title: '5' }, { value: 10, title: '10' }, { value: 25, title: '25' }, { value: 50, title: '50' }, { value: -1, title: 'All' }]"
        fixed-header
        :height="tableHeight"
        item-value="id"
        hover
        class="elevation-0"
        @click:row="onRowClick"
        :row-props="() => ({ style: { cursor: 'pointer' } })"
      >
        <!-- JM-C-3: Empty state -->
        <template #no-data>
          <div class="text-center py-12">
            <v-icon icon="mdi-folder-open-outline" size="80" color="grey-lighten-1" />
            <p class="text-h6 text-grey-darken-1 mt-4">No projects found</p>
            <p class="text-body-2 text-grey">
              Try adjusting your filters or create a new project
            </p>
            <v-btn
              v-if="canAdd('coi')"
              color="primary"
              class="mt-4"
              @click="createProject"
            >
              <v-icon start>mdi-plus</v-icon>
              New Project
            </v-btn>
          </div>
        </template>
        <!-- Project Name -->
        <template #item.projectName="{ item }">
          <span class="font-weight-medium">{{ item.projectName }}</span>
        </template>

        <!-- Status Chip -->
        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <!-- Publication Status -->
        <template #item.publicationStatus="{ item }">
          <v-chip
            :color="getPublicationStatusColor(item.publicationStatus)"
            size="small"
            variant="tonal"
          >
            {{ getPublicationStatusLabel(item.publicationStatus) }}
          </v-chip>
          <div
            v-if="item.publicationStatus === 'PENDING_REVIEW' && item.approvalMetadata?.submittedByName"
            class="text-caption text-medium-emphasis mt-1"
          >
            by {{ item.approvalMetadata.submittedByName }}
          </div>
        </template>

        <!-- Contract Amount -->
        <template #item.totalContractAmount="{ item }">
          {{ formatCurrency(item.totalContractAmount) }}
        </template>

        <!-- Progress -->
        <template #item.physicalAccomplishment="{ item }">
          <div class="d-flex flex-column align-center" style="min-width: 120px">
            <v-progress-linear
              :model-value="Number(item.physicalAccomplishment) || 0"
              :color="(Number(item.physicalAccomplishment) || 0) >= 100 ? 'success' : 'primary'"
              height="8"
              rounded
              class="mb-1"
              style="width: 100%"
            />
            <span class="text-caption">{{ (Number(item.physicalAccomplishment) || 0).toFixed(1) }}%</span>
          </div>
        </template>

        <!-- Actions (Meatball Menu) -->
        <template #item.actions="{ item }">
          <v-menu location="start">
            <template #activator="{ props }">
              <v-btn
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
                v-bind="props"
                :loading="actionLoading === item.id"
              />
            </template>
            <v-list density="compact" min-width="180">
              <!-- View (always visible) -->
              <v-list-item @click="viewProject(item)" prepend-icon="mdi-eye">
                <v-list-item-title>View</v-list-item-title>
              </v-list-item>

              <!-- Edit (conditional) -->
              <v-list-item
                v-if="canEditItem(item)"
                @click="editProject(item)"
                prepend-icon="mdi-pencil"
              >
                <v-list-item-title>Edit</v-list-item-title>
              </v-list-item>

              <!-- Submit for Review (Staff owner + DRAFT) -->
              <v-list-item
                v-if="canSubmitForReview(item)"
                @click="submitForReview(item)"
                prepend-icon="mdi-send"
              >
                <v-list-item-title>Submit for Review</v-list-item-title>
              </v-list-item>

              <!-- Withdraw Submission (Original submitter + PENDING_REVIEW) -->
              <v-list-item
                v-if="canWithdraw(item)"
                @click="withdrawSubmission(item)"
                prepend-icon="mdi-undo"
                class="text-orange"
              >
                <v-list-item-title>Withdraw Submission</v-list-item-title>
              </v-list-item>

              <!-- Approve (Admin + PENDING_REVIEW) -->
              <v-list-item
                v-if="canApproveItem(item)"
                @click="approveItem(item)"
                prepend-icon="mdi-check-circle"
                class="text-success"
              >
                <v-list-item-title>Approve</v-list-item-title>
              </v-list-item>

              <!-- Reject (Admin + PENDING_REVIEW) -->
              <v-list-item
                v-if="canRejectItem(item)"
                @click="openRejectDialog(item)"
                prepend-icon="mdi-close-circle"
                class="text-warning"
              >
                <v-list-item-title>Reject</v-list-item-title>
              </v-list-item>

              <!-- Divider before Delete -->
              <v-divider v-if="canDelete('coi')" class="my-1" />

              <!-- Delete (Admin only) -->
              <v-list-item
                v-if="canDelete('coi')"
                @click="confirmDelete(item)"
                prepend-icon="mdi-delete"
                class="text-error"
              >
                <v-list-item-title>Delete</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <!-- LLL-B/C: optional + new default columns -->
        <template #item.projectCode="{ item }">
          <span class="text-body-2">{{ item.projectCode || '—' }}</span>
        </template>
        <template #item.fundSource="{ item }">
          <div class="text-body-2">
            {{ item.primaryFundingSource ? labelForPrimaryFundingSource(item.primaryFundingSource) : (item.fundSource || '—') }}
          </div>
          <div v-if="item.fundingSourceDescription" class="text-caption text-grey-darken-1">
            {{ item.fundingSourceDescription }}
          </div>
        </template>
        <template #item.originalCompletionDate="{ item }">
          <span class="text-body-2">{{ formatDate(item.originalCompletionDate) }}</span>
        </template>
        <template #item.originalStartDate="{ item }">
          <span class="text-body-2">{{ formatDate(item.originalStartDate) }}</span>
        </template>
        <template #item.revisedCompletionDate="{ item }">
          <span class="text-body-2">{{ formatDate(item.revisedCompletionDate) }}</span>
        </template>
        <template #item.contractor="{ item }">
          <span class="text-body-2">{{ item.contractor || '—' }}</span>
        </template>
        <template #item.revisedStartDate="{ item }">
          <span class="text-body-2">{{ formatDate(item.revisedStartDate) }}</span>
        </template>
        <template #item.projectDuration="{ item }">
          <span class="text-body-2">{{ item.projectDuration || '—' }}</span>
        </template>
        <template #item.createdAt="{ item }">
          <v-tooltip :text="formatDate(item.createdAt)" location="top">
            <template #activator="{ props: tp }">
              <span v-bind="tp" class="text-body-2">{{ formatRelativeDate(item.createdAt) }}</span>
            </template>
          </v-tooltip>
        </template>
        <template #item.updatedAt="{ item }">
          <v-tooltip :text="formatDate(item.updatedAt)" location="top">
            <template #activator="{ props: tp }">
              <span v-bind="tp" class="text-body-2">{{ formatRelativeDate(item.updatedAt) }}</span>
            </template>
          </v-tooltip>
        </template>

        <!-- Loading State -->
        <template #loading>
          <v-skeleton-loader type="table-row@5" />
        </template>

      </v-data-table>
      </div>
    </v-card>

    <!-- PPP-B5: Recent Activities section label -->
    <div v-if="canViewActivity" class="d-flex align-center ga-2 mb-2 mt-4">
      <v-icon size="16" color="grey-darken-2">mdi-history</v-icon>
      <span class="text-caption font-weight-bold text-grey-darken-2 text-uppercase coi-section-label">Recent Activities</span>
      <v-divider class="flex-grow-1 ml-1" />
    </div>

    <!-- LLL-D: Recent Activity — admin-only collapsible (default collapsed, lazy-fetched) -->
    <v-expansion-panels v-if="canViewActivity" v-model="activityExpanded" variant="accordion" class="mt-2">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon size="16" class="mr-2">mdi-history</v-icon>
          <span class="text-subtitle-2 font-weight-bold">System Activity</span>
          <v-chip v-if="recentActivity.length" size="x-small" class="ml-2" variant="tonal">{{ recentActivity.length }}</v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div v-if="!recentActivity.length" class="text-caption text-grey py-2">No recent activity.</div>
          <v-list v-else density="compact" class="pa-0" style="max-height:220px;overflow-y:auto">
            <v-list-item v-for="ev in recentActivity" :key="ev.id" class="px-0">
              <v-list-item-title class="text-caption">
                <span class="font-weight-medium">{{ ev.userName }}</span> {{ activityLabel(ev.action) }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption text-grey">{{ formatActivityDate(ev.createdAt) }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    </v-window-item>
    <!-- End Projects Tab -->

    <!-- Analytics Tab (Phase JF) -->
    <v-window-item value="analytics">
      <div v-if="analyticsLoading">
        <v-row dense class="mb-4">
          <v-col v-for="n in 4" :key="n" cols="6" md="3"><v-skeleton-loader type="card" height="100" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="12" md="5"><v-skeleton-loader type="card" height="300" /></v-col>
          <v-col cols="12" md="7"><v-skeleton-loader type="card" height="300" /></v-col>
          <v-col cols="12" md="6"><v-skeleton-loader type="card" height="260" /></v-col>
          <v-col cols="12" md="6"><v-skeleton-loader type="card" height="260" /></v-col>
        </v-row>
      </div>
      <div v-else-if="analyticsError" class="text-center py-12">
        <v-icon icon="mdi-alert-circle-outline" size="64" color="error" class="mb-2" />
        <p class="text-h6 text-error">Failed to load analytics</p>
        <p class="text-body-2 text-grey mb-4">{{ analyticsError }}</p>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-refresh" @click="fetchAnalytics">Retry</v-btn>
      </div>
      <template v-else-if="analyticsSummary">
        <!-- III-F: Top-of-tab guidance banner -->
        <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
          <strong>Portfolio Analytics</strong> — Comprehensive analytics across {{ stats.total }} infrastructure projects.
          Charts use authoritative DB aggregates from the analytics endpoints.
        </v-alert>

        <!-- Financial Hero Row -->
        <v-row class="mb-4" dense>
          <v-col cols="6" md="3">
            <v-card color="primary" variant="tonal" class="pa-4">
              <p class="text-caption">Total Appropriation</p>
              <p class="text-h5 font-weight-bold">{{ formatCurrencyShort(financialSummary?.total_appropriation || 0) }}</p>
            </v-card>
          </v-col>
          <v-col cols="6" md="3">
            <v-card color="info" variant="tonal" class="pa-4">
              <p class="text-caption">Cost Incurred</p>
              <p class="text-h5 font-weight-bold">{{ formatCurrencyShort(financialSummary?.total_obligation || 0) }}</p>
            </v-card>
          </v-col>
          <v-col cols="6" md="3">
            <v-card color="deep-purple" variant="tonal" class="pa-4">
              <p class="text-caption">Avg Progress</p>
              <p class="text-h5 font-weight-bold">{{ stats.avgProgress.toFixed(1) }}%</p>
            </v-card>
          </v-col>
          <v-col cols="6" md="3">
            <v-card color="orange" variant="tonal" class="pa-4">
              <p class="text-caption">Utilization Rate</p>
              <p class="text-h5 font-weight-bold">{{ (financialSummary?.utilization_rate || 0).toFixed(1) }}%</p>
            </v-card>
          </v-col>
        </v-row>

        <!-- III-F: Status & Campus Distribution section label -->
        <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mt-4 mb-2">
          <v-icon size="14" class="mr-1">mdi-chart-pie</v-icon> Status &amp; Campus Distribution
        </div>

        <!-- Charts Row -->
        <v-row>
          <v-col cols="12" md="5">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-2">Status Distribution</v-card-title>
              <VueApexCharts
                v-if="statusChartSeries.length > 0"
                type="donut"
                height="280"
                :options="statusChartOptions"
                :series="statusChartSeries"
              />
              <CiChartEmpty v-else icon="mdi-chart-donut" title="No status data" description="Status distribution appears once projects are recorded." />
            </v-card>
          </v-col>
          <v-col cols="12" md="7">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-2">Projects by Campus</v-card-title>
              <VueApexCharts
                v-if="campusChartSeries[0]?.data?.length > 0"
                type="bar"
                height="280"
                :options="campusChartOptions"
                :series="campusChartSeries"
              />
              <CiChartEmpty v-else icon="mdi-map-marker-multiple" title="No campus data" description="Per-campus project counts appear once projects are recorded." />
            </v-card>
          </v-col>
        </v-row>

        <!-- III-F: Physical Accomplishment Analytics section label -->
        <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mt-4 mb-2">
          <v-icon size="14" class="mr-1">mdi-chart-bar</v-icon> Physical Accomplishment Analytics
        </div>

        <!-- Physical Progress Distribution (full-width) -->
        <v-row>
          <v-col cols="12">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-2">Physical Progress Distribution</v-card-title>
              <VueApexCharts
                v-if="projects.length > 0"
                type="bar"
                height="200"
                :options="progressDistChart.options"
                :series="progressDistChart.series"
              />
              <CiChartEmpty v-else icon="mdi-chart-bar" title="No progress data" description="Physical progress distribution appears once projects are recorded." />
            </v-card>
          </v-col>
        </v-row>

        <!-- III-F: Campus Intelligence section label -->
        <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mt-4 mb-2">
          <v-icon size="14" class="mr-1">mdi-map-marker-multiple</v-icon> Campus Intelligence
        </div>

        <!-- III-C + III-D: Avg Progress by Campus + Budget by Campus -->
        <v-row class="mt-1">
          <v-col cols="12" md="6">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-1">Avg Physical Progress by Campus</v-card-title>
              <v-card-subtitle class="text-caption pb-2">Which campuses are most advanced in construction delivery?</v-card-subtitle>
              <VueApexCharts
                v-if="campusProgressChart.series[0].data.length > 0"
                type="bar"
                height="220"
                :options="campusProgressChart.options"
                :series="campusProgressChart.series"
              />
              <CiChartEmpty v-else icon="mdi-map-marker-multiple" title="No campus data" description="Average progress by campus appears once projects are recorded." />
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-1">Budget Concentration by Campus</v-card-title>
              <v-card-subtitle class="text-caption pb-2">Where is infrastructure investment concentrated?</v-card-subtitle>
              <VueApexCharts
                v-if="budgetByCampusChart.series.some(v => v > 0)"
                type="donut"
                height="220"
                :options="budgetByCampusChart.options"
                :series="budgetByCampusChart.series"
              />
              <CiChartEmpty v-else icon="mdi-cash-multiple" title="No financial data" description="Budget concentration appears once contract values are recorded." />
            </v-card>
          </v-col>
        </v-row>

        <!-- III-D: Contract Value by Status -->
        <v-row class="mt-4">
          <v-col cols="12" md="6">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-1">Contract Value by Status</v-card-title>
              <v-card-subtitle class="text-caption pb-2">How much budget is allocated per project status?</v-card-subtitle>
              <VueApexCharts
                v-if="contractByStatusChart.series.some(v => v > 0)"
                type="donut"
                height="220"
                :options="contractByStatusChart.options"
                :series="contractByStatusChart.series"
              />
              <CiChartEmpty v-else icon="mdi-chart-donut" title="No contract data" description="Contract value by status appears once projects are recorded." />
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-1">Publication Status</v-card-title>
              <v-card-subtitle class="text-caption pb-2">Review readiness across the portfolio</v-card-subtitle>
              <VueApexCharts
                v-if="publicationStatusChart.series.some(v => v > 0)"
                type="donut"
                height="220"
                :options="publicationStatusChart.options"
                :series="publicationStatusChart.series"
              />
              <CiChartEmpty v-else icon="mdi-chart-donut" title="No publication data" description="Status breakdown appears once projects are reviewed." />
            </v-card>
          </v-col>
        </v-row>

        <!-- III-F: Partnership & Funding Analytics section label -->
        <div class="text-caption text-grey-darken-1 font-weight-bold text-uppercase mt-4 mb-2">
          <v-icon size="14" class="mr-1">mdi-handshake</v-icon> Partnership &amp; Funding Analytics
        </div>

        <!-- III-E: Contractor + Funding Source row -->
        <v-row class="mt-1">
          <v-col cols="12" md="7">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-1">Projects by Contractor</v-card-title>
              <v-card-subtitle class="text-caption pb-2">Which contractors have the most active projects?</v-card-subtitle>
              <VueApexCharts
                v-if="contractorChart.series[0]?.data?.length > 0"
                type="bar"
                height="260"
                :options="contractorChart.options"
                :series="contractorChart.series"
              />
              <CiChartEmpty v-else icon="mdi-account-hard-hat" title="No contractor data" description="Projects by contractor appears once contractors are assigned." />
            </v-card>
          </v-col>
          <v-col cols="12" md="5">
            <v-card class="pa-4" elevation="1" rounded="lg">
              <v-card-title class="text-body-1 font-weight-bold mb-1">Funding Source Distribution</v-card-title>
              <v-card-subtitle class="text-caption pb-2">How projects are distributed by funding source</v-card-subtitle>
              <VueApexCharts
                v-if="fundingSourceChart.series.length > 0"
                type="donut"
                height="260"
                :options="fundingSourceChart.options"
                :series="fundingSourceChart.series"
              />
              <CiChartEmpty v-else icon="mdi-cash-multiple" title="No funding source data" description="Funding source distribution appears once sources are assigned." />
            </v-card>
          </v-col>
        </v-row>
      </template>
      <div v-else class="text-center py-12 text-grey">
        <v-icon icon="mdi-chart-bar" size="64" class="mb-2" />
        <p class="text-h6">No analytics data yet</p>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-refresh" class="mt-3" @click="fetchAnalytics">Load Analytics</v-btn>
      </div>
    </v-window-item>
    <!-- End Analytics Tab -->

    </v-window>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ projectToDelete?.projectName }}</strong>?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false" :disabled="deleting">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="deleteProject" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- LLL-E: Full Search dialog — complete original/revised date-range field set -->
    <v-dialog v-model="showFullSearch" max-width="720">
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon icon="mdi-tune-variant" />Advanced Search
        </v-card-title>
        <v-card-text>
          <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase mb-2">Project Identifier</div>
          <v-row dense class="mb-2">
            <v-col cols="12">
              <v-text-field v-model="filterProjectCode" label="Project Code / ID" variant="outlined" density="compact" hide-details clearable prepend-inner-icon="mdi-identifier" />
            </v-col>
          </v-row>
          <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase mb-2">Original Schedule</div>
          <v-row dense class="mb-2">
            <v-col cols="6" sm="3"><v-text-field v-model="filterOrigStartFrom" type="date" label="Orig. Start From" variant="outlined" density="compact" hide-details clearable /></v-col>
            <v-col cols="6" sm="3"><v-text-field v-model="filterOrigStartTo" type="date" label="Orig. Start To" variant="outlined" density="compact" hide-details clearable /></v-col>
            <v-col cols="6" sm="3"><v-text-field v-model="filterOrigEndFrom" type="date" label="Orig. End From" variant="outlined" density="compact" hide-details clearable /></v-col>
            <v-col cols="6" sm="3"><v-text-field v-model="filterOrigEndTo" type="date" label="Orig. End To" variant="outlined" density="compact" hide-details clearable /></v-col>
          </v-row>
          <div class="text-caption text-grey-darken-1 font-weight-medium text-uppercase mb-2">Revised Schedule</div>
          <v-row dense>
            <v-col cols="6" sm="3"><v-text-field v-model="filterRevStartFrom" type="date" label="Rev. Start From" variant="outlined" density="compact" hide-details clearable /></v-col>
            <v-col cols="6" sm="3"><v-text-field v-model="filterRevStartTo" type="date" label="Rev. Start To" variant="outlined" density="compact" hide-details clearable /></v-col>
            <v-col cols="6" sm="3"><v-text-field v-model="filterRevEndFrom" type="date" label="Rev. End From" variant="outlined" density="compact" hide-details clearable /></v-col>
            <v-col cols="6" sm="3"><v-text-field v-model="filterRevEndTo" type="date" label="Rev. End To" variant="outlined" density="compact" hide-details clearable /></v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" color="grey-darken-1" prepend-icon="mdi-filter-off" @click="clearFilters">Clear All</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="showFullSearch = false">Done</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reject Dialog -->
    <v-dialog v-model="rejectDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-h6">Reject Submission</v-card-title>
        <v-card-text>
          <p class="mb-4">
            Reject <strong>{{ projectToReject?.projectName }}</strong>?
            The owner will be notified and can edit and resubmit.
          </p>
          <v-textarea
            v-model="rejectNotes"
            label="Rejection Notes (optional)"
            placeholder="Provide feedback for the submitter..."
            rows="3"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejectDialog = false" :disabled="rejecting">Cancel</v-btn>
          <v-btn color="warning" variant="flat" @click="rejectItem" :loading="rejecting">Reject</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }

/* NNN-J: section divider labels */
.coi-section-label { letter-spacing: 0.06em; }

/* MMM-I: subtle hover lift for KPI cards (cue that they carry tooltips) */
.kpi-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
</style>
