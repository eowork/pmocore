<script setup lang="ts">
// T-HOME (TH-6): originally "Featured Projects."
// T-HOME-CMS-11 (TH11-4): renamed Featured News — fully standalone CMS
// showcase, decoupled from COI (RH11-3 supersedes T-HOME-CMS-8's
// project-linked design). Carousel display via Vuetify's native
// v-slide-group (RH11-5) — no new dependency, no COI live-data fallback
// (a standalone content type has nothing meaningful to auto-populate from).
import { getStatusColor } from '~/utils/status-colors'
import { formatDate } from '~/utils/userFormat'
import type { HomepageItemUI } from '~/composables/useHomepageContent'

const router = useRouter()
const { fetchOnce, itemsFor, sectionsConfig } = useHomepageContent()

onMounted(fetchOnce)

const cards = computed(() =>
  [...itemsFor('featured_project')].sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)),
)

const emptyBehavior = computed(
  () => sectionsConfig.value.find(s => s.key === 'featured_projects')?.emptyBehavior ?? 'placeholder',
)
const isEmpty = computed(() => !cards.value.length)

// T-HOME-CMS-13 (operator directive): a carousel with visible scroll arrows
// but nothing to actually scroll past reads as broken, and left-packed cards
// in a mostly-empty row look unbalanced — the same class of issue TH6-7 fixed
// for grid sections. 4 is the desktop column count (see .featured-news-card
// width breakpoints below): at or under that, every card already fits one
// row, so render a centered static row instead of the carousel; only switch
// to the scrollable v-slide-group once content genuinely overflows.
const CAROUSEL_THRESHOLD = 4
const needsCarousel = computed(() => cards.value.length > CAROUSEL_THRESHOLD)

// T-HOME-CMS-14 (operator directive): "full view modality for further
// information" — every card now opens a detail dialog (not a direct
// navigate-away) so full_description (captured since TH11-2 but never
// actually rendered anywhere — a real gap) has somewhere to be shown.
const detailOpen = ref(false)
const detailCard = ref<HomepageItemUI | null>(null)

function openCard(card: HomepageItemUI) {
  detailCard.value = card
  detailOpen.value = true
}

function visitLink(url: string) {
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener')
  } else {
    router.push(url)
    detailOpen.value = false
  }
}

function bylineDate(card: HomepageItemUI): string {
  return formatDate(card.publish_date || card.created_at)
}

defineProps<{ variant?: 'neutral' | 'white' }>()
</script>

<template>
  <PublicSectionBand
    :variant="variant"
    :is-empty="isEmpty"
    :empty-behavior="emptyBehavior"
    empty-message="Featured news will appear here once published."
    empty-icon="mdi-newspaper-variant-outline"
  >
    <template #heading>
      <div class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">Featured News</h2>
        <p class="text-subtitle-1 text-figma-muted mb-0">
          Highlights, achievements, and announcements from across the University.
        </p>
      </div>
    </template>

    <!-- T-HOME-CMS-13 (operator directive): centered static row when
         everything already fits (<=4 cards, D-equivalent of TH6-7's grid
         centering fix) — no carousel chrome for content that doesn't
         overflow. Switches to the scrollable v-slide-group (TH11-4/D5) only
         once cards genuinely exceed one row. -->
    <div v-if="!needsCarousel" class="featured-news-row">
      <PublicFeaturedNewsCard
        v-for="card in cards"
        :key="card.id"
        :card="card"
        @open="openCard"
      />
    </div>
    <v-slide-group v-else show-arrows class="featured-news-carousel">
      <v-slide-group-item v-for="card in cards" :key="card.id">
        <PublicFeaturedNewsCard :card="card" @open="openCard" />
      </v-slide-group-item>
    </v-slide-group>

    <!-- T-HOME-CMS-14: full-view detail modal — image, tag, full byline,
         all badges, and full_description (never rendered on the card face). -->
    <v-dialog v-model="detailOpen" max-width="640" scrollable>
      <v-card v-if="detailCard" rounded="lg">
        <v-img
          v-if="detailCard.image_url"
          :src="detailCard.image_url"
          :alt="detailCard.alt_text || detailCard.title"
          cover
          height="260"
        />
        <v-card-text class="pt-4">
          <span v-if="detailCard.manual_value" class="featured-news-tag mb-3 d-inline-block">
            {{ detailCard.manual_value }}
          </span>
          <h2 class="text-h5 font-weight-bold text-figma-primary mb-1">{{ detailCard.title }}</h2>
          <p v-if="detailCard.subtitle" class="text-subtitle-1 text-figma-muted mb-2">
            {{ detailCard.subtitle }}
          </p>
          <div v-if="detailCard.author" class="featured-news-byline mb-4">
            <v-icon size="14" class="mr-1">mdi-account-outline</v-icon>
            <span>by: {{ detailCard.author }}<template v-if="detailCard.department">, {{ detailCard.department }}</template></span>
            <v-icon size="14" class="ml-3 mr-1">mdi-calendar-outline</v-icon>
            <span>{{ bylineDate(detailCard) }}</span>
          </div>
          <div
            v-if="detailCard.status_text || detailCard.campus_text || detailCard.budget_text || detailCard.completion_text"
            class="d-flex flex-wrap ga-1 mb-4"
          >
            <v-chip v-if="detailCard.status_text" size="small" variant="tonal" :color="getStatusColor(detailCard.status_text)">
              {{ detailCard.status_text }}
            </v-chip>
            <v-chip v-if="detailCard.campus_text" size="small" variant="tonal" color="figma-muted" prepend-icon="mdi-map-marker-outline">
              {{ detailCard.campus_text }}
            </v-chip>
            <v-chip v-if="detailCard.budget_text" size="small" variant="tonal" color="figma-muted" prepend-icon="mdi-cash-multiple">
              {{ detailCard.budget_text }}
            </v-chip>
            <v-chip v-if="detailCard.completion_text" size="small" variant="tonal" color="figma-muted" prepend-icon="mdi-progress-check">
              {{ detailCard.completion_text }}
            </v-chip>
          </div>
          <p class="text-body-1 text-figma-primary" style="white-space: pre-line;">
            {{ detailCard.full_description || detailCard.body || 'No further details have been provided for this item.' }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">Close</v-btn>
          <v-btn
            v-if="detailCard.link_url"
            color="figma-primary"
            variant="flat"
            append-icon="mdi-arrow-right"
            @click="visitLink(detailCard.link_url)"
          >
            Learn More
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PublicSectionBand>
</template>

<style scoped>
.featured-news-carousel :deep(.v-slide-group__content) {
  gap: 16px;
  padding: 4px 4px 20px;
}

/* T-HOME-CMS-14: same tag/byline treatment as PublicFeaturedNewsCard.vue —
   duplicated here (Vue `scoped` styles don't cross component boundaries)
   for the detail modal, which lives in this component, not the card. */
.featured-news-tag {
  padding: 3px 10px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(var(--v-theme-on-surface), 0.75);
  background-color: rgba(var(--v-theme-on-surface), 0.05);
  border-left: 4px solid var(--csu-gold, #f9dc07);
}
.featured-news-byline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* T-HOME-CMS-13: centered, wrapping row — the fix for "less than 4 entries
   looks unbalanced." justify-content: center means 1-3 cards sit centered
   as a group instead of left-packed against the container edge. */
.featured-news-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  padding: 4px 4px 20px;
}
</style>
