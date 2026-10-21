<script setup lang="ts">
import { adaptRepairProjects, type UIRepairProject, type BackendRepairProject, type PublicationStatus } from '~/utils/adapters'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const api = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { canAdd, canEdit, canDelete, isAdmin, isStaff, isSuperAdmin } = usePermissions()

const repairs = ref<UIRepairProject[]>([])
const search = ref('')
const loading = ref(true)
const deleting = ref(false)
const deleteDialog = ref(false)
const repairToDelete = ref<UIRepairProject | null>(null)

// Reject dialog state
const rejectDialog = ref(false)
const rejectNotes = ref('')
const repairToReject = ref<UIRepairProject | null>(null)
const rejecting = ref(false)

// Action state
const actionLoading = ref<string | null>(null)

// Table headers - publication status visible to all users
const headers = computed(() => {
  return [
    { title: 'Title', key: 'title', sortable: true },
    { title: 'Location', key: 'location', sortable: true },
    { title: 'Campus', key: 'campus', sortable: true },
    { title: 'Urgency', key: 'urgencyLevel', sortable: true },
    { title: 'Status', key: 'status', sortable: true },
    { title: 'Publication', key: 'publicationStatus', sortable: true },
    { title: 'Actions', key: 'actions', sortable: false, align: 'center' as const },
  ]
})

// Publication status color mapping
function getPublicationStatusColor(status: PublicationStatus): string {
  const colors: Record<PublicationStatus, string> = {
    DRAFT: 'grey',
    PENDING_REVIEW: 'orange',
    PUBLISHED: 'success',
    REJECTED: 'error',
  }
  return colors[status] || 'grey'
}

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
function viewRepair(repair: UIRepairProject) {
  router.push(`/repairs/detail-${repair.id}`)
}

function editRepair(repair: UIRepairProject) {
  router.push(`/repairs/edit-${repair.id}`)
}

function createRepair() {
  router.push('/repairs/new')
}

// Delete confirmation
function confirmDelete(repair: UIRepairProject) {
  repairToDelete.value = repair
  deleteDialog.value = true
}

// --- Meatball Menu Action Visibility ---

// Check if current user is record owner, delegate, or assigned (Phase BL)
function isOwnerOrAssigned(repair: UIRepairProject): boolean {
  const userId = authStore.user?.id
  if (!userId) return false
  return (
    repair.createdBy === userId
    || repair.delegatedTo === userId
    || repair.assignedUsers?.some(u => u.id === userId) || false
  )
}

// Edit: Owner/assigned can edit own record, Admin can edit any. Editing PENDING_REVIEW auto-reverts to DRAFT.
function canEditItem(repair: UIRepairProject): boolean {
  if (isAdmin.value) return true
  return isOwnerOrAssigned(repair)
}

// Submit/Resubmit for Review: Owner/assigned + DRAFT or REJECTED status
function canSubmitForReview(repair: UIRepairProject): boolean {
  if (!isStaff.value && !isOwnerOrAssigned(repair)) return false
  if (!isOwnerOrAssigned(repair)) return false
  return repair.publicationStatus === 'DRAFT' || repair.publicationStatus === 'REJECTED'
}

// Withdraw: Original submitter + PENDING_REVIEW status only
function canWithdraw(repair: UIRepairProject): boolean {
  if (repair.publicationStatus !== 'PENDING_REVIEW') return false
  return repair.approvalMetadata?.submittedBy === authStore.user?.id
}

// Approve: Admin + PENDING_REVIEW status + NOT self-submitted
// Self-approval prevention: UI hides button if user is the submitter (backend also enforces)
function canApproveItem(repair: UIRepairProject): boolean {
  if (!isAdmin.value) return false
  if (repair.publicationStatus !== 'PENDING_REVIEW') return false
  // Prevent self-approval - hide button for own submissions (SuperAdmin excluded from this check)
  const currentUserId = authStore.user?.id
  if (!isSuperAdmin.value && repair.approvalMetadata?.submittedBy === currentUserId) {
    return false
  }
  return true
}

// Reject: Admin + PENDING_REVIEW status only
function canRejectItem(repair: UIRepairProject): boolean {
  return isAdmin.value && repair.publicationStatus === 'PENDING_REVIEW'
}

// --- Meatball Menu Actions ---

async function submitForReview(repair: UIRepairProject) {
  actionLoading.value = repair.id
  try {
    await api.post(`/api/repair-projects/${repair.id}/submit-for-review`, {})
    toast.success(`"${repair.title}" submitted for review`)
    await fetchRepairs()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to submit for review')
  } finally {
    actionLoading.value = null
  }
}

async function withdrawSubmission(repair: UIRepairProject) {
  actionLoading.value = repair.id
  try {
    await api.post(`/api/repair-projects/${repair.id}/withdraw`, {})
    toast.success(`"${repair.title}" withdrawn successfully`)
    await fetchRepairs()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to withdraw submission')
  } finally {
    actionLoading.value = null
  }
}

async function approveItem(repair: UIRepairProject) {
  actionLoading.value = repair.id
  try {
    await api.post(`/api/repair-projects/${repair.id}/publish`, {})
    toast.success(`"${repair.title}" published successfully`)
    await fetchRepairs()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to publish')
  } finally {
    actionLoading.value = null
  }
}

function openRejectDialog(repair: UIRepairProject) {
  repairToReject.value = repair
  rejectNotes.value = ''
  rejectDialog.value = true
}

