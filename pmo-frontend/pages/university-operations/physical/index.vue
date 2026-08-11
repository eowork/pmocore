<script setup lang="ts">
/**
 * Phase CZ-B: Physical Accomplishments View (BAR No. 1)
 *
 * This page displays the Physical Accomplishments with:
 * - Fiscal year selector (top right)
 * - 4 pillar tabs (Higher Ed, Advanced Ed, Research, Extension)
 * - Outcome and Output indicator tables per pillar
 * - Draft/Review workflow integration
 * - Edit Data button per section
 */

import type { PublicationStatus } from '~/utils/adapters'
// Phase DQ-A: VueApexCharts removed — analytics belong on main module page only

definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const route = useRoute()
const api = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { isAdmin, isStaff, canAdd, isSuperAdmin } = usePermissions()

// Phase DW-C: Centralized fiscal year store
import { useFiscalYearStore } from '~/stores/fiscalYear'
import { storeToRefs } from 'pinia'

const fiscalYearStore = useFiscalYearStore()
const { selectedFiscalYear, fiscalYearOptions } = storeToRefs(fiscalYearStore)

// Phase DW-C: Fiscal year creation permission (moved to main module)
// canCreateFiscalYear removed - button now in main university-operations page

// Phase DR-D: Organizational Outcome Definitions (BAR1 Standard - Corrected)
// OO assignments per DBM BAR1 reporting requirements
const OO_DEFINITIONS = {
  OO1: {
    code: 'OO1',
    description: 'Relevant and quality tertiary education ensured to achieve inclusive growth and access of poor but deserving students to quality tertiary education increased',
    pillars: ['HIGHER_EDUCATION'],  // Only Higher Education
  },
  OO2: {
    code: 'OO2',
    description: 'Higher education research improved to promote economic productivity and innovation',
    pillars: ['ADVANCED_EDUCATION', 'RESEARCH'],  // Both Advanced Ed and Research
  },
  OO3: {
    code: 'OO3',
    description: 'Community engagement increased',
    pillars: ['TECHNICAL_ADVISORY'],
  },
} as const

// Fixed Pillar Definitions (BAR1 Standard)
const PILLARS = [
  {
    id: 'HIGHER_EDUCATION',
    name: 'Higher Education',
    fullName: 'Higher Education Program',
    uacs: '310100000000000',
    oo: 'OO1',
    icon: 'mdi-school',
    color: 'blue'
  },
  {
    id: 'ADVANCED_EDUCATION',
    name: 'Advanced Ed',
    fullName: 'Advanced Education Program',
    uacs: '320100000000000',
    oo: 'OO2',  // Phase DR-D: Corrected from OO1 to OO2
    icon: 'mdi-book-education',
    color: 'purple'
  },
  {
    id: 'RESEARCH',
    name: 'Research',
    fullName: 'Research Program',
    uacs: '320200000000000',
    oo: 'OO2',
    icon: 'mdi-flask',
    color: 'teal'
  },
  {
    id: 'TECHNICAL_ADVISORY',
    name: 'Extension',
    fullName: 'Technical Advisory Extension Program',
    uacs: '330100000000000',
    oo: 'OO3',
    icon: 'mdi-handshake',
    color: 'orange'
  },
] as const

// State
// Phase DW-C: selectedFiscalYear now comes from fiscalYearStore (storeToRefs)
// Phase DW-A: Remove ALL; default to Q1; Q4 = Final Year Projection
// Phase GA-3: Read quarter from URL query for deep-link support (Directive 222)
const selectedQuarter = ref<string>(
  (route.query.quarter as string) && ['Q1', 'Q2', 'Q3', 'Q4'].includes(route.query.quarter as string)
    ? (route.query.quarter as string)
    : 'Q1'
)
const activePillar = ref<string>(
  (route.query.pillar as string) && PILLARS.some(p => p.id === route.query.pillar)
    ? (route.query.pillar as string)
    : PILLARS[0].id
)
const loading = ref(true)
const actionLoading = ref(false)

// Phase DW-A: Quarter options — no ALL mode
const quarterOptions = [
  { title: 'Q1 (Jan–Mar)', value: 'Q1' },
  { title: 'Q2 (Apr–Jun)', value: 'Q2' },
  { title: 'Q3 (Jul–Sep)', value: 'Q3' },
  { title: 'Q4 (Oct–Dec)', value: 'Q4' },
]

// Phase DW-B: Quarter highlight helper
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
function qCellClass(quarter: string): string {
  return quarter === selectedQuarter.value ? 'q-active-cell' : 'q-dimmed-cell'
}

// Data
const pillarTaxonomy = ref<any[]>([])
const pillarIndicators = ref<any[]>([])
const currentOperation = ref<any>(null)
// Phase EL-B: All pillar operations for the current FY — used by cross-pillar submit
const allPillarOperations = ref<any[]>([])
// Phase EM-C: University-wide quarterly report for the selected FY+quarter
const currentQuarterlyReport = ref<any>(null)
// Phase EP-B: Loading guard — Submit button hidden while quarterly report is being fetched
const isLoadingQuarterlyReport = ref(true)
// Phase EP-D: Error guard — Submit button hidden when quarterly report fetch failed (state unknown)
const quarterlyReportFetchFailed = ref(false)
// Phase EP-A: Initialization guard — prevents watch(selectedFiscalYear) from racing onMounted
let isInitializing = true

// Phase DP-B: AbortController for cancelling stale fetches
let fetchAbortController: AbortController | null = null

// Quarterly entry dialog
const entryDialog = ref(false)
const selectedIndicator = ref<any>(null)
const entryForm = ref<any>({})
const saving = ref(false)

// Phase FJ: Prior-quarter prefill state
const wasPrefilled = ref(false)
const prefillSourceQ = ref<string | null>(null)
const PRIOR_QUARTER_MAP: Record<string, string | null> = {
  Q1: null, Q2: 'Q1', Q3: 'Q2', Q4: 'Q3',
}

// Phase FM-1: Check if a record has all data fields empty (null/zero/empty string)
function isRecordEffectivelyEmpty(data: any): boolean {
  if (!data) return true
  const fields = [
    'target_q1', 'target_q2', 'target_q3', 'target_q4',
    'accomplishment_q1', 'accomplishment_q2', 'accomplishment_q3', 'accomplishment_q4',
    'score_q1', 'score_q2', 'score_q3', 'score_q4',
  ]
  return fields.every(f => data[f] == null || data[f] === '' || data[f] === 0)
}

// Phase GOV-UI: Governance dialogs for post-publication editing
const publishedEditWarningDialog = ref(false)
const pendingEditIndicator = ref<any>(null)
const unlockRequestDialog = ref(false)
const unlockRequestReason = ref('')
const unlockRequestLoading = ref(false)

// Phase DT-A: Tab-navigation state removed — dialog now shows all quarters simultaneously

// Phase DW-C: Fiscal year dialog moved to main university-operations page
// (fiscalYearDialog, newFiscalYear, creatingFiscalYear removed)

// Phase DW-C: Fiscal year options now come from fiscalYearStore (storeToRefs)
// Local fetchFiscalYears removed - using fiscalYearStore.fetchFiscalYears()

// Phase DW-C: Fiscal year creation moved to main university-operations page
// (createFiscalYear and openFiscalYearDialog removed)

// Current pillar info
const currentPillar = computed(() => {
  return PILLARS.find(p => p.id === activePillar.value) || PILLARS[0]
})

// Phase DC-E: Current Organizational Outcome
const currentOO = computed(() => {
  const ooKey = currentPillar.value.oo as keyof typeof OO_DEFINITIONS
  return OO_DEFINITIONS[ooKey]
})

// Phase EN-B: Quarter status derived from quarterly_reports.publication_status (not per-pillar status_qN)
// Phase EP-D: Distinguish fetch failure from genuine "no record" state
const currentQuarterStatus = computed(() => {
  if (quarterlyReportFetchFailed.value) return 'FETCH_ERROR'
  return currentQuarterlyReport.value?.publication_status ?? 'NOT_STARTED'
})


// Phase DS-A: Unit type display with abbreviated labels for consistent chip width
const unitTypeConfig: Record<string, { suffix: string; color: string; icon: string; label: string; title: string }> = {
  PERCENTAGE: { suffix: '%', color: 'blue', icon: 'mdi-percent', label: 'PCT', title: 'Percentage' },
  COUNT: { suffix: '', color: 'green', icon: 'mdi-counter', label: 'CNT', title: 'Count' },
  WEIGHTED_COUNT: { suffix: '', color: 'orange', icon: 'mdi-scale-balance', label: 'WGT', title: 'Weighted Count' },
}

function getUnitConfig(unitType: string) {
  return unitTypeConfig[unitType] || { suffix: '', color: 'grey', icon: 'mdi-help', label: '?', title: 'Unknown' }
}

// Outcome indicators
const outcomeIndicators = computed(() => {
  return pillarTaxonomy.value.filter(t => t.indicator_type === 'OUTCOME')
})

// Output indicators
const outputIndicators = computed(() => {
  return pillarTaxonomy.value.filter(t => t.indicator_type === 'OUTPUT')
})

