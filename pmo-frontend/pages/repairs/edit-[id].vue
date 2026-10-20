<script setup lang="ts">
import type { BackendRepairProjectDetail } from '~/utils/adapters'
import { adaptRepairDetail } from '~/utils/adapters'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()

const loading = ref(true)
const submitting = ref(false)

// ACE-R15 Tier 3: Direct ID extraction (no computed, no watchEffect)
const repairId = route.params.id as string

// Validate ID immediately - redirect if missing
if (!repairId) {
  console.error('[Repairs Edit] No repair ID in route, redirecting to list')
  router.push('/repairs')
}

// Form data
const form = ref({
  project_code: '',
  title: '',
  description: '',
  building_name: '',
  floor_number: '',
  room_number: '',
  specific_location: '',
  repair_type_id: '',
  urgency_level: '',
  is_emergency: false,
  campus: '',
  status: '',
  reported_by: '',
  inspection_date: '',
  start_date: '',
  end_date: '',
  budget: null as number | null,
  actual_cost: null as number | null,
  assigned_technician: '',
  // Phase AW: Multi-select assignment
  assigned_user_ids: [] as string[],
})

// Dropdown options
const urgencyOptions = [
  { title: 'Low', value: 'LOW' },
  { title: 'Medium', value: 'MEDIUM' },
  { title: 'High', value: 'HIGH' },
  { title: 'Critical', value: 'CRITICAL' },
]

const campusOptions = [
  { title: 'Main Campus', value: 'MAIN' },
  { title: 'Cabadbaran Campus', value: 'CABADBARAN' },
  { title: 'Both Campuses', value: 'BOTH' },
]

const statusOptions = [
  { title: 'Reported', value: 'REPORTED' },
  { title: 'Inspected', value: 'INSPECTED' },
  { title: 'Approved', value: 'APPROVED' },
  { title: 'In Progress', value: 'IN_PROGRESS' },
  { title: 'Completed', value: 'COMPLETED' },
  { title: 'Cancelled', value: 'CANCELLED' },
]

// Lookup data
const repairTypes = ref<{ id: string; name: string }[]>([])
// Phase AF: staff for delegation. The search runs on the server; the ids already assigned to
// this repair are held so narrowing the list never blanks a chip.
const { staffUsers, staffLoading, loadStaff, onStaffSearch, onStaffFocus } = useStaffSearch({
  heldIds: () => form.value.assigned_user_ids,
})

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  positiveNumber: (v: number | null) => v === null || v >= 0 || 'Must be a positive number',
}

// Fetch repair and lookup data using direct ID
// STEP 5 Fix: Load lookups FIRST, then repair data (ensures v-select items exist before v-model is set)
async function fetchData() {
  if (!repairId) {
    toast.error('Invalid repair ID')
    loading.value = false
    return
  }

  loading.value = true

  try {
    console.log('[Repairs Edit] Fetching lookup data first...')

    // STEP 1: Load repair types and repair data in parallel
    const [typesRes, repairRes] = await Promise.all([
      api.get<{ data: { id: string; name: string }[] }>('/api/repair-types'),
      api.get<BackendRepairProjectDetail>(`/api/repair-projects/${repairId}`),
    ])
    repairTypes.value = typesRes.data || []

    const adapted = adaptRepairDetail(repairRes)

    form.value = {
      project_code: adapted.project_code,
      title: adapted.title,
      description: adapted.description,
      building_name: adapted.building_name,
      floor_number: adapted.floor_number,
      room_number: adapted.room_number,
      specific_location: adapted.specific_location,
      repair_type_id: adapted.repair_type_id,
      urgency_level: adapted.urgency_level,
      is_emergency: adapted.is_emergency,
      campus: adapted.campus,
      status: adapted.status,
      reported_by: adapted.reported_by,
      inspection_date: adapted.inspection_date,
      start_date: adapted.start_date,
      end_date: adapted.end_date,
      budget: adapted.budget,
      actual_cost: adapted.actual_cost,
      assigned_technician: adapted.assigned_technician,
      // Phase AW: Multi-select assignment - extract IDs from assigned_users array
      assigned_user_ids: ((repairRes as any).assigned_users || []).map((u: { id: string }) => u.id),
    }

    // STEP 2: Load eligible users (Phase AV: global, no campus filter). This first page is
    // unfiltered, so it carries the labels for the chips the form was just hydrated with.
    await loadStaff()

    console.log('[Repairs Edit] Form populated with repair_type_id:', form.value.repair_type_id)
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to load repair data')
    console.error('[Repairs Edit] Failed to fetch:', err)
  } finally {
    loading.value = false
  }
}

// Submit form
async function handleSubmit() {
  submitting.value = true

  try {
    const payload = {
      project_code: form.value.project_code,
      title: form.value.title,
      description: form.value.description || undefined,
      building_name: form.value.building_name,
      floor_number: form.value.floor_number || undefined,
      room_number: form.value.room_number || undefined,
      specific_location: form.value.specific_location || undefined,
      repair_type_id: form.value.repair_type_id || undefined,
      urgency_level: form.value.urgency_level,
      is_emergency: form.value.is_emergency,
      campus: form.value.campus,
      status: form.value.status,
      reported_by: form.value.reported_by || undefined,
      inspection_date: form.value.inspection_date || undefined,
      start_date: form.value.start_date || undefined,
      end_date: form.value.end_date || undefined,
      budget: form.value.budget || undefined,
      actual_cost: form.value.actual_cost || undefined,
      assigned_technician: form.value.assigned_technician || undefined,
      // Phase AW: Multi-select assignment
      assigned_user_ids: form.value.assigned_user_ids.length > 0 ? form.value.assigned_user_ids : undefined,
    }

    console.log('[Repairs Edit] Submitting update for:', repairId)
    await api.patch(`/api/repair-projects/${repairId}`, payload)
    toast.success('Repair updated successfully')
    router.push(`/repairs/detail-${repairId}`)
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to update repair')
    console.error('[Repairs Edit] Failed to update:', err)
  } finally {
    submitting.value = false
  }
}

