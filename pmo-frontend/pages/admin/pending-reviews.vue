<script setup lang="ts">
/**
 * Pending Reviews Dashboard - Admin-only page
 *
 * Displays all records pending review across modules.
 * Filtered by admin's module assignments.
 * SuperAdmin sees all pending items.
 */

definePageMeta({
  middleware: ['auth'],
})

const api = useApi()
const router = useRouter()
const toast = useToast()
const { isAdmin, isSuperAdmin, canApprove } = usePermissions()

// PHASE BBCH (Track 1, R-372): the review queue is reachable by anyone with approval authority —
// Admin/SuperAdmin (Layer 1) OR an Approver/Manager module level (Layer 3) in a reviewable
// project module (coi/repairs). Per-item actions remain individually gated by canReviewItem(item).
//
// University Operations is deliberately EXCLUDED from the module-level branch: UO approval
// authority is Admin/SuperAdmin only (access-[id].vue no longer offers Approver/Manager on
// any university_operations* key), because one approve/reject action publishes the shared
// FY+quarter report across every pillar at once — not a per-project decision a delegated
// Approver should make. isAdmin/isSuperAdmin below still cover UO reviewers; they just aren't
// reached via a module-level grant.
const canReviewAny = computed(
  () =>
    isAdmin.value ||
    isSuperAdmin.value ||
    canApprove('coi') ||
    canApprove('repairs'),
)

// Per-item reviewer check — see canReviewAny for why university_operations bypasses
// canApprove() (module-level) entirely and requires the system role directly.
function canReviewItem(item: PendingItem): boolean {
  if (item.module === 'university_operations') return isAdmin.value || isSuperAdmin.value
  return canApprove(item.module)
}

// Redirect users without any approval authority
onMounted(() => {
  if (!canReviewAny.value) {
    toast.error('Access denied. Approval authority required.')
    router.push('/dashboard')
  }
})

interface PendingItem {
  id: string
  title: string
  project_code?: string
  campus?: string
  publication_status: string
  submitted_by: string
  submitted_at: string
  created_at: string
  submitter_name: string
  module: 'coi' | 'repairs' | 'university_operations'
  // Phase EM-E: Distinguish quarterly reports from legacy per-pillar entries
  // Phase GOV-UI: 'unlock_request' for pending unlock requests
  source?: 'quarterly_report' | 'legacy' | 'unlock_request'
  // Phase GOV-UI: Unlock request metadata
  unlock_request_reason?: string
  unlock_requested_at?: string
}

// Phase GOV-D: Versioned submission history items
interface ArchivedItem {
  id: string
  quarterly_report_id: string
  fiscal_year: number
  quarter: string
  title: string
  version: number
  event_type: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVERTED' | 'UNLOCKED'
  current_status: string
  submitter_name?: string
  submitted_at?: string
  reviewed_by_name?: string
  reviewed_at?: string
  review_notes?: string
  actioned_by_name: string
  actioned_at: string
  reason?: string
  module: 'university_operations'
}

const loading = ref(true)
const pendingItems = ref<PendingItem[]>([])
const archivedItems = ref<ArchivedItem[]>([])
const activeTab = ref('all')

// Action states
const actionLoading = ref<string | null>(null)
const rejectDialog = ref(false)
const itemToReject = ref<PendingItem | null>(null)
const rejectNotes = ref('')
const rejecting = ref(false)

// Phase EN-D: Multi-select batch actions
const selectedItems = ref<PendingItem[]>([])
const batchLoading = ref<'approve' | 'reject' | null>(null)

// Module-level scoping: batch approve/reject only offered when every selected item's
// module is within the reviewer's approval authority (Approver/Manager for coi/repairs;
// Admin/SuperAdmin only for university_operations — see canReviewItem). Mixed selections
// spanning an unauthorized module default-deny the whole batch action.
const canActOnSelection = computed(
  () => selectedItems.value.length > 0 && selectedItems.value.every(i => canReviewItem(i))
)
const batchRejectDialog = ref(false)
const batchRejectNotes = ref('')

// Module labels
const moduleLabels: Record<string, string> = {
  coi: 'Infrastructure (COI)',
  repairs: 'Repair Projects',
  university_operations: 'University Operations',
}

// Module colors
const moduleColors: Record<string, string> = {
  coi: 'blue',
  repairs: 'orange',
  university_operations: 'purple',
}