// Phase DR-E: Lightweight rate summary computed from existing pillarIndicators
// Uses same rate model as backend: SUM(actual/target) per indicator
const pillarRateSummary = computed(() => {
  const indicators = pillarIndicators.value.filter(i => i.pillar_indicator_id !== null)
  const withData = pillarTaxonomy.value.filter(t => getIndicatorData(t.id) !== null).length
  const total = pillarTaxonomy.value.length

  let targetRate = 0
  let actualRate = 0

  for (const indicator of indicators) {
    const target = (parseFloat(indicator.target_q1) || 0) + (parseFloat(indicator.target_q2) || 0)
      + (parseFloat(indicator.target_q3) || 0) + (parseFloat(indicator.target_q4) || 0)
    const actual = (parseFloat(indicator.accomplishment_q1) || 0) + (parseFloat(indicator.accomplishment_q2) || 0)
      + (parseFloat(indicator.accomplishment_q3) || 0) + (parseFloat(indicator.accomplishment_q4) || 0)

    if (target > 0) {
      targetRate += 1.0
      actualRate += actual / target
    }
  }

  const ratePct = targetRate > 0 ? (actualRate / targetRate) * 100 : null

  return { withData, total, targetRate, actualRate, ratePct }
})

// Get indicator data by taxonomy ID
function getIndicatorData(taxonomyId: string) {
  return pillarIndicators.value.find(i => i.pillar_indicator_id === taxonomyId) || null
}

// Phase FM-1: Check if prior-quarter prefill is available for an indicator
// Prefill available when current quarter has no record OR has an empty record
function hasPrefillAvailable(taxonomyId: string): boolean {
  const priorQ = PRIOR_QUARTER_MAP[selectedQuarter.value]
  if (!priorQ) return false
  const data = getIndicatorData(taxonomyId)
  return data === null || isRecordEffectivelyEmpty(data)
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase DQ-A: Decoupled Data Fetching Architecture
// Taxonomy (static, pillar-based) is fetched SEPARATELY from indicator data
// (fiscal-year-specific) to ensure indicators always render per BAR1 standard
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phase DQ-A: Fetch taxonomy (static, pillar-based)
 * Taxonomy is INDEPENDENT of fiscal year and must always display
 */
async function fetchTaxonomy() {
  try {
    const taxonomyRes = await api.get<any[]>(
      `/api/university-operations/taxonomy/${activePillar.value}`
    )
    pillarTaxonomy.value = Array.isArray(taxonomyRes) ? taxonomyRes : (taxonomyRes as any)?.data || []
    console.log('[Physical] Taxonomy fetched:', {
      pillar: activePillar.value,
      count: pillarTaxonomy.value.length,
      outcome: pillarTaxonomy.value.filter(t => t.indicator_type === 'OUTCOME').length,
      output: pillarTaxonomy.value.filter(t => t.indicator_type === 'OUTPUT').length,
    })
  } catch (err: any) {
    console.error('[Physical] Taxonomy fetch failed:', err)
    // Only clear taxonomy on its own error - don't affect other state
    pillarTaxonomy.value = []
  }
}

/**
 * Phase DQ-A: Fetch indicator data (fiscal-year-specific)
 * Indicator data failure does NOT affect taxonomy display
 * Phase DW-C: Guard against invalid fiscal year
 */
async function fetchIndicatorData() {
  // Phase DW-C: Guard - ensure fiscal year is valid before API call
  if (!selectedFiscalYear.value || selectedFiscalYear.value < 2020) {
    console.warn('[Physical] fetchIndicatorData: Invalid fiscal year, skipping fetch')
    pillarIndicators.value = []
    return
  }

  try {
    // Phase FL-3: Pass quarter to fetch — per-quarter record isolation
    const indicatorsRes = await api.get<any[]>(
      `/api/university-operations/indicators?pillar_type=${activePillar.value}&fiscal_year=${selectedFiscalYear.value}&quarter=${selectedQuarter.value}`
    )
    pillarIndicators.value = Array.isArray(indicatorsRes) ? indicatorsRes : (indicatorsRes as any)?.data || []
    console.log('[Physical] Indicator data fetched:', {
      pillar: activePillar.value,
      fiscalYear: selectedFiscalYear.value,
      quarter: selectedQuarter.value,
      count: pillarIndicators.value.length,
    })
  } catch (err: any) {
    console.error('[Physical] Indicator data fetch failed:', err)
    // Clear indicator data but PRESERVE taxonomy
    pillarIndicators.value = []
  }
}

/**
 * Phase DQ-B: Fetch all pillar data with decoupled error handling
 * Taxonomy and indicator data are fetched independently
 */
async function fetchPillarData() {
  // Phase DP-B: Cancel any pending fetch before starting new one
  if (fetchAbortController) {
    fetchAbortController.abort()
  }
  fetchAbortController = new AbortController()
  const currentController = fetchAbortController

  loading.value = true

  // Phase DQ-A: Fetch taxonomy first (pillar-based, fiscal-year-independent)
  await fetchTaxonomy()

  // Phase DP-B: Check if this fetch was aborted (newer fetch started)
  if (currentController.signal.aborted) return

  // Phase DQ-A: Fetch indicator data (fiscal-year-specific)
  // This can fail without affecting taxonomy display
  await fetchIndicatorData()

  if (currentController.signal.aborted) return

  // Find existing operation for this pillar/year
  await findCurrentOperation()

  if (currentController.signal.aborted) return

  loading.value = false
}

// Find or identify current operation
async function findCurrentOperation() {
  try {
    // Phase DL-D: Diagnostic logging for operation lookup
    console.log('[Physical] findCurrentOperation: Searching for', {
      operation_type: activePillar.value,
      fiscal_year: selectedFiscalYear.value,
      fiscal_year_type: typeof selectedFiscalYear.value,
    });

    // Phase EK-C: Add filters to avoid pagination miss
    const response = await api.get<any>(
      `/api/university-operations?type=${activePillar.value}&fiscal_year=${selectedFiscalYear.value}&limit=100`
    )
    const data = Array.isArray(response) ? response : (response?.data || [])

    console.log('[Physical] findCurrentOperation: Available operations:', data.map((op: any) => ({
      id: op.id,
      operation_type: op.operation_type,
      fiscal_year: op.fiscal_year,
      fiscal_year_type: typeof op.fiscal_year,
      title: op.title,
    })));

    // Phase DL-D: Type-safe comparison (convert both to numbers)
    currentOperation.value = data.find(
      (op: any) => op.operation_type === activePillar.value && Number(op.fiscal_year) === Number(selectedFiscalYear.value)
    ) || null

    console.log('[Physical] findCurrentOperation: Result:', currentOperation.value ? {
      id: currentOperation.value.id,
      operation_type: currentOperation.value.operation_type,
      fiscal_year: currentOperation.value.fiscal_year,
      title: currentOperation.value.title,
    } : 'NULL (no operation found for this pillar + year)');
  } catch (err) {
    console.error('[Physical] findCurrentOperation: Error:', err);
    currentOperation.value = null
  }
}

// Phase EL-B + EI-E: Load all 4 pillar operations for the current FY (for cross-pillar submit)
// Phase EI-E: Filter to known pillar types only — prevents non-pillar operations from being included
async function fetchAllPillarOperations() {
  if (!selectedFiscalYear.value || selectedFiscalYear.value < 2020) return
  try {
    const response = await api.get<any>(
      `/api/university-operations?fiscal_year=${selectedFiscalYear.value}&limit=10`
    )
    const allOps = Array.isArray(response) ? response : (response?.data || [])
    // Phase EI-E: Only include operations matching known pillar types
    allPillarOperations.value = allOps.filter(
      (op: any) => PILLARS.some(p => p.id === op.operation_type)
    )
  } catch (err) {
    console.error('[Physical] fetchAllPillarOperations: Error:', err)
    allPillarOperations.value = []
  }
}

// Phase EM-C: Fetch or create quarterly report for current FY+quarter
async function fetchQuarterlyReport() {
  // Phase EP-B: Track loading state so canSubmitAllPillars() blocks during fetch
  isLoadingQuarterlyReport.value = true
  quarterlyReportFetchFailed.value = false
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
    console.log('[Physical] fetchQuarterlyReport:', {
      fiscalYear: selectedFiscalYear.value,
      quarter: selectedQuarter.value,
      found: !!currentQuarterlyReport.value,
      status: currentQuarterlyReport.value?.publication_status,
    })
  } catch (err) {
    console.error('[Physical] fetchQuarterlyReport: Error:', err)
    currentQuarterlyReport.value = null
    // Phase EP-D: Mark fetch as failed so Submit is blocked and status shows warning
    quarterlyReportFetchFailed.value = true
  } finally {
    isLoadingQuarterlyReport.value = false
  }
}

function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return Number(val).toFixed(2)
}

// Format percentage (used in indicator table rows and entry dialog)
function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return `${Number(val).toFixed(1)}%`
}

// Get color based on accomplishment rate (used in indicator table rows)
function getRateColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return 'grey'
  if (rate >= 100) return 'success'
  if (rate >= 80) return 'warning'
  return 'error'
}

// Get variance color (used in indicator table rows)
function getVarianceColor(variance: number | null | undefined): string {
  if (variance === null || variance === undefined) return 'grey'
  return variance >= 0 ? 'success' : 'error'
}

// Publication status helpers
function getPublicationStatusColor(status: PublicationStatus | string): string {
  const colors: Record<string, string> = {
    DRAFT: 'grey',
    PENDING_REVIEW: 'orange',
    PUBLISHED: 'success',
    REJECTED: 'error',
    FETCH_ERROR: 'warning',
  }
  return colors[status] || 'grey'
}

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

// --- Permission Checks (COI/Repairs pattern) ---

