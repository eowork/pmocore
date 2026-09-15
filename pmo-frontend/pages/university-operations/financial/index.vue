<script setup lang="ts">
/**
 * Phase ET-C: Financial Accomplishments View (BAR No. 2)
 *
 * Mirrors the Physical Accomplishments page structure:
 * - Fiscal year + quarter selectors
 * - 4 pillar tabs (MFO1-4)
 * - Financial records grouped by campus → expense class
 * - Subtotals computed on frontend
 * - Shared quarterly report governance (submit/withdraw/lock)
 */

import type { PublicationStatus } from '~/utils/adapters'
import { getPublicationStatusColor } from '~/utils/status-colors'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const route = useRoute()
const api = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { isAdmin, isStaff, canAdd, isSuperAdmin } = usePermissions()

// Centralized fiscal year store
import { useFiscalYearStore } from '~/stores/fiscalYear'
import { storeToRefs } from 'pinia'

const fiscalYearStore = useFiscalYearStore()
const { selectedFiscalYear, fiscalYearOptions } = storeToRefs(fiscalYearStore)

// Fixed Pillar Definitions (BAR1 Standard — same as Physical page)
const PILLARS = [
  {
    id: 'HIGHER_EDUCATION',
    name: 'Higher Education',
    fullName: 'MFO1: Higher Education Program',
    icon: 'mdi-school',
    color: 'blue',
  },
  {
    id: 'ADVANCED_EDUCATION',
    name: 'Advanced Ed',
    fullName: 'MFO2: Advanced Education Program',
    icon: 'mdi-book-education',
    color: 'purple',
  },
  {
    id: 'RESEARCH',
    name: 'Research',
    fullName: 'MFO3: Research Program',
    icon: 'mdi-flask',
    color: 'teal',
  },
  {
    id: 'TECHNICAL_ADVISORY',
    name: 'Extension',
    fullName: 'MFO4: Technical Advisory & Extension Program',
    icon: 'mdi-handshake',
    color: 'orange',
  },
] as const

// Expense class definitions
const EXPENSE_CLASSES = [
  { id: 'PS', name: 'Personal Services', color: 'blue' },
  { id: 'MOOE', name: 'Maintenance and Other Operating Expenses', color: 'orange' },
  { id: 'CO', name: 'Capital Outlay', color: 'teal' },
] as const

// Campus definitions
const CAMPUSES = [
  { id: 'MAIN', name: 'Main Campus' },
  { id: 'CABADBARAN', name: 'Cabadbaran Campus' },
] as const

// Phase HN: Pillar-based tab visibility (Directive 159)
// FIX: an empty pillar_assignments list now means NO pillars granted (default-deny),
// not "no restriction" — a user with zero assignments has simply never been given
// pillar access yet and should be redirected (see hasAnyPillarAccess below), not
// silently shown every pillar's data.
const visiblePillars = computed(() => {
  if (isAdmin.value || isSuperAdmin.value) return PILLARS
  const assignments = authStore.user?.pillarAssignments ?? []
  return PILLARS.filter(p => assignments.includes(p.id))
})

// Phase HN: whether the user has ANY reason to be on this page at all — Admin/SuperAdmin
// bypass, otherwise at least one pillar assignment is required. Zero assignments ⇒ redirect
// with a toast rather than rendering a page with every tab disabled.
const hasAnyPillarAccess = computed(() => {
  if (isAdmin.value || isSuperAdmin.value) return true
  return (authStore.user?.pillarAssignments ?? []).length > 0
})

// State
const selectedQuarter = ref<string>('Q4')
const activePillar = ref<string>(
  (route.query.pillar as string) && PILLARS.some(p => p.id === route.query.pillar)
    ? (route.query.pillar as string)
    : PILLARS[0].id
)
const loading = ref(true)
const actionLoading = ref(false)

// Quarter options
const quarterOptions = [
  { title: 'Q1 (Jan–Mar)', value: 'Q1' },
  { title: 'Q2 (Apr–Jun)', value: 'Q2' },
  { title: 'Q3 (Jul–Sep)', value: 'Q3' },
  { title: 'Q4 (Oct–Dec)', value: 'Q4' },
]

// Data
const financialRecords = ref<any[]>([])
const currentOperation = ref<any>(null)
const operationNotFound = ref(false) // Phase HU: Distinguish "not configured" from "no data" (Directive 216)
const currentQuarterlyReport = ref<any>(null)
const isLoadingQuarterlyReport = ref(true)
const quarterlyReportFetchFailed = ref(false)
let isInitializing = true

// Phase FB-B: Prior-quarter prefill state (non-persistent)
const prefillRecords = ref<any[]>([])
const isPrefillMode = ref(false)
const prefillSourceQuarter = ref<string | null>(null)
const prefillLoading = ref(false)

// AbortController for cancelling stale fetches
let fetchAbortController: AbortController | null = null

// Entry dialog
const entryDialog = ref(false)
const editingRecord = ref<any>(null)
const entryForm = ref<any>({})
const saving = ref(false)

// Delete confirmation
const deleteDialog = ref(false)
const deletingRecord = ref<any>(null)
const deleting = ref(false)

// Governance dialogs
const publishedEditWarningDialog = ref(false)
const pendingEditRecord = ref<any>(null)
const unlockRequestDialog = ref(false)
const unlockRequestReason = ref('')
const unlockRequestLoading = ref(false)

// Phase HL: Column visibility for Financial module (Directive 150)
const columnVisibility = reactive({
  remarks: false,
  mov: false,
})
const anyPanelVisible = computed(() => columnVisibility.remarks || columnVisibility.mov)
const remarksRowColspan = computed(() => canEditData() ? 7 : 6)

// Phase HL: MOV type-selector state (Directive 152)
const movType = ref<'text' | 'link' | 'file'>('text')
const movValue = ref('')
const movUploading = ref(false)
const movFileMetadata = ref<{ filename: string; size: number; mimeType: string } | null>(null)
const movFileInputRef = ref<HTMLInputElement | null>(null)

function parseMov(raw: string | null | undefined): { type: 'text' | 'link' | 'file'; value: string; metadata: any } {
  if (!raw) return { type: 'text', value: '', metadata: null }
  try {
    const parsed = JSON.parse(raw)
    if (parsed.type && parsed.value !== undefined) return { type: parsed.type, value: parsed.value, metadata: parsed.metadata || null }
  } catch {}
  return { type: 'text', value: raw, metadata: null }
}

function serializeMov(): string | null {
  if (!movValue.value && movType.value !== 'file') return null
  const obj: any = { type: movType.value, value: movValue.value }
  if (movType.value === 'file' && movFileMetadata.value) obj.metadata = movFileMetadata.value
  return JSON.stringify(obj)
}

watch(movType, () => { movValue.value = ''; movFileMetadata.value = null })