// Phase EZ-B: Dynamic module label based on actual content flags from backend
function getModuleLabel(item: any): string {
  if (item.has_physical && item.has_financial) return '(Physical & Financial)'
  if (item.has_physical) return '(Physical)'
  if (item.has_financial) return '(Financial)'
  return '(Physical & Financial)' // fallback for items without flags
}

// API endpoints by module
const moduleEndpoints: Record<string, string> = {
  coi: '/api/construction-projects',
  repairs: '/api/repair-projects',
  university_operations: '/api/university-operations',
}

// Fetch pending reviews from all modules
async function fetchPendingItems() {
  loading.value = true
  pendingItems.value = []

  try {
    // Phase EM-E: Fetch quarterly reports for University Operations instead of per-pillar entries
    // Phase GOV-UI: Also fetch pending unlock requests
    // Phase GOV-D: Fetch versioned submission history for archive
    const [coiPending, repairsPending, quarterlyPending, unlockPending, historyItems] = await Promise.all([
      api.get<any[]>('/api/construction-projects/pending-review').catch(() => []),
      api.get<any[]>('/api/repair-projects/pending-review').catch(() => []),
      api.get<any[]>('/api/university-operations/quarterly-reports/pending-review').catch(() => []),
      api.get<any[]>('/api/university-operations/quarterly-reports/pending-unlock').catch(() => []),
      api.get<any[]>('/api/university-operations/quarterly-reports/submission-history').catch(() => []),
    ])

    // Phase EM-E: Quarter display names
    const quarterNames: Record<string, string> = {
      Q1: 'Quarter 1 (Jan–Mar)',
      Q2: 'Quarter 2 (Apr–Jun)',
      Q3: 'Quarter 3 (Jul–Sep)',
      Q4: 'Quarter 4 (Oct–Dec)',
    }

    // Combine and normalize
    const combined: PendingItem[] = [
      ...coiPending.map(d => ({
        ...d,
        module: 'coi' as const,
        source: 'legacy' as const,
        title: d.title || d.project_code || 'Untitled',
      })),
      ...repairsPending.map(d => ({
        ...d,
        module: 'repairs' as const,
        source: 'legacy' as const,
        title: d.title || 'Untitled',
      })),
      // Phase EZ-B: Dynamic submission labels based on actual content
      ...quarterlyPending.map(d => ({
        ...d,
        module: 'university_operations' as const,
        source: 'quarterly_report' as const,
        title: `UO Quarterly Report — ${d.quarter} FY ${d.fiscal_year} ${getModuleLabel(d)}`,
      })),
      // Phase EZ-B: Unlock requests with dynamic labels
      ...unlockPending.map(d => ({
        ...d,
        module: 'university_operations' as const,
        source: 'unlock_request' as const,
        title: `Unlock Request: UO ${d.quarter} FY ${d.fiscal_year} ${getModuleLabel(d)}`,
        submitter_name: d.requester_name || 'Unknown',
        submitted_at: d.unlock_requested_at,
        unlock_request_reason: d.unlock_request_reason,
        unlock_requested_at: d.unlock_requested_at,
      })),
    ]

    // Sort by submitted_at ascending (oldest first - FIFO review)
    pendingItems.value = combined.sort((a, b) =>
      new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    )

    // Phase GOV-D: Populate archived items from versioned submission history
    // Phase EZ-B: Archived items with dynamic module labels
    archivedItems.value = historyItems.map(d => ({
      ...d,
      module: 'university_operations' as const,
      title: `UO Quarterly Report — ${d.quarter} FY ${d.fiscal_year} (Physical & Financial)`,
    }))
  } catch (err) {
    console.error('[PendingReviews] Failed to fetch:', err)
    toast.error('Failed to load pending reviews')
  } finally {
    loading.value = false
  }
}

// Filtered items based on active tab
const filteredItems = computed(() => {
  if (activeTab.value === 'all') return pendingItems.value
  return pendingItems.value.filter(item => item.module === activeTab.value)
})

// Tab counts
const tabCounts = computed(() => ({
  all: pendingItems.value.length,
  coi: pendingItems.value.filter(i => i.module === 'coi').length,
  repairs: pendingItems.value.filter(i => i.module === 'repairs').length,
  university_operations: pendingItems.value.filter(i => i.module === 'university_operations').length,
}))

// Phase GOV-C: Filtered archived items based on active tab
const filteredArchivedItems = computed(() => {
  if (activeTab.value === 'all') return archivedItems.value
  if (activeTab.value === 'university_operations') return archivedItems.value
  return [] // Only university_operations has archived items for now
})