function isOwnerOrAssigned(op: any): boolean {
  if (!op) return false
  const userId = authStore.user?.id
  if (!userId) return false
  const isAssigned = Array.isArray(op.assigned_users) && op.assigned_users.some((u: any) => u.id === userId)
  return op.created_by === userId || isAssigned
}

function canEditData(): boolean {
  if (!currentOperation.value) return canAdd('operations')
  // Phase GOV-C: Admin on PUBLISHED quarterly must have explicit unlock approval
  if (isAdmin.value) {
    if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') {
      return isSuperAdmin.value || !!currentQuarterlyReport.value?.unlocked_by
    }
    return true
  }
  if (currentOperation.value.publication_status === 'PUBLISHED') return false
  // Phase ER-A: Published quarterly report locks indicator/financial edits for non-admin users
  if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') return false
  return isOwnerOrAssigned(currentOperation.value)
}

// Phase EM-C: Cross-pillar submit guard — checks quarterly report status
function canSubmitAllPillars(): boolean {
  // Phase EP-B: Block Submit button while quarterly report status is loading
  if (isLoadingQuarterlyReport.value) return false
  // Phase EP-D: Block Submit when quarterly report state is unknown (fetch failed)
  if (quarterlyReportFetchFailed.value) return false
  // If we have a quarterly report, check its status
  if (currentQuarterlyReport.value) {
    const status = currentQuarterlyReport.value.publication_status
    if (status !== 'DRAFT' && status !== 'REJECTED') return false
    if (isAdmin.value) return true
    return currentQuarterlyReport.value.created_by === authStore.user?.id
  }
  // No quarterly report yet — allow creating one if there are pillar operations
  if (allPillarOperations.value.length === 0) return false
  if (isAdmin.value) return true
  return allPillarOperations.value.some(op => isOwnerOrAssigned(op))
}

// Phase EM-C: Withdraw guard — checks quarterly report status
function canWithdrawAllPillars(): boolean {
  if (!currentQuarterlyReport.value) return false
  if (currentQuarterlyReport.value.publication_status !== 'PENDING_REVIEW') return false
  if (isAdmin.value) return true
  return currentQuarterlyReport.value.submitted_by === authStore.user?.id
}



function goBack() {
  router.push({
    path: '/university-operations',
    query: { year: selectedFiscalYear.value.toString() }
  })
}

// Phase DV-B: Removed createNewEntry() - no longer needed
// Old workflow: Navigate to /university-operations/new
// New workflow: Click indicator rows → quarterly entry dialog

// Open quarterly entry dialog
function openEntryDialog(indicator: any) {
  if (!canEditData()) {
    toast.warning('You do not have permission to edit this data')
    return
  }

  // Phase GOV-C: Show governance warning when SuperAdmin or unlocked Admin edits a PUBLISHED quarter
  if (currentQuarterlyReport.value?.publication_status === 'PUBLISHED') {
    if (isSuperAdmin.value || (isAdmin.value && currentQuarterlyReport.value?.unlocked_by)) {
      pendingEditIndicator.value = indicator
      publishedEditWarningDialog.value = true
      return
    }
  }

  openEntryDialogDirect(indicator)
}

// Phase GOV-UI: Proceed with edit after governance warning acknowledged
function confirmPublishedEdit() {
  publishedEditWarningDialog.value = false
  if (pendingEditIndicator.value) {
    openEntryDialogDirect(pendingEditIndicator.value)
    pendingEditIndicator.value = null
  }
}

// Phase GOV-UI: Internal helper — opens entry dialog without governance checks
// Phase FL-4: Made async for per-quarter prefill (API fetch of prior quarter's record)
async function openEntryDialogDirect(indicator: any) {
  selectedIndicator.value = indicator
  const existingData = getIndicatorData(indicator.id)

  // Debug logging
  console.log('[Physical] Opening entry dialog:', {
    taxonomyId: indicator.id,
    taxonomyName: indicator.indicator_name,
    existingData: existingData,
    existingDataId: existingData?.id,
    quarter: selectedQuarter.value,
    pillarIndicatorsCount: pillarIndicators.value.length,
  })

  // Phase FM-1: Per-quarter record model — prefill from prior quarter's record
  // Empty records (all data fields null) still allow prior-quarter reference
  wasPrefilled.value = false
  prefillSourceQ.value = null

  const needsPrefill = !existingData || isRecordEffectivelyEmpty(existingData)

  if (existingData && !needsPrefill) {
    // Current quarter has a populated record — load it directly
    entryForm.value = {
      pillar_indicator_id: indicator.id,
      fiscal_year: selectedFiscalYear.value,
      target_q1: existingData.target_q1 ?? null,
      target_q2: existingData.target_q2 ?? null,
      target_q3: existingData.target_q3 ?? null,
      target_q4: existingData.target_q4 ?? null,
      accomplishment_q1: existingData.accomplishment_q1 ?? null,
      accomplishment_q2: existingData.accomplishment_q2 ?? null,
      accomplishment_q3: existingData.accomplishment_q3 ?? null,
      accomplishment_q4: existingData.accomplishment_q4 ?? null,
      score_q1: existingData.score_q1 || '',
      score_q2: existingData.score_q2 || '',
      score_q3: existingData.score_q3 || '',
      score_q4: existingData.score_q4 || '',
      remarks: existingData.remarks || '',
      override_rate: existingData.override_rate ?? null,
      _existingId: existingData.id || null,
    }
  } else {
    // No record OR empty record — check for prior quarter prefill
    // Preserve _existingId if empty record exists (PATCH to update, not POST duplicate)
    const preservedId = existingData?.id || null
    const priorQ = PRIOR_QUARTER_MAP[selectedQuarter.value]
    let priorData: any = null

    if (priorQ) {
      try {
        const priorIndicators = await api.get<any[]>(
          `/api/university-operations/indicators?pillar_type=${activePillar.value}&fiscal_year=${selectedFiscalYear.value}&quarter=${priorQ}`
        )
        const priorList = Array.isArray(priorIndicators) ? priorIndicators : (priorIndicators as any)?.data || []
        priorData = priorList.find((i: any) => i.pillar_indicator_id === indicator.id) || null
        console.log('[Physical] Prior quarter prefill lookup:', {
          priorQ,
          found: !!priorData,
          priorDataId: priorData?.id,
          emptyRecordId: preservedId,
        })
      } catch (err) {
        console.warn('[Physical] Prior quarter fetch failed, starting empty:', err)
      }
    }

    if (priorData) {
      // Deep-copy ALL 12 columns from prior quarter's record as starting point
      entryForm.value = {
        pillar_indicator_id: indicator.id,
        fiscal_year: selectedFiscalYear.value,
        target_q1: priorData.target_q1 ?? null,
        target_q2: priorData.target_q2 ?? null,
        target_q3: priorData.target_q3 ?? null,
        target_q4: priorData.target_q4 ?? null,
        accomplishment_q1: priorData.accomplishment_q1 ?? null,
        accomplishment_q2: priorData.accomplishment_q2 ?? null,
        accomplishment_q3: priorData.accomplishment_q3 ?? null,
        accomplishment_q4: priorData.accomplishment_q4 ?? null,
        score_q1: priorData.score_q1 || '',
        score_q2: priorData.score_q2 || '',
        score_q3: priorData.score_q3 || '',
        score_q4: priorData.score_q4 || '',
        remarks: priorData.remarks || '',
        override_rate: null, // Phase FY-2: do not inherit prior quarter's override
        _existingId: preservedId,
      }
      wasPrefilled.value = true
      prefillSourceQ.value = priorQ
    } else {
      // No prior data — start with empty form
      entryForm.value = {
        pillar_indicator_id: indicator.id,
        fiscal_year: selectedFiscalYear.value,
        target_q1: null, target_q2: null, target_q3: null, target_q4: null,
        accomplishment_q1: null, accomplishment_q2: null, accomplishment_q3: null, accomplishment_q4: null,
        score_q1: '', score_q2: '', score_q3: '', score_q4: '',
        remarks: '',
        override_rate: null,
        _existingId: preservedId,
      }
    }
  }

  // Phase DT-A: Tab navigation removed — all quarters shown simultaneously
  entryDialog.value = true
}

/**
 * Phase DV-A: Sanitize empty strings to null for numeric fields
 *
 * Vue v-model.number clears to "" when user deletes field content.
 * Backend DTO validation rejects empty strings for @IsNumber() fields.
 * Solution: Convert "" → null before sending to API.
 */
function sanitizeNumericPayload(data: any): any {
  const numericFields = [
    'target_q1',
    'target_q2',
    'target_q3',
    'target_q4',
    'accomplishment_q1',
    'accomplishment_q2',
    'accomplishment_q3',
    'accomplishment_q4',
  ]

  const sanitized = { ...data }

  numericFields.forEach(field => {
    if (sanitized[field] === '') {
      sanitized[field] = null
    }
  })

  return sanitized
}

