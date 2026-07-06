<script setup lang="ts">
import {
  adaptProjectDetail,
  adaptGalleryItem,
  qualifyBackendUrl,
  type UIProjectDetail,
  type BackendProjectDetail,
  type BackendGalleryItem,
  type UIGalleryItem,
} from '~/utils/adapters'

definePageMeta({})

const route = useRoute()
const router = useRouter()
const api = useApi()
const { public: { apiBase } } = useRuntimeConfig()

const project = ref<UIProjectDetail | null>(null)
const gallery = ref<UIGalleryItem[]>([])
const loading = ref(true)
const loadingGallery = ref(false)

const projectId = route.params.id as string

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ongoing: 'info',
    completed: 'success',
    planning: 'warning',
    cancelled: 'error',
    not_started: 'grey',
    in_progress: 'info',
    done: 'success',
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

function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRate(value: number): string {
  return `${(value || 0).toFixed(2)}%`
}

async function fetchProject() {
  loading.value = true
  try {
    const response = await api.get<BackendProjectDetail>(
      `/api/public/construction-projects/${projectId}`,
    )
    project.value = adaptProjectDetail(response)
  } catch (err) {
    console.error('[COI Public Detail] Failed to fetch:', err)
  } finally {
    loading.value = false
  }
}

async function fetchGallery() {
  loadingGallery.value = true
  try {
    const res = await api.get<{ data: BackendGalleryItem[] }>(
      `/api/public/construction-projects/${projectId}/gallery`,
    )
    gallery.value = (res.data || []).map((b) => adaptGalleryItem(b, apiBase))
  } catch (err) {
    console.error('[COI Public Detail] Failed to fetch gallery:', err)
  } finally {
    loadingGallery.value = false
  }
}

function goBack() {
  router.push('/coi/public')
}