// Navigation - Use router.back() to return to exact previous context
function goBack() {
  router.back()
}

// ACE-R15 Tier 3: Simple onMounted (no watchEffect complexity)
onMounted(() => {
  console.log('[Repairs Edit] Mounted with ID:', repairId)
  fetchData()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center ga-3 mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          Edit Repair
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          {{ form.title }}
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article" />
    </v-card>

    <!-- Form -->
    <v-form v-else @submit.prevent="handleSubmit">
      <v-row>
        <!-- Main Form -->
        <v-col cols="12" md="8">
          <!-- Basic Information -->
          <v-card class="mb-4">
            <v-card-title>Basic Information</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.project_code"
                    label="Repair Code *"
                    placeholder="RP-2026-001"
                    hint="Unique repair identifier"
                    persistent-hint
                    :rules="[rules.required]"
                    required
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="form.repair_type_id"
                    label="Repair Type"
                    :items="repairTypes"
                    item-title="name"
                    item-value="id"
                    clearable
                    placeholder="Select repair type"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="form.title"
                    label="Title *"
                    placeholder="e.g., Ceiling Repair in Room 101"
                    :rules="[rules.required]"
                    required
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="form.description"
                    label="Description"
                    placeholder="Describe the repair issue and scope of work..."
                    rows="3"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Location -->
          <v-card class="mb-4">
            <v-card-title>Location</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="form.campus"
                    label="Campus *"
                    :items="campusOptions"
                    :rules="[rules.required]"
                    required
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.building_name"
                    label="Building Name *"
                    placeholder="e.g., Admin Building"
                    :rules="[rules.required]"
                    required
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.floor_number"
                    label="Floor Number"
                    placeholder="e.g., 2nd Floor"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.room_number"
                    label="Room Number"
                    placeholder="e.g., 101"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.specific_location"
                    label="Specific Location"
                    placeholder="e.g., Near window"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Status & Timeline -->
          <v-card class="mb-4">
            <v-card-title>Status & Timeline</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="form.status"
                    label="Status *"
                    :items="statusOptions"
                    :rules="[rules.required]"
                    required
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.reported_by"
                    label="Reported By"
                    placeholder="Name of person who reported"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.inspection_date"
                    label="Inspection Date"
                    type="date"
                    hint="When facility was inspected"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.start_date"
                    label="Start Date"
                    type="date"
                    hint="When repair work begins"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.end_date"
                    label="Completion Date"
                    type="date"
                    hint="Expected or actual completion"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.assigned_technician"
                    label="Assigned Technician"
                    placeholder="Name of assigned personnel"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Costs -->
          <v-card class="mb-4">
            <v-card-title>Costs</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="form.budget"
                    label="Estimated Budget (PHP)"
                    type="number"
                    placeholder="50000"
                    :rules="[rules.positiveNumber]"
                    prefix="₱"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="form.actual_cost"
                    label="Actual Cost (PHP)"
                    type="number"
                    placeholder="45000"
                    :rules="[rules.positiveNumber]"
                    prefix="₱"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Sidebar -->
        <v-col cols="12" md="4">
          <!-- Assigned Staff/Personnel -->
          <v-card class="mb-4">
            <v-card-title>Assigned Staff/Personnel</v-card-title>
            <v-divider />
            <v-card-text>
              <v-autocomplete
                v-model="form.assigned_user_ids"
                label="Assigned Staff/Personnel"
                :items="staffUsers"
                :item-title="(u: any) => `${u.last_name}, ${u.first_name}`"
                item-value="id"
                multiple
                chips
                closable-chips
                clearable
                hint="Search by name or email and assign one or more staff members"
                persistent-hint
                variant="outlined"
                density="comfortable"
                :loading="staffLoading"
                no-filter
                @update:focused="onStaffFocus"
                @update:search="onStaffSearch"
              />
            </v-card-text>
          </v-card>

          <!-- Urgency -->
          <v-card class="mb-4">
            <v-card-title>Urgency</v-card-title>
            <v-divider />
            <v-card-text>
              <v-select
                v-model="form.urgency_level"
                label="Urgency Level *"
                :items="urgencyOptions"
                :rules="[rules.required]"
                required
                variant="outlined"
                density="comfortable"
                class="mb-3"
              />
              <v-checkbox
                v-model="form.is_emergency"
                label="This is an emergency"
                color="error"
                hint="Check if immediate attention required"
              />
            </v-card-text>
          </v-card>

          <!-- Actions -->
          <v-card>
            <v-card-text>
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="submitting"
                :disabled="submitting"
              >
                Save Changes
              </v-btn>
              <v-btn
                variant="outlined"
                size="large"
                block
                class="mt-3"
                @click="goBack"
                :disabled="submitting"
              >
                Cancel
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-form>
  </div>
</template>