async function handleMovFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.[0]) return
  const file = input.files[0]
  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25MB
  if (file.size > MAX_UPLOAD_BYTES) {
    toast.error(`File too large. Maximum allowed size is 25MB (selected file: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
    if (input) input.value = ''
    return
  }
  const formData = new FormData()
  formData.append('file', file)
  movUploading.value = true
  try {
    const response = await api.upload<{ filePath: string; originalName: string; fileSize: number; mimeType: string }>('/api/uploads', formData)
    movValue.value = response.filePath
    movFileMetadata.value = { filename: response.originalName, size: response.fileSize, mimeType: response.mimeType }
  } catch (err: any) {
    toast.error(err.message || 'File upload failed')
  } finally {
    movUploading.value = false
    if (input) input.value = ''
  }
}

function initMovFromMetadata(metadata: any) {
  const raw = metadata?.mov ? JSON.stringify(metadata.mov) : null
  const parsed = parseMov(raw)
  movType.value = parsed.type
  movValue.value = parsed.value
  movFileMetadata.value = parsed.metadata
}

// Current pillar info
const currentPillar = computed(() => {
  return PILLARS.find(p => p.id === activePillar.value) || PILLARS[0]
})

// Quarter status
const currentQuarterStatus = computed(() => {
  if (quarterlyReportFetchFailed.value) return 'FETCH_ERROR'
  return currentQuarterlyReport.value?.publication_status ?? 'NOT_STARTED'
})

// --- Permission Checks (same pattern as Physical page) ---

function isOwnerOrAssigned(op: any): boolean {
  if (!op) return false
  const userId = authStore.user?.id
  if (!userId) return false
  const isAssigned = Array.isArray(op.assigned_users) && op.assigned_users.some((u: any) => u.id === userId)
  return op.created_by === userId || isAssigned
}

function canEditData(): boolean {
  if (!currentOperation.value) return canAdd('university_operations')
  if (isAdmin.value) {
    if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') {
      return isSuperAdmin.value || !!currentQuarterlyReport.value?.unlocked_by
    }
    return true
  }
  // Phase FH-1: Financial edit-lock governed by quarterly report, NOT operation publication_status
  // Operation-level publication is from UO main page workflow — independent of financial data entry
  if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') return false
  // Phase FG-2: Staff with OPERATIONS module access can edit any pillar's financial data
  return canAdd('university_operations')
}

function canSubmitAllPillars(): boolean {
  if (isLoadingQuarterlyReport.value) return false
  if (quarterlyReportFetchFailed.value) return false
  if (currentQuarterlyReport.value) {
    const status = currentQuarterlyReport.value.publication_status
    if (status !== 'DRAFT' && status !== 'REJECTED') return false
    if (isAdmin.value) return true
    return currentQuarterlyReport.value.created_by === authStore.user?.id
  }
  if (isAdmin.value) return true
  return currentOperation.value ? isOwnerOrAssigned(currentOperation.value) : false
}

function canWithdrawAllPillars(): boolean {
  if (!currentQuarterlyReport.value) return false
  if (currentQuarterlyReport.value.publication_status !== 'PENDING_REVIEW') return false
  if (isAdmin.value) return true
  return currentQuarterlyReport.value.submitted_by === authStore.user?.id
}

// Publication status helpers

function getPublicationStatusLabel(status: PublicationStatus | string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    PUBLISHED: 'Published',
    REJECTED: 'Rejected',
    FETCH_ERROR: 'Status Unavailable',
  }
  return labels[status] || status
}

// --- Data Fetching ---

async function fetchFinancialData() {
  if (fetchAbortController) fetchAbortController.abort()
  fetchAbortController = new AbortController()
  const currentController = fetchAbortController

  // Phase FD-2: Capture context at call time to detect stale responses
  const snapshotPillar = activePillar.value
  const snapshotFY = selectedFiscalYear.value
  const snapshotQuarter = selectedQuarter.value

  loading.value = true

  await findCurrentOperation(snapshotPillar, snapshotFY)
  if (currentController.signal.aborted || activePillar.value !== snapshotPillar) { loading.value = false; return }

  if (currentOperation.value) {
    try {
      const res = await api.get<any[]>(
        `/api/university-operations/${currentOperation.value.id}/financials?fiscal_year=${snapshotFY}&quarter=${snapshotQuarter}`
      )
      // Phase FD-2: Discard if context changed during await
      if (currentController.signal.aborted || activePillar.value !== snapshotPillar) { loading.value = false; return }
      financialRecords.value = Array.isArray(res) ? res : (res as any)?.data || []
    } catch (err: any) {
      if (currentController.signal.aborted || activePillar.value !== snapshotPillar) { loading.value = false; return }
      console.error('[Financial] Fetch financials failed:', err)
      financialRecords.value = []
    }
  } else {
    financialRecords.value = []
  }

  if (currentController.signal.aborted || activePillar.value !== snapshotPillar) { loading.value = false; return }
  loading.value = false

  // Phase FB-B: If current quarter is empty, attempt to load prior quarter as reference
  if (financialRecords.value.length === 0) {
    await fetchPrefillData(snapshotPillar)
  } else {
    clearPrefill()
  }
}

// Phase HU: Use pillar-operation endpoint — no ownership filter, correct for display context (Directive 211)
async function findCurrentOperation(targetPillar?: string, targetFY?: number) {
  const pillar = targetPillar ?? activePillar.value
  const fy = targetFY ?? selectedFiscalYear.value
  operationNotFound.value = false
  try {
    const found = await api.get<any>(
      `/api/university-operations/pillar-operation?pillar_type=${pillar}&fiscal_year=${fy}`
    )
    if (activePillar.value === pillar) {
      currentOperation.value = found
    }
  } catch (err: any) {
    console.error('[Financial] findCurrentOperation: Error:', err)
    if (activePillar.value === pillar) {
      currentOperation.value = null
      // Phase HU: Detect 404 (operation not configured) vs other errors (Directive 216)
      if (err?.statusCode === 404 || err?.status === 404 || err?.response?.status === 404) {
        operationNotFound.value = true
      }
    }
  }
}

async function fetchQuarterlyReport() {
  isLoadingQuarterlyReport.value = true
  quarterlyReportFetchFailed.value = false
  currentQuarterlyReport.value = null // Phase FA-A: clear stale state immediately on every call
  if (!selectedFiscalYear.value || selectedFiscalYear.value < 2020) {
    currentQuarterlyReport.value = null
    isLoadingQuarterlyReport.value = false
    return
  }
  try {
    const response = await api.get<any>(
      `/api/university-operations/quarterly-reports?fiscal_year=${selectedFiscalYear.value}&quarter=${selectedQuarter.value}`
    )
    const reports = Array.isArray(response) ? response : (response?.data || [])
    currentQuarterlyReport.value = reports.length > 0 ? reports[0] : null
  } catch (err) {
    console.error('[Financial] fetchQuarterlyReport: Error:', err)
    currentQuarterlyReport.value = null
    quarterlyReportFetchFailed.value = true
  } finally {
    isLoadingQuarterlyReport.value = false
  }
}

// --- Phase FB-B: Prior-Quarter Prefill ---

const PRIOR_QUARTER_MAP: Record<string, string | null> = {
  Q1: null, Q2: 'Q1', Q3: 'Q2', Q4: 'Q3',
}

function clearPrefill() {
  prefillRecords.value = []
  isPrefillMode.value = false
  prefillSourceQuarter.value = null
}

function removePrefillRow(index: number) {
  prefillRecords.value.splice(index, 1)
  if (prefillRecords.value.length === 0) {
    clearPrefill()
  }
}

async function fetchPrefillData(snapshotPillar?: string) {
  const pillarAtCall = snapshotPillar ?? activePillar.value
  const priorQ = PRIOR_QUARTER_MAP[selectedQuarter.value]
  if (!priorQ || !currentOperation.value) {
    clearPrefill()
    return
  }
  prefillLoading.value = true
  try {
    const res = await api.get<any[]>(
      `/api/university-operations/${currentOperation.value.id}/financials?fiscal_year=${selectedFiscalYear.value}&quarter=${priorQ}`
    )
    // Phase FF-1: Discard stale prefill if pillar changed during await
    if (activePillar.value !== pillarAtCall) return
    const records = Array.isArray(res) ? res : (res as any)?.data || []
    if (records.length > 0) {
      prefillRecords.value = records
      isPrefillMode.value = true
      prefillSourceQuarter.value = priorQ
    } else {
      clearPrefill()
    }
  } catch {
    clearPrefill()
  } finally {
    prefillLoading.value = false
  }
}

function openPrefillSaveDialog(record: any) {
  editingRecord.value = null
  entryForm.value = {
    operations_programs: record.operations_programs || '',
    department: record.department || 'MAIN',
    expense_class: record.expense_class || '',
    fund_type: record.fund_type || '',
    allotment: record.allotment,
    obligation: record.obligation,
    disbursement: record.disbursement,
    remarks: record.remarks || '',
  }
  // Phase HL: Initialize MOV from prefill record metadata (Directive 152)
  initMovFromMetadata(record.metadata)
  entryDialog.value = true
}

async function saveAllPrefillRecords() {
  if (!currentOperation.value || prefillRecords.value.length === 0) return
  saving.value = true
  let successCount = 0
  let failCount = 0
  try {
    for (const rec of prefillRecords.value) {
      try {
        await api.post(`/api/university-operations/${currentOperation.value.id}/financials`, {
          fiscal_year: selectedFiscalYear.value,
          quarter: selectedQuarter.value,
          operations_programs: rec.operations_programs || '',
          department: rec.department || null,
          expense_class: rec.expense_class || null,
          fund_type: rec.fund_type || null,
          allotment: rec.allotment !== null && rec.allotment !== undefined ? Number(rec.allotment) : null,
          obligation: rec.obligation !== null && rec.obligation !== undefined ? Number(rec.obligation) : null,
          disbursement: rec.disbursement !== null && rec.disbursement !== undefined ? Number(rec.disbursement) : null,
          remarks: rec.remarks || null,
          // Phase HL: Carry over MOV metadata from prefill (Directive 152)
          metadata: rec.metadata?.mov ? { mov: rec.metadata.mov } : undefined,
        })
        successCount++
      } catch {
        failCount++
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} record${successCount !== 1 ? 's' : ''} saved as ${selectedQuarter.value}`)
    }
    if (failCount > 0) {
      toast.error(`${failCount} record${failCount !== 1 ? 's' : ''} failed to save`)
    }
    clearPrefill()
    await fetchFinancialData()
  } finally {
    saving.value = false
  }
}