// Save quarterly data
async function saveQuarterlyData() {
  if (!selectedIndicator.value) return

  // Phase DL-B: Comprehensive debug logging at entry
  console.group('[Physical] saveQuarterlyData ENTRY');
  console.log('selectedIndicator (taxonomy):', {
    id: selectedIndicator.value?.id,
    indicator_name: selectedIndicator.value?.indicator_name,
    pillar_type: selectedIndicator.value?.pillar_type,
  });
  console.log('currentOperation:', {
    id: currentOperation.value?.id,
    operation_type: currentOperation.value?.operation_type,
    fiscal_year: currentOperation.value?.fiscal_year,
    title: currentOperation.value?.title,
  });
  console.log('selectedFiscalYear:', selectedFiscalYear.value);
  console.log('activePillar:', activePillar.value);
  console.log('entryForm._existingId:', entryForm.value._existingId);
  console.log('pillarIndicators (sample 3):', pillarIndicators.value.slice(0, 3).map(i => ({
    id: i.id,
    pillar_indicator_id: i.pillar_indicator_id,
    fiscal_year: i.fiscal_year,
    operation_id: i.operation_id,
    particular: i.particular,
  })));
  console.groupEnd();

  saving.value = true
  try {
    // First ensure we have an operation
    if (!currentOperation.value) {
      console.log('[Physical] No current operation - creating new operation');
      // Create operation first
      const createRes = await api.post<any>('/api/university-operations', {
        title: `${currentPillar.value.fullName} - FY ${selectedFiscalYear.value}`,
        operation_type: activePillar.value,
        fiscal_year: selectedFiscalYear.value,
        campus: 'MAIN',
        status: 'ONGOING',
      })
      currentOperation.value = createRes
      console.log('[Physical] Created new operation:', currentOperation.value.id);
    }

    const { _existingId } = entryForm.value

    // Phase FL-1: Full 12-field payload — record-level isolation via per-quarter DB records
    // Each quarter has its own independent record; all columns are editable
    const quarterPayload: any = {
      pillar_indicator_id: entryForm.value.pillar_indicator_id,
      fiscal_year: entryForm.value.fiscal_year,
      reported_quarter: selectedQuarter.value,
      target_q1: entryForm.value.target_q1,
      target_q2: entryForm.value.target_q2,
      target_q3: entryForm.value.target_q3,
      target_q4: entryForm.value.target_q4,
      accomplishment_q1: entryForm.value.accomplishment_q1,
      accomplishment_q2: entryForm.value.accomplishment_q2,
      accomplishment_q3: entryForm.value.accomplishment_q3,
      accomplishment_q4: entryForm.value.accomplishment_q4,
      score_q1: entryForm.value.score_q1,
      score_q2: entryForm.value.score_q2,
      score_q3: entryForm.value.score_q3,
      score_q4: entryForm.value.score_q4,
      remarks: entryForm.value.remarks,
    }

    // Phase DV-A: Sanitize empty strings to null for numeric fields
    const payload = sanitizeNumericPayload(quarterPayload)

    // Phase DM-A: Use indicator's actual operation_id for UPDATE to prevent 404 mismatch
    const operationId = _existingId
      ? (pillarIndicators.value.find(i => i.id === _existingId)?.operation_id || currentOperation.value.id)
      : currentOperation.value.id

    // Phase DM-B: Validate operationId exists before proceeding
    if (!operationId) {
      console.error('[Physical] CRITICAL: operationId is NULL or undefined', {
        _existingId,
        currentOperation: currentOperation.value,
        indicatorFound: pillarIndicators.value.find(i => i.id === _existingId),
      })
      toast.error('Cannot save: Operation ID not found. Please refresh the page.')
      saving.value = false
      return
    }

    // Phase DI-C: Validate _existingId before attempting PATCH
    if (_existingId) {
      // Verify indicator still exists in current year's data
      const existsInCurrentYear = pillarIndicators.value.some(i => i.id === _existingId)

      console.log('[Physical] _existingId validation:', {
        _existingId,
        existsInCurrentYear,
        pillarIndicatorsTotal: pillarIndicators.value.length,
      });

      if (!existsInCurrentYear) {
        console.warn('[Physical] _existingId not found in current year data. Switching to POST (create new).')
        console.log('[Physical] Indicator might be from different year. Creating new record for current year.')
        // Treat as new record for this year
        await api.post(
          `/api/university-operations/${operationId}/indicators/quarterly`,
          payload
        )
        toast.success('Quarterly data saved for current year')
        entryDialog.value = false
        await fetchPillarData()
        return
      }
    }

    // Debug logging
    console.log('[Physical] Saving quarterly data:', {
      operationId,
      _existingId,
      pillar_indicator_id: payload.pillar_indicator_id,
      fiscal_year: payload.fiscal_year,
      hasRemarks: !!payload.remarks,
      route: _existingId ? 'PATCH (update)' : 'POST (create)',
    })

    if (_existingId) {
      // Phase DJ-A: Use dedicated quarterly PATCH endpoint with full validation
      const patchUrl = `/api/university-operations/${operationId}/indicators/${_existingId}/quarterly`;
      console.log('[Physical] PATCH REQUEST:', {
        url: patchUrl,
        operationId,
        indicatorId: _existingId,
        fieldCount: Object.keys(payload).length,
      });
      await api.patch(patchUrl, payload)
      toast.success('Quarterly data updated successfully')
    } else {
      // Create new
      const postUrl = `/api/university-operations/${operationId}/indicators/quarterly`;
      console.log('[Physical] POST REQUEST:', { url: postUrl, operationId });
      await api.post(postUrl, payload)
      toast.success('Quarterly data saved successfully')
    }

    entryDialog.value = false
    await fetchPillarData()
    // Phase GOV-UI: Refresh quarterly report status after save (backend auto-reverts to DRAFT)
    await fetchQuarterlyReport()
  } catch (err: any) {
    console.error('[Physical] Save failed:', err);
    toast.error(err.message || 'Failed to save quarterly data')
  } finally {
    saving.value = false
  }
}

// Phase FY-1: DBM BAR1 standard — ALL indicator types use SUM (Directive 211/212)
const computedPreview = computed(() => {
  const f = entryForm.value
  const targets = [f.target_q1, f.target_q2, f.target_q3, f.target_q4]
    .filter(v => v !== null && v !== undefined && v !== '')
  const actuals = [f.accomplishment_q1, f.accomplishment_q2, f.accomplishment_q3, f.accomplishment_q4]
    .filter(v => v !== null && v !== undefined && v !== '')

  const totalTarget = targets.length > 0
    ? targets.reduce((a, b) => Number(a) + Number(b), 0)
    : null
  const totalActual = actuals.length > 0
    ? actuals.reduce((a, b) => Number(a) + Number(b), 0)
    : null

  const variance = totalTarget !== null && totalActual !== null ? totalActual - totalTarget : null
  const rate = totalTarget !== null && totalTarget !== 0 && totalActual !== null
    ? (totalActual / totalTarget) * 100
    : null

  return { totalTarget, totalActual, variance, rate }
})

// Phase EM-C: Submit quarterly report for the current FY+quarter (single API call)
async function submitAllPillarsForReview() {
  actionLoading.value = true
  try {
    // Phase EP-C: Defensive re-fetch to ensure latest status before submitting
    await fetchQuarterlyReport()
    if (currentQuarterlyReport.value &&
        currentQuarterlyReport.value.publication_status !== 'DRAFT' &&
        currentQuarterlyReport.value.publication_status !== 'REJECTED') {
      const label = currentQuarterlyReport.value.publication_status.toLowerCase().replace('_', ' ')
      toast.warning(`This quarter is already ${label}`)
      return
    }

    let report = currentQuarterlyReport.value
    // If no quarterly report exists yet, create one
    if (!report) {
      report = await api.post<any>('/api/university-operations/quarterly-reports', {
        fiscal_year: selectedFiscalYear.value,
        quarter: selectedQuarter.value,
      })
      currentQuarterlyReport.value = report
    }
    // Submit for review — single API call
    await api.post(`/api/university-operations/quarterly-reports/${report.id}/submit`, {})
    toast.success(`${selectedQuarter.value} submitted for review`)
    await fetchQuarterlyReport()
    await findCurrentOperation()
  } catch (err: any) {
    console.error('[Physical] submitAllPillarsForReview:', err)
    toast.error(err.message || 'Failed to submit quarterly report')
  } finally {
    actionLoading.value = false
  }
}

// Phase EM-C: Withdraw quarterly report submission (single API call)
async function withdrawAllPillarsSubmission() {
  if (!currentQuarterlyReport.value) return
  actionLoading.value = true
  try {
    await api.post(`/api/university-operations/quarterly-reports/${currentQuarterlyReport.value.id}/withdraw`, {})
    toast.success(`${selectedQuarter.value} submission withdrawn`)
    await fetchQuarterlyReport()
    await findCurrentOperation()
  } catch (err: any) {
    console.error('[Physical] withdrawAllPillarsSubmission:', err)
    toast.error(err.message || 'Failed to withdraw quarterly report')
  } finally {
    actionLoading.value = false
  }
}

// Phase GOV-UI: Submit unlock request for published quarterly report (non-admin)
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
    console.error('[Physical] submitUnlockRequest:', err)
    toast.error(err.message || 'Failed to submit unlock request')
  } finally {
    unlockRequestLoading.value = false
  }
}


// Phase DQ-B: Decoupled Watch Handlers
// Pillar changes refetch taxonomy + indicator data
// Fiscal year changes ONLY refetch indicator data (taxonomy is static per pillar)
// ═══════════════════════════════════════════════════════════════════════════

// Watch pillar changes - refetch taxonomy AND indicator data
// Phase DP-A: Guard against fetch when fiscal year not yet initialized
watch(activePillar, async () => {
  if (!selectedFiscalYear.value || selectedFiscalYear.value < 2020) {
    console.warn('[Physical] Skipping fetch - fiscal year not initialized')
    return
  }
  loading.value = true
  await fetchTaxonomy()
  await fetchIndicatorData()
  await findCurrentOperation()
  loading.value = false
})

