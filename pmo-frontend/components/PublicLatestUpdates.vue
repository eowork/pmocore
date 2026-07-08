<script setup lang="ts">
// T-HOME (TH-8): latest updates — recently updated published projects.
import { getStatusColor } from '~/utils/status-colors'
import { labelForCampus } from '~/utils/campus'
import { formatRelativeDate } from '~/utils/date-utils'
import { formatDate } from '~/utils/userFormat'

const { fetchOnce, loading, latestUpdated } = usePublicProjects()
const { sectionsConfig } = useHomepageContent()

onMounted(fetchOnce)

const updates = computed(() => latestUpdated(5))

// T-HOME-CMS-8 (TH8-2/TH8-3/TH8-4)
defineProps<{ variant?: 'neutral' | 'white' }>()
const emptyBehavior = computed(
  () => sectionsConfig.value.find(s => s.key === 'latest_updates')?.emptyBehavior ?? 'placeholder',
)
// Not "empty" while still loading — the skeleton loader covers that state.
const isEmpty = computed(() => !loading.value && !updates.value.length)
</script>

<template>
  <PublicSectionBand
    :variant="variant"
    :is-empty="isEmpty"
    :empty-behavior="emptyBehavior"
    empty-message="Latest updates will appear here once published."
    empty-icon="mdi-update"
  >
    <template #heading>
      <div class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">Latest Updates</h2>
        <p class="text-subtitle-1 text-figma-muted mb-0">
          The most recently updated published projects.
        </p>
      </div>
    </template>

    <v-row justify="center">
      <v-col cols="12" md="8" lg="7">
        <v-skeleton-loader v-if="loading" type="list-item-two-line@5" />
        <v-timeline v-else side="end" density="compact" align="start">
          <v-timeline-item
            v-for="project in updates"
            :key="project.id"
            :dot-color="getStatusColor(project.status)"
            size="x-small"
          >
            <div class="d-flex flex-wrap align-center justify-space-between ga-2">
              <div>
                <NuxtLink
                  :to="`/coi/public/detail-${project.id}`"
                  class="text-body-1 font-weight-medium update-link"
                >
                  {{ project.projectName }}
                </NuxtLink>
                <div class="text-caption text-figma-muted">
                  {{ labelForCampus(project.campus) }}
                  <v-chip size="x-small" variant="tonal" :color="getStatusColor(project.status)" class="ml-1">
                    {{ project.status }}
                  </v-chip>
                </div>
              </div>
              <v-tooltip :text="formatDate(project.updatedAt)" location="top">
                <template #activator="{ props: tipProps }">
                  <span v-bind="tipProps" class="text-caption text-figma-muted flex-shrink-0">
                    {{ formatRelativeDate(project.updatedAt) }}
                  </span>
                </template>
              </v-tooltip>
            </div>
          </v-timeline-item>
        </v-timeline>
      </v-col>
    </v-row>
  </PublicSectionBand>
</template>

<style scoped>
.update-link {
  color: rgb(var(--v-theme-figma-primary));
  text-decoration: none;
}
.update-link:hover,
.update-link:focus {
  text-decoration: underline;
}
</style>