// --- Grouped Data (campus → expense class) ---

const groupedFinancials = computed(() => {
  const records = financialRecords.value
  const groups: Record<string, Record<string, any[]>> = {}

  for (const campus of CAMPUSES) {
    groups[campus.id] = {}
    for (const ec of EXPENSE_CLASSES) {
      groups[campus.id][ec.id] = []
    }
    // Uncategorized
    groups[campus.id]['_NONE'] = []
  }
  // Records with no campus
  groups['_NONE'] = { '_NONE': [] }

  for (const rec of records) {
    const campus = rec.department && CAMPUSES.some(c => c.id === rec.department)
      ? rec.department
      : '_NONE'
    const ec = rec.expense_class && EXPENSE_CLASSES.some(e => e.id === rec.expense_class)
      ? rec.expense_class
      : '_NONE'

    if (!groups[campus]) {
      groups[campus] = {}
    }
    if (!groups[campus][ec]) {
      groups[campus][ec] = []
    }
    groups[campus][ec].push(rec)
  }

  return groups
})

// Campus subtotals
// Phase HE: Replace balance with disbursement (Directives 388, 389)
const campusSubtotals = computed(() => {
  const result: Record<string, { allotment: number; obligation: number; disbursement: number; utilization: number | null }> = {}
  for (const campus of CAMPUSES) {
    let allotment = 0
    let obligation = 0
    let disbursement = 0
    for (const ec of EXPENSE_CLASSES) {
      const records = groupedFinancials.value[campus.id]?.[ec.id] || []
      for (const rec of records) {
        allotment += Number(rec.allotment) || 0
        obligation += Number(rec.obligation) || 0
        disbursement += Number(rec.disbursement) || 0
      }
    }
    // Include uncategorized
    const uncategorized = groupedFinancials.value[campus.id]?.['_NONE'] || []
    for (const rec of uncategorized) {
      allotment += Number(rec.allotment) || 0
      obligation += Number(rec.obligation) || 0
      disbursement += Number(rec.disbursement) || 0
    }
    result[campus.id] = {
      allotment,
      obligation,
      disbursement,
      utilization: allotment > 0 ? (obligation / allotment) * 100 : null,
    }
  }
  return result
})

// Pillar total
// Phase HE: Replace balance with disbursement (Directives 388, 389)
const pillarTotal = computed(() => {
  let allotment = 0
  let obligation = 0
  let disbursement = 0
  for (const rec of financialRecords.value) {
    allotment += Number(rec.allotment) || 0
    obligation += Number(rec.obligation) || 0
    disbursement += Number(rec.disbursement) || 0
  }
  return {
    allotment,
    obligation,
    disbursement,
    utilization: allotment > 0 ? (obligation / allotment) * 100 : null,
  }
})

// Check if a campus has any data
function campusHasData(campusId: string): boolean {
  const campusGroup = groupedFinancials.value[campusId]
  if (!campusGroup) return false
  return Object.values(campusGroup).some(records => (records as any[]).length > 0)
}

// --- Format Helpers ---

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return `${Number(val).toFixed(2)}%`
}

// --- Entry Dialog ---

function openAddDialog() {
  if (!canEditData()) {
    toast.warning('You do not have permission to edit this data')
    return
  }
  if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') {
    if (isSuperAdmin.value || (isAdmin.value && currentQuarterlyReport.value?.unlocked_by)) {
      pendingEditRecord.value = null
      publishedEditWarningDialog.value = true
      return
    }
  }
  openAddDialogDirect()
}

function openAddDialogDirect() {
  editingRecord.value = null
  entryForm.value = {
    operations_programs: '',
    department: 'MAIN',
    expense_class: 'PS',
    fund_type: '',
    allotment: null,
    obligation: null,
    disbursement: null,
    remarks: '',
  }
  // Phase HL: Reset MOV state (Directive 152)
  movType.value = 'text'
  movValue.value = ''
  movFileMetadata.value = null
  entryDialog.value = true
}

function openEditDialog(record: any) {
  if (!canEditData()) {
    toast.warning('You do not have permission to edit this data')
    return
  }
  if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') {
    if (isSuperAdmin.value || (isAdmin.value && currentQuarterlyReport.value?.unlocked_by)) {
      pendingEditRecord.value = record
      publishedEditWarningDialog.value = true
      return
    }
  }
  openEditDialogDirect(record)
}

function openEditDialogDirect(record: any) {
  editingRecord.value = record
  entryForm.value = {
    operations_programs: record.operations_programs || '',
    department: record.department || 'MAIN',
    expense_class: record.expense_class || '',
    fund_type: record.fund_type || '',
    allotment: record.allotment,
    obligation: record.obligation,
    disbursement: record.disbursement,
    remarks: record.remarks || '',
  }
  // Phase HL: Initialize MOV from record metadata (Directive 152)
  initMovFromMetadata(record.metadata)
  entryDialog.value = true
}

function confirmPublishedEdit() {
  publishedEditWarningDialog.value = false
  if (pendingEditRecord.value) {
    openEditDialogDirect(pendingEditRecord.value)
    pendingEditRecord.value = null
  } else {
    openAddDialogDirect()
  }
}

// Computed utilization preview
const utilizationPreview = computed(() => {
  const a = Number(entryForm.value.allotment) || 0
  const o = Number(entryForm.value.obligation) || 0
  if (a <= 0) return null
  return (o / a) * 100
})

async function saveFinancialRecord() {
  if (!entryForm.value.operations_programs?.trim()) {
    toast.warning('Program/Line Item name is required')
    return
  }

  saving.value = true
  try {
    // Ensure we have an operation
    if (!currentOperation.value) {
      const createRes = await api.post<any>('/api/university-operations', {
        title: `${currentPillar.value.fullName} - FY ${selectedFiscalYear.value}`,
        operation_type: activePillar.value,
        fiscal_year: selectedFiscalYear.value,
        campus: entryForm.value.department || 'MAIN',
        status: 'ONGOING',
      })
      currentOperation.value = createRes
    }

    const operationId = editingRecord.value
      ? (editingRecord.value.operation_id || currentOperation.value.id)
      : currentOperation.value.id

    const payload: any = {
      fiscal_year: selectedFiscalYear.value,
      quarter: selectedQuarter.value,
      operations_programs: entryForm.value.operations_programs.trim(),
      department: entryForm.value.department || null,
      expense_class: entryForm.value.expense_class || null,
      fund_type: entryForm.value.fund_type || null,
      allotment: entryForm.value.allotment !== null && entryForm.value.allotment !== '' ? Number(entryForm.value.allotment) : null,
      obligation: entryForm.value.obligation !== null && entryForm.value.obligation !== '' ? Number(entryForm.value.obligation) : null,
      disbursement: entryForm.value.disbursement !== null && entryForm.value.disbursement !== '' ? Number(entryForm.value.disbursement) : null,
      remarks: entryForm.value.remarks?.trim() || null,
      // Phase HL: MOV stored in metadata field (Directive 152)
      metadata: (() => {
        const mov = serializeMov()
        return mov ? { mov: JSON.parse(mov) } : undefined
      })(),
    }

    if (editingRecord.value) {
      await api.patch(
        `/api/university-operations/${operationId}/financials/${editingRecord.value.id}`,
        payload
      )
      toast.success('Financial record updated')
    } else {
      await api.post(
        `/api/university-operations/${operationId}/financials`,
        payload
      )
      toast.success('Financial record created')
    }

    entryDialog.value = false
    await fetchFinancialData()
    await fetchQuarterlyReport()
  } catch (err: any) {
    console.error('[Financial] Save failed:', err)
    toast.error(err.message || 'Failed to save financial record')
  } finally {
    saving.value = false
  }
}

// --- Delete ---

function confirmDelete(record: any) {
  deletingRecord.value = record
  deleteDialog.value = true
}

async function executeDelete() {
  if (!deletingRecord.value || !currentOperation.value) return
  deleting.value = true
  try {
    const operationId = deletingRecord.value.operation_id || currentOperation.value.id
    await api.del(`/api/university-operations/${operationId}/financials/${deletingRecord.value.id}`)
    toast.success('Financial record deleted')
    deleteDialog.value = false
    deletingRecord.value = null
    await fetchFinancialData()
  } catch (err: any) {
    console.error('[Financial] Delete failed:', err)
    toast.error(err.message || 'Failed to delete financial record')
  } finally {
    deleting.value = false
  }
}