async function rejectItem() {
  if (!repairToReject.value) return
  rejecting.value = true
  try {
    await api.post(`/api/repair-projects/${repairToReject.value.id}/reject`, {
      notes: rejectNotes.value || 'Rejected by administrator',
    })
    toast.success(`"${repairToReject.value.title}" rejected`)
    rejectDialog.value = false
    await fetchRepairs()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to reject')
  } finally {
    rejecting.value = false
    repairToReject.value = null
    rejectNotes.value = ''
  }
}

async function deleteRepair() {
  if (!repairToDelete.value) return
  deleting.value = true
  try {
    await api.del(`/api/repair-projects/${repairToDelete.value.id}`)
    const deletedTitle = repairToDelete.value.title
    repairs.value = repairs.value.filter(r => r.id !== repairToDelete.value!.id)
    toast.success(`Repair "${deletedTitle}" deleted successfully`)
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to delete repair')
    console.error('Failed to delete repair:', err)
  } finally {
    deleting.value = false
    deleteDialog.value = false
    repairToDelete.value = null
  }
}

// Status color mapping
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    REPORTED: 'info',
    INSPECTED: 'purple',
    APPROVED: 'primary',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'error',
  }
  return colors[status] || 'grey'
}

// Urgency color mapping
function getUrgencyColor(level: string): string {
  const colors: Record<string, string> = {
    LOW: 'success',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'error',
  }
  return colors[level] || 'grey'
}

// Filtered repairs
const filteredRepairs = computed(() => {
  if (!search.value) return repairs.value
  const term = search.value.toLowerCase()
  return repairs.value.filter(
    (r) =>
      r.title.toLowerCase().includes(term) ||
      r.location.toLowerCase().includes(term) ||
      r.campus.toLowerCase().includes(term) ||
      r.status.toLowerCase().includes(term) ||
      r.urgencyLevel.toLowerCase().includes(term)
  )
})

async function fetchRepairs() {
  loading.value = true
  try {
    // Every page of the list, not just the first: the endpoint answers with 20 rows by
    // default, and this page filters, sorts and paginates in the browser over whatever
    // it is handed — so the rest of the table was unreachable.
    const { rows, total, truncated } = await fetchAllPages<BackendRepairProject>((page, limit) =>
      api.get<{ data: BackendRepairProject[]; meta?: { total: number; totalPages: number } }>(
        `/api/repair-projects?page=${page}&limit=${limit}`,
      ),
    )
    repairs.value = adaptRepairProjects(rows)
    if (truncated) {
      toast.warning(`Showing the first ${rows.length} of ${total} repairs. Narrow the filters to see the rest.`)
    }
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to load repairs')
    console.error('Failed to fetch repairs:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchRepairs)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          Repair Projects
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Track and manage facility repair requests
        </p>
      </div>
      <v-btn v-if="canAdd('repairs')" color="primary" prepend-icon="mdi-plus" @click="createRepair">
        New Repair
      </v-btn>
    </div>

    <!-- Data Table Card -->
    <v-card>
      <!-- Toolbar -->
      <v-card-title class="d-flex align-center pa-4">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search repairs"
          single-line
          hide-details
          density="compact"
          variant="outlined"
          class="mr-4"
          style="max-width: 300px"
        />
        <v-spacer />
        <v-chip color="primary" variant="tonal">
          {{ filteredRepairs.length }} repairs
        </v-chip>
      </v-card-title>

      <v-divider />

      <!-- Table -->
      <v-data-table
        :key="repairs.length"
        :headers="headers"
        :items="filteredRepairs"
        :loading="loading"
        :search="search"
        item-value="id"
        hover
        class="elevation-0"
      >
        <!-- Title -->
        <template #item.title="{ item }">
          <span class="font-weight-medium">{{ item.title }}</span>
        </template>

        <!-- Urgency -->
        <template #item.urgencyLevel="{ item }">
          <v-chip
            :color="getUrgencyColor(item.urgencyLevel)"
            size="small"
            variant="tonal"
          >
            {{ item.urgencyLevel }}
          </v-chip>
        </template>

        <!-- Status Chip -->
        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ item.status.replace('_', ' ') }}
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
              <v-list-item @click="viewRepair(item)" prepend-icon="mdi-eye">
                <v-list-item-title>View</v-list-item-title>
              </v-list-item>

              <!-- Edit (conditional) -->
              <v-list-item
                v-if="canEditItem(item)"
                @click="editRepair(item)"
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
              <v-divider v-if="canDelete('repairs')" class="my-1" />

              <!-- Delete (Admin only) -->
              <v-list-item
                v-if="canDelete('repairs')"
                @click="confirmDelete(item)"
                prepend-icon="mdi-delete"
                class="text-error"
              >
                <v-list-item-title>Delete</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <!-- Loading State -->
        <template #loading>
          <v-skeleton-loader type="table-row@5" />
        </template>

        <!-- Empty State -->
        <template #no-data>
          <div class="text-center pa-6">
            <v-icon icon="mdi-tools" size="64" color="grey-lighten-1" class="mb-4" />
            <p class="text-h6 text-grey-darken-1">No repairs found</p>
            <p class="text-body-2 text-grey">Repair requests will appear here once added</p>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ repairToDelete?.title }}</strong>?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false" :disabled="deleting">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="deleteRepair" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reject Dialog -->
    <v-dialog v-model="rejectDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-h6">Reject Submission</v-card-title>
        <v-card-text>
          <p class="mb-4">
            Reject <strong>{{ repairToReject?.title }}</strong>?
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
