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
const deleteDialog = ref(false)
const recordToDelete = ref<any>(null)
const createDialog = ref(false)
const deleting = ref(false)

// Form data
const form = ref({
  academic_year: '',
  indigenous_category: '',
  subcategory: '',
  total_participants: null as number | null,
  male_count: null as number | null,
  female_count: null as number | null,
})

const submitting = ref(false)

// Table headers
const headers = [
  { title: 'Academic Year', key: 'academic_year', sortable: true },
  { title: 'Category', key: 'indigenous_category', sortable: true },
  { title: 'Subcategory', key: 'subcategory', sortable: true },
  { title: 'Total', key: 'total_participants', align: 'center' as const },
  { title: 'Male', key: 'male_count', align: 'center' as const },
  { title: 'Female', key: 'female_count', align: 'center' as const },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center' as const },
]

// Validation rules
const rules = {
  required: (v: string) => !!v || 'This field is required',
}

// Reset form
function resetForm() {
  form.value = {
    academic_year: '',
    indigenous_category: '',
    subcategory: '',
    total_participants: null,
    male_count: null,
    female_count: null,
  }
}

// Submit form
async function handleSubmit() {
  submitting.value = true
  try {
    await api.post('/api/gad/indigenous-parity', form.value)
    toast.success('Indigenous parity record created successfully')
    createDialog.value = false
    resetForm()
    await fetchRecords()
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to create record')
    console.error('[GAD Indigenous] Failed to create:', err)
  } finally {
    submitting.value = false
  }
}

// Delete
function confirmDelete(record: any) {
  recordToDelete.value = record
  deleteDialog.value = true
}

async function deleteRecord() {
  if (!recordToDelete.value) return
  deleting.value = true
  try {
    await api.del(`/api/gad/indigenous-parity/${recordToDelete.value.id}`)
    records.value = records.value.filter(r => r.id !== recordToDelete.value.id)
    toast.success('Record deleted successfully')
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to delete record')
    console.error('[GAD Indigenous] Failed to delete:', err)
  } finally {
    deleting.value = false
    deleteDialog.value = false
    recordToDelete.value = null
  }
}

// Filtered records
const filteredRecords = computed(() => {
  if (!search.value) return records.value
  const term = search.value.toLowerCase()
  return records.value.filter(
    (r) =>
      r.academic_year?.toLowerCase().includes(term) ||
      r.indigenous_category?.toLowerCase().includes(term)
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
        `/api/gad/indigenous-parity?page=${page}&limit=${limit}`,
      ),
    )
    records.value = rows
    if (truncated) {
      toast.warning(`Showing the first ${rows.length} of ${total} records. Narrow the filters to see the rest.`)
    }
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to load records')
    console.error('[GAD Indigenous] Failed to fetch:', err)
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
            Indigenous Parity
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            Monitor indigenous peoples participation
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
        <template #item.actions="{ item }">
          <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
        </template>
        <template #loading>
          <v-skeleton-loader type="table-row@5" />
        </template>
        <template #no-data>
          <div class="text-center pa-6">
            <v-icon icon="mdi-account-heart" size="64" color="grey-lighten-1" class="mb-4" />
            <p class="text-h6 text-grey-darken-1">No records found</p>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Create Dialog -->
    <v-dialog v-model="createDialog" max-width="600">
      <v-card>
        <v-card-title class="text-h6">Add Indigenous Parity Record</v-card-title>
        <v-divider />
        <v-form @submit.prevent="handleSubmit">
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.academic_year" label="Academic Year" :rules="[rules.required]" required variant="outlined" density="comfortable" placeholder="2024-2025" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.indigenous_category" label="Indigenous Category" :rules="[rules.required]" required variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.subcategory" label="Subcategory" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.total_participants" label="Total Participants" type="number" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.male_count" label="Male Count" type="number" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="form.female_count" label="Female Count" type="number" variant="outlined" density="comfortable" />
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

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">Confirm Delete</v-card-title>
        <v-card-text>Are you sure you want to delete this record?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false" :disabled="deleting">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="deleteRecord" :loading="deleting" :disabled="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