// --- Governance: Submit / Withdraw / Unlock ---

async function submitAllPillarsForReview() {
  actionLoading.value = true
  try {
    await fetchQuarterlyReport()
    if (currentQuarterlyReport.value &&
        currentQuarterlyReport.value.publication_status !== 'DRAFT' &&
        currentQuarterlyReport.value.publication_status !== 'REJECTED') {
      const label = currentQuarterlyReport.value.publication_status.toLowerCase().replace('_', ' ')
      toast.warning(`This quarter is already ${label}`)
      return
    }

    let report = currentQuarterlyReport.value
    if (!report) {
      report = await api.post<any>('/api/university-operations/quarterly-reports', {
        fiscal_year: selectedFiscalYear.value,
        quarter: selectedQuarter.value,
      })
      currentQuarterlyReport.value = report
    }
    await api.post(`/api/university-operations/quarterly-reports/${report.id}/submit`, {})
    toast.success(`Financial ${selectedQuarter.value} submitted for review`)
    await fetchQuarterlyReport()
    await findCurrentOperation()
  } catch (err: any) {
    console.error('[Financial] submitAllPillarsForReview:', err)
    toast.error(err.message || 'Failed to submit quarterly report')
  } finally {
    actionLoading.value = false
  }
}

async function withdrawAllPillarsSubmission() {
  if (!currentQuarterlyReport.value) return
  actionLoading.value = true
  try {
    await api.post(`/api/university-operations/quarterly-reports/${currentQuarterlyReport.value.id}/withdraw`, {})
    toast.success(`Financial ${selectedQuarter.value} submission withdrawn`)
    await fetchQuarterlyReport()
    await findCurrentOperation()
  } catch (err: any) {
    console.error('[Financial] withdrawAllPillarsSubmission:', err)
    toast.error(err.message || 'Failed to withdraw quarterly report')
  } finally {
    actionLoading.value = false
  }
}

async function submitUnlockRequest() {
  if (!currentQuarterlyReport.value) return
  if (!unlockRequestReason.value.trim()) {
    toast.warning('Please provide a reason for the unlock request')
    return
  }
  unlockRequestLoading.value = true
  try {
    await api.post(
      `/api/university-operations/quarterly-reports/${currentQuarterlyReport.value.id}/request-unlock`,
      { reason: unlockRequestReason.value.trim() }
    )
    toast.success('Unlock request submitted successfully')
    unlockRequestDialog.value = false
    unlockRequestReason.value = ''
    await fetchQuarterlyReport()
  } catch (err: any) {
    console.error('[Financial] submitUnlockRequest:', err)
    toast.error(err.message || 'Failed to submit unlock request')
  } finally {
    unlockRequestLoading.value = false
  }
}

// --- Navigation ---

function goBack() {
  router.push({
    path: '/university-operations',
    query: { year: selectedFiscalYear.value.toString() }
  })
}

// --- Watchers ---

// Phase FF-3: Debounce pillar switches to batch rapid tab clicks into a single fetch chain
let pillarDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(activePillar, () => {
  if (!selectedFiscalYear.value || selectedFiscalYear.value < 2020) return
  clearPrefill() // Phase FB-B: Clear prefill on pillar switch immediately
  if (pillarDebounceTimer) clearTimeout(pillarDebounceTimer)
  pillarDebounceTimer = setTimeout(async () => {
    pillarDebounceTimer = null
    await fetchFinancialData()
  }, 150)
})

watch(selectedFiscalYear, async (newYear) => {
  if (isInitializing) return
  if (!newYear || newYear < 2020) return
  // Phase FB-A: Instant clear — prevents stale status during fetchFinancialData()
  currentQuarterlyReport.value = null
  clearPrefill()
  router.replace({ query: { ...route.query, year: newYear.toString() } })
  await fetchFinancialData()
  await fetchQuarterlyReport()
})

watch(selectedQuarter, async () => {
  if (isInitializing) return
  // Phase FB-A: Instant clear — prevents stale status during fetchFinancialData()
  currentQuarterlyReport.value = null
  clearPrefill()
  await fetchFinancialData()
  await fetchQuarterlyReport()
})

onMounted(async () => {
  // Phase HN: zero pillar assignments ⇒ nothing on this page is accessible — bounce
  // back to the UO landing page instead of rendering with every tab disabled.
  if (!hasAnyPillarAccess.value) {
    toast.error('No pillar access assigned. Contact your administrator.')
    router.push('/university-operations')
    return
  }
  // Phase HN: If current activePillar not in visiblePillars, select first visible
  if (!visiblePillars.value.some(p => p.id === activePillar.value)) {
    activePillar.value = visiblePillars.value[0]?.id ?? activePillar.value
  }
  await fiscalYearStore.fetchFiscalYears()
  await fetchFinancialData()
  await fetchQuarterlyReport()
  isInitializing = false
})
</script>

