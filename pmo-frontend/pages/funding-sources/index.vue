<script setup lang="ts">
import { adaptFundingSources, type UIFundingSource, type BackendFundingSource } from '~/utils/adapters'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const api = useApi()
const toast = useToast()
const { canAdd, canEdit, canDelete } = usePermissions()

// View funding source (edit page doubles as detail for reference data)
function viewSource(source: UIFundingSource) {
  router.push(`/funding-sources/edit-${source.id}`)
}

const fundingSources = ref<UIFundingSource[]>([])
const search = ref('')
const loading = ref(true)
const deleting = ref(false)
const deleteDialog = ref(false)
const sourceToDelete = ref<UIFundingSource | null>(null)

// Table headers
const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Created', key: 'createdAt', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center' as const },
]

// Navigation
function editSource(source: UIFundingSource) {
  router.push(`/funding-sources/edit-${source.id}`)
}

function createSource() {
  router.push('/funding-sources/new')
}

// Delete confirmation
function confirmDelete(source: UIFundingSource) {
  sourceToDelete.value = source
  deleteDialog.value = true
}

async function deleteSource() {
  if (!sourceToDelete.value) return
  deleting.value = true
  try {
    await api.del(`/api/funding-sources/${sourceToDelete.value.id}`)
    const deletedName = sourceToDelete.value.name
    fundingSources.value = fundingSources.value.filter(s => s.id !== sourceToDelete.value!.id)
    toast.success(`Funding source "${deletedName}" deleted successfully`)
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to delete funding source')
    console.error('Failed to delete funding source:', err)
  } finally {
    deleting.value = false
    deleteDialog.value = false
    sourceToDelete.value = null
  }
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

// Filtered sources
const filteredSources = computed(() => {
  if (!search.value) return fundingSources.value
  const term = search.value.toLowerCase()
  return fundingSources.value.filter(
    (s) =>
      s.name.toLowerCase().includes(term) ||
      s.description.toLowerCase().includes(term)
  )
})

async function fetchSources() {
  loading.value = true
  try {
    // Every page of the list, not just the first: the endpoint answers with 20 rows by
    // default, and this page filters, sorts and paginates in the browser over whatever
    // it is handed — so the rest of the table was unreachable.
    const { rows, total, truncated } = await fetchAllPages<BackendFundingSource>((page, limit) =>
      api.get<{ data: BackendFundingSource[]; meta?: { total: number; totalPages: number } }>(
        `/api/funding-sources?page=${page}&limit=${limit}`,
      ),
    )
    fundingSources.value = adaptFundingSources(rows)
    if (truncated) {
      toast.warning(`Showing the first ${rows.length} of ${total} funding sources. Narrow the filters to see the rest.`)
    }
  } catch (err: unknown) {
    const error = err as { message?: string }
    toast.error(error.message || 'Failed to load funding sources')
    console.error('Failed to fetch funding sources:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchSources)
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          Funding Sources
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Manage funding source records
        </p>
      </div>
      <v-btn v-if="canAdd('funding-sources')" color="primary" prepend-icon="mdi-plus" @click="createSource">
        New Funding Source
      </v-btn>
    </div>

    <!-- Data Table Card -->
    <v-card>
      <!-- Toolbar -->
      <v-card-title class="d-flex align-center pa-4">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search funding sources"
          single-line
          hide-details
          density="compact"
          variant="outlined"
          class="mr-4"
          style="max-width: 300px"
        />
        <v-spacer />
        <v-chip color="primary" variant="tonal">
          {{ filteredSources.length }} sources
        </v-chip>
      </v-card-title>

      <v-divider />

      <!-- Table -->
      <v-data-table
        :key="fundingSources.length"
        :headers="headers"
        :items="filteredSources"
        :loading="loading"
        :search="search"
        item-value="id"
        hover
        class="elevation-0"
      >
        <!-- Name -->
        <template #item.name="{ item }">
          <span class="font-weight-medium">{{ item.name }}</span>
        </template>

        <!-- Description -->
        <template #item.description="{ item }">
          <span class="text-truncate" style="max-width: 300px; display: inline-block;">
            {{ item.description || '-' }}
          </span>
        </template>

        <!-- Created Date -->
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
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
              />
            </template>
            <v-list density="compact" min-width="150">
              <!-- View -->
              <v-list-item @click="viewSource(item)" prepend-icon="mdi-eye">
                <v-list-item-title>View</v-list-item-title>
              </v-list-item>

              <!-- Edit -->
              <v-list-item
                v-if="canEdit('funding-sources')"
                @click="editSource(item)"
                prepend-icon="mdi-pencil"
              >
                <v-list-item-title>Edit</v-list-item-title>
              </v-list-item>

              <!-- Divider before Delete -->
              <v-divider v-if="canDelete('funding-sources')" class="my-1" />

              <!-- Delete -->
              <v-list-item
                v-if="canDelete('funding-sources')"
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
            <v-icon icon="mdi-cash-multiple" size="64" color="grey-lighten-1" class="mb-4" />
            <p class="text-h6 text-grey-darken-1">No funding sources found</p>
            <p class="text-body-2 text-grey">Funding sources will appear here once added</p>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ sourceToDelete?.name }}</strong>?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false" :disabled="deleting">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="deleteSource" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