// Watch fiscal year changes - ONLY refetch indicator data (taxonomy is pillar-based)
// Phase DP-A: Guard against invalid fiscal year
watch(selectedFiscalYear, async (newYear) => {
  // Phase EP-A: Skip during onMounted initialization to prevent race condition
  if (isInitializing) return
  if (!newYear || newYear < 2020) return
  // Phase DI-B: Sync year changes to URL query
  router.replace({
    query: { ...route.query, year: newYear.toString() }
  })
  // Phase DQ-B: Only refetch indicator data - taxonomy is fiscal-year-independent
  loading.value = true
  await fetchIndicatorData()
  await findCurrentOperation()
  // Phase EL-B: Reload all pillar operations when FY changes
  await fetchAllPillarOperations()
  // Phase EM-C: Reload quarterly report for new FY+quarter
  await fetchQuarterlyReport()
  loading.value = false
})

// Phase FL-3: Watch quarter changes — reload indicator data + quarterly report
// Per-quarter record isolation: each quarter has its own DB records
watch(selectedQuarter, async () => {
  await fetchIndicatorData()
  await fetchQuarterlyReport()
})

// Phase DW-C: Fix race condition - await fiscal year fetch before indicator data
onMounted(async () => {
  // Ensure fiscal year is initialized before fetching pillar data
  await fiscalYearStore.fetchFiscalYears()
  await fetchPillarData()
  // Phase EL-B: Load all pillar operations after initial data is ready
  await fetchAllPillarOperations()
  // Phase EM-C: Load quarterly report for initial FY+quarter
  await fetchQuarterlyReport()
  // Phase EP-A: Allow watch(selectedFiscalYear) to fire for user-driven changes
  isInitializing = false
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center mb-4 ga-3">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <h1 class="text-h4 font-weight-bold text-grey-darken-3">
            Physical Accomplishments
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            BAR No. 1 - Quarterly Physical Report of Operations
          </p>
        </div>
      </div>
      <!-- Phase EM-D: Expanded max-width to 760px for breathing room with all controls -->
      <div class="d-flex flex-column flex-sm-row align-stretch align-sm-center ga-2 ga-sm-3" style="width: 100%; max-width: 760px">
        <!-- Phase EE-D: Quarter Selector — tooltip removed (v-tooltip on v-select causes persistent display) -->
        <v-select
          v-model="selectedQuarter"
          :items="quarterOptions"
          item-title="title"
          item-value="value"
          label="Reporting Period"
          variant="outlined"
          density="compact"
          hide-details
          class="flex-sm-0-0-auto"
          style="width: 100%; max-width: 200px"
          prepend-inner-icon="mdi-calendar-range"
        />
        <!-- Fiscal Year Selector -->
        <v-select
          v-model="selectedFiscalYear"
          :items="fiscalYearOptions"
          label="Fiscal Year"
          variant="outlined"
          density="compact"
          hide-details
          class="flex-sm-0-0-auto"
          style="width: 100%; max-width: 170px"
          prepend-inner-icon="mdi-calendar"
        />
        <!-- Phase EO-F: Export menu (before Submit per header control order spec) -->
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-btn
              color="primary"
              variant="outlined"
              density="compact"
              prepend-icon="mdi-file-export"
              class="flex-sm-0-0-auto"
              v-bind="props"
            >
              <span class="d-none d-sm-inline">Export</span>
              <v-icon class="d-sm-none">mdi-file-export</v-icon>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item disabled>
              <template v-slot:prepend>
                <v-icon>mdi-file-pdf-box</v-icon>
              </template>
              <v-list-item-title>Export to PDF</v-list-item-title>
              <v-list-item-subtitle class="text-caption">Coming soon</v-list-item-subtitle>
            </v-list-item>
            <v-list-item disabled>
              <template v-slot:prepend>
                <v-icon>mdi-file-excel</v-icon>
              </template>
              <v-list-item-title>Export to Excel</v-list-item-title>
              <v-list-item-subtitle class="text-caption">Coming soon</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-menu>
        <!-- Phase EO-F: Submit / status button (rightmost position) -->
        <v-btn
          v-if="canSubmitAllPillars()"
          color="primary"
          variant="tonal"
          density="compact"
          :prepend-icon="currentQuarterlyReport?.publication_status === 'REJECTED' ? 'mdi-refresh' : 'mdi-send'"
          :loading="actionLoading"
          @click="submitAllPillarsForReview"
          class="flex-sm-0-0-auto"
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
          class="flex-sm-0-0-auto"
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
          class="flex-sm-0-0-auto"
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
          class="flex-sm-0-0-auto"
        >
          Approved
        </v-chip>
        <!-- Phase DW-C: "Add Fiscal Year" button moved to main university-operations page -->
      </div>
    </div>

    <!-- Phase EO-B: Consolidated hero bar — single authoritative quarterly status -->
    <v-sheet v-if="currentPillar" rounded="lg" class="mb-4 pa-3 d-flex align-center justify-space-between flex-wrap ga-2" color="grey-lighten-4">
      <div class="d-flex align-center ga-2">
        <v-icon :icon="currentPillar.icon" :color="currentPillar.color" size="small" />
        <span class="text-body-2 font-weight-medium">{{ currentPillar.fullName }}</span>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip size="x-small" variant="outlined" color="primary">
          {{ selectedQuarter }}
        </v-chip>
        <v-chip
          :color="getPublicationStatusColor(currentQuarterStatus as any)"
          size="x-small"
          variant="tonal"
          :prepend-icon="currentQuarterStatus === 'FETCH_ERROR' ? 'mdi-alert-circle' : undefined"
        >
          {{ currentQuarterStatus === 'NOT_STARTED' ? 'Not Started' : getPublicationStatusLabel(currentQuarterStatus as any) }}
        </v-chip>
      </div>
    </v-sheet>

    <!-- Phase EP-D: Retry banner — shown when quarterly report fetch failed -->
    <v-alert
      v-if="quarterlyReportFetchFailed"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center justify-space-between">
        <span class="text-body-2">
          Unable to load quarterly report status. Submit is disabled until the status is confirmed.
        </span>
        <v-btn
          variant="outlined"
          color="warning"
          size="small"
          prepend-icon="mdi-refresh"
          :loading="isLoadingQuarterlyReport"
          @click="fetchQuarterlyReport"
        >
          Retry
        </v-btn>
      </div>
    </v-alert>

    <!-- Phase EO-E: Rejection banner — reads from quarterly report status -->
    <v-alert
      v-if="currentQuarterlyReport && currentQuarterlyReport.publication_status === 'REJECTED'"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center ga-3">
        <v-chip color="error" variant="flat">Rejected</v-chip>
        <span class="text-body-2">
          {{ currentQuarterlyReport.review_notes || 'This quarterly report was rejected. Please revise and resubmit.' }}
        </span>
      </div>
    </v-alert>

    <!-- Phase GOV-C: Lock advisory with Request Update workflow — non-admin OR admin without unlock -->
    <v-alert
      v-if="!isSuperAdmin && currentQuarterlyReport && currentQuarterlyReport.publication_status === 'PUBLISHED' && !currentQuarterlyReport.unlocked_by"
      :type="currentQuarterlyReport.unlock_requested_by ? 'warning' : 'info'"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center ga-2">
        <v-icon size="small">{{ currentQuarterlyReport.unlock_requested_by ? 'mdi-clock-outline' : 'mdi-lock-outline' }}</v-icon>
        <span v-if="currentQuarterlyReport.unlock_requested_by" class="text-body-2">
          An unlock request has been submitted and is pending administrator review.
        </span>
        <span v-else class="text-body-2">
          This quarter's report has been published. Data entry is locked.
        </span>
        <v-spacer />
        <v-btn
          v-if="!currentQuarterlyReport.unlock_requested_by"
          size="small"
          variant="outlined"
          color="primary"
          @click="unlockRequestDialog = true"
        >
          <v-icon start size="small">mdi-lock-open-variant-outline</v-icon>
          Request Update
        </v-btn>
      </div>
    </v-alert>

    <!-- Phase GOV-C: Admin/SuperAdmin advisory when report is unlocked or SuperAdmin bypass -->
    <v-alert
      v-if="(isSuperAdmin || (isAdmin && currentQuarterlyReport?.unlocked_by)) && currentQuarterlyReport && currentQuarterlyReport.publication_status === 'PUBLISHED'"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      <div class="d-flex align-center ga-2">
        <v-icon size="small">mdi-shield-alert-outline</v-icon>
        <span class="text-body-2">
          This quarter's report is published. Editing data will automatically revert the report to Draft status, requiring re-submission.
        </span>
      </div>
    </v-alert>

    <!-- Phase DR-C: Pillar Tabs with Full Program Names -->
    <v-card class="mb-4">
      <v-tabs v-model="activePillar" bg-color="primary" show-arrows class="pillar-tabs">
        <v-tab v-for="pillar in PILLARS" :key="pillar.id" :value="pillar.id" class="pillar-tab">
          <v-icon start>{{ pillar.icon }}</v-icon>
          {{ pillar.fullName }}
        </v-tab>
      </v-tabs>
    </v-card>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article, table" />
    </v-card>

    <!-- Pillar Content -->
    <template v-else>
      <!-- Phase DC-E: Organizational Outcome Header -->
      <v-card class="mb-4" color="primary" variant="tonal">
        <v-card-text class="py-3">
          <div class="d-flex align-center ga-2">
            <v-chip color="primary" variant="flat" size="small">{{ currentOO.code }}</v-chip>
            <span class="text-body-2 font-weight-medium">{{ currentOO.description }}</span>
          </div>
        </v-card-text>
      </v-card>

      <!-- Phase EE-B: Consolidated Pillar Header (merged DR-E summary + publication status + action controls) -->
      <v-card class="mb-4" :color="currentPillar.color" variant="tonal">
        <v-card-text>
          <div class="d-flex align-center justify-space-between pillar-header-content">
            <!-- Left: Pillar identity -->
            <div>
              <div class="d-flex align-center ga-2 mb-2">
                <v-icon :icon="currentPillar.icon" size="large" />
                <h2 class="text-h5 font-weight-bold">{{ currentPillar.fullName }}</h2>
              </div>
              <p class="text-body-2 mb-0">
                <strong>UACS Code:</strong> {{ currentPillar.uacs }}
              </p>
            </div>
            <!-- Right: FY + Status + Indicator metrics -->
            <div class="d-flex flex-column align-end ga-2">
              <!-- Phase EO-D: FY chip only — publication status removed (canonical status in header row) -->
              <div class="d-flex ga-1 align-center">
                <v-chip color="primary" size="small">
                  FY {{ selectedFiscalYear }}
                </v-chip>
              </div>
              <!-- Row 2: Indicator count + Achievement rate -->
              <div v-if="pillarTaxonomy.length > 0" class="d-flex ga-1 flex-wrap justify-end">
                <v-chip size="x-small" variant="tonal" color="primary">
                  <v-icon start size="x-small">mdi-database-check</v-icon>
                  {{ pillarRateSummary.withData }}/{{ pillarRateSummary.total }} Indicators
                </v-chip>
                <v-chip size="x-small" variant="tonal"
                  :color="pillarRateSummary.ratePct === null ? 'grey'
                    : pillarRateSummary.ratePct >= 100 ? 'success'
                    : pillarRateSummary.ratePct >= 80 ? 'warning' : 'error'">
                  <v-icon start size="x-small">mdi-chart-line</v-icon>
                  {{ pillarRateSummary.ratePct !== null ? `${pillarRateSummary.ratePct.toFixed(1)}%` : 'No data' }}
                </v-chip>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Phase DX-C: Collapsible quarterly reporting guidance -->
      <v-expansion-panels variant="accordion" class="mb-4">
        <v-expansion-panel>
          <v-expansion-panel-title class="text-body-2">
            <v-icon start size="small" color="info">mdi-information-outline</v-icon>
            Quarterly Reporting Guide
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="text-body-2">
              <p class="mb-2">
                <strong>How It Works:</strong> Each quarter (Q1–Q4) stores your data as an independent record for that reporting period. When you select a quarter and save, only that quarter's record is affected — other quarters remain untouched.
              </p>
              <p class="mb-2">
                <strong>Entering Data:</strong> 1) Select your reporting period using the Quarter dropdown. 2) Click any indicator row to open the data entry form. 3) Enter Target, Actual, and Score values for all four quarters — you can edit any column freely. 4) Click Save. Your data is saved to the selected quarter's record only.
              </p>
              <p class="mb-2">
                <strong>Prior-Quarter Reference:</strong> When you open an indicator in a new quarter with no existing data, the system automatically fills in values from the previous quarter as a starting point. You can edit these values before saving — they will not affect the previous quarter's record.
              </p>
              <p class="mb-2">
                <strong>Quarter Schedule:</strong> Q1 (Jan–Mar) · Q2 (Apr–Jun) · Q3 (Jul–Sep) · Q4 (Oct–Dec)
              </p>
              <p class="mb-0">
                <strong>Submission &amp; Review:</strong> Once all indicators are complete for a quarter, submit for review using the Submit button. Your data goes through: Draft → Pending Review → Published. Published quarters are locked for editing unless unlocked by an administrator.
              </p>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- Outcome Indicators -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center bg-blue-grey-lighten-5">
          <v-icon start color="primary">mdi-target</v-icon>
          Outcome Indicators
          <v-chip size="small" class="ml-2" color="primary" variant="tonal">
            {{ outcomeIndicators.length }}
          </v-chip>
        </v-card-title>
        <v-divider />

        <!-- Phase EG-B: Score columns removed from overview table (accessible via entry dialog) -->
        <div v-if="outcomeIndicators.length > 0" class="responsive-table-wrapper">
          <v-table density="compact">
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left indicator-column" rowspan="2">Indicator</th>
                <th v-for="q in QUARTERS" :key="q" colspan="2" class="text-center qgroup-header border-right-q" :class="{ 'q-active-group': q === selectedQuarter }">{{ q }}</th>
                <th class="variance-column" rowspan="2">Variance</th>
                <th class="rate-column" rowspan="2">Rate</th>
                <th v-if="canEditData()" class="action-column" rowspan="2"></th>
              </tr>
              <tr class="bg-grey-lighten-5">
                <template v-for="q in QUARTERS" :key="q + '-sub'">
                  <th class="text-center qsub-col" :class="qCellClass(q)">Target</th>
                  <th class="text-center qsub-col border-right-q" :class="qCellClass(q)">Actual</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="indicator in outcomeIndicators"
                :key="indicator.id"
                class="cursor-pointer"
                @click="canEditData() && openEntryDialog(indicator)"
              >
                <td class="indicator-cell">
                  <div class="d-flex align-start ga-2">
                    <v-tooltip location="top">
                      <template #activator="{ props }">
                        <v-chip
                          v-bind="props"
                          :color="getUnitConfig(indicator.unit_type).color"
                          size="x-small"
                          variant="tonal"
                          class="mt-1 flex-shrink-0 unit-type-chip"
                        >
                          <v-icon start size="x-small">{{ getUnitConfig(indicator.unit_type).icon }}</v-icon>
                          {{ getUnitConfig(indicator.unit_type).label }}
                        </v-chip>
                      </template>
                      {{ getUnitConfig(indicator.unit_type).title }}
                    </v-tooltip>
                    <div>
                      <v-tooltip location="top" max-width="400">
                        <template #activator="{ props }">
                          <div v-bind="props" class="font-weight-medium indicator-text">{{ indicator.indicator_name }}</div>
                        </template>
                        <span style="white-space: pre-line">{{ indicator.indicator_name }}</span>
                      </v-tooltip>
                      <v-tooltip location="bottom">
                        <template #activator="{ props }">
                          <div v-bind="props" class="text-caption text-grey uacs-code">{{ indicator.indicator_code }}</div>
                        </template>
                        <span>UACS Code: {{ indicator.indicator_code }}</span>
                      </v-tooltip>
                    </div>
                  </div>
                </td>
                <template v-if="getIndicatorData(indicator.id)">
                  <!-- Phase DW-D: Always render all 12 quarter cells with highlight -->
                  <template v-for="q in QUARTERS" :key="q + '-data'">
                    <td class="text-center qsub-cell" :class="qCellClass(q)">{{ formatNumber(getIndicatorData(indicator.id)?.[`target_${q.toLowerCase()}`]) }}{{ getUnitConfig(indicator.unit_type).suffix }}</td>
                    <td class="text-center qsub-cell text-success border-right-q" :class="qCellClass(q)">{{ formatNumber(getIndicatorData(indicator.id)?.[`accomplishment_${q.toLowerCase()}`]) }}{{ getUnitConfig(indicator.unit_type).suffix }}</td>
                  </template>
                  <td class="text-right">
                    <v-chip
                      size="x-small"
                      :color="getVarianceColor(getIndicatorData(indicator.id)?.variance)"
                      variant="tonal"
                    >
                      {{ formatNumber(getIndicatorData(indicator.id)?.variance) }}
                    </v-chip>
                  </td>
                  <td class="text-right">
                    <v-chip
                      size="x-small"
                      :color="getRateColor(getIndicatorData(indicator.id)?.accomplishment_rate)"
                      variant="tonal"
                    >
                      {{ formatPercent(getIndicatorData(indicator.id)?.accomplishment_rate) }}
                    </v-chip>
                  </td>
                </template>
                <td v-else colspan="10" class="text-center">
                  <div class="no-data-hint pa-2">
                    <v-icon size="small" color="grey" class="mr-1">mdi-pencil-plus-outline</v-icon>
                    <span class="text-grey">Click row to enter quarterly data</span>
                  </div>
                </td>
                <td v-if="canEditData()" class="text-center">
                  <v-btn icon="mdi-pencil" variant="text" size="x-small" @click.stop="openEntryDialog(indicator)" />
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Phase FJ-3: Prefill availability notice for outcome indicators -->
          <div v-if="outcomeIndicators.some(ind => hasPrefillAvailable(ind.id))" class="text-caption text-grey px-4 pb-2">
            <v-icon size="x-small" color="info" class="mr-1">mdi-information-outline</v-icon>
            {{ PRIOR_QUARTER_MAP[selectedQuarter] }} data available for some indicators — click a row to pre-fill {{ selectedQuarter }} values.
          </div>
        </div>

        <v-card-text v-else class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1" class="mb-3">mdi-target</v-icon>
          <div class="text-h6 text-grey-darken-1">No Outcome Indicators</div>
          <div class="text-body-2 text-grey mt-1">
            Outcome indicators for {{ currentPillar.name }} have not been configured in the taxonomy.
          </div>
        </v-card-text>
      </v-card>

      <!-- Output Indicators -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center bg-blue-grey-lighten-5">
          <v-icon start color="success">mdi-chart-box</v-icon>
          Output Indicators
          <v-chip size="small" class="ml-2" color="success" variant="tonal">
            {{ outputIndicators.length }}
          </v-chip>
        </v-card-title>
        <v-divider />

        <!-- Phase DW-C: Always render all 4 quarter groups; highlight selected -->
        <div v-if="outputIndicators.length > 0" class="responsive-table-wrapper">
          <v-table density="compact">
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left indicator-column" rowspan="2">Indicator</th>
                <th v-for="q in QUARTERS" :key="q" colspan="2" class="text-center qgroup-header border-right-q" :class="{ 'q-active-group': q === selectedQuarter }">{{ q }}</th>
                <th class="variance-column" rowspan="2">Variance</th>
                <th class="rate-column" rowspan="2">Rate</th>
                <th v-if="canEditData()" class="action-column" rowspan="2"></th>
              </tr>
              <tr class="bg-grey-lighten-5">
                <template v-for="q in QUARTERS" :key="q + '-sub'">
                  <th class="text-center qsub-col" :class="qCellClass(q)">Target</th>
                  <th class="text-center qsub-col border-right-q" :class="qCellClass(q)">Actual</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="indicator in outputIndicators"
                :key="indicator.id"
                class="cursor-pointer"
                @click="canEditData() && openEntryDialog(indicator)"
              >
                <td class="indicator-cell">
                  <div class="d-flex align-start ga-2">
                    <v-tooltip location="top">
                      <template #activator="{ props }">
                        <v-chip
                          v-bind="props"
                          :color="getUnitConfig(indicator.unit_type).color"
                          size="x-small"
                          variant="tonal"
                          class="mt-1 flex-shrink-0 unit-type-chip"
                        >
                          <v-icon start size="x-small">{{ getUnitConfig(indicator.unit_type).icon }}</v-icon>
                          {{ getUnitConfig(indicator.unit_type).label }}
                        </v-chip>
                      </template>
                      {{ getUnitConfig(indicator.unit_type).title }}
                    </v-tooltip>
                    <div>
                      <v-tooltip location="top" max-width="400">
                        <template #activator="{ props }">
                          <div v-bind="props" class="font-weight-medium indicator-text">{{ indicator.indicator_name }}</div>
                        </template>
                        <span style="white-space: pre-line">{{ indicator.indicator_name }}</span>
                      </v-tooltip>
                      <v-tooltip location="bottom">
                        <template #activator="{ props }">
                          <div v-bind="props" class="text-caption text-grey uacs-code">{{ indicator.indicator_code }}</div>
                        </template>
                        <span>UACS Code: {{ indicator.indicator_code }}</span>
                      </v-tooltip>
                    </div>
                  </div>
                </td>
                <template v-if="getIndicatorData(indicator.id)">
                  <!-- Phase DW-D: Always render all 8 quarter cells with highlight -->
                  <template v-for="q in QUARTERS" :key="q + '-data'">
                    <td class="text-center qsub-cell" :class="qCellClass(q)">{{ formatNumber(getIndicatorData(indicator.id)?.[`target_${q.toLowerCase()}`]) }}{{ getUnitConfig(indicator.unit_type).suffix }}</td>
                    <td class="text-center qsub-cell text-success border-right-q" :class="qCellClass(q)">{{ formatNumber(getIndicatorData(indicator.id)?.[`accomplishment_${q.toLowerCase()}`]) }}{{ getUnitConfig(indicator.unit_type).suffix }}</td>
                  </template>
                  <td class="text-right">
                    <v-chip
                      size="x-small"
                      :color="getVarianceColor(getIndicatorData(indicator.id)?.variance)"
                      variant="tonal"
                    >
                      {{ formatNumber(getIndicatorData(indicator.id)?.variance) }}
                    </v-chip>
                  </td>
                  <td class="text-right">
                    <v-chip
                      size="x-small"
                      :color="getRateColor(getIndicatorData(indicator.id)?.accomplishment_rate)"
                      variant="tonal"
                    >
                      {{ formatPercent(getIndicatorData(indicator.id)?.accomplishment_rate) }}
                    </v-chip>
                  </td>
                </template>
                <td v-else colspan="10" class="text-center">
                  <div class="no-data-hint pa-2">
                    <v-icon size="small" color="grey" class="mr-1">mdi-pencil-plus-outline</v-icon>
                    <span class="text-grey">Click row to enter quarterly data</span>
                  </div>
                </td>
                <td v-if="canEditData()" class="text-center">
                  <v-btn icon="mdi-pencil" variant="text" size="x-small" @click.stop="openEntryDialog(indicator)" />
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Phase FJ-3: Prefill availability notice for output indicators -->
          <div v-if="outputIndicators.some(ind => hasPrefillAvailable(ind.id))" class="text-caption text-grey px-4 pb-2">
            <v-icon size="x-small" color="info" class="mr-1">mdi-information-outline</v-icon>
            {{ PRIOR_QUARTER_MAP[selectedQuarter] }} data available for some indicators — click a row to pre-fill {{ selectedQuarter }} values.
          </div>
        </div>

        <v-card-text v-else class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1" class="mb-3">mdi-chart-box</v-icon>
          <div class="text-h6 text-grey-darken-1">No Output Indicators</div>
          <div class="text-body-2 text-grey mt-1">
            Output indicators for {{ currentPillar.name }} have not been configured in the taxonomy.
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- Phase DW-C: Fiscal Year Creation Dialog moved to main university-operations page -->

    <!-- Phase DU-A: Quarterly Data Entry Dialog — Vertical Quarter-Row Table -->
    <v-dialog v-model="entryDialog" max-width="700" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start>mdi-table-edit</v-icon>
          Enter Quarterly Data
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="entryDialog = false" />
        </v-card-title>

        <v-divider />

        <!-- Phase GOV-C: Advisory when editing an unlocked post-publication report -->
        <v-alert
          v-if="currentQuarterlyReport?.unlocked_by"
          type="warning"
          variant="tonal"
          class="mx-4 mt-4"
          density="compact"
        >
          <div class="d-flex align-center ga-2">
            <v-icon size="small">mdi-alert-outline</v-icon>
            <span class="text-body-2">
              This quarterly report has already been published and may have been submitted to external agencies such as DBM.
              Any modification will require re-validation and re-submission for review.
            </span>
          </div>
        </v-alert>

        <v-card-text class="pa-4">
          <!-- Indicator Info -->
          <v-alert type="info" variant="tonal" class="mb-4" density="compact">
            <div class="font-weight-medium">{{ selectedIndicator?.indicator_name }}</div>
            <div class="text-caption">
              Unit Type: {{ selectedIndicator?.unit_type }} | UACS: {{ selectedIndicator?.uacs_code }} | FY {{ selectedFiscalYear }}
            </div>
          </v-alert>

          <!-- Phase FJ-2: Advisory notice when prior-quarter prefill occurred -->
          <v-alert v-if="wasPrefilled" type="info" variant="tonal" class="mb-4" density="compact" closable>
            <v-icon start size="small">mdi-content-copy</v-icon>
            All values pre-filled from <strong>{{ prefillSourceQ }}</strong> record — edit freely. This will create a new {{ selectedQuarter }} record.
          </v-alert>

          <!-- Phase DU-A: Vertical tabular data entry — rows = quarters, cols = T/A/S -->
          <v-table density="compact" class="mb-4">
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="q-label-cell">Quarter</th>
                <th class="text-center">Target</th>
                <th class="text-center">Actual</th>
                <th class="text-center">Score (optional)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Phase FL-1: All quarter fields are fully editable — record isolation at DB level -->
              <!-- Q1 -->
              <tr>
                <td class="q-label-cell">
                  <v-chip size="small" color="blue" variant="tonal" class="font-weight-bold">Q1</v-chip>
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.target_q1" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.accomplishment_q1" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model="entryForm.score_q1" placeholder="e.g. 148/200"
                    density="compact" variant="outlined" hide-details />
                </td>
              </tr>
              <!-- Q2 -->
              <tr>
                <td class="q-label-cell">
                  <v-chip size="small" color="teal" variant="tonal" class="font-weight-bold">Q2</v-chip>
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.target_q2" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.accomplishment_q2" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model="entryForm.score_q2" placeholder="e.g. 148/200"
                    density="compact" variant="outlined" hide-details />
                </td>
              </tr>
              <!-- Q3 -->
              <tr>
                <td class="q-label-cell">
                  <v-chip size="small" color="orange" variant="tonal" class="font-weight-bold">Q3</v-chip>
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.target_q3" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.accomplishment_q3" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model="entryForm.score_q3" placeholder="e.g. 148/200"
                    density="compact" variant="outlined" hide-details />
                </td>
              </tr>
              <!-- Q4 -->
              <tr>
                <td class="q-label-cell">
                  <v-chip size="small" color="deep-purple" variant="tonal" class="font-weight-bold">Q4</v-chip>
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.target_q4" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model.number="entryForm.accomplishment_q4" type="number" step="0.01" min="0"
                    density="compact" variant="outlined" hide-details />
                </td>
                <td class="du-input-cell">
                  <v-text-field v-model="entryForm.score_q4" placeholder="e.g. 148/200"
                    density="compact" variant="outlined" hide-details />
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Remarks -->
          <v-textarea
            v-model="entryForm.remarks"
            label="Remarks"
            rows="2"
            variant="outlined"
            density="compact"
            class="mb-3"
          />

          <!-- Annual Totals (Read-Only) -->
          <v-card variant="outlined" class="bg-grey-lighten-4">
            <v-card-text class="py-2">
              <div class="text-subtitle-2 mb-1">
                <v-icon start size="small">mdi-calculator</v-icon>
                Annual Totals (Read-Only)
              </div>
              <div class="d-flex ga-4 flex-wrap mb-3">
                <v-chip variant="tonal" size="small">
                  Total Target: {{ formatNumber(computedPreview.totalTarget) }}
                </v-chip>
                <v-chip variant="tonal" size="small">
                  Total Actual: {{ formatNumber(computedPreview.totalActual) }}
                </v-chip>
                <v-chip
                  :color="getVarianceColor(computedPreview.variance)"
                  variant="tonal"
                  size="small"
                >
                  Variance: {{ computedPreview.variance !== null ? formatNumber(computedPreview.variance) : '—' }}
                </v-chip>
                <v-chip
                  :color="getRateColor(computedPreview.rate)"
                  variant="tonal"
                  size="small"
                >
                  Rate: {{ computedPreview.rate !== null ? formatPercent(computedPreview.rate) : '—' }}
                </v-chip>
                <!-- Phase FY-2: Override active badge -->
                <v-chip v-if="entryForm.override_rate !== null && entryForm.override_rate !== ''" color="warning" variant="tonal" size="small">
                  <v-icon start size="x-small">mdi-pencil-circle</v-icon>
                  Override Applied: {{ entryForm.override_rate }}%
                </v-chip>
              </div>
              <!-- Phase FY-2: Optional rate override input (Directive 213) -->
              <v-text-field
                v-model.number="entryForm.override_rate"
                label="Override Rate (%) — Optional"
                type="number"
                variant="outlined"
                density="compact"
                :min="0"
                :max="9999.99"
                clearable
                hide-details="auto"
                hint="Leave blank to use auto-calculated rate. Override does not affect Target or Actual values."
                persistent-hint
                class="mt-1"
                style="max-width: 280px;"
                @click:clear="entryForm.override_rate = null"
              />
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-btn variant="text" @click="entryDialog = false">Cancel</v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            :loading="saving"
            @click="saveQuarterlyData"
          >
            <v-icon start>mdi-content-save</v-icon>
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Phase GOV-UI: Published Report Governance Warning Dialog (Admin) -->
    <v-dialog v-model="publishedEditWarningDialog" max-width="520" persistent>
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="warning">mdi-shield-alert-outline</v-icon>
          Published Report — Governance Warning
        </v-card-title>
        <v-card-text>
          <p class="text-body-1 mb-3">
            This quarterly report has already been published and may have been submitted
            to external agencies such as DBM.
          </p>
          <p class="text-body-1 font-weight-medium">
            Updating this report will automatically revert it to Draft status,
            requiring re-submission for review.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="publishedEditWarningDialog = false; pendingEditIndicator = null">
            Cancel
          </v-btn>
          <v-btn color="warning" variant="flat" @click="confirmPublishedEdit">
            Proceed with Edit
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Phase GOV-UI: Unlock Request Dialog (Non-Admin) -->
    <v-dialog v-model="unlockRequestDialog" max-width="520" persistent>
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-lock-open-variant-outline</v-icon>
          Request Update Authorization
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">
            Provide a reason for requesting modification of this published report.
            Your request will be reviewed by an administrator.
          </p>
          <v-textarea
            v-model="unlockRequestReason"
            label="Reason for update request"
            rows="3"
            variant="outlined"
            :rules="[(v: string) => !!v?.trim() || 'Reason is required']"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="unlockRequestDialog = false; unlockRequestReason = ''">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="unlockRequestLoading"
            :disabled="!unlockRequestReason.trim()"
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
  background-color: rgba(0, 0, 0, 0.04);
}