// Format date
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Phase GOV-D: Event type color mapping for submission history
function eventTypeColor(eventType: string): string {
  const colors: Record<string, string> = {
    SUBMITTED: 'blue',
    APPROVED: 'success',
    REJECTED: 'error',
    REVERTED: 'orange',
    UNLOCKED: 'purple',
  }
  return colors[eventType] || 'grey'
}

// Navigate to view item
function viewItem(item: PendingItem) {
  // Phase EM-E: Quarterly reports navigate to physical page with FY+quarter context
  if (item.source === 'quarterly_report') {
    const qr = item as any
    router.push({
      path: '/university-operations/physical',
      query: { year: qr.fiscal_year?.toString() },
    })
    return
  }
  const routes: Record<string, string> = {
    coi: `/coi/detail-${item.id}`,
    repairs: `/repairs/detail-${item.id}`,
    university_operations: `/university-operations/detail-${item.id}`,
  }
  router.push(routes[item.module])
}

// Approve item
async function approveItem(item: PendingItem) {
  // Check approval authority
  if (!canReviewItem(item)) {
    toast.error('You are not authorized to approve items in this module')
    return
  }

  actionLoading.value = item.id
  try {
    // Phase EM-E: Quarterly reports use dedicated approve endpoint
    const endpoint = item.source === 'quarterly_report'
      ? `/api/university-operations/quarterly-reports/${item.id}/approve`
      : `${moduleEndpoints[item.module]}/${item.id}/publish`
    await api.post(endpoint, {})
    toast.success(`"${item.title}" published successfully`)
    await fetchPendingItems()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to approve')
  } finally {
    actionLoading.value = null
  }
}

// Open reject dialog
function openRejectDialog(item: PendingItem) {
  // Check approval authority
  if (!canReviewItem(item)) {
    toast.error('You are not authorized to reject items in this module')
    return
  }

  itemToReject.value = item
  rejectNotes.value = ''
  rejectDialog.value = true
}

// Reject item
async function rejectItem() {
  if (!itemToReject.value) return
  rejecting.value = true
  try {
    // Phase EM-E: Quarterly reports use dedicated reject endpoint
    const endpoint = itemToReject.value.source === 'quarterly_report'
      ? `/api/university-operations/quarterly-reports/${itemToReject.value.id}/reject`
      : `${moduleEndpoints[itemToReject.value.module]}/${itemToReject.value.id}/reject`
    await api.post(endpoint, {
      notes: rejectNotes.value || 'Rejected by administrator',
    })
    toast.success(`"${itemToReject.value.title}" rejected`)
    rejectDialog.value = false
    await fetchPendingItems()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to reject')
  } finally {
    rejecting.value = false
    itemToReject.value = null
    rejectNotes.value = ''
  }
}

// Phase EN-D: Batch approve selected items
async function approveSelected() {
  // Phase GOV-C: Exclude unlock_request items from batch actions
  // Re-check authority here too — the toolbar button only shows when canActOnSelection
  // is true, but selection can change between render and click.
  const batchItems = selectedItems.value.filter(
    i => i.source !== 'unlock_request' && canReviewItem(i)
  )
  if (batchItems.length === 0) {
    toast.warning('Unlock requests must be handled individually')
    return
  }
  batchLoading.value = 'approve'
  let successCount = 0
  let failCount = 0
  for (const item of batchItems) {
    try {
      const endpoint = item.source === 'quarterly_report'
        ? `/api/university-operations/quarterly-reports/${item.id}/approve`
        : `${moduleEndpoints[item.module]}/${item.id}/publish`
      await api.post(endpoint, {})
      successCount++
    } catch {
      failCount++
    }
  }
  if (successCount > 0) toast.success(`${successCount} item(s) approved`)
  if (failCount > 0) toast.error(`${failCount} item(s) failed to approve`)
  selectedItems.value = []
  batchLoading.value = null
  await fetchPendingItems()
}

// Phase EN-D: Open batch reject dialog
function openBatchRejectDialog() {
  if (selectedItems.value.length === 0) return
  batchRejectNotes.value = ''
  batchRejectDialog.value = true
}

