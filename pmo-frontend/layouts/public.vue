<script setup lang="ts">
// T-HOME (TH-2): public site chrome — header + footer for anonymous-facing pages.
// No auth store usage: this layout must render identically for anonymous visitors.
const currentYear = new Date().getFullYear()

// T-HOME-POLISH (THP-1): Parkinsans is scoped to the public homepage only — the
// authenticated dashboard keeps Poppins (app.vue). Explicit fallback stack so a
// blocked font CDN at deploy time still renders correctly.
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Parkinsans:wght@400;500;600;700&display=swap',
    },
  ],
})

// THC-7: simplified public nav — Home only; Sign In stays as the standalone button.
// T-HOME-CMS-3 (TH3-2): "Staff Sign In" → "Sign In" — cleaner wording that doesn't
// imply staff-only access (future auth methods may serve other audiences too).
const navLinks = [
  { title: 'Home', to: '/' },
]

// T-HOME-CMS: footer copy is admin-managed with seeded fallbacks.
// T-HOME-CMS-2 (THM-1): homepage theme preset — read here so it's set on the
// root element before any section renders (avoids a flash of the wrong theme).
const { fetchOnce, setting, theme } = useHomepageContent()
onMounted(fetchOnce)

const footerMission = computed(() =>
  setting(
    'footer_mission',
    'PMO CORE publishes infrastructure and university operations information to promote transparency and accountability across CSU campuses.',
  ),
)
const contactAddress = computed(() =>
  setting('contact_address', 'Ampayon, Butuan City, Agusan del Norte'),
)
const contactWebsite = computed(() => setting('contact_website', 'www.carsu.edu.ph'))
</script>

<template>
  <div class="public-homepage-root" :data-theme="theme">
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <v-app-bar color="figma-surface-elevated" elevation="1" height="64">
      <NuxtLink to="/" class="d-flex align-center text-decoration-none ml-4 mr-2 flex-shrink-0">
        <v-img
          src="/csu-logo.svg"
          alt="Caraga State University logo"
          width="36"
          height="36"
          class="flex-shrink-0 me-2"
        />
        <div class="d-none d-sm-block">
          <div class="text-subtitle-1 font-weight-bold text-figma-primary" style="line-height: 1.1;">
            PMO CORE
          </div>
          <div class="text-caption text-figma-muted" style="line-height: 1.1;">
            Caraga State University
          </div>
        </div>
      </NuxtLink>

      <v-spacer />

      <nav aria-label="Public navigation" class="d-none d-md-flex align-center ga-1 mr-2">
        <v-btn
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          variant="text"
          color="figma-primary"
          class="text-none"
        >
          {{ link.title }}
        </v-btn>
      </nav>

      <v-btn
        to="/login"
        color="figma-primary"
        variant="flat"
        prepend-icon="mdi-login"
        class="text-none mr-4"
      >
        Sign In
      </v-btn>
    </v-app-bar>

    <v-main>
      <div id="main-content">
        <slot />
      </div>

      <!-- Footer -->
      <footer class="public-footer">
        <v-container class="py-10">
          <v-row>
            <v-col cols="12" md="5">
              <div class="d-flex align-center mb-3">
                <v-img
                  src="/csu-logo.svg"
                  alt=""
                  width="40"
                  height="40"
                  class="flex-shrink-0 me-3"
                  style="max-width: 40px;"
                />
                <div>
                  <div class="text-subtitle-1 font-weight-bold text-white">Project Management Office</div>
                  <div class="text-caption text-grey-lighten-1">Caraga State University</div>
                </div>
              </div>
              <p class="text-body-2 text-grey-lighten-1" style="max-width: 380px;">
                {{ footerMission }}
              </p>
            </v-col>

            <v-col cols="6" md="3">
              <div class="text-subtitle-2 font-weight-bold text-white mb-3">Quick Links</div>
              <div class="d-flex flex-column ga-2">
                <NuxtLink to="/" class="footer-link text-body-2">Home</NuxtLink>
                <NuxtLink to="/coi/public" class="footer-link text-body-2">Published Projects</NuxtLink>
                <NuxtLink to="/login" class="footer-link text-body-2">Sign In</NuxtLink>
              </div>
            </v-col>

            <v-col cols="6" md="4">
              <div class="text-subtitle-2 font-weight-bold text-white mb-3">Contact</div>
              <div class="d-flex flex-column ga-2 text-body-2 text-grey-lighten-1">
                <div class="d-flex align-center ga-2">
                  <v-icon size="16" color="grey-lighten-1">mdi-map-marker-outline</v-icon>
                  <span>{{ contactAddress }}</span>
                </div>
                <div class="d-flex align-center ga-2">
                  <v-icon size="16" color="grey-lighten-1">mdi-web</v-icon>
                  <span>{{ contactWebsite }}</span>
                </div>
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-6" color="grey-darken-2" />

          <div class="d-flex flex-wrap justify-space-between align-center ga-2">
            <span class="text-caption text-grey-lighten-1">
              © {{ currentYear }} Project Management Office, Caraga State University
            </span>
            <span class="text-caption text-grey-darken-1">
              Internal data access is restricted to authorized personnel.
            </span>
          </div>
        </v-container>
      </footer>
    </v-main>
  </div>
</template>