/* Phase DE-E: Responsive table enhancements */
.responsive-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.v-table thead tr th {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: #f5f5f5;
}

/* Phase DS-D: Multiline indicator text with preserved line breaks per BAR1 standard
 * Indicators must display complete descriptions without truncation
 * Text wrapping is enabled to accommodate long indicator names with sub-items
 * white-space: pre-line preserves explicit newlines while collapsing other whitespace
 */
.indicator-text {
  white-space: pre-line;  /* Preserve newlines, wrap normally */
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 5;
  max-width: none;
  /* Phase EE-F: Line-clamp to 3 lines — full text readable via tooltip on hover */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Phase DS-B: Fixed width unit type chip for consistent alignment */
.unit-type-chip {
  min-width: 52px;
  max-width: 52px;
  justify-content: center;
}

.unit-type-chip .v-chip__content {
  justify-content: center;
  gap: 2px;
}

/* Phase DS-E: Responsive indicator text sizing with preserved line breaks */
@media (max-width: 960px) {
  .indicator-text {
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .unit-type-chip {
    min-width: 48px;
    max-width: 48px;
  }
}

@media (max-width: 600px) {
  .indicator-text {
    font-size: 0.85rem;
    line-height: 1.45;
  }

  .unit-type-chip {
    min-width: 44px;
    max-width: 44px;
    font-size: 0.65rem;
  }
}

/* Phase DR-F: Flexible indicator column for full BAR1 text display */
.indicator-column {
  min-width: 320px;  /* Increased from 280px for longer indicators with sub-items */
  width: auto;
}

.indicator-cell {
  min-width: 320px;  /* Increased from 280px */
  padding: 14px 16px !important;  /* Increased vertical padding */
  vertical-align: top;
}

/* Phase DR-A: Consistent row vertical alignment for wrapped indicator text */
/* All non-indicator cells align to top to match indicator cell behavior */
.v-table th:not(.indicator-column),
.v-table td:not(.indicator-cell) {
  white-space: nowrap;
  min-width: auto;
  vertical-align: top;  /* Match indicator cell alignment */
}

/* Ensure consistent cell padding across all columns */
.v-table tbody tr td {
  padding-top: 12px !important;
  padding-bottom: 12px !important;
}

/* Phase DR-B: Fixed column widths for data consistency */
.quarter-column {
  width: 90px;
  min-width: 90px;
  max-width: 90px;
  text-align: center;
  vertical-align: top;
}

.variance-column {
  width: 80px;
  min-width: 80px;
  text-align: right;
  vertical-align: top;
}

.rate-column {
  width: 80px;
  min-width: 80px;
  text-align: right;
  vertical-align: top;
}

.action-column {
  width: 60px;
  min-width: 60px;
  text-align: center;
  vertical-align: top;
}

/* Computed fields shading */
.computed-field {
  background-color: rgba(0, 0, 0, 0.03);
}

/* Mobile-friendly pillar header */
@media (max-width: 600px) {
  .pillar-header-content {
    flex-direction: column;
    align-items: flex-start !important;
  }

  .pillar-header-content .text-right {
    text-align: left !important;
    margin-top: 8px;
  }
}

/* Mobile table improvements */
@media (max-width: 768px) {
  .v-table td,
  .v-table th {
    padding: 6px 8px !important;
    font-size: 0.8rem;
  }

  .v-table .text-caption {
    font-size: 0.7rem !important;
  }
}

/* Phase DH: UACS code styling */
.uacs-code {
  cursor: help;
  border-bottom: 1px dotted #9e9e9e;
  display: inline-block;
}

/* Phase DH: No data hint styling */
.no-data-hint {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.no-data-hint:hover {
  background-color: rgba(25, 118, 210, 0.08);
}

/* Phase DR-C: Tab label styling for full program names */
.pillar-tabs .pillar-tab {
  text-transform: none;  /* Preserve original case */
  letter-spacing: normal;
  font-weight: 500;
}

/* Mobile: Adjust tab text for narrower viewports */
@media (max-width: 960px) {
  .pillar-tabs .pillar-tab {
    font-size: 0.8rem;
    padding: 0 12px;
    min-width: auto;
  }
}

@media (max-width: 600px) {
  .pillar-tabs .pillar-tab {
    font-size: 0.75rem;
    padding: 0 8px;
  }

  .pillar-tabs .pillar-tab .v-icon {
    margin-right: 4px;
    font-size: 16px;
  }
}

/* Phase DU-B: Expanded ALL-mode quarterly sub-columns */
.qgroup-header {
  font-weight: 600;
  font-size: 0.8rem;
}
.qsub-col {
  min-width: 68px;
  width: 68px;
  font-size: 0.75rem;
}
.qsub-col-score {
  min-width: 80px;
  width: 80px;
  font-size: 0.75rem;
}
.qsub-cell {
  min-width: 68px;
  font-size: 0.8rem;
}
.qsub-cell-score {
  min-width: 80px;
  font-size: 0.8rem;
}
.border-right-q {
  border-right: 1px solid rgba(0,0,0,0.1) !important;
}

/* Phase DU-A: Dialog vertical table */
.q-label-cell {
  width: 60px;
  text-align: center;
  vertical-align: middle;
}
.du-input-cell {
  padding: 8px 6px !important;
  vertical-align: middle;
}

/* Phase DW-E: Quarter highlight classes */
.q-active-cell {
  background-color: rgba(var(--v-theme-primary), 0.06) !important;
  font-weight: 600;
}
.q-active-group {
  background-color: rgba(var(--v-theme-primary), 0.10) !important;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}
.q-dimmed-cell {
  opacity: 0.7;   /* Phase DX-A: raised from 0.45 to prevent "disabled" misperception */
}
</style>
