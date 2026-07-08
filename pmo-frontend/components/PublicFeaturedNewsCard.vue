<script setup lang="ts">
// T-HOME-CMS-13 (operator directive): extracted from PublicFeaturedNews.vue
// so the exact same card markup renders in both the carousel (overflow) and
// centered-row (fits-in-one-row) layouts without duplication (DRY).
import { getStatusColor } from '~/utils/status-colors'
import { formatDate } from '~/utils/userFormat'
import type { HomepageItemUI } from '~/composables/useHomepageContent'

const props = defineProps<{ card: HomepageItemUI }>()
const emit = defineEmits<{ open: [card: HomepageItemUI] }>()

function bylineDate(): string {
  return formatDate(props.card.publish_date || props.card.created_at)
}
</script>

<template>
  <v-card
    class="featured-news-card csu-card"
    :class="{ 'featured-news-card--featured': card.is_featured }"
    rounded="lg"
    hover
    @click="emit('open', card)"
  >
    <div class="featured-news-media">
      <v-img
        v-if="card.image_url"
        :src="card.image_url"
        :alt="card.alt_text || card.title"
        cover
        height="170"
      />
      <div
        v-else
        class="featured-news-media-fallback d-flex align-center justify-center"
      >
        <v-icon icon="mdi-newspaper-variant-outline" size="40" color="white" />
      </div>
      <v-chip
        v-if="card.is_featured"
        size="small"
        color="warning"
        variant="flat"
        prepend-icon="mdi-star"
        class="featured-news-featured-badge"
      >
        Featured
      </v-chip>
    </div>
    <!-- T-HOME-CMS-12 (TH12-3): CSU Press Release-style category tag —
         rectangular, gold left-accent bar, own row below the image
         (not a floating pill over it). -->
    <div v-if="card.manual_value" class="featured-news-tag-row">
      <span class="featured-news-tag">{{ card.manual_value }}</span>
    </div>
    <v-card-item>
      <v-card-title class="text-subtitle-1 font-weight-bold text-figma-primary featured-news-title">
        {{ card.title }}
      </v-card-title>
      <v-card-subtitle v-if="card.subtitle" class="featured-news-subtitle">
        {{ card.subtitle }}
      </v-card-subtitle>
      <!-- T-HOME-CMS-12 (TH12-4): "by: {author} · {date}" byline, matching
           the CSU reference exactly — clear office attribution. -->
      <div v-if="card.author" class="featured-news-byline">
        <v-icon size="14" class="mr-1">mdi-account-outline</v-icon>
        <span>by: {{ card.author }}<template v-if="card.department">, {{ card.department }}</template></span>
        <v-icon size="14" class="ml-3 mr-1">mdi-calendar-outline</v-icon>
        <span>{{ bylineDate() }}</span>
      </div>
    </v-card-item>
    <!-- T-HOME-CMS-14 (operator directive): flex-grow region absorbs
         whatever content is/isn't present (chips, body) so the outer card
         stays a fixed height regardless — "strictly the same size." -->
    <v-card-text class="featured-news-content pt-0">
      <div v-if="card.status_text || card.campus_text || card.budget_text || card.completion_text" class="d-flex flex-wrap ga-1 mb-3">
        <v-chip v-if="card.status_text" size="x-small" variant="tonal" :color="getStatusColor(card.status_text)">
          {{ card.status_text }}
        </v-chip>
        <v-chip v-if="card.campus_text" size="x-small" variant="tonal" color="figma-muted" prepend-icon="mdi-map-marker-outline">
          {{ card.campus_text }}
        </v-chip>
        <v-chip v-if="card.budget_text" size="x-small" variant="tonal" color="figma-muted" prepend-icon="mdi-cash-multiple">
          {{ card.budget_text }}
        </v-chip>
        <v-chip v-if="card.completion_text" size="x-small" variant="tonal" color="figma-muted" prepend-icon="mdi-progress-check">
          {{ card.completion_text }}
        </v-chip>
      </div>
      <p v-if="card.body" class="text-body-2 text-figma-muted mb-0 featured-news-body">
        {{ card.body }}
      </p>
    </v-card-text>
    <!-- T-HOME-CMS-14: always present (not conditional on link_url) — every
         card opens the full-detail modal; footer position never shifts. -->
    <v-card-actions>
      <v-btn color="figma-primary" variant="text" append-icon="mdi-arrow-right" @click.stop="emit('open', card)">
        View Details
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.featured-news-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  width: 280px;
  /* T-HOME-CMS-14: fixed height, not min-height — every card is literally
     the same size regardless of how much content it has. */
  height: 460px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.featured-news-content {
  flex: 1 1 auto;
  overflow: hidden;
}
.featured-news-card:hover {
  transform: translateY(-2px);
}
.featured-news-card--featured {
  border-width: 2px;
  border-color: var(--csu-accent, #009900) !important;
}

/* T-HOME-CMS-11 (TH11-4): CSU Press Release-inspired sizing — 4 desktop /
   2-3 tablet / 1 mobile visible at once, per the directive's own example. */
@media (max-width: 599px) {
  .featured-news-card { width: 260px; }
}
@media (min-width: 600px) and (max-width: 959px) {
  .featured-news-card { width: 300px; }
}
@media (min-width: 960px) {
  .featured-news-card { width: 300px; }
}

.featured-news-media {
  position: relative;
  height: 170px;
  flex-shrink: 0;
}
.featured-news-media-fallback {
  height: 100%;
  background: linear-gradient(135deg, var(--csu-accent, #009900), var(--csu-emerald, #003300));
  opacity: 0.9;
}

/* T-HOME-CMS-12 (TH12-3): rectangular tag, gold left-accent bar — matches
   the CSU Press Release reference exactly (not a rounded floating chip). */
.featured-news-tag-row {
  padding: 10px 16px 0;
}
.featured-news-tag {
  display: inline-block;
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
  font-size: 0.72rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 4px;
}

.featured-news-featured-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-weight: 600;
}

.featured-news-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
  line-height: 1.3;
  min-height: 2.6em;
  margin-top: 6px;
}
.featured-news-subtitle {
  white-space: normal;
  opacity: 0.8;
}

.featured-news-body {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
