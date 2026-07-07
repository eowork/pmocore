<script setup lang="ts">
import { adaptProjects, type UIProject, type BackendProject } from '~/utils/adapters'

// T-HOME (TH-10): public shell — anonymous visitors must not see the admin chrome.
definePageMeta({ layout: 'public' })

const router = useRouter()
const api = useApi()

const projects = ref<UIProject[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref('')
const filterCampus = ref('')

// MG / MF: Updated status taxonomy.
const statusFilterOptions = [
  { title: 'All',      value: ''         },
  { title: 'Proposal', value: 'PROPOSAL' },
  { title: 'Ongoing',  value: 'ONGOING'  },
  { title: 'Complete', value: 'COMPLETE' },
]
const campusFilterOptions = [
  { title: 'All Campuses', value: '' },
  { title: 'Main Campus', value: 'MAIN' },
  { title: 'Cabadbaran', value: 'CABADBARAN' },
]

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ongoing: 'info',
    completed: 'success',
    planning: 'warning',
    cancelled: 'error',
  }
  return colors[status?.toLowerCase()] || 'grey'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const filteredProjects = computed(() => {
  let result = projects.value
  if (filterStatus.value) {
    result = result.filter(p => p.status?.toUpperCase() === filterStatus.value)
  }
  if (filterCampus.value) {
    result = result.filter(p => p.campus?.toUpperCase() === filterCampus.value)
  }
  if (search.value) {
    const term = search.value.toLowerCase()
    result = result.filter(p => p.projectName.toLowerCase().includes(term))
  }
  return result
})

async function fetchProjects() {
  loading.value = true
  try {
    const response = await api.get<{ data: BackendProject[] }>(
      '/api/public/construction-projects?publication_status=PUBLISHED',
    )
    projects.value = adaptProjects(response.data || [])
  } catch (err) {
    console.error('[COI Public] Failed to fetch:', err)
  } finally {
    loading.value = false
  }
}

function viewDetail(p: UIProject) {
  router.push(`/coi/public/detail-${p.id}`)
}

onMounted(fetchProjects)
</script>

<template>
  <div class="pa-4">
    <div class="mb-4">
      <h1 class="text-h4 font-weight-bold">Infrastructure Projects</h1>
      <p class="text-subtitle-1 text-grey-darken-1">
        Published construction projects across all campuses
      </p>
    </div>

    <v-row dense class="mb-3">
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="search"
          label="Search projects..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          hide-details
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-select
          v-model="filterStatus"
          :items="statusFilterOptions"
          label="Status"
          variant="outlined"
          density="compact"
          hide-details
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-select
          v-model="filterCampus"
          :items="campusFilterOptions"
          label="Campus"
          variant="outlined"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>

    <div v-if="loading">
      <v-skeleton-loader type="card@3" />
    </div>
    <div v-else-if="filteredProjects.length === 0" class="text-center pa-8 text-grey">
      <v-icon icon="mdi-folder-open-outline" size="64" class="mb-2" />
      <p class="text-h6">No projects found</p>
    </div>
    <v-row v-else dense>
      <v-col v-for="p in filteredProjects" :key="p.id" cols="12" md="6" lg="4">
        <v-card hover @click="viewDetail(p)">
          <v-card-title class="text-truncate">{{ p.projectName }}</v-card-title>
          <v-card-subtitle>
            <v-chip size="x-small" variant="tonal" class="mr-1">{{ p.campus || '-' }}</v-chip>
            <v-chip :color="getStatusColor(p.status)" size="x-small" variant="tonal">{{ p.status }}</v-chip>
          </v-card-subtitle>
          <v-card-text>
            <div class="mb-2">
              <p class="text-caption text-grey">Physical Progress</p>
              <v-progress-linear
                :model-value="p.physicalAccomplishment"
                :color="p.physicalAccomplishment >= 100 ? 'success' : 'primary'"
                height="8"
                rounded
              />
              <span class="text-caption">{{ p.physicalAccomplishment }}%</span>
            </div>
            <div class="d-flex justify-space-between">
              <span class="text-caption">Contract:</span>
              <span class="font-weight-bold">{{ formatCurrency(p.totalContractAmount) }}</span>
            </div>
            <div class="d-flex justify-space-between">
              <span class="text-caption">Contractor:</span>
              <span class="text-truncate">{{ p.contractor || '-' }}</span>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" color="primary" @click.stop="viewDetail(p)">View Details</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