<style scoped>
/* T-HOME-POLISH (THP-1) + T-HOME-CMS-2 (THM-1) + T-HOME-CMS-4 (TH4-1): official
   CSU brand tokens + Parkinsans, scoped to the public homepage subtree only —
   does not affect the authenticated dashboard.
   -----------------------------------------------------------------------
   TH4-1 FIX: earlier versions overrode Vuetify's *internal* generated theme
   variable (`--v-theme-figma-accent`) to retint the sky-blue `figma-accent`
   color. That depended on unverifiable assumptions about Vuetify's internal
   naming/behavior and did not reliably propagate (RH4-2). Fixed by defining
   our OWN first-party `--csu-accent` variable here and having every homepage
   component apply it via an explicit `.csu-accent`/`.csu-accent-icon` class —
   fully within code this project owns and can debug directly in DevTools. */
.public-homepage-root {
  --csu-green: #009900;
  --csu-gold: #f9dc07;
  --csu-orange: #ff9900;
  --csu-emerald: #003300;
  --csu-gray: #4d4d4d;
  font-family: 'Parkinsans', 'Poppins', sans-serif;

  /* Theme-able surfaces (all 8 section components + this layout's footer read
     these instead of hardcoded hex — see PublicHero/Highlights/Announcements/
     Faq.vue). Defaults = Light Emerald preset. */
  --csu-band-bg: #f8fafc;
  --csu-band-border: #e2e8f0;
  --csu-hero-gradient-start: #f0fdf4;
  --csu-hero-gradient-end: #ffffff;
  --csu-footer-bg: #0f172a;

  /* First-party accent color — replaces the removed Vuetify-internal override.
     -rgb is a comma triplet (no rgb() wrapper) for tonal-style backgrounds
     via rgba(var(--csu-accent-rgb), alpha), matching Vuetify's own convention. */
  --csu-accent: var(--csu-green);
  --csu-accent-rgb: 0, 153, 0;
}

/* Theme presets (THM-1) — closed set, no freeform color picker, per directive.
   Each preset re-tints the band/hero/accent surfaces above; none invert text
   to a dark background, since every section's text classes (text-figma-primary
   etc.) are hardcoded for light-surface contrast — a true dark mode would need
   every component's text color audited, out of scope for a preset swap. */
.public-homepage-root[data-theme='dark_emerald'] {
  --csu-band-bg: #eafbea;
  --csu-band-border: #bbf0c4;
  --csu-hero-gradient-start: #d7f5db;
  --csu-hero-gradient-end: #ffffff;
  --csu-accent: var(--csu-gold); /* contrast against deeper emerald */
  --csu-accent-rgb: 249, 220, 7;
}

.public-homepage-root[data-theme='csu_green'] {
  --csu-band-bg: #f0fdf4;
  --csu-band-border: #bbf7d0;
  --csu-hero-gradient-start: #dcfce7;
  --csu-hero-gradient-end: #ffffff;
  --csu-accent: var(--csu-gold);
  --csu-accent-rgb: 249, 220, 7;
}

.public-homepage-root[data-theme='white'] {
  --csu-band-bg: #fafafa;
  --csu-band-border: #e5e7eb;
  --csu-hero-gradient-start: #ffffff;
  --csu-hero-gradient-end: #ffffff;
  --csu-accent: var(--csu-green);
  --csu-accent-rgb: 0, 153, 0;
}

.public-homepage-root[data-theme='neutral_gray'] {
  --csu-band-bg: #f3f4f6;
  --csu-band-border: #d1d5db;
  --csu-hero-gradient-start: #f3f4f6;
  --csu-hero-gradient-end: #ffffff;
  --csu-accent: var(--csu-emerald);
  --csu-accent-rgb: 0, 51, 0;
}

.skip-link {
  position: absolute;
  top: -48px;
  left: 8px;
  z-index: 10000;
  padding: 8px 16px;
  background: #0f172a;
  color: #ffffff;
  border-radius: 0 0 8px 8px;
  text-decoration: none;
  transition: top 0.15s ease;
}
.skip-link:focus {
  top: 0;
}

.public-footer {
  background-color: var(--csu-footer-bg, #0f172a); /* brand-dark closing band */
}

.footer-link {
  color: #cbd5e1;
  text-decoration: none;
}
.footer-link:hover,
.footer-link:focus {
  color: #ffffff;
  text-decoration: underline;
}
</style>

<!-- T-HOME-CMS-4 (TH4-1): deliberately UNSCOPED — these utility classes must
     apply inside every homepage component (PublicHero, PublicAboutCore,
     PublicTransparency, PublicAnnouncements, etc.), not just this layout's own
     template. Vue's `scoped` attribute only tags elements a component renders
     itself, so a scoped rule here would never match another SFC's markup —
     the CSS custom properties it reads (--csu-accent) still resolve correctly
     per-element via normal inheritance regardless of which stylesheet defines
     the consuming rule. -->
<style>
.csu-accent {
  color: var(--csu-accent) !important;
}
.csu-accent-icon .v-icon {
  color: var(--csu-accent) !important;
}
/* Replaces v-avatar color="figma-accent" variant="tonal" — Vuetify's tonal
   variant computes background opacity from the theme color internally, which
   is exactly the internal-dependency problem TH4-1 removes; this reproduces
   the same visual (tinted background + matching icon color) with first-party
   variables only. */
.csu-accent-avatar {
  background-color: rgba(var(--csu-accent-rgb), 0.12) !important;
}
.csu-accent-avatar .v-icon {
  color: var(--csu-accent) !important;
}
</style>
