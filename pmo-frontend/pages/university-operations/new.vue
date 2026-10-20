<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const route = useRoute()
const api = useApi()
const toast = useToast()

const loading = ref(false)
const submitting = ref(false)

// Phase CX-B: Query params from pillar-based navigation
const pillarParam = computed(() => route.query.pillar as string || '')
const yearParam = computed(() => route.query.year ? Number(route.query.year) : null)

// Pillar display name mapping
const pillarDisplayNames: Record<string, string> = {
  'HIGHER_EDUCATION': 'Higher Education Program',
  'ADVANCED_EDUCATION': 'Advanced Education Program',
  'RESEARCH': 'Research Program',
  'TECHNICAL_ADVISORY': 'Technical Advisory Extension Program',
}

// Form data
const form = ref({
  title: '',
  description: '',
  code: '',
  operation_type: '',
  campus: '',
  status: 'PLANNING',
  start_date: '',
  end_date: '',
  budget: null as number | null,
  // Phase BD: Fiscal year for BAR1 year-based filtering
  fiscal_year: null as number | null,
  // Phase AW: Multi-select assignment
  assigned_user_ids: [] as string[],
})

// Phase AO: staff for the assignment dropdown. The search runs on the server; the ids already
// picked are held so narrowing the list never blanks a chip.
const { staffUsers, staffLoading, loadStaff, onStaffSearch, onStaffFocus } = useStaffSearch({
  heldIds: () => form.value.assigned_user_ids,
})

// Dropdown options
const operationTypeOptions = [
  { title: 'Higher Education', value: 'HIGHER_EDUCATION' },
  { title: 'Advanced Education', value: 'ADVANCED_EDUCATION' },
  { title: 'Research', value: 'RESEARCH' },
  { title: 'Technical Advisory', value: 'TECHNICAL_ADVISORY' },
]

const campusOptions = [
  { title: 'Main Campus', value: 'MAIN' },
  { title: 'Cabadbaran Campus', value: 'CABADBARAN' },
  { title: 'Both Campuses', value: 'BOTH' },
]

const statusOptions = [
  { title: 'Planning', value: 'PLANNING' },
  { title: 'Ongoing', value: 'ONGOING' },
  { title: 'Completed', value: 'COMPLETED' },
  { title: 'On Hold', value: 'ON_HOLD' },
  { title: 'Cancelled', value: 'CANCELLED' },
]

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
  positiveNumber: (v: number | null) => v === null || v >= 0 || 'Must be a positive number',
}

onMounted(() => {
  // Phase AV: an unfiltered first page (global, no campus filter) so the dropdown has
  // something to show before anything is typed.
  void loadStaff()

  // Phase CX-B: Pre-fill form from query params
  if (pillarParam.value) {
    form.value.operation_type = pillarParam.value
  }
  if (yearParam.value) {
    form.value.fiscal_year = yearParam.value
  }
  // Auto-generate title based on pillar and year
  if (pillarParam.value && yearParam.value) {
    const pillarName = pillarDisplayNames[pillarParam.value] || pillarParam.value
    form.value.title = `${pillarName} - FY ${yearParam.value}`
  }
})

// Submit form
async function handleSubmit() {
  submitting.value = true

  try {
    const payload = {
      title: form.value.title,
      description: form.value.description || undefined,
      code: form.value.code || undefined,
      operation_type: form.value.operation_type,
      campus: form.value.campus,
      status: form.value.status,
      start_date: form.value.start_date || undefined,
      end_date: form.value.end_date || undefined,
      budget: form.value.budget || undefined,
      // Phase BD: Fiscal year
      fiscal_year: form.value.fiscal_year || undefined,
      // Phase AW: Multi-select assignment
      assigned_user_ids: form.value.assigned_user_ids.length > 0 ? form.value.assigned_user_ids : undefined,
    }

    console.log('[UniOps Create] Submitting:', payload)
    const result = await api.post<{ id: string }>('/api/university-operations', payload)

    toast.success('Operation created successfully')

    // Phase DA-D: Redirect to physical view after creation
    router.push('/university-operations/physical')
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to create operation')
    console.error('[UniOps Create] Failed:', err)
  } finally {
    submitting.value = false
  }
}

// Navigation - Use router.back() for context-aware return
function goBack() {
  router.back()
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center ga-3 mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          {{ pillarParam ? `New ${pillarDisplayNames[pillarParam] || pillarParam}` : 'New University Operation' }}
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          {{ pillarParam && yearParam
            ? `Create quarterly data entry for FY ${yearParam}`
            : 'Create a new university operation or program' }}
        </p>
      </div>
    </div>

    <!-- Phase CX-B: Context alert when creating from pillar navigation -->
    <v-alert
      v-if="pillarParam && yearParam"
      type="info"
      variant="tonal"
      class="mb-4"
      closable
    >
      <strong>Creating operation for:</strong> {{ pillarDisplayNames[pillarParam] }} - Fiscal Year {{ yearParam }}
      <br>
      <span class="text-caption">This operation will be linked to the fixed indicator taxonomy for this pillar.</span>
    </v-alert>

    <!-- Form -->
    <v-form @submit.prevent="handleSubmit">
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
                    v-model="form.code"
                    label="Operation Code"
                    placeholder="UO-2026-001"
                    hint="Unique operation identifier"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="form.operation_type"
                    label="Operation Type *"
                    :items="operationTypeOptions"
                    :rules="[rules.required]"
                    required
                    variant="outlined"
                    density="comfortable"
                    :disabled="!!pillarParam"
                    :hint="pillarParam ? 'Locked to pillar from navigation' : undefined"
                    :persistent-hint="!!pillarParam"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model="form.title"
                    label="Title *"
                    placeholder="e.g., Graduate School Enrollment Drive"
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
                    placeholder="Describe the operation objectives and scope..."
                    rows="3"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
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
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Schedule & Budget -->
          <v-card class="mb-4">
            <v-card-title>Schedule & Budget</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.start_date"
                    label="Start Date"
                    type="date"
                    hint="Operation start date"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.end_date"
                    label="End Date"
                    type="date"
                    hint="Estimated end date"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="form.budget"
                    label="Budget (PHP)"
                    type="number"
                    placeholder="500000.00"
                    :rules="[rules.positiveNumber]"
                    prefix="₱"
                    variant="outlined"
                    density="comfortable"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model.number="form.fiscal_year"
                    label="Fiscal Year"
                    type="number"
                    placeholder="2026"
                    :hint="yearParam ? 'Locked to fiscal year from navigation' : 'BAR1 reporting fiscal year (e.g. 2026)'"
                    persistent-hint
                    variant="outlined"
                    density="comfortable"
                    :disabled="!!yearParam"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Sidebar -->
        <v-col cols="12" md="4">
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
                Create Operation
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