onMounted(() => {
  fetchProject()
  fetchGallery()
})
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center ga-3 mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
      <div>
        <h1 class="text-h4 font-weight-bold">{{ project?.projectName || 'Project Details' }}</h1>
        <p class="text-subtitle-1 text-grey-darken-1">{{ project?.projectCode || '' }}</p>
      </div>
    </div>

    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article, table" />
    </v-card>

    <template v-else-if="project">
      <!-- Status & Progress -->
      <v-card class="mb-4">
        <v-card-text>
          <div class="d-flex flex-wrap ga-6 align-center">
            <div>
              <p class="text-caption text-grey mb-1">Status</p>
              <v-chip :color="getStatusColor(project.status)" size="large">{{ project.status }}</v-chip>
            </div>
            <div style="min-width: 200px">
              <p class="text-caption text-grey mb-1">Physical Progress</p>
              <v-progress-linear
                :model-value="project.physicalAccomplishment"
                :color="project.physicalAccomplishment >= 100 ? 'success' : 'primary'"
                height="10"
                rounded
              />
              <span class="font-weight-bold">{{ project.physicalAccomplishment }}%</span>
            </div>
            <div>
              <p class="text-caption text-grey mb-1">Contract Amount</p>
              <p class="text-h5 font-weight-bold text-primary">
                {{ formatCurrency(project.totalContractAmount) }}
              </p>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col cols="12" md="8">
          <!-- Project Info -->
          <v-card class="mb-4">
            <v-card-title>Project Information</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Start Date</p>
                  <p class="font-weight-medium">{{ formatDate(project.startDate) }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Target Completion</p>
                  <p class="font-weight-medium">{{ formatDate(project.targetCompletionDate) }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Project Engineer</p>
                  <p class="font-weight-medium">{{ project.projectEngineer || '-' }}</p>
                </v-col>
                <v-col cols="12" sm="6">
                  <p class="text-caption text-grey">Project Manager</p>
                  <p class="font-weight-medium">{{ project.projectManager || '-' }}</p>
                </v-col>
                <v-col cols="12">
                  <p class="text-caption text-grey">Description</p>
                  <p>{{ project.description || '-' }}</p>
                </v-col>
                <v-col v-if="project.beneficiaries != null" cols="12">
                  <p class="text-caption text-grey">Beneficiaries</p>
                  <p>{{ project.beneficiaries.toLocaleString() }}</p>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- KT-A: Project Narrative (summary, scope, facilities) -->
          <v-card
            v-if="project.summary || project.scope || project.facilities"
            class="mb-4"
          >
            <v-card-title>Project Narrative</v-card-title>
            <v-divider />
            <v-card-text>
              <div v-if="project.summary" class="mb-4">
                <p class="text-caption text-grey mb-1">Summary</p>
                <p style="white-space: pre-line">{{ project.summary }}</p>
              </div>
              <div v-if="project.scope" class="mb-4">
                <p class="text-caption text-grey mb-1">Scope</p>
                <p style="white-space: pre-line">{{ project.scope }}</p>
              </div>
              <div v-if="project.facilities">
                <p class="text-caption text-grey mb-1">Facilities</p>
                <p style="white-space: pre-line">{{ project.facilities }}</p>
              </div>
            </v-card-text>
          </v-card>

          <!-- Milestones (read-only) -->
          <v-card class="mb-4">
            <v-card-title>Milestones</v-card-title>
            <v-divider />
            <v-data-table
              :items="project.milestones"
              :headers="[
                { title: 'Milestone', key: 'name' },
                { title: 'Description', key: 'description' },
                { title: 'Target Date', key: 'targetDate' },
                { title: 'Actual Date', key: 'actualDate' },
                { title: 'Status', key: 'status' },
              ]"
              density="comfortable"
              class="elevation-0"
            >
              <template #item.targetDate="{ item }">{{ formatDate(item.targetDate) }}</template>
              <template #item.actualDate="{ item }">{{ formatDate(item.actualDate) }}</template>
              <template #item.status="{ item }">
                <v-chip :color="getStatusColor(item.status)" size="small">{{ item.status }}</v-chip>
              </template>
              <template #no-data>
                <div class="text-center pa-4 text-grey">No milestones</div>
              </template>
            </v-data-table>
          </v-card>

          <!-- ME: POW section removed -->

          <!-- Gallery -->
          <v-card class="mb-4">
            <v-card-title>Gallery</v-card-title>
            <v-divider />
            <v-card-text>
              <div v-if="loadingGallery"><v-skeleton-loader type="image@4" /></div>
              <div v-else-if="gallery.length === 0" class="text-center pa-4 text-grey">
                No images available
              </div>
              <v-row v-else dense>
                <v-col v-for="item in gallery" :key="item.id" cols="6" md="3">
                  <v-card>
                    <v-img :src="item.imageUrl" aspect-ratio="1" cover />
                    <v-card-text class="pa-2">
                      <p class="text-caption text-truncate">{{ item.caption || item.category }}</p>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <!-- KT-B: Strategic Profile -->
          <v-card
            v-if="project.strategicAlignment || project.objectives?.length || project.keyFeatures?.length || project.outputIndicators?.length || project.outcomeIndicators?.length"
            class="mb-4"
          >
            <v-card-title>Strategic Profile</v-card-title>
            <v-divider />
            <v-card-text>
              <div v-if="project.strategicAlignment" class="mb-4">
                <p class="text-caption text-grey mb-1">Strategic Alignment</p>
                <p>{{ project.strategicAlignment }}</p>
              </div>
              <div v-if="project.objectives?.length" class="mb-4">
                <p class="text-caption text-grey mb-1">Objectives</p>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip v-for="obj in project.objectives" :key="obj" size="small" variant="tonal">{{ obj }}</v-chip>
                </div>
              </div>
              <div v-if="project.keyFeatures?.length" class="mb-4">
                <p class="text-caption text-grey mb-1">Key Features</p>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip v-for="feat in project.keyFeatures" :key="feat" size="small" variant="tonal" color="secondary">{{ feat }}</v-chip>
                </div>
              </div>
              <div v-if="project.outputIndicators?.length" class="mb-4">
                <p class="text-caption text-grey mb-1">Output Indicators</p>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip v-for="ind in project.outputIndicators" :key="ind" size="small" variant="tonal" color="info">{{ ind }}</v-chip>
                </div>
              </div>
              <div v-if="project.outcomeIndicators?.length">
                <p class="text-caption text-grey mb-1">Outcome Indicators</p>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip v-for="ind in project.outcomeIndicators" :key="ind" size="small" variant="tonal" color="success">{{ ind }}</v-chip>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- Building Details -->
          <v-card class="mb-4">
            <v-card-title>Building Details</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item>
                <v-list-item-title>Building Type</v-list-item-title>
                <v-list-item-subtitle>{{ project.buildingType || '-' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Floor Area</v-list-item-title>
                <v-list-item-subtitle>{{ project.floorArea ? `${project.floorArea} sqm` : '-' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Number of Floors</v-list-item-title>
                <v-list-item-subtitle>{{ project.numberOfFloors || '-' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- Contractor & Funding -->
          <v-card class="mb-4">
            <v-card-title>Contractor & Funding</v-card-title>
            <v-divider />
            <v-list>
              <v-list-item>
                <v-list-item-title>Contractor</v-list-item-title>
                <v-list-item-subtitle>{{ project.contractor || '-' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Fund Source</v-list-item-title>
                <v-list-item-subtitle>{{ project.fundSource || '-' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- KT-C: Project Team -->
          <v-card v-if="project.assignedUsers?.length" class="mb-4">
            <v-card-title>Project Team</v-card-title>
            <v-divider />
            <v-list lines="two">
              <v-list-item
                v-for="member in project.assignedUsers"
                :key="member.id"
                :title="member.name"
                :subtitle="[member.role, member.department].filter(Boolean).join(' · ')"
                prepend-icon="mdi-account"
              />
            </v-list>
          </v-card>

          <!-- Financials -->
          <v-card class="mb-4">
            <v-card-title>Financial Records</v-card-title>
            <v-divider />
            <v-data-table
              v-if="project.financials.length > 0"
              :items="project.financials"
              :headers="[
                { title: 'FY', key: 'fiscalYear', align: 'center' },
                { title: 'Appropriation', key: 'appropriation', align: 'end' },
                { title: 'Obligation', key: 'obligation', align: 'end' },
                { title: 'Disbursement', key: 'disbursement', align: 'end' },
                { title: 'Util.', key: 'utilizationRate', align: 'end' },
              ]"
              density="compact"
              class="elevation-0"
            >
              <template #item.appropriation="{ item }">{{ formatCurrency(item.appropriation) }}</template>
              <template #item.obligation="{ item }">{{ formatCurrency(item.obligation) }}</template>
              <template #item.disbursement="{ item }">{{ formatCurrency(item.disbursement) }}</template>
              <template #item.utilizationRate="{ item }">{{ formatRate(item.utilizationRate) }}</template>
            </v-data-table>
            <v-card-text v-else class="text-center text-grey">
              No financial records
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
