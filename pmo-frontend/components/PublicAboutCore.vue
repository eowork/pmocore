<script setup lang="ts">
// T-HOME-CMS (THC-10): "About PMO CORE" narrative — what CORE means, why it
// exists, who manages it. Copy is CMS-managed with seeded fallback.
// T-HOME-CMS-4 (TH4-4): facets moved from a hardcoded array to CMS items
// (section_key='about_facet') — same generic pattern as every other section,
// admin-editable via Homepage Management. Fallback array only covers the
// case where the migration/seed hasn't run yet (never renders empty).
const { fetchOnce, setting, itemsFor } = useHomepageContent()

onMounted(fetchOnce)

const title = computed(() => setting('about_core_title', 'About PMO CORE'))
const body = computed(() =>
  setting(
    'about_core_body',
    'CORE stands for Centralized Operations and Reporting Engine. It is maintained by the Project Management Office of Caraga State University as the single source of truth for university project and operations reporting.',
  ),
)

const FALLBACK_FACETS = [
  { id: 'fallback-1', icon: 'mdi-hub-outline', title: 'Centralized', body: 'One platform for infrastructure, operations, and program reporting across all CSU campuses.' },
  { id: 'fallback-2', icon: 'mdi-cog-outline', title: 'Operations', body: 'Live monitoring of university projects and quarterly accomplishments from proposal to completion.' },
  { id: 'fallback-3', icon: 'mdi-file-chart-outline', title: 'Reporting', body: 'Structured, standards-aligned reports reviewed and approved before publication.' },
  { id: 'fallback-4', icon: 'mdi-engine-outline', title: 'Engine', body: 'The system that powers transparency and evidence-based decisions for university governance.' },
]

const facets = computed(() => {
  const cmsFacets = itemsFor('about_facet')
  return cmsFacets.length ? cmsFacets : FALLBACK_FACETS
})

// T-HOME-CMS-8 (TH8-2/TH8-3): variant supplied by pages/index.vue's render
// loop — this component no longer decides its own background (RH8-2).
defineProps<{ variant?: 'neutral' | 'white' }>()
</script>

<template>
  <PublicSectionBand :variant="variant">
    <v-row>
      <v-col cols="12" md="5" class="text-center text-md-left">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-4">{{ title }}</h2>
        <p class="text-body-1 text-figma-muted">{{ body }}</p>
      </v-col>
      <v-col cols="12" md="7">
        <!-- T-HOME-CMS-6 (TH6-7): center partial rows. -->
        <v-row dense justify="center">
          <v-col v-for="facet in facets" :key="facet.id" cols="12" sm="6">
            <v-card class="pa-5 h-100 facet-card csu-card" elevation="2" rounded="lg">
              <!-- T-HOME-CMS-5 (TH5-4): optional facet photo, admin-uploaded
                   via the item's image field (about_facet now hasImage). -->
              <v-img
                v-if="facet.image_url"
                :src="facet.image_url"
                :alt="facet.alt_text || facet.title"
                cover
                height="120"
                class="rounded mb-3"
              />
              <v-avatar class="mb-3 csu-accent-avatar" variant="tonal" size="40">
                <v-icon :icon="facet.icon" size="20" />
              </v-avatar>
              <h3 class="text-subtitle-1 font-weight-bold text-figma-primary mb-1">
                {{ facet.title }}
              </h3>
              <p class="text-body-2 text-figma-muted mb-0">{{ facet.body }}</p>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </PublicSectionBand>
</template>

<style scoped>
.facet-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.facet-card:hover {
  transform: translateY(-2px);
}
</style>
