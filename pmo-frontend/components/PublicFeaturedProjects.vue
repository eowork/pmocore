<script setup lang="ts">
// T-HOME (TH-6): featured published projects — 4/2/1 responsive card grid,
// no photos (gallery is a per-project endpoint; avoided by design decision D6).
import { getStatusColor } from '~/utils/status-colors'
import { labelForCampus } from '~/utils/campus'
import type { UIProject } from '~/utils/adapters'

const router = useRouter()
const { fetchOnce, loading, featured } = usePublicProjects()

onMounted(fetchOnce)

const featuredProjects = computed(() => featured(4))

function viewDetail(p: UIProject) {
  router.push(`/coi/public/detail-${p.id}`)
}

function progressOf(p: UIProject): number {
  return Math.min(100, Math.max(0, Number(p.physicalAccomplishment) || 0))
}
</script>

<template>
  <v-container v-if="loading || featuredProjects.length" class="py-12">
    <div class="text-center mb-8">
      <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">Featured Published Projects</h2>
      <p class="text-subtitle-1 text-figma-muted mb-0">
        A selection of infrastructure projects currently published by the PMO.
      </p>
    </div>

    <v-row v-if="loading" dense>
      <v-col v-for="n in 4" :key="n" cols="12" sm="6" lg="3">
        <v-skeleton-loader type="article, actions" height="260" rounded="lg" />
      </v-col>
    </v-row>

    <v-row v-else dense>
      <v-col
        v-for="project in featuredProjects"
        :key="project.id"
        cols="12"
        sm="6"
        lg="3"
      >
        <v-card
          class="h-100 d-flex flex-column featured-card"
          variant="elevated"
          hover
          @click="viewDetail(project)"
        >
          <div
            class="featured-card-header d-flex align-center justify-center"
            :class="`bg-${getStatusColor(project.status)}`"
          >
            <v-icon icon="mdi-office-building" size="40" color="white" />
          </div>
          <v-card-item>
            <v-card-title class="text-subtitle-1 font-weight-bold text-figma-primary featured-card-title">
              {{ project.projectName }}
            </v-card-title>
          </v-card-item>
          <v-card-text class="flex-grow-1 pt-0">
            <div class="d-flex flex-wrap ga-1 mb-3">
              <v-chip size="x-small" variant="tonal" :color="getStatusColor(project.status)">
                {{ project.status }}
              </v-chip>
              <v-chip size="x-small" variant="tonal" color="figma-muted" prepend-icon="mdi-map-marker-outline">
                {{ labelForCampus(project.campus) }}
              </v-chip>
            </div>
            <div v-if="project.primaryFundingSource || project.fundSource" class="text-caption text-figma-muted mb-3">
              <v-icon size="14" class="mr-1">mdi-cash-multiple</v-icon>
              {{ project.primaryFundingSource || project.fundSource }}
            </div>
            <div class="d-flex align-center justify-space-between mb-1">
              <span class="text-caption text-figma-muted">Physical progress</span>
              <span class="text-caption font-weight-bold text-figma-primary">{{ progressOf(project) }}%</span>
            </div>
            <v-progress-linear
              :model-value="progressOf(project)"
              :color="getStatusColor(project.status)"
              height="6"
              rounded
              :aria-label="`Physical progress ${progressOf(project)} percent`"
            />
          </v-card-text>
          <v-card-actions>
            <v-btn color="figma-primary" variant="text" append-icon="mdi-arrow-right">
              View Details
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <div v-if="!loading" class="text-center mt-6">
      <v-btn to="/coi/public" variant="text" class="csu-accent" append-icon="mdi-arrow-right">
        View all published projects
      </v-btn>
    </div>
  </v-container>
</template>

<style scoped>
.featured-card {
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.featured-card:hover {
  transform: translateY(-2px);
}

.featured-card-header {
  height: 72px;
  opacity: 0.85;
}

.featured-card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
  line-height: 1.3;
  min-height: 2.6em;
}
</style>
