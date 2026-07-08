<script setup lang="ts">
// T-HOME-CMS (THC-8): CTA-free institutional hero — storytelling, not actions.
// Copy is CMS-managed (homepage_settings) with seeded fallbacks so the section
// never renders empty on a fresh deploy (D11).
// T-HOME-CMS-3 (TH3-3): the right column IS the administrator-managed carousel
// now — PublicCarousel.vue was removed as a separate page-level section (DRY;
// one height constant instead of two files keeping one in sync). When the CMS
// has zero published `hero_slide` items, the static CSU building photo renders
// as an implicit single slide so the hero never has an empty media column.
import { useDisplay } from 'vuetify'

const HERO_MEDIA_HEIGHT = 440
const HERO_MEDIA_HEIGHT_MOBILE = 260

const { fetchOnce, itemsFor, setting } = useHomepageContent()

onMounted(fetchOnce)

const headline = computed(() =>
  setting('hero_headline', 'Caraga State University PMO CORE'),
)
const subtitle = computed(() =>
  setting('hero_subtitle', 'Centralized Operations and Reporting Engine'),
)
const body = computed(() =>
  setting(
    'hero_body',
    'PMO CORE is the University\'s integrated platform for planning, monitoring, and reporting — bringing infrastructure projects, university operations, and institutional programs into one transparent system managed by the Project Management Office.',
  ),
)

const cmsSlides = computed(() => itemsFor('hero_slide').filter(s => s.image_url))

// Fallback slide keeps the media column populated on a fresh deploy — same
// "never renders empty" philosophy as the hero text (D11).
const FALLBACK_SLIDE = {
  id: 'fallback-building',
  image_url: '/csu-admin-building.png',
  alt_text: 'Caraga State University administration building',
  title: '',
  body: '',
  link_url: '',
}

const slides = computed(() => (cmsSlides.value.length ? cmsSlides.value : [FALLBACK_SLIDE]))

const { smAndDown } = useDisplay()
const carouselHeight = computed(() =>
  smAndDown.value ? HERO_MEDIA_HEIGHT_MOBILE : HERO_MEDIA_HEIGHT,
)
</script>

<template>
  <div class="hero-band">
    <v-container class="py-12 py-md-16">
      <v-row align="center">
        <v-col cols="12" md="7">
          <div class="d-flex align-center ga-3 mb-4">
            <v-img
              src="/csu-official-seal.png"
              alt="Caraga State University official seal"
              width="56"
              height="56"
              class="flex-shrink-0"
              style="max-width: 56px;"
            />
            <div>
              <p class="text-overline csu-accent font-weight-medium mb-0" style="line-height: 1.4;">
                Caraga State University — Project Management Office
              </p>
              <div class="hero-accent-rule" aria-hidden="true" />
            </div>
          </div>
          <h1 class="text-h3 text-md-h2 font-weight-bold text-figma-primary mb-2">
            {{ headline }}
          </h1>
          <p class="text-h6 font-weight-medium csu-accent mb-4">
            {{ subtitle }}
          </p>
          <p class="text-body-1 text-figma-muted mb-0" style="max-width: 640px;">
            {{ body }}
          </p>
        </v-col>
        <v-col cols="12" md="5" class="d-none d-md-flex justify-center">
          <v-carousel
            :height="carouselHeight"
            :cycle="slides.length > 1"
            interval="7000"
            :show-arrows="slides.length > 1 ? 'hover' : false"
            :hide-delimiters="slides.length <= 1"
            hide-delimiter-background
            delimiter-icon="mdi-circle-small"
            class="rounded-lg hero-carousel"
            style="max-width: 440px; width: 100%;"
          >
            <v-carousel-item
              v-for="slide in slides"
              :key="slide.id"
              :src="slide.image_url"
              cover
              :alt="slide.alt_text || slide.title || 'University highlight'"
            >
              <div v-if="slide.title || slide.body" class="carousel-caption pa-4">
                <h3 v-if="slide.title" class="text-subtitle-1 font-weight-bold text-white mb-1">
                  {{ slide.title }}
                </h3>
                <p v-if="slide.body" class="text-caption text-grey-lighten-2 mb-0 caption-body">
                  {{ slide.body }}
                </p>
                <v-btn
                  v-if="slide.link_url"
                  :to="slide.link_url"
                  size="x-small"
                  variant="tonal"
                  color="white"
                  append-icon="mdi-arrow-right"
                  class="mt-2"
                >
                  Read more
                </v-btn>
              </div>
            </v-carousel-item>
          </v-carousel>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
/* T-HOME-POLISH (THP-5): hero band's gradient resolves to white, keeping the
   band visually distinct without a border line beneath it.
   T-HOME-CMS-10 (TH10-3): extended to a 3-stop gradient (existing tokens
   only) with a slight angle for layered depth — background change only,
   hero layout/markup untouched per the standing constraint. */
.hero-band {
  background: linear-gradient(
    170deg,
    var(--csu-hero-gradient-start, #f0fdf4) 0%,
    var(--csu-hero-gradient-end, #ffffff) 62%,
    var(--csu-band-bg, #f8fafc) 100%
  );
  /* T-HOME-CMS-15 (operator directive): at default viewport height, the next
     section (About PMO CORE) was peeking in by ~20-30px at the bottom edge —
     a background/sizing adjustment only (hero layout/markup untouched, per
     the standing constraint). 64px = the public app-bar's own height, so the
     band fills the remaining viewport on first load; content stays centered
     via the existing `align="center"` row, just with more room to breathe. */
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
}
.hero-band > .v-container {
  width: 100%;
}

/* CSU gold brand accent under the overline (D3: brand moments only).
   T-HOME-CMS-5 (TH5-8): now reads from the theme token so the accent
   visibly shifts with the active preset — hero layout/markup unchanged. */
.hero-accent-rule {
  width: 64px;
  height: 4px;
  border-radius: 2px;
  background-color: var(--csu-button-tint, #f9dc07);
}

.hero-carousel {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.carousel-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(0deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0) 100%);
}

.caption-body {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
