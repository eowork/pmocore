<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const api = useApi()
const toast = useToast()

const loading = ref(false)
const submitting = ref(false)

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
  urgency_level: 'MEDIUM',
  is_emergency: false,
  campus: '',
  status: 'REPORTED',
  reported_by: '',
  budget: null as number | null,
  assigned_technician: '',
  // Phase AW: Multi-select assignment
  assigned_user_ids: [] as string[],
})

// Phase AO: staff for the assignment dropdown. The search runs on the server; the ids already
// picked are held so narrowing the list never blanks a chip.
const { staffUsers, staffLoading, loadStaff, onStaffSearch, onStaffFocus } = useStaffSearch({
  heldIds: () => form.value.assigned_user_ids,
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

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  positiveNumber: (v: number | null) => v === null || v >= 0 || 'Must be a positive number',
}

// Fetch lookup data
async function fetchLookups() {
  loading.value = true
  try {
    const response = await api.get<{ data: { id: string; name: string }[] }>('/api/repair-types')
    repairTypes.value = response.data || []
  } catch (err) {
    console.error('Failed to fetch repair types:', err)
  } finally {
    loading.value = false
  }
}

// Submit form
async function handleSubmit() {
  submitting.value = true

  try {
    // Do NOT send project_id - backend will create base projects record and generate ID
    const payload = {
      project_code: form.value.project_code,
      title: form.value.title,
      description: form.value.description || undefined,
      building_name: form.value.building_name,
      floor_number: form.value.floor_number || undefined,
      room_number: form.value.room_number || undefined,
      specific_location: form.value.specific_location || undefined,
      repair_type_id: form.value.repair_type_id,
      urgency_level: form.value.urgency_level,
      is_emergency: form.value.is_emergency,
      campus: form.value.campus,
      status: form.value.status,
      reported_by: form.value.reported_by || undefined,
      budget: form.value.budget || undefined,
      assigned_technician: form.value.assigned_technician || undefined,
      // Phase AW: Multi-select assignment
      assigned_user_ids: form.value.assigned_user_ids.length > 0 ? form.value.assigned_user_ids : undefined,
    }

    console.log('[Repairs Create] Submitting:', payload)
    await api.post('/api/repair-projects', payload)
    toast.success('Repair request created successfully')
    router.push('/repairs')
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to create repair request')
    console.error('[Repairs Create] Failed:', err)
  } finally {
    submitting.value = false
  }
}

// Navigation
function goBack() {
  router.push('/repairs')
}

onMounted(() => {
  fetchLookups()
  // Phase AV: an unfiltered first page (global, no campus filter) so the dropdown has
  // something to show before anything is typed.
  void loadStaff()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center ga-3 mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          New Repair Request
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Submit a new facility repair request
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
                    label="Repair Type *"
                    :items="repairTypes"
                    item-title="name"
                    item-value="id"
                    :rules="[rules.required]"
                    required
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

          <!-- Status & Assignment -->
          <v-card class="mb-4">
            <v-card-title>Status & Assignment</v-card-title>
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
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.assigned_technician"
                    label="Assigned Technician"
                    placeholder="Name of assigned personnel"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
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
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Sidebar -->
        <v-col cols="12" md="4">
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

          <!-- Phase AW: Multi-select Assignment Card -->
          <v-card class="mb-4">
            <v-card-title>Assigned Staff</v-card-title>
            <v-divider />
            <v-card-text>
              <v-autocomplete
                v-model="form.assigned_user_ids"
                label="Assign To"
                :items="staffUsers"
                :item-title="(item: any) => `${item.last_name}, ${item.first_name}`"
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
                Submit Repair Request
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
