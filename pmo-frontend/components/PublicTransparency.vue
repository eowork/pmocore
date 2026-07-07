<script setup lang="ts">
// T-HOME-POLISH (THP-4): transparency statement — informational only. The Staff
// Access card was removed from this section (auth stays reachable via the nav
// bar and footer "Sign In" links) so this reads as a pure mission statement.
// T-HOME-CMS-4 (TH4-4): title/body/pillars moved from 100% hardcoded to CMS
// content (homepage_settings + section_key='transparency_pillar') — same
// generic pattern as every other section. Fallbacks preserve today's copy.
const { fetchOnce, setting, itemsFor } = useHomepageContent()

onMounted(fetchOnce)

const title = computed(() => setting('transparency_title', 'Why PMO CORE Exists'))
const body = computed(() =>
  setting(
    'transparency_body',
    'The Project Management Office maintains PMO CORE so that students, employees, and the public can see how university infrastructure and operations are planned, funded, and delivered. Only records approved for public viewing appear here.',
  ),
)

const FALLBACK_PILLARS = [
  { id: 'fallback-1', icon: 'mdi-eye-outline', title: 'Transparency', body: 'Published project records are open to the public, no account required.' },
  { id: 'fallback-2', icon: 'mdi-scale-balance', title: 'Accountability', body: 'Every published record passes a review-and-approval workflow before release.' },
  { id: 'fallback-3', icon: 'mdi-chart-timeline-variant', title: 'Monitoring', body: 'Physical progress and timelines are tracked from proposal to completion.' },
  { id: 'fallback-4', icon: 'mdi-domain', title: 'Governance', body: 'Reporting follows university and national budget-reporting standards.' },
]

const pillars = computed(() => {
  const cmsPillars = itemsFor('transparency_pillar')
  return cmsPillars.length ? cmsPillars : FALLBACK_PILLARS
})
</script>

<template>
  <v-container id="transparency" class="py-12">
    <div class="text-center mb-8">
      <h2 class="text-h4 font-weight-bold text-figma-primary mb-3">{{ title }}</h2>
      <p class="text-body-1 text-figma-muted mx-auto" style="max-width: 640px;">
        {{ body }}
      </p>
    </div>
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-row dense>
          <v-col v-for="pillar in pillars" :key="pillar.id" cols="12" sm="6">
            <v-card class="pa-5 h-100 pillar-card" elevation="2" rounded="lg">
              <div class="d-flex ga-3">
                <v-avatar class="flex-shrink-0 csu-accent-avatar" variant="tonal" size="40">
                  <v-icon :icon="pillar.icon" size="20" />
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-bold text-figma-primary">{{ pillar.title }}</div>
                  <div class="text-body-2 text-figma-muted">{{ pillar.body }}</div>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.pillar-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.pillar-card:hover {
  transform: translateY(-2px);
}
</style>