// Phase EN-D: Batch reject selected items
async function batchRejectSelected() {
  // Phase GOV-C: Exclude unlock_request items from batch actions
  // Re-check authority here too — the toolbar button only shows when canActOnSelection
  // is true, but selection can change between render and click.
  const batchItems = selectedItems.value.filter(
    i => i.source !== 'unlock_request' && canReviewItem(i)
  )
  if (batchItems.length === 0) {
    toast.warning('Unlock requests must be handled individually')
    return
  }
  batchLoading.value = 'reject'
  let successCount = 0
  let failCount = 0
  for (const item of batchItems) {
    try {
      const endpoint = item.source === 'quarterly_report'
        ? `/api/university-operations/quarterly-reports/${item.id}/reject`
        : `${moduleEndpoints[item.module]}/${item.id}/reject`
      await api.post(endpoint, { notes: batchRejectNotes.value || 'Rejected by administrator' })
      successCount++
    } catch {
      failCount++
    }
  }
  if (successCount > 0) toast.success(`${successCount} item(s) rejected`)
  if (failCount > 0) toast.error(`${failCount} item(s) failed to reject`)
  selectedItems.value = []
  batchRejectDialog.value = false
  batchLoading.value = null
  await fetchPendingItems()
}

// Phase GOV-UI: Approve unlock request (revert to DRAFT)
async function approveUnlockRequest(item: PendingItem) {
  if (!canReviewItem(item)) {
    toast.error('You are not authorized to approve unlock requests in this module')
    return
  }
  actionLoading.value = item.id
  try {
    await api.post(`/api/university-operations/quarterly-reports/${item.id}/unlock`, {
      reason: `Approved unlock request: ${item.unlock_request_reason || 'No reason provided'}`,
    })
    toast.success(`Unlock approved — report reverted to Draft`)
    await fetchPendingItems()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to unlock report')
  } finally {
    actionLoading.value = null
  }
}

// Phase GOV-UI: Deny unlock request
async function denyUnlockRequest(item: PendingItem) {
  if (!canReviewItem(item)) {
    toast.error('You are not authorized to deny unlock requests in this module')
    return
  }
  actionLoading.value = item.id
  try {
    await api.post(`/api/university-operations/quarterly-reports/${item.id}/deny-unlock`, {})
    toast.success(`Unlock request denied`)
    await fetchPendingItems()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to deny unlock request')
  } finally {
    actionLoading.value = null
  }
}

onMounted(() => {
  // canReviewAny already covers Admin/SuperAdmin (Layer 1) OR Approver/Manager module
  // level (Layer 3) — isAdmin alone wrongly excluded the latter (they'd pass the
  // redirect guard above, then hit the "Access Denied" fallback below for lack of data).
  if (canReviewAny.value) {
    fetchPendingItems()
  }
})
</script>

