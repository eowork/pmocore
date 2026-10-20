<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const api = useApi()
const toast = useToast()

const records = ref<any[]>([])
const search = ref('')
const loading = ref(true)
const createDialog = ref(false)

// Form data
const form = ref({
  title: '',
  description: '',
  category: '',
  priority: '',
  status: '',
  target_beneficiaries: null as number | null,
  actual_beneficiaries: null as number | null,
  target_budget: null as number | null,
  actual_budget: null as number | null,
  year: '',
  responsible: '',
})

const submitting = ref(false)

// Table headers
const headers = [
  { title: 'Title', key: 'title', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Priority', key: 'priority', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Target', key: 'target_beneficiaries', align: 'center' as const },
  { title: 'Actual', key: 'actual_beneficiaries', align: 'center' as const },
  { title: 'Year', key: 'year', sortable: true },
]

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
}

// Priority options
const priorityOptions = ['High', 'Medium', 'Low']
const statusOptions = ['Pending', 'In Progress', 'Completed', 'Cancelled']

// Reset form
function resetForm() {
  form.value = {
    title: '',
    description: '',
    category: '',
    priority: '',
    status: '',
    target_beneficiaries: null,
    actual_beneficiaries: null,
    target_budget: null,
    actual_budget: null,
    year: '',
    responsible: '',
  }
}

// Submit form
async function handleSubmit() {
  submitting.value = true
  try {
    await api.post('/api/gad/gpb-accomplishments', form.value)
    toast.success('GPB accomplishment created successfully')
    createDialog.value = false
    resetForm()
    await fetchRecords()
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to create record')
    console.error('[GAD GPB] Failed to create:', err)
  } finally {
    submitting.value = false
  }
}

// Format currency
function formatCurrency(amount: number): string {
  if (!amount) return '-'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Filtered records
const filteredRecords = computed(() => {
  if (!search.value) return records.value
  const term = search.value.toLowerCase()
  return records.value.filter(
    (r) =>
      r.title?.toLowerCase().includes(term) ||
      r.category?.toLowerCase().includes(term)
  )
})

// Fetch records
async function fetchRecords() {
  try {
    // Every page of the list, not just the first: the endpoint answers with 20 rows by
    // default, and this page filters, sorts and paginates in the browser over whatever
    // it is handed — so the rest of the table was unreachable.
    const { rows, total, truncated } = await fetchAllPages<any>((page, limit) =>
      api.get<{ data: any[]; meta?: { total: number; totalPages: number } }>(
        `/api/gad/gpb-accomplishments?page=${page}&limit=${limit}`,
      ),
    )
    records.value = rows
    if (truncated) {
      toast.warning(`Showing the first ${rows.length} of ${total} records. Narrow the filters to see the rest.`)
    }
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to load records')
    console.error('[GAD GPB] Failed to fetch:', err)
  } finally {
    loading.value = false
  }
}

// Navigation
function goBack() {
  router.push('/gad')
}

onMounted(fetchRecords)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <h1 class="text-h4 font-weight-bold text-grey-darken-3">
            GPB Accomplishments
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            Gender and Development Plan accomplishments
          </p>
        </div>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="createDialog = true">
        Add Record
      </v-btn>
    </div>

    <!-- Data Table Card -->
    <v-card>
      <v-card-title class="d-flex align-center pa-4">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search records"
          single-line
          hide-details
          density="compact"
          variant="outlined"
          class="mr-4"
          style="max-width: 300px"
        />
        <v-spacer />
        <v-chip color="primary" variant="tonal">
          {{ filteredRecords.length }} records
        </v-chip>
      </v-card-title>

      <v-divider />

      <v-data-table
        :key="records.length"
        :headers="headers"
        :items="filteredRecords"
        :loading="loading"
        item-value="id"
        hover
        class="elevation-0"
      >
        <template #item.title="{ item }">
          <span class="font-weight-medium">{{ item.title }}</span>
        </template>
        <template #item.status="{ item }">
          <v-chip size="small" variant="tonal">{{ item.status || '-' }}</v-chip>
        </template>
        <template #loading>
          <v-skeleton-loader type="table-row@5" />
        </template>
        <template #no-data>
          <div class="text-center pa-6">
            <v-icon icon="mdi-chart-bar" size="64" color="grey-lighten-1" class="mb-4" />
            <p class="text-h6 text-grey-darken-1">No records found</p>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Create Dialog -->
    <v-dialog v-model="createDialog" max-width="700">
      <v-card>
        <v-card-title class="text-h6">Add GPB Accomplishment</v-card-title>
        <v-divider />
        <v-form @submit.prevent="handleSubmit">
          <v-card-text>
            <v-row>
              <v-col cols="12">
                <v-text-field v-model="form.title" label="Title" :rules="[rules.required]" required variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="form.description" label="Description" rows="2" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.category" label="Category" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="form.priority" label="Priority" :items="priorityOptions" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="form.status" label="Status" :items="statusOptions" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.year" label="Year" variant="outlined" density="comfortable" placeholder="2025" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.target_beneficiaries" label="Target Beneficiaries" type="number" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.actual_beneficiaries" label="Actual Beneficiaries" type="number" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.target_budget" label="Target Budget (PHP)" type="number" prefix="₱" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.actual_budget" label="Actual Budget (PHP)" type="number" prefix="₱" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="form.responsible" label="Responsible Office/Person" variant="outlined" density="comfortable" />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="createDialog = false">Cancel</v-btn>
            <v-btn type="submit" color="primary" :loading="submitting">Save</v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </div>
</template>
