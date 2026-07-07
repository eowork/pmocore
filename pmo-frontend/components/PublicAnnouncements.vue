<script setup lang="ts">
// T-HOME-CMS-3 (TH3-5): Latest Announcements redesigned as a card grid —
// pinned announcement featured full-width at the top, remaining announcements
// in a layout-template grid (TH3-4). Publish/unpublish and reordering already
// existed (Homepage Management); pin + schedule are the new capabilities.
import { colPropsForLayout, isMasonryLayout } from '~/utils/homepage-layout'
import { formatDate } from '~/utils/userFormat'

const { fetchOnce, itemsFor, sectionsConfig } = useHomepageContent()

onMounted(fetchOnce)

const announcements = computed(() => itemsFor('announcement'))
const featured = computed(() => announcements.value.find(a => a.is_pinned))
const rest = computed(() => announcements.value.filter(a => a.id !== featured.value?.id))

const layout = computed(() => sectionsConfig.value.find(s => s.key === 'announcements')?.layout)
const colProps = computed(() => colPropsForLayout(layout.value))
const masonry = computed(() => isMasonryLayout(layout.value))
</script>

<template>
  <div v-if="announcements.length" class="announcements-band py-12">
    <v-container>
      <h2 class="text-h4 font-weight-bold text-figma-primary mb-8 text-center">Latest Announcements</h2>

      <!-- Featured / pinned announcement -->
      <v-card
        v-if="featured"
        class="mb-6 featured-announcement"
        elevation="3"
        rounded="lg"
        :to="featured.link_url || undefined"
      >
        <v-row no-gutters>
          <v-col v-if="featured.image_url" cols="12" sm="4">
            <v-img :src="featured.image_url" :alt="featured.alt_text || featured.title" cover height="100%" min-height="160" />
          </v-col>
          <v-col :cols="featured.image_url ? undefined : 12" :sm="featured.image_url ? 8 : 12">
            <v-card-text class="pa-5">
              <div class="d-flex align-center ga-2 mb-2">
                <v-chip size="small" color="warning" variant="flat" prepend-icon="mdi-pin">Pinned</v-chip>
                <span class="text-caption text-figma-muted">{{ formatDate(featured.created_at) }}</span>
              </div>
              <h3 class="text-h6 font-weight-bold text-figma-primary mb-1">{{ featured.title }}</h3>
              <p class="text-body-2 text-figma-muted mb-2" style="white-space: pre-line;">{{ featured.body }}</p>
              <v-btn
                v-if="featured.link_url"
                size="small"
                variant="text"
                class="announcement-cta"
                append-icon="mdi-arrow-right"
              >
                Read more
              </v-btn>
            </v-card-text>
          </v-col>
        </v-row>
      </v-card>

      <!-- Remaining announcements -->
      <div v-if="masonry" class="announcements-masonry">
        <v-card v-for="a in rest" :key="a.id" class="pa-4 announcement-card masonry-item" elevation="1" rounded="lg" :to="a.link_url || undefined">
          <v-img v-if="a.image_url" :src="a.image_url" :alt="a.alt_text || a.title" cover height="140" class="rounded mb-3" />
          <div class="d-flex align-center ga-2 mb-1">
            <v-icon :icon="a.icon || 'mdi-bullhorn-outline'" size="18" class="announcement-icon" />
            <span class="text-caption text-figma-muted">{{ formatDate(a.created_at) }}</span>
          </div>
          <h3 class="text-subtitle-1 font-weight-bold text-figma-primary mb-1">{{ a.title }}</h3>
          <p class="text-body-2 text-figma-muted mb-2" style="white-space: pre-line;">{{ a.body }}</p>
          <v-btn v-if="a.link_url" size="small" variant="text" class="announcement-cta" append-icon="mdi-arrow-right">
            Read more
          </v-btn>
        </v-card>
      </div>
      <v-row v-else dense>
        <v-col v-for="a in rest" :key="a.id" v-bind="colProps">
          <v-card class="pa-4 h-100 announcement-card" elevation="1" rounded="lg" :to="a.link_url || undefined">
            <v-img v-if="a.image_url" :src="a.image_url" :alt="a.alt_text || a.title" cover height="140" class="rounded mb-3" />
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon :icon="a.icon || 'mdi-bullhorn-outline'" size="18" class="announcement-icon" />
              <span class="text-caption text-figma-muted">{{ formatDate(a.created_at) }}</span>
            </div>
            <h3 class="text-subtitle-1 font-weight-bold text-figma-primary mb-1">{{ a.title }}</h3>
            <p class="text-body-2 text-figma-muted mb-2" style="white-space: pre-line;">{{ a.body }}</p>
            <v-btn v-if="a.link_url" size="small" variant="text" class="announcement-cta" append-icon="mdi-arrow-right">
              Read more
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.announcements-band {
  background-color: var(--csu-band-bg, #f8fafc);
  border-top: 1px solid var(--csu-band-border, #e2e8f0);
  border-bottom: 1px solid var(--csu-band-border, #e2e8f0);
}

/* T-HOME-POLISH (THP-6): CSU Orange is the directive's named use case for announcements. */
.announcement-icon {
  color: var(--csu-orange, #ff9900);
}
.announcement-cta {
  color: var(--csu-orange, #ff9900);
}

.featured-announcement {
  cursor: pointer;
}

.announcement-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.announcement-card:hover {
  transform: translateY(-2px);
}

/* T-HOME-CMS-3 (TH3-4/D4): masonry via CSS multi-column. */
.announcements-masonry {
  column-count: 1;
  column-gap: 16px;
}
@media (min-width: 600px) {
  .announcements-masonry { column-count: 2; }
}
@media (min-width: 960px) {
  .announcements-masonry { column-count: 3; }
}
.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
  display: inline-block;
  width: 100%;
}
</style>