<template>
  <div>
    <!-- Row 1: Title + Submit/Status (Phase HK-2 — Directive 133) -->
    <div class="d-flex align-center ga-3 mb-2" style="justify-content: space-between">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <h1 class="text-h4 font-weight-bold text-grey-darken-3">
            Financial Accomplishments
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            Budget Utilization and Financial Performance
          </p>
        </div>
      </div>
      <div class="d-flex align-center flex-wrap ga-2">
        <template v-if="!isLoadingQuarterlyReport">
          <v-btn
            v-if="canSubmitAllPillars()"
            color="primary"
            variant="flat"
            density="compact"
            :prepend-icon="currentQuarterlyReport?.publication_status === 'REJECTED' ? 'mdi-refresh' : 'mdi-send'"
            :loading="actionLoading"
            @click="submitAllPillarsForReview"
            class="flex-shrink-0"
          >
            <span class="d-none d-sm-inline">{{ currentQuarterlyReport?.publication_status === 'REJECTED' ? 'Resubmit' : 'Submit for Review' }}</span>
            <v-icon class="d-sm-none">{{ currentQuarterlyReport?.publication_status === 'REJECTED' ? 'mdi-refresh' : 'mdi-send' }}</v-icon>
          </v-btn>
          <v-btn
            v-else-if="canWithdrawAllPillars()"
            color="warning"
            variant="tonal"
            density="compact"
            prepend-icon="mdi-undo"
            :loading="actionLoading"
            @click="withdrawAllPillarsSubmission"
            class="flex-shrink-0"
          >
            <span class="d-none d-sm-inline">Withdraw Submission</span>
            <v-icon class="d-sm-none">mdi-undo</v-icon>
          </v-btn>
          <v-btn
            v-else-if="currentQuarterlyReport?.publication_status === 'PENDING_REVIEW'"
            color="info"
            variant="tonal"
            density="compact"
            prepend-icon="mdi-clock-outline"
            disabled
            class="flex-shrink-0"
          >
            <span class="d-none d-sm-inline">Pending Review</span>
            <v-icon class="d-sm-none">mdi-clock-outline</v-icon>
          </v-btn>
          <v-chip
            v-else-if="currentQuarterlyReport?.publication_status === 'PUBLISHED'"
            color="success"
            variant="tonal"
            size="small"
            prepend-icon="mdi-check-circle"
            class="flex-shrink-0"
          >
            Approved
          </v-chip>
        </template>
      </div>
    </div>

    <!-- Row 2: Hero KPI Stats (Phase HJ-6 — Directive 132) -->
    <div v-if="!loading && financialRecords.length > 0" class="d-flex flex-wrap ga-3 mb-4">
      <div class="fin-stat-card">
        <div class="fin-stat-label">Appropriation</div>
        <div class="fin-stat-value text-primary">₱{{ formatCurrency(pillarTotal.allotment) }}</div>
      </div>
      <div class="fin-stat-card">
        <div class="fin-stat-label">Obligations</div>
        <div class="fin-stat-value text-info">₱{{ formatCurrency(pillarTotal.obligation) }}</div>
      </div>
      <div class="fin-stat-card">
        <div class="fin-stat-label">Disbursement</div>
        <div class="fin-stat-value" style="color: #00897B">₱{{ formatCurrency(pillarTotal.disbursement) }}</div>
      </div>
      <div v-if="pillarTotal.utilization !== null" class="fin-stat-card fin-stat-card--highlight">
        <div class="fin-stat-label">Utilization Rate</div>
        <div
          class="fin-stat-value"
          style="font-size: 1.25rem"
          :class="(pillarTotal.utilization ?? 0) >= 80 ? 'text-success' : (pillarTotal.utilization ?? 0) >= 50 ? 'text-warning' : 'text-error'"
        >{{ formatPercent(pillarTotal.utilization) }}</div>
      </div>
    </div>

    <!-- Row 3: Controls — Quarter + FY + Export (Phase HK-2) -->
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-select
        v-model="selectedQuarter"
        :items="quarterOptions"
        item-title="title"
        item-value="value"
        label="Reporting Period"
        variant="outlined"
        density="compact"
        hide-details
        style="width: 200px"
        prepend-inner-icon="mdi-calendar-range"
      />
      <v-select
        :model-value="selectedFiscalYear"
        @update:model-value="fiscalYearStore.setFiscalYear"
        :items="fiscalYearOptions"
        label="Fiscal Year"
        density="compact"
        variant="outlined"
        hide-details
        style="width: 140px"
        prepend-inner-icon="mdi-calendar"
      />
      <!-- Phase HL: Column visibility menu for Financial parity (Directive 150) -->
      <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props: menuProps }">
          <v-btn variant="outlined" density="compact" prepend-icon="mdi-eye-settings" class="flex-shrink-0" v-bind="menuProps">
            <span class="d-none d-sm-inline">Columns</span>
          </v-btn>
        </template>
        <v-card min-width="230" class="pa-3">
          <div class="text-subtitle-2 mb-2">Show / Hide Columns</div>
          <v-checkbox v-model="columnVisibility.remarks" label="Remarks" density="compact" hide-details color="primary" />
          <v-checkbox v-model="columnVisibility.mov" label="Means of Verification (MOV)" density="compact" hide-details color="primary" />
        </v-card>
      </v-menu>
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn
            variant="outlined"
            density="compact"
            prepend-icon="mdi-file-export"
            class="flex-shrink-0"
            v-bind="props"
          >
            <span class="d-none d-sm-inline">Export</span>
            <v-icon class="d-sm-none">mdi-file-export</v-icon>
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item disabled>
            <template v-slot:prepend><v-icon>mdi-file-pdf-box</v-icon></template>
            <v-list-item-title>Export to PDF</v-list-item-title>
            <v-list-item-subtitle class="text-caption">Coming soon</v-list-item-subtitle>
          </v-list-item>
          <v-list-item disabled>
            <template v-slot:prepend><v-icon>mdi-file-excel</v-icon></template>
            <v-list-item-title>Export to Excel</v-list-item-title>
            <v-list-item-subtitle class="text-caption">Coming soon</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Pillar Tabs (Phase EX-E: Match Physical page styling) -->
    <v-card class="mb-4">
      <v-tabs v-model="activePillar" bg-color="primary" show-arrows>
        <v-tab
          v-for="pillar in visiblePillars"
          :key="pillar.id"
          :value="pillar.id"
        >
          <v-icon start>{{ pillar.icon }}</v-icon>
          {{ pillar.fullName }}
        </v-tab>
      </v-tabs>
    </v-card>

    <!-- Pillar Header Card -->
    <v-card elevation="1" rounded="lg" class="mb-4">
      <v-card-text class="d-flex flex-wrap align-center ga-2 py-3">
        <v-icon :color="currentPillar.color" class="mr-1">{{ currentPillar.icon }}</v-icon>
        <span class="text-subtitle-1 font-weight-bold">{{ currentPillar.fullName }}</span>
        <v-spacer />

        <!-- FY + Status chips -->
        <v-chip size="small" variant="tonal" color="primary">
          FY {{ selectedFiscalYear }}
        </v-chip>
        <v-chip
          size="small"
          variant="tonal"
          :color="getPublicationStatusColor(currentQuarterStatus)"
        >
          <v-icon start size="x-small">mdi-circle</v-icon>
          {{ getPublicationStatusLabel(currentQuarterStatus) }}
        </v-chip>
        <v-chip size="small" variant="tonal">
          {{ financialRecords.length }} record{{ financialRecords.length !== 1 ? 's' : '' }}
        </v-chip>
        <v-chip
          v-if="pillarTotal.utilization !== null"
          size="small"
          variant="tonal"
          :color="(pillarTotal.utilization ?? 0) >= 80 ? 'success' : 'warning'"
        >
          {{ formatPercent(pillarTotal.utilization) }} Utilization
        </v-chip>

        <!-- Phase HG: Submit/Withdraw moved to top action bar (Directive 112) — pillar header shows status chips only -->
      </v-card-text>
    </v-card>

    <!-- Lock Advisory Banners -->
    <v-alert
      v-if="!isAdmin && currentQuarterlyReport && currentQuarterlyReport.publication_status === 'PUBLISHED'"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center ga-2">
        <v-icon size="small">mdi-lock-outline</v-icon>
        <span class="text-body-2">
          This quarter's report has been published. Data entry is locked.
          <a href="#" class="text-primary" @click.prevent="unlockRequestDialog = true">Request changes</a>
        </span>
      </div>
    </v-alert>

    <v-alert
      v-if="isAdmin && !isSuperAdmin && currentQuarterlyReport?.publication_status === 'PUBLISHED' && !currentQuarterlyReport?.unlocked_by"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center ga-2">
        <v-icon size="small">mdi-shield-lock-outline</v-icon>
        <span class="text-body-2">
          This quarter is published. Admin editing requires explicit unlock approval from a SuperAdmin.
        </span>
      </div>
    </v-alert>

    <v-alert
      v-if="currentQuarterlyReport?.publication_status === 'REJECTED'"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      <div class="text-body-2">
        <strong>Rejected:</strong> {{ currentQuarterlyReport.review_notes || 'No notes provided.' }}
      </div>
    </v-alert>

    <v-alert
      v-if="quarterlyReportFetchFailed"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center ga-2">
        <v-icon size="small">mdi-alert-outline</v-icon>
        <span class="text-body-2">Unable to fetch quarterly report status. Submit controls are disabled.</span>
        <v-btn size="x-small" variant="text" @click="fetchQuarterlyReport">Retry</v-btn>
      </div>
    </v-alert>

    <!-- Phase FA-E: Financial Reporting Guide — renamed, numbered steps, sample values -->
    <v-expansion-panels variant="accordion" class="mb-4">
      <v-expansion-panel>
        <v-expansion-panel-title class="text-body-2">
          <v-icon start size="small" color="info">mdi-information-outline</v-icon>
          How to Enter Financial Data
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="text-body-2">
            <p class="font-weight-bold mb-2">Steps</p>

            <p class="mb-1"><strong>Step 1 — Select the correct Program tab</strong> (MFO1–MFO4) at the top of this page. Each program has its own independent budget allocation. Do not mix data across programs.</p>

            <p class="mb-1"><strong>Step 2 — Click "Add Financial Record"</strong> to open the data entry form for the selected quarter and fiscal year.</p>

            <p class="mb-1"><strong>Step 3 — Fill in the required fields:</strong></p>
            <ul class="mb-2 ml-4">
              <li><em>Program / Line Item</em> — name of the budget line (e.g., "Salaries and Wages — Teaching", "Office Supplies", "Laboratory Equipment")</li>
              <li><em>Campus</em> — Main Campus or Cabadbaran Campus</li>
              <li><em>Expense Class</em> — <strong>PS</strong> (Personal Services: salaries, wages, personnel benefits), <strong>MOOE</strong> (Maintenance &amp; Other Operating Expenses: supplies, utilities), or <strong>CO</strong> (Capital Outlay: equipment, buildings, infrastructure)</li>
              <li><em>Appropriation</em> — total approved budget for this line item (e.g., ₱5,000,000.00)</li>
              <li><em>Obligations</em> — amount committed or obligated against the appropriation (e.g., ₱3,250,000.00)</li>
              <li><em>Disbursement</em> (optional) — actual cash payments released (e.g., ₱2,800,000.00)</li>
            </ul>

            <p class="mb-1"><strong>Step 4 — Submit for review</strong> when all records for the quarter are complete. Use the <strong>Submit</strong> button in the program header. Physical and Financial reports share the same quarterly submission.</p>

            <v-divider class="my-2" />

            <!-- Phase HF: Disbursement Rate formula removed (Directive 106) -->
            <p class="mb-0 text-grey-darken-1">
              <strong>Key formulas (DBM):</strong>
              <em>Unobligated Balance</em> = Appropriation − Obligations &nbsp;|&nbsp;
              <em>% Utilization</em> = (Obligations ÷ Appropriation) × 100
            </p>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Loading State -->
    <v-card v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="mt-4 text-grey">Loading financial data...</div>
    </v-card>

    <!-- Financial Data -->
    <template v-else>
      <!-- Add Record Button -->
      <div v-if="canEditData()" class="d-flex justify-end mb-3">
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-plus"
          @click="openAddDialog"
        >
          Add Financial Record
        </v-btn>
      </div>

      <!-- Phase FB-B: Prefill loading indicator -->
      <div v-if="prefillLoading && financialRecords.length === 0" class="text-center py-4 text-grey mb-3">
        <v-progress-circular indeterminate size="24" class="mr-2" />
        Loading {{ PRIOR_QUARTER_MAP[selectedQuarter] }} reference data...
      </div>

      <!-- Phase FB-B: Prefill banner + read-only reference table (FE-2: dialog-based editing) -->
      <template v-if="isPrefillMode && financialRecords.length === 0 && !prefillLoading">
        <!-- Phase FI-2: Advisory banner — not a decision gate -->
        <v-alert type="info" variant="tonal" class="mb-3" closable @click:close="clearPrefill">
          <div class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span class="text-body-2">
              <v-icon start size="small">mdi-content-copy</v-icon>
              Showing <strong>{{ prefillSourceQuarter }}</strong> data as reference
              ({{ prefillRecords.length }} record{{ prefillRecords.length !== 1 ? 's' : '' }}).
              Click any row to edit and save as <strong>{{ selectedQuarter }}</strong>.
            </span>
            <div class="d-flex ga-1">
              <v-btn size="x-small" variant="tonal"
                :loading="saving" @click="saveAllPrefillRecords"
                prepend-icon="mdi-content-save-all"
              >
                Save All as {{ selectedQuarter }}
              </v-btn>
              <v-btn size="x-small" variant="text" @click="clearPrefill">
                Clear
              </v-btn>
            </div>
          </div>
        </v-alert>

        <v-card elevation="1" rounded="lg" class="mb-4">
          <v-table density="compact" class="financial-table">
            <thead>
              <tr class="bg-primary text-white">
                <th style="min-width: 220px">Program / Line Item</th>
                <th style="width: 80px">Class</th>
                <th style="width: 140px" class="text-right">Appropriation</th>
                <th style="width: 140px" class="text-right">Obligations</th>
                <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                <th style="width: 130px" class="text-right">Disbursement</th>
                <th style="width: 100px" class="text-right">% Utilization</th>
                <!-- Phase FF-4: Use canAdd('university_operations') so all users with base access can save prefill rows -->
                <th v-if="canAdd('university_operations')" style="width: 80px" class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(rec, idx) in prefillRecords" :key="'prefill-' + idx" class="bg-grey-lighten-5 cursor-pointer" @click="openPrefillSaveDialog(rec)">
                <td>
                  <span class="text-body-2">{{ rec.operations_programs }}</span>
                  <v-chip size="x-small" variant="tonal" color="info" class="ml-2">From {{ prefillSourceQuarter }}</v-chip>
                </td>
                <td>
                  <v-chip v-if="rec.expense_class" size="small" variant="flat" color="primary" class="font-weight-bold">{{ rec.expense_class }}</v-chip>
                  <span v-else class="text-grey">—</span>
                </td>
                <td class="text-right font-weight-medium">{{ formatCurrency(rec.allotment) }}</td>
                <td class="text-right">{{ formatCurrency(rec.obligation) }}</td>
                <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                <td class="text-right">{{ formatCurrency(rec.disbursement) }}</td>
                <td class="text-right">
                  <!-- Phase HF: Utilization chip emphasis — size="small" variant="flat" (Directive 104) -->
                  <v-chip
                    v-if="rec.utilization_rate !== null && rec.utilization_rate !== undefined"
                    :color="Number(rec.utilization_rate) >= 80 ? 'success' : Number(rec.utilization_rate) >= 50 ? 'warning' : 'error'"
                    size="small" variant="flat"
                  >{{ formatPercent(rec.utilization_rate) }}</v-chip>
                  <span v-else class="text-grey">—</span>
                </td>
                <td v-if="canAdd('university_operations')" class="text-center">
                  <v-btn
                    icon="mdi-pencil"
                    size="x-small"
                    variant="text"
                    @click.stop="openPrefillSaveDialog(rec)"
                  />
                  <v-btn
                    icon="mdi-delete-outline"
                    size="x-small"
                    variant="text"
                    color="error"
                    @click.stop="removePrefillRow(idx)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>

      <!-- Phase FD-4: Empty state with explicit guidance (no records AND no prefill) -->
      <v-card v-if="financialRecords.length === 0 && !isPrefillMode && !prefillLoading" variant="outlined" class="mb-4">
        <v-table density="compact" class="financial-table">
          <thead>
            <tr class="bg-primary text-white">
              <th style="min-width: 220px">Program / Line Item</th>
              <th style="width: 80px">Class</th>
              <th style="width: 140px" class="text-right">Appropriation</th>
              <th style="width: 140px" class="text-right">Obligations</th>
              <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
              <th style="width: 130px" class="text-right">Disbursement</th>
              <th style="width: 100px" class="text-right">% Utilization</th>
              <th v-if="canEditData()" style="width: 80px" class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td :colspan="canEditData() ? 7 : 6" class="text-center py-6 text-grey">
                <v-icon size="20" color="grey-lighten-1" class="mr-1">mdi-currency-php</v-icon>
                <template v-if="operationNotFound">
                  No operation record has been configured for {{ currentPillar.fullName }}, FY {{ selectedFiscalYear }}.
                  Please contact an administrator.
                </template>
                <template v-else-if="!currentOperation">
                  Unable to load operation context for {{ currentPillar.fullName }}, FY {{ selectedFiscalYear }}.
                </template>
                <template v-else>
                  No financial records for {{ currentPillar.fullName }}, {{ selectedQuarter }} FY {{ selectedFiscalYear }}.
                  <span v-if="canEditData()">
                    Click <strong>Add Financial Record</strong> above to begin.
                  </span>
                </template>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Campus-Grouped Financial Tables -->
      <template v-if="financialRecords.length > 0">
        <template v-for="campus in CAMPUSES" :key="campus.id">
          <v-card v-if="campusHasData(campus.id)" elevation="1" rounded="lg" class="mb-4">
            <v-card-title class="text-subtitle-1 bg-grey-lighten-4 py-2 px-4 d-flex align-center">
              <v-icon start size="small" color="primary">mdi-domain</v-icon>
              {{ campus.name }}
              <v-spacer />
              <v-chip size="x-small" variant="tonal" color="primary">
                {{ formatCurrency(campusSubtotals[campus.id]?.allotment) }}
              </v-chip>
            </v-card-title>

            <v-table density="compact" class="financial-table">
              <thead>
                <tr class="bg-primary text-white">
                  <th style="min-width: 220px">Program / Line Item</th>
                  <th style="width: 80px">Class</th>
                  <th style="width: 140px" class="text-right">Appropriation</th>
                  <th style="width: 140px" class="text-right">Obligations</th>
                  <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                  <th style="width: 130px" class="text-right">Disbursement</th>
                  <th style="width: 100px" class="text-right">% Utilization</th>
                  <th v-if="canEditData()" style="width: 80px" class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                <!-- Group by expense class -->
                <template v-for="ec in EXPENSE_CLASSES" :key="ec.id">
                  <template v-if="(groupedFinancials[campus.id]?.[ec.id] || []).length > 0">
                    <!-- Phase HL: Wrap in template for stacked panel (Directive 150) -->
                    <template v-for="rec in groupedFinancials[campus.id][ec.id]" :key="rec.id">
                    <tr class="cursor-pointer" @click="openEditDialog(rec)">
                      <td>
                        <span class="text-body-2">{{ rec.operations_programs }}</span>
                      </td>
                      <td>
                        <v-chip :color="ec.color" size="small" variant="flat" class="font-weight-bold">{{ ec.id }}</v-chip>
                      </td>
                      <td class="text-right font-weight-medium">{{ formatCurrency(rec.allotment) }}</td>
                      <td class="text-right">{{ formatCurrency(rec.obligation) }}</td>
                      <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                      <td class="text-right">{{ formatCurrency(rec.disbursement) }}</td>
                      <td class="text-right">
                        <!-- Phase HF: Utilization chip emphasis — size="small" variant="flat" (Directive 104) -->
                        <v-chip
                          v-if="rec.utilization_rate !== null && rec.utilization_rate !== undefined"
                          :color="Number(rec.utilization_rate) >= 80 ? 'success' : Number(rec.utilization_rate) >= 50 ? 'warning' : 'error'"
                          size="small"
                          variant="flat"
                        >
                          {{ formatPercent(rec.utilization_rate) }}
                        </v-chip>
                        <span v-else class="text-grey">—</span>
                      </td>
                      <td v-if="canEditData()" class="text-center">
                        <v-btn
                          icon="mdi-pencil"
                          size="x-small"
                          variant="text"
                          @click.stop="openEditDialog(rec)"
                        />
                        <v-btn
                          v-if="isAdmin"
                          icon="mdi-delete-outline"
                          size="x-small"
                          variant="text"
                          color="error"
                          @click.stop="confirmDelete(rec)"
                        />
                      </td>
                    </tr>
                    <!-- Phase HL: Stacked panel — remarks + MOV (Directive 150) -->
                    <tr v-if="anyPanelVisible" class="narrative-stacked-row cursor-pointer" @click="openEditDialog(rec)">
                      <td :colspan="remarksRowColspan" class="pa-0">
                        <div class="narrative-stacked-panel">
                          <div v-if="columnVisibility.remarks" class="narrative-stacked-item">
                            <span class="narrative-stacked-label">Remarks:</span>
                            <span v-if="rec.remarks" class="narrative-stacked-text">{{ rec.remarks }}</span>
                            <span v-else class="text-grey text-caption">—</span>
                          </div>
                          <div v-if="columnVisibility.mov" class="narrative-stacked-item">
                            <span class="narrative-stacked-label">MOV:</span>
                            <template v-if="rec.metadata?.mov">
                              <a v-if="rec.metadata.mov.type === 'link'" :href="rec.metadata.mov.value" target="_blank" rel="noopener" class="narrative-stacked-text text-primary" @click.stop>
                                <v-icon size="x-small" class="mr-1">mdi-open-in-new</v-icon>{{ rec.metadata.mov.value }}
                              </a>
                              <span v-else-if="rec.metadata.mov.type === 'file'" class="narrative-stacked-text">
                                <v-icon size="x-small" class="mr-1">mdi-file-check</v-icon>{{ rec.metadata.mov.metadata?.filename || rec.metadata.mov.value }}
                              </span>
                              <span v-else class="narrative-stacked-text">{{ rec.metadata.mov.value }}</span>
                            </template>
                            <span v-else class="text-grey text-caption">—</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </template>
                  </template>
                </template>
                <!-- Uncategorized records -->
                <template v-if="(groupedFinancials[campus.id]?.['_NONE'] || []).length > 0">
                  <!-- Phase HL: Wrap in template for stacked panel (Directive 150) -->
                  <template v-for="rec in groupedFinancials[campus.id]['_NONE']" :key="rec.id">
                  <tr class="cursor-pointer" @click="openEditDialog(rec)">
                    <td>
                      <span class="text-body-2">{{ rec.operations_programs }}</span>
                    </td>
                    <td><v-chip size="small" variant="tonal" color="grey">—</v-chip></td>
                    <td class="text-right font-weight-medium">{{ formatCurrency(rec.allotment) }}</td>
                    <td class="text-right">{{ formatCurrency(rec.obligation) }}</td>
                    <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                    <td class="text-right">{{ formatCurrency(rec.disbursement) }}</td>
                    <td class="text-right">
                      <!-- Phase HF: Utilization chip (Directive 104) -->
                      <v-chip
                        v-if="rec.utilization_rate !== null && rec.utilization_rate !== undefined"
                        :color="Number(rec.utilization_rate) >= 80 ? 'success' : Number(rec.utilization_rate) >= 50 ? 'warning' : 'error'"
                        size="small"
                        variant="flat"
                      >{{ formatPercent(rec.utilization_rate) }}</v-chip>
                      <span v-else class="text-grey">—</span>
                    </td>
                    <td v-if="canEditData()" class="text-center">
                      <v-btn
                        icon="mdi-pencil"
                        size="x-small"
                        variant="text"
                        @click.stop="openEditDialog(rec)"
                      />
                      <v-btn
                        v-if="isAdmin"
                        icon="mdi-delete-outline"
                        size="x-small"
                        variant="text"
                        color="error"
                        @click.stop="confirmDelete(rec)"
                      />
                    </td>
                  </tr>
                  <!-- Phase HL: Stacked panel — remarks + MOV (Directive 150) -->
                  <tr v-if="anyPanelVisible" class="narrative-stacked-row cursor-pointer" @click="openEditDialog(rec)">
                    <td :colspan="remarksRowColspan" class="pa-0">
                      <div class="narrative-stacked-panel">
                        <div v-if="columnVisibility.remarks" class="narrative-stacked-item">
                          <span class="narrative-stacked-label">Remarks:</span>
                          <span v-if="rec.remarks" class="narrative-stacked-text">{{ rec.remarks }}</span>
                          <span v-else class="text-grey text-caption">—</span>
                        </div>
                        <div v-if="columnVisibility.mov" class="narrative-stacked-item">
                          <span class="narrative-stacked-label">MOV:</span>
                          <template v-if="rec.metadata?.mov">
                            <a v-if="rec.metadata.mov.type === 'link'" :href="rec.metadata.mov.value" target="_blank" rel="noopener" class="narrative-stacked-text text-primary" @click.stop>
                              <v-icon size="x-small" class="mr-1">mdi-open-in-new</v-icon>{{ rec.metadata.mov.value }}
                            </a>
                            <span v-else-if="rec.metadata.mov.type === 'file'" class="narrative-stacked-text">
                              <v-icon size="x-small" class="mr-1">mdi-file-check</v-icon>{{ rec.metadata.mov.metadata?.filename || rec.metadata.mov.value }}
                            </span>
                            <span v-else class="narrative-stacked-text">{{ rec.metadata.mov.value }}</span>
                          </template>
                          <span v-else class="text-grey text-caption">—</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  </template>
                </template>
                <!-- Campus Sub-Total Row -->
                <tr class="bg-grey-lighten-4 font-weight-bold">
                  <td>Sub-Total — {{ campus.name }}</td>
                  <td></td>
                  <td class="text-right">{{ formatCurrency(campusSubtotals[campus.id]?.allotment) }}</td>
                  <td class="text-right">{{ formatCurrency(campusSubtotals[campus.id]?.obligation) }}</td>
                  <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                  <td class="text-right">{{ formatCurrency(campusSubtotals[campus.id]?.disbursement) }}</td>
                  <td class="text-right">{{ formatPercent(campusSubtotals[campus.id]?.utilization) }}</td>
                  <td v-if="canEditData()"></td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </template>

        <!-- Pillar Total -->
        <v-card elevation="1" rounded="lg" class="mb-4">
          <v-table density="compact">
            <tbody>
              <tr class="bg-primary-lighten-5 font-weight-bold text-primary">
                <td style="min-width: 220px">Total — {{ currentPillar.fullName }}</td>
                <td style="width: 80px"></td>
                <td style="width: 140px" class="text-right">{{ formatCurrency(pillarTotal.allotment) }}</td>
                <td style="width: 140px" class="text-right">{{ formatCurrency(pillarTotal.obligation) }}</td>
                <!-- Phase HF: Disbursement before % Utilization (Directive 103) -->
                <td style="width: 130px" class="text-right">{{ formatCurrency(pillarTotal.disbursement) }}</td>
                <td style="width: 100px" class="text-right">{{ formatPercent(pillarTotal.utilization) }}</td>
                <td v-if="canEditData()" style="width: 80px"></td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>
    </template>

    <!-- Entry Dialog -->
    <v-dialog v-model="entryDialog" max-width="600" persistent>
      <v-card>
        <v-card-title class="text-h6 bg-primary text-white">
          <v-icon class="mr-2">{{ editingRecord ? 'mdi-pencil' : 'mdi-plus' }}</v-icon>
          {{ editingRecord ? 'Edit' : 'Add' }} Financial Record
        </v-card-title>

        <v-card-text class="pt-4">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="entryForm.operations_programs"
                label="Program / Line Item *"
                variant="outlined"
                density="compact"
                placeholder="e.g., Personal Services, MOOE, Capital Outlay"
              />
            </v-col>

            <v-col cols="6">
              <v-select
                v-model="entryForm.department"
                :items="[{ title: 'Main Campus', value: 'MAIN' }, { title: 'Cabadbaran Campus', value: 'CABADBARAN' }]"
                label="Campus"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="entryForm.expense_class"
                :items="[
                  { title: 'PS — Personal Services', value: 'PS' },
                  { title: 'MOOE — Maintenance & Operating', value: 'MOOE' },
                  { title: 'CO — Capital Outlay', value: 'CO' },
                ]"
                label="Expense Class"
                variant="outlined"
                density="compact"
                clearable
              />
            </v-col>

            <v-col cols="6">
              <v-select
                v-model="entryForm.fund_type"
                :items="[
                  { title: 'RAF — Programs', value: 'RAF_PROGRAMS' },
                  { title: 'RAF — Projects', value: 'RAF_PROJECTS' },
                  { title: 'RAF — Continuing', value: 'RAF_CONTINUING' },
                  { title: 'IGF — Main', value: 'IGF_MAIN' },
                  { title: 'IGF — Cabadbaran', value: 'IGF_CABADBARAN' },
                ]"
                label="Fund Type"
                variant="outlined"
                density="compact"
                clearable
              />
            </v-col>
            <v-col cols="12">
              <v-divider class="my-1" />
              <div class="text-subtitle-2 text-grey mb-2 mt-2">Financial Amounts</div>
            </v-col>

            <v-col cols="4">
              <v-text-field
                v-model.number="entryForm.allotment"
                label="Appropriation"
                hint="Total budget allocation for this line item"
                persistent-hint
                variant="outlined"
                density="compact"
                type="number"
                min="0"
                prefix="₱"
              />
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model.number="entryForm.obligation"
                label="Obligations"
                hint="Amounts committed against the appropriation"
                persistent-hint
                variant="outlined"
                density="compact"
                type="number"
                min="0"
                prefix="₱"
              />
            </v-col>
            <v-col cols="4">
              <v-text-field
                v-model.number="entryForm.disbursement"
                label="Disbursement (Optional)"
                hint="Actual cash payments released"
                persistent-hint
                variant="outlined"
                density="compact"
                type="number"
                min="0"
                prefix="₱"
              />
            </v-col>

            <!-- Phase EZ-A: Cross-field validation warnings -->
            <v-col cols="12" v-if="(Number(entryForm.obligation) || 0) > (Number(entryForm.allotment) || 0) && (Number(entryForm.allotment) || 0) > 0">
              <v-alert type="warning" variant="tonal" density="compact">
                Obligations ({{ formatCurrency(Number(entryForm.obligation) || 0) }}) exceed Appropriation ({{ formatCurrency(Number(entryForm.allotment) || 0) }}) — balance will be negative.
              </v-alert>
            </v-col>
            <v-col cols="12" v-if="(Number(entryForm.disbursement) || 0) > (Number(entryForm.obligation) || 0) && (Number(entryForm.obligation) || 0) > 0">
              <v-alert type="warning" variant="tonal" density="compact">
                Disbursement ({{ formatCurrency(Number(entryForm.disbursement) || 0) }}) exceeds Obligations ({{ formatCurrency(Number(entryForm.obligation) || 0) }}) — verify data accuracy.
              </v-alert>
            </v-col>

            <!-- Live preview -->
            <v-col cols="12" v-if="utilizationPreview !== null">
              <v-alert type="info" variant="tonal" density="compact">
                <div class="d-flex align-center ga-4 text-body-2">
                  <span>% Utilization: <strong>{{ formatPercent(utilizationPreview) }}</strong></span>
                  <span>Balance: <strong>{{ formatCurrency((Number(entryForm.allotment) || 0) - (Number(entryForm.obligation) || 0)) }}</strong></span>
                </div>
              </v-alert>
            </v-col>

            <v-col cols="12">
              <v-textarea
                v-model="entryForm.remarks"
                label="Remarks"
                variant="outlined"
                density="compact"
                rows="2"
                auto-grow
              />
            </v-col>

            <!-- Phase HL: MOV type-selector UI for Financial (Directive 152) -->
            <v-col cols="12">
              <div class="text-subtitle-2 mb-2">Means of Verification (MOV)</div>
              <v-btn-toggle v-model="movType" mandatory density="compact" color="primary" class="mb-2">
                <v-btn value="text" size="small"><v-icon start size="small">mdi-text</v-icon>Text</v-btn>
                <v-btn value="link" size="small"><v-icon start size="small">mdi-link</v-icon>Link</v-btn>
                <v-btn value="file" size="small"><v-icon start size="small">mdi-file-upload</v-icon>File</v-btn>
              </v-btn-toggle>

              <v-textarea
                v-if="movType === 'text'"
                v-model="movValue"
                label="MOV Description"
                variant="outlined"
                density="compact"
                rows="2"
                auto-grow
                hint="Evidence or documentation supporting financial data"
                persistent-hint
              />
              <v-text-field
                v-else-if="movType === 'link'"
                v-model="movValue"
                label="MOV URL"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-link"
                hint="Paste a link to the supporting document or resource"
                persistent-hint
              />
              <div v-else-if="movType === 'file'">
                <input ref="movFileInputRef" type="file" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt" @change="handleMovFileUpload" />
                <v-btn variant="outlined" size="small" :loading="movUploading" @click="movFileInputRef?.click()">
                  <v-icon start size="small">mdi-upload</v-icon>
                  {{ movFileMetadata ? 'Replace File' : 'Upload File' }}
                </v-btn>
                <div v-if="movFileMetadata" class="mt-2 text-body-2">
                  <v-icon size="small" class="mr-1">mdi-file-check</v-icon>
                  {{ movFileMetadata.filename }}
                  <span class="text-grey ml-1">({{ (movFileMetadata.size / 1024).toFixed(1) }} KB)</span>
                </div>
                <div v-else-if="movValue" class="mt-2 text-body-2">
                  <v-icon size="small" class="mr-1">mdi-file</v-icon>
                  {{ movValue }}
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="entryDialog = false" :disabled="saving || movUploading">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="movUploading"
            @click="saveFinancialRecord"
          >
            {{ editingRecord ? 'Update' : 'Save' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6 bg-error text-white">
          <v-icon class="mr-2">mdi-delete-alert</v-icon>
          Confirm Delete
        </v-card-title>
        <v-card-text class="pt-4">
          Are you sure you want to delete the financial record
          "<strong>{{ deletingRecord?.operations_programs }}</strong>"?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false" :disabled="deleting">Cancel</v-btn>
          <v-btn color="error" variant="flat" :loading="deleting" @click="executeDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Published Edit Warning Dialog -->
    <v-dialog v-model="publishedEditWarningDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6 bg-warning">
          <v-icon class="mr-2">mdi-alert</v-icon>
          Editing Published Quarter
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-1 mb-3">
            This quarter's report has been <strong>published</strong>.
          </p>
          <p class="text-body-2">
            Modifying data will automatically revert the quarterly report status to
            <v-chip size="x-small" color="grey" variant="tonal">DRAFT</v-chip>,
            requiring re-submission and re-approval.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="publishedEditWarningDialog = false">Cancel</v-btn>
          <v-btn color="warning" variant="flat" @click="confirmPublishedEdit">
            Proceed with Edit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Unlock Request Dialog -->
    <v-dialog v-model="unlockRequestDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-h6 bg-primary text-white">
          <v-icon class="mr-2">mdi-lock-open-variant</v-icon>
          Request Changes
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-2 mb-3">
            This quarter's report has been published. Submit a request to an Administrator
            to unlock it for modifications.
          </p>
          <v-textarea
            v-model="unlockRequestReason"
            label="Reason for changes *"
            variant="outlined"
            rows="3"
            auto-grow
            placeholder="Describe what needs to be changed and why..."
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="unlockRequestDialog = false" :disabled="unlockRequestLoading">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="unlockRequestLoading"
            @click="submitUnlockRequest"
          >
            Submit Request
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.cursor-pointer:hover {
  background-color: #e3f2fd !important;
}

.financial-table th {
  font-size: 0.75rem !important;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  color: white !important;
}

/* Phase HF: Utilization Rate hero card emphasis (Directive 105) */
.fin-stat-card--highlight {
  border-width: 2px;
  border-color: rgba(0, 0, 0, 0.18);
  min-width: 130px;
}

/* Phase HE: Financial hero stat cards (Directive 390) */
.fin-stat-card {
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  min-width: 110px;
}
.fin-stat-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}
.fin-stat-value {
  font-size: 1rem;
  font-weight: 700;
  margin-top: 2px;
  white-space: nowrap;
}

/* Phase HL: Stacked panel styles — parity with Physical module (Directive 150) */
.narrative-stacked-row {
  background-color: #fafafa;
}
.narrative-stacked-row:hover {
  background-color: #f0f4ff !important;
}
.narrative-stacked-panel {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  border-top: 1px dashed #e0e0e0;
}
.narrative-stacked-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 200px;
  flex: 1 1 auto;
}
.narrative-stacked-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}
.narrative-stacked-text {
  font-size: 0.82rem;
  color: rgba(0, 0, 0, 0.8);
  word-break: break-word;
}
</style>