<template>
  <div v-if="canReviewAny">
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          Pending Reviews
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Submissions awaiting your approval
        </p>
      </div>
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-refresh"
        @click="fetchPendingItems"
        :loading="loading"
      >
        Refresh
      </v-btn>
    </div>

    <!-- Module Tabs -->
    <v-card class="mb-4">
      <v-tabs v-model="activeTab" color="primary" grow>
        <v-tab value="all">
          All
          <v-badge
            v-if="tabCounts.all > 0"
            :content="tabCounts.all"
            color="primary"
            inline
            class="ml-2"
          />
        </v-tab>
        <v-tab value="coi">
          Construction
          <v-badge
            v-if="tabCounts.coi > 0"
            :content="tabCounts.coi"
            color="blue"
            inline
            class="ml-2"
          />
        </v-tab>
        <v-tab value="repairs">
          Repairs
          <v-badge
            v-if="tabCounts.repairs > 0"
            :content="tabCounts.repairs"
            color="orange"
            inline
            class="ml-2"
          />
        </v-tab>
        <v-tab value="university_operations">
          University Ops
          <v-badge
            v-if="tabCounts.university_operations > 0"
            :content="tabCounts.university_operations"
            color="purple"
            inline
            class="ml-2"
          />
        </v-tab>
      </v-tabs>
    </v-card>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="table" />
    </v-card>

    <!-- Empty State -->
    <v-card v-else-if="filteredItems.length === 0" class="pa-6">
      <v-empty-state
        icon="mdi-clipboard-check-outline"
        headline="No Pending Reviews"
        :text="activeTab === 'all'
          ? 'There are no submissions waiting for your review.'
          : `No pending reviews in ${moduleLabels[activeTab] || activeTab}.`"
      />
    </v-card>

    <!-- Pending Reviews Table -->
    <v-card v-else>
      <!-- Phase EN-D: Batch action toolbar -->
      <v-toolbar v-if="selectedItems.length > 0" density="compact" color="primary" class="px-2">
        <span class="text-body-2 font-weight-medium ml-2">{{ selectedItems.length }} selected</span>
        <v-spacer />
        <template v-if="canActOnSelection">
          <v-btn
            variant="text"
            prepend-icon="mdi-check-circle"
            size="small"
            :loading="batchLoading === 'approve'"
            :disabled="!!batchLoading"
            @click="approveSelected"
          >
            Approve Selected
          </v-btn>
          <v-btn
            variant="text"
            prepend-icon="mdi-close-circle"
            size="small"
            color="error"
            :loading="batchLoading === 'reject'"
            :disabled="!!batchLoading"
            @click="openBatchRejectDialog"
            class="ml-1"
          >
            Reject Selected
          </v-btn>
        </template>
        <span v-else class="text-caption text-grey-lighten-2 mr-2">
          Selection includes a module outside your approval authority
        </span>
      </v-toolbar>
      <v-data-table
        v-model="selectedItems"
        :headers="[
          { title: 'Title', key: 'title', sortable: true },
          { title: 'Module', key: 'module', sortable: true },
          { title: 'Submitted By', key: 'submitter_name', sortable: true },
          { title: 'Submitted', key: 'submitted_at', sortable: true },
          { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="filteredItems"
        :items-per-page="20"
        density="comfortable"
        hover
        show-select
        item-value="id"
        return-object
      >
        <!-- Title -->
        <template #item.title="{ item }">
          <div>
            <span class="font-weight-medium">{{ item.title }}</span>
            <div v-if="item.project_code" class="text-caption text-grey">
              {{ item.project_code }}
            </div>
            <div v-if="item.campus" class="text-caption text-grey">
              {{ item.campus }}
            </div>
          </div>
        </template>

        <!-- Module Badge -->
        <template #item.module="{ item }">
          <v-chip
            :color="moduleColors[item.module]"
            size="small"
            variant="tonal"
          >
            {{ moduleLabels[item.module] }}
          </v-chip>
        </template>

        <!-- Submitter -->
        <template #item.submitter_name="{ item }">
          {{ item.submitter_name || 'Unknown' }}
        </template>

        <!-- Submitted Date -->
        <template #item.submitted_at="{ item }">
          {{ formatDate(item.submitted_at) }}
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
              <!-- View -->
              <v-list-item
                @click="viewItem(item)"
                prepend-icon="mdi-eye"
              >
                <v-list-item-title>View Details</v-list-item-title>
              </v-list-item>

              <v-divider class="my-1" />

              <!-- Phase GOV-UI: Unlock request actions -->
              <template v-if="item.source === 'unlock_request'">
                <v-list-item
                  v-if="item.unlock_request_reason"
                  prepend-icon="mdi-message-text-outline"
                  class="text-grey-darken-1"
                >
                  <v-list-item-title class="text-body-2">{{ item.unlock_request_reason }}</v-list-item-title>
                </v-list-item>
                <v-divider v-if="item.unlock_request_reason" class="my-1" />
                <!-- Unlock decisions are university_operations-only — Admin/SuperAdmin only
                     (see canReviewItem); no module-level Approver/Manager path here. -->
                <template v-if="canReviewItem(item)">
                  <v-list-item
                    @click="approveUnlockRequest(item)"
                    prepend-icon="mdi-lock-open-check"
                    class="text-success"
                  >
                    <v-list-item-title>Approve Unlock</v-list-item-title>
                  </v-list-item>
                  <v-list-item
                    @click="denyUnlockRequest(item)"
                    prepend-icon="mdi-lock-remove"
                    class="text-error"
                  >
                    <v-list-item-title>Deny Unlock</v-list-item-title>
                  </v-list-item>
                </template>
              </template>

              <!-- Standard review actions — coi/repairs: Approver/Manager or Admin/SuperAdmin;
                   university_operations: Admin/SuperAdmin only (see canReviewItem). -->
              <template v-else-if="canReviewItem(item)">
                <!-- Approve -->
                <v-list-item
                  @click="approveItem(item)"
                  prepend-icon="mdi-check-circle"
                  class="text-success"
                >
                  <v-list-item-title>Approve</v-list-item-title>
                </v-list-item>

                <!-- Reject -->
                <v-list-item
                  @click="openRejectDialog(item)"
                  prepend-icon="mdi-close-circle"
                  class="text-error"
                >
                  <v-list-item-title>Reject</v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>
        </template>
      </v-data-table>
    </v-card>

    <!-- Reject Dialog -->
    <v-dialog v-model="rejectDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          Reject Submission
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            Are you sure you want to reject
            <strong>"{{ itemToReject?.title }}"</strong>?
          </p>
          <v-textarea
            v-model="rejectNotes"
            label="Rejection Notes"
            placeholder="Provide feedback for the submitter..."
            rows="3"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="rejectDialog = false"
            :disabled="rejecting"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="rejectItem"
            :loading="rejecting"
          >
            Reject
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Phase EN-D: Batch Reject Dialog -->
    <v-dialog v-model="batchRejectDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          Reject {{ selectedItems.length }} Item(s)
        </v-card-title>
        <v-card-text>
          <p class="mb-4">
            Are you sure you want to reject
            <strong>{{ selectedItems.length }} selected item(s)</strong>?
          </p>
          <v-textarea
            v-model="batchRejectNotes"
            label="Rejection Notes"
            placeholder="Provide feedback for the submitters..."
            rows="3"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="batchRejectDialog = false"
            :disabled="batchLoading === 'reject'"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="batchRejectSelected"
            :loading="batchLoading === 'reject'"
          >
            Reject All
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Info Card -->
    <v-card class="mt-4 pa-4">
      <div class="text-subtitle-2 mb-2">Review Guidelines</div>
      <ul class="text-body-2 text-grey-darken-1 pl-4">
        <li>Review submissions in order received (oldest first)</li>
        <li>Approve items that meet all requirements</li>
        <li>Reject items with clear feedback for revision</li>
        <li v-if="!isSuperAdmin">You can only approve items in your assigned modules</li>
      </ul>
    </v-card>

    <!-- Phase GOV-D: Versioned Submission History -->
    <v-expansion-panels v-if="filteredArchivedItems.length > 0" class="mt-4">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <div class="d-flex align-center ga-2">
            <v-icon size="small">mdi-history</v-icon>
            <span class="font-weight-medium">Submission History</span>
            <v-badge :content="filteredArchivedItems.length" color="grey" inline class="ml-1" />
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-data-table
            :headers="[
              { title: 'Ver', key: 'version', sortable: true, width: '60' },
              { title: 'Event', key: 'event_type', sortable: true, width: '120' },
              { title: 'FY', key: 'fiscal_year', sortable: true, width: '60' },
              { title: 'Quarter', key: 'quarter', sortable: true, width: '80' },
              { title: 'Submitted By', key: 'submitter_name', sortable: true },
              { title: 'Reviewed By', key: 'reviewed_by_name', sortable: true },
              { title: 'Action By', key: 'actioned_by_name', sortable: true },
              { title: 'Date', key: 'actioned_at', sortable: true, width: '140' },
              { title: 'Notes / Reason', key: 'notes_reason', sortable: false },
            ]"
            :items="filteredArchivedItems"
            :items-per-page="15"
            density="compact"
            hover
            no-data-text="No submission history available"
          >
            <template #item.version="{ item }">
              <span class="font-weight-medium">v{{ item.version }}</span>
            </template>
            <template #item.event_type="{ item }">
              <v-chip
                :color="eventTypeColor(item.event_type)"
                size="small"
                variant="tonal"
              >
                {{ item.event_type }}
              </v-chip>
            </template>
            <template #item.submitter_name="{ item }">
              {{ item.submitter_name || '—' }}
            </template>
            <template #item.reviewed_by_name="{ item }">
              {{ item.reviewed_by_name || '—' }}
            </template>
            <template #item.actioned_by_name="{ item }">
              {{ item.actioned_by_name || '—' }}
            </template>
            <template #item.actioned_at="{ item }">
              {{ formatDate(item.actioned_at) }}
            </template>
            <template #item.notes_reason="{ item }">
              <span v-if="item.review_notes || item.reason" class="text-caption text-grey-darken-1">
                {{ item.review_notes || item.reason }}
              </span>
              <span v-else class="text-caption text-grey">—</span>
            </template>
          </v-data-table>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>

  <!-- Access Denied (fallback, should redirect) -->
  <div v-else class="pa-6 text-center">
    <v-icon size="64" color="error">mdi-shield-off</v-icon>
    <h2 class="mt-4">Access Denied</h2>
    <p class="text-grey">Approval authority required to view this page.</p>
    <v-btn color="primary" to="/dashboard" class="mt-4">
      Return to Dashboard
    </v-btn>
  </div>
</template>
