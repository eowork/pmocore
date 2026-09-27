<script setup lang="ts">
import { adaptRepairDetail, type UIRepairDetail, type BackendRepairProjectDetail, type PublicationStatus } from '~/utils/adapters'
import { getPublicationStatusColor } from '~/utils/status-colors'

definePageMeta({
  // 'permission' was missing here, so the repair detail page was the one route under a gated
  // prefix that no module guard ever ran on.
  middleware: ['auth', 'permission'],
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const { isAdmin, isStaff, canEdit } = usePermissions()
const authStore = useAuthStore()

const repair = ref<UIRepairDetail | null>(null)
const loading = ref(true)

// ACE-R15 Tier 3: Direct ID extraction (no computed, no watchEffect)
const repairId = route.params.id as string

// Validate ID immediately - redirect if missing
if (!repairId) {
  console.error('[Repairs Detail] No repair ID in route, redirecting to list')
  router.push('/repairs')
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

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Fetch repair using direct ID
async function fetchRepair() {
  if (!repairId) {
    toast.error('Invalid repair ID')
    loading.value = false
    return
  }

  try {
    loading.value = true
    console.log('[Repairs Detail] Fetching repair:', repairId)
    const response = await api.get<BackendRepairProjectDetail>(`/api/repair-projects/${repairId}`)
    repair.value = adaptRepairDetail(response)
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to load repair details')
    console.error('[Repairs Detail] Failed to fetch repair:', err)
  } finally {
    loading.value = false
  }
}

// Navigation
function goBack() {
  router.push('/repairs')
}

function editRepair() {
  router.push(`/repairs/edit-${repairId}`)
}

// Draft Workflow State
const workflowDialog = ref(false)
const workflowAction = ref<'submit' | 'publish' | 'reject' | 'withdraw'>('submit')
const rejectionNotes = ref('')
const workflowProcessing = ref(false)

// Check if current user is the owner, delegate, or assigned (Phase BL)
const isOwnerOrAssigned = computed(() => {
  if (!repair.value) return false
  const userId = authStore.user?.id
  if (!userId) return false
  return (
    repair.value.createdBy === userId
    || repair.value.delegatedTo === userId
    || repair.value.assignedUsers?.some(u => u.id === userId) || false
  )
})

// Show Submit/Resubmit for Review: Staff or assigned user who owns/is assigned to a DRAFT or REJECTED record
const canSubmitForReview = computed(() => {
  if (!repair.value) return false
  if (!isStaff.value && !isOwnerOrAssigned.value) return false
  if (!isOwnerOrAssigned.value) return false
  return (
    repair.value.publicationStatus === 'DRAFT'
    || repair.value.publicationStatus === 'REJECTED'
  )
})

// Show Withdraw button: Original submitter viewing PENDING_REVIEW
const canWithdraw = computed(() => {
  if (!repair.value) return false
  if (repair.value.publicationStatus !== 'PENDING_REVIEW') return false
  return repair.value.approvalMetadata?.submittedBy === authStore.user?.id
})

// Show Publish/Reject buttons: Admin viewing PENDING_REVIEW
const canPublishOrReject = computed(() => {
  if (!repair.value) return false
  return isAdmin.value && repair.value.publicationStatus === 'PENDING_REVIEW'
})

// Show Edit button: Must be owner/assigned or Admin
// Editing PENDING_REVIEW reverts to DRAFT automatically (Phase W)
const canEditCurrentProject = computed(() => {
  if (!repair.value) return false
  if (isAdmin.value) return true
  return isOwnerOrAssigned.value
})

// Publication status helpers

function getPublicationStatusLabel(status: PublicationStatus): string {
  const labels: Record<PublicationStatus, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    PUBLISHED: 'Published',
    REJECTED: 'Rejected',
  }
  return labels[status] || status
}

// Workflow actions
function openSubmitDialog() {
  workflowAction.value = 'submit'
  workflowDialog.value = true
}

function openPublishDialog() {
  workflowAction.value = 'publish'
  workflowDialog.value = true
}

function openRejectDialog() {
  workflowAction.value = 'reject'
  rejectionNotes.value = ''
  workflowDialog.value = true
}

function openWithdrawDialog() {
  workflowAction.value = 'withdraw'
  workflowDialog.value = true
}

async function executeWorkflowAction() {
  workflowProcessing.value = true
  try {
    if (workflowAction.value === 'submit') {
      await api.post(`/api/repair-projects/${repairId}/submit-for-review`, {})
      toast.success('Submitted for review successfully')
    } else if (workflowAction.value === 'publish') {
      await api.post(`/api/repair-projects/${repairId}/publish`, {})
      toast.success('Repair published successfully')
    } else if (workflowAction.value === 'reject') {
      await api.post(`/api/repair-projects/${repairId}/reject`, { notes: rejectionNotes.value })
      toast.success('Repair rejected')
    } else if (workflowAction.value === 'withdraw') {
      await api.post(`/api/repair-projects/${repairId}/withdraw`, {})
      toast.success('Submission withdrawn successfully')
    }
    // Refresh repair data
    await fetchRepair()
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || `Failed to ${workflowAction.value}`)
    console.error(`Workflow action failed:`, err)
  } finally {
    workflowProcessing.value = false
    workflowDialog.value = false
    rejectionNotes.value = ''
  }
}

// ACE-R15 Tier 3: Simple onMounted (no watchEffect complexity)
onMounted(() => {
  console.log('[Repairs Detail] Mounted with ID:', repairId)
  fetchRepair()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <h1 class="text-h4 font-weight-bold text-grey-darken-3">
            {{ repair?.title || 'Repair Details' }}
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            {{ repair?.repairCode || '' }}
          </p>
        </div>
      </div>
      <div class="d-flex ga-2">
        <!-- Draft Workflow Buttons -->
        <v-btn
          v-if="canSubmitForReview"
          color="orange"
          prepend-icon="mdi-send"
          @click="openSubmitDialog"
          :disabled="loading"
        >
          Submit for Review
        </v-btn>
        <v-btn
          v-if="canWithdraw"
          color="orange"
          variant="outlined"
          prepend-icon="mdi-undo"
          @click="openWithdrawDialog"
          :disabled="loading"
        >
          Withdraw
        </v-btn>
        <v-btn
          v-if="canPublishOrReject"
          color="success"
          prepend-icon="mdi-check-circle"
          @click="openPublishDialog"
          :disabled="loading"
        >
          Publish
        </v-btn>
        <v-btn
          v-if="canPublishOrReject"
          color="error"
          variant="outlined"
          prepend-icon="mdi-close-circle"
          @click="openRejectDialog"
          :disabled="loading"
        >
          Reject
        </v-btn>
        <v-btn v-if="canEditCurrentProject" color="primary" prepend-icon="mdi-pencil" @click="editRepair" :disabled="loading">
          Edit Repair
        </v-btn>
      </div>
    </div>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article" />
    </v-card>

    <!-- Repair Details -->
    <template v-else-if="repair">
      <!-- Status Card -->
      <v-card class="mb-4">
        <v-card-text>
          <div class="d-flex flex-wrap ga-6 align-center">
            <div>
              <p class="text-caption text-grey mb-1">Status</p>
              <v-chip :color="getStatusColor(repair.status)" size="large">
                {{ repair.status.replace('_', ' ') }}
              </v-chip>
            </div>
            <div v-if="isAdmin || repair.publicationStatus !== 'PUBLISHED'">
              <p class="text-caption text-grey mb-1">Publication</p>
              <v-chip :color="getPublicationStatusColor(repair.publicationStatus)" size="large">
                {{ getPublicationStatusLabel(repair.publicationStatus) }}
              </v-chip>
              <!-- Approval Metadata -->
              <div v-if="repair.publicationStatus === 'PUBLISHED' && repair.approvalMetadata?.reviewedByName" class="mt-2">
                <v-chip size="small" variant="tonal" color="success" prepend-icon="mdi-check-circle">
                  Approved by {{ repair.approvalMetadata.reviewedByName }}
                </v-chip>
                <p class="text-caption text-grey mt-1">
                  {{ formatDate(repair.approvalMetadata.reviewedAt || '') }}
                </p>
              </div>
              <div v-else-if="repair.publicationStatus === 'REJECTED' && repair.approvalMetadata?.reviewedByName" class="mt-2">
                <v-chip size="small" variant="tonal" color="error" prepend-icon="mdi-close-circle">
                  Rejected by {{ repair.approvalMetadata.reviewedByName }}
                </v-chip>
                <p class="text-caption text-grey mt-1">
                  {{ formatDate(repair.approvalMetadata.reviewedAt || '') }}
                </p>
                <p v-if="repair.approvalMetadata.reviewNotes" class="text-body-2 text-grey-darken-1 mt-1">
                  <strong>Notes:</strong> {{ repair.approvalMetadata.reviewNotes }}
                </p>
              </div>
              <div v-else-if="repair.publicationStatus === 'PENDING_REVIEW' && repair.approvalMetadata?.submittedByName" class="mt-2">
                <v-chip size="small" variant="tonal" color="orange" prepend-icon="mdi-clock-outline">
                  Submitted by {{ repair.approvalMetadata.submittedByName }}
                </v-chip>
                <p class="text-caption text-grey mt-1">
                  {{ formatDate(repair.approvalMetadata.submittedAt || '') }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-caption text-grey mb-1">Urgency</p>
              <v-chip :color="getUrgencyColor(repair.urgency_level)" size="large">
                {{ repair.urgency_level }}
              </v-chip>
            </div>
            <div>
              <p class="text-caption text-grey mb-1">Campus</p>
              <v-chip variant="outlined">{{ repair.campus }}</v-chip>
            </div>
            <v-spacer />
            <div class="text-right">
              <p class="text-caption text-grey mb-1">Estimated Budget</p>
              <p class="text-h5 font-weight-bold text-primary">
                {{ formatCurrency(repair.budget || 0) }}
              </p>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Main Details -->
      <v-row>
        <v-col cols="12" md="8">
          <!-- Repair Information -->
          <v-card class="mb-4">
            <v-card-title>Repair Information</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" v-if="repair.description">
                  <p class="text-caption text-grey">Description</p>
                  <p>{{ repair.description }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Building</p>
                  <p class="font-weight-medium">{{ repair.building_name || '-' }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Floor / Room</p>
                  <p class="font-weight-medium">{{ repair.floor_number || '-' }} / {{ repair.room_number || '-' }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Specific Location</p>
                  <p class="font-weight-medium">{{ repair.specific_location || '-' }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Reported By</p>
                  <p class="font-weight-medium">{{ repair.reported_by || '-' }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Inspection Date</p>
                  <p class="font-weight-medium">{{ formatDate(repair.inspection_date) }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Assigned Technician</p>
                  <p class="font-weight-medium">{{ repair.assigned_technician || '-' }}</p>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Timeline -->
          <v-card class="mb-4">
            <v-card-title>Progress Timeline</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Start Date</p>
                  <p class="font-weight-medium">{{ formatDate(repair.start_date) }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">End Date</p>
                  <p class="font-weight-medium">{{ formatDate(repair.end_date) }}</p>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <!-- Cost Details -->
          <v-card class="mb-4">
            <v-card-title>Cost Details</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-calculator" />
                </template>
                <v-list-item-title>Estimated Budget</v-list-item-title>
                <v-list-item-subtitle>{{ formatCurrency(repair.budget || 0) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-receipt" />
                </template>
                <v-list-item-title>Actual Cost</v-list-item-title>
                <v-list-item-subtitle>{{ formatCurrency(repair.actual_cost || 0) }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- Quick Info -->
          <v-card class="mb-4">
            <v-card-title>Quick Info</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-identifier" />
                </template>
                <v-list-item-title>Repair Code</v-list-item-title>
                <v-list-item-subtitle>{{ repair.project_code }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-map-marker" />
                </template>
                <v-list-item-title>Campus</v-list-item-title>
                <v-list-item-subtitle>{{ repair.campus }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="repair.is_emergency">
                <template #prepend>
                  <v-icon icon="mdi-alert" color="error" />
                </template>
                <v-list-item-title class="text-error">Emergency</v-list-item-title>
                <v-list-item-subtitle>Requires immediate attention</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- Assigned Staff/Personnel -->
          <v-card v-if="repair.delegatedToName" class="mb-4">
            <v-card-title>Assigned Staff/Personnel</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-account-check" />
                </template>
                <v-list-item-title>Assigned To</v-list-item-title>
                <v-list-item-subtitle>{{ repair.delegatedToName }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- Approval History Timeline -->
          <v-card>
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-history" size="small" />
              Approval History
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-2">
              <v-timeline side="end" density="compact" truncate-line="both">
                <!-- Stage 1: Created -->
                <v-timeline-item
                  dot-color="blue-grey"
                  icon="mdi-file-plus-outline"
                  size="small"
                >
                  <div class="text-body-2 font-weight-medium">Record Created</div>
                  <div class="text-caption text-grey">
                    {{ repair.approvalMetadata?.createdByName || 'Unknown' }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ formatDate(repair.approvalMetadata?.createdAt || '') }}
                  </div>
                </v-timeline-item>

                <!-- Stage 2: Submitted (only if submitted) -->
                <v-timeline-item
                  v-if="repair.approvalMetadata?.submittedByName"
                  dot-color="orange"
                  icon="mdi-send-outline"
                  size="small"
                >
                  <div class="text-body-2 font-weight-medium">Submitted for Review</div>
                  <div class="text-caption text-grey">
                    {{ repair.approvalMetadata.submittedByName }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ formatDate(repair.approvalMetadata.submittedAt || '') }}
                  </div>
                </v-timeline-item>

                <!-- Stage 3: Review Decision (only if reviewed) -->
                <v-timeline-item
                  v-if="repair.approvalMetadata?.reviewedByName"
                  :dot-color="repair.publicationStatus === 'PUBLISHED' ? 'success' : 'error'"
                  :icon="repair.publicationStatus === 'PUBLISHED' ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'"
                  size="small"
                >
                  <div class="text-body-2 font-weight-medium">
                    {{ repair.publicationStatus === 'PUBLISHED' ? 'Approved' : 'Rejected' }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ repair.approvalMetadata.reviewedByName }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ formatDate(repair.approvalMetadata.reviewedAt || '') }}
                  </div>
                  <div v-if="repair.approvalMetadata.reviewNotes" class="text-caption text-error mt-1">
                    <strong>Notes:</strong> {{ repair.approvalMetadata.reviewNotes }}
                  </div>
                </v-timeline-item>
              </v-timeline>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Workflow Action Dialog -->
    <v-dialog v-model="workflowDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-h6">
          <template v-if="workflowAction === 'submit'">Submit for Review</template>
          <template v-else-if="workflowAction === 'publish'">Publish Repair</template>
          <template v-else>Reject Repair</template>
        </v-card-title>
        <v-card-text>
          <template v-if="workflowAction === 'submit'">
            <p>
              Submit <strong>{{ repair?.title }}</strong> for admin review?
            </p>
            <p class="text-caption text-grey mt-2">
              An administrator will review and approve or reject this repair.
            </p>
          </template>
          <template v-else-if="workflowAction === 'publish'">
            <p>
              Publish <strong>{{ repair?.title }}</strong>?
            </p>
            <p class="text-caption text-grey mt-2">
              This will make the repair visible to all users.
            </p>
          </template>
          <template v-else>
            <p class="mb-4">
              Reject <strong>{{ repair?.title }}</strong>?
            </p>
            <v-textarea
              v-model="rejectionNotes"
              label="Rejection Notes (optional)"
              placeholder="Explain why this repair was rejected..."
              rows="3"
              variant="outlined"
              hide-details
            />
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="workflowDialog = false" :disabled="workflowProcessing">Cancel</v-btn>
          <v-btn
            :color="workflowAction === 'reject' ? 'error' : workflowAction === 'publish' ? 'success' : 'orange'"
            variant="flat"
            @click="executeWorkflowAction"
            :loading="workflowProcessing"
          >
            <template v-if="workflowAction === 'submit'">Submit</template>
            <template v-else-if="workflowAction === 'publish'">Publish</template>
            <template v-else>Reject</template>
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
