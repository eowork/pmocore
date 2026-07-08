<script setup lang="ts">
// T-HOME-CMS (THC-9): admin-authored University Highlights — replaces the
// Public Snapshot stats block (RHC-10). Renders only when ≥1 published highlight
// exists, so a fresh deployment never shows a wall of zeros.
// value_source 'auto:*' entries resolve live numbers from published COI data (D12).
import { colPropsForLayout, isMasonryLayout } from '~/utils/homepage-layout'

const { fetchOnce: fetchContent, itemsFor, sectionsConfig } = useHomepageContent()
const { fetchOnce: fetchProjects, total, ongoing, completed } = usePublicProjects()

const highlights = computed(() => itemsFor('highlight'))
const needsAuto = computed(() => highlights.value.some(h => h.value_source.startsWith('auto:')))

// T-HOME-CMS-3 (TH3-4): closed-set layout template, admin-selectable per section.
const layout = computed(() => sectionsConfig.value.find(s => s.key === 'highlights')?.layout)
const colProps = computed(() => colPropsForLayout(layout.value))
const masonry = computed(() => isMasonryLayout(layout.value))

onMounted(async () => {
  await fetchContent()
  // Only pay for the projects call when an auto-valued highlight demands it.
  if (needsAuto.value) fetchProjects()
})

function resolveValue(h: { value_source: string; manual_value: string }): string {
  switch (h.value_source) {
    case 'auto:published_count': return String(total.value)
    case 'auto:ongoing_count': return String(ongoing.value)
    case 'auto:completed_count': return String(completed.value)
    default: return h.manual_value
  }
}

// T-HOME-CMS-8 (TH8-2/TH8-3/TH8-4): variant from pages/index.vue; empty state
// now shows a placeholder (admin-configurable) instead of vanishing (RH8-3).
defineProps<{ variant?: 'neutral' | 'white' }>()
const emptyBehavior = computed(
  () => sectionsConfig.value.find(s => s.key === 'highlights')?.emptyBehavior ?? 'placeholder',
)
</script>

<template>
  <PublicSectionBand
    :variant="variant"
    :is-empty="!highlights.length"
    :empty-behavior="emptyBehavior"
    empty-message="Highlights are being prepared."
    empty-icon="mdi-star-outline"
  >
    <template #heading>
      <h2 class="text-h4 font-weight-bold text-figma-primary mb-8 text-center">
        University Highlights
      </h2>
    </template>
      <div v-if="masonry" class="highlights-masonry">
        <v-card
          v-for="highlight in highlights"
          :key="highlight.id"
          class="pa-5 highlight-card csu-card masonry-item"
          elevation="2"
          rounded="lg"
        >
          <div class="d-flex align-start ga-4">
            <v-avatar
              color="primary"
              variant="tonal"
              size="48"
              class="flex-shrink-0"
              :style="highlight.color_token ? { backgroundColor: `var(--csu-${highlight.color_token})`, color: '#fff' } : undefined"
            >
              <!-- T-HOME-CMS-5 (TH5-6): custom-uploaded icon image, clamped to
                   the avatar's own size — no separate normalization step needed. -->
              <v-img v-if="highlight.image_url" :src="highlight.image_url" :alt="highlight.alt_text || highlight.title" cover />
              <v-icon v-else :icon="highlight.icon || 'mdi-star-outline'" size="24" />
            </v-avatar>
            <div>
              <div v-if="resolveValue(highlight)" class="text-h4 text-sm-h3 font-weight-bold text-figma-primary">
                {{ resolveValue(highlight) }}
              </div>
              <h3 class="text-subtitle-1 font-weight-bold text-figma-primary">{{ highlight.title }}</h3>
              <p class="text-body-2 text-figma-muted mb-0 mt-1">{{ highlight.body }}</p>
            </div>
          </div>
        </v-card>
      </div>
      <!-- T-HOME-CMS-6 (TH6-7): center partial rows. -->
      <v-row v-else dense justify="center">
        <v-col
          v-for="highlight in highlights"
          :key="highlight.id"
          v-bind="colProps"
        >
          <v-card class="pa-5 h-100 highlight-card csu-card" elevation="2" rounded="lg">
            <div class="d-flex align-start ga-4">
              <v-avatar
                color="primary"
                variant="tonal"
                size="48"
                class="flex-shrink-0"
                :style="highlight.color_token ? { backgroundColor: `var(--csu-${highlight.color_token})`, color: '#fff' } : undefined"
              >
                <v-img v-if="highlight.image_url" :src="highlight.image_url" :alt="highlight.alt_text || highlight.title" cover />
                <v-icon v-else :icon="highlight.icon || 'mdi-star-outline'" size="24" />
              </v-avatar>
              <div>
                <div
                  v-if="resolveValue(highlight)"
                  class="text-h4 text-sm-h3 font-weight-bold text-figma-primary"
                >
                  {{ resolveValue(highlight) }}
                </div>
                <h3 class="text-subtitle-1 font-weight-bold text-figma-primary">
                  {{ highlight.title }}
                </h3>
                <p class="text-body-2 text-figma-muted mb-0 mt-1">
                  {{ highlight.body }}
                </p>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
  </PublicSectionBand>
</template>

<style scoped>
.highlight-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.highlight-card:hover {
  transform: translateY(-2px);
}

/* T-HOME-CMS-3 (TH3-4/D4): masonry via CSS multi-column — native CSS grid
   masonry has poor browser support in 2026; column-count needs no library. */
.highlights-masonry {
  column-count: 1;
  column-gap: 16px;
}
@media (min-width: 600px) {
  .highlights-masonry { column-count: 2; }
}
@media (min-width: 960px) {
  .highlights-masonry { column-count: 3; }
}
.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
  display: inline-block;
  width: 100%;
}
</style>
