<script setup lang="ts">
// T-HOME-CMS (THC-12) + T-HOME-CMS-2 (THM-5): official public entry point of
// PMO CORE. Hero (which now includes the carousel as its media column — see
// T-HOME-CMS-3 TH3-3) always renders first (identity band, not toggleable —
// avoids an admin accidentally hiding the whole homepage).
// Remaining sections are admin-configurable (enable/disable + order) via
// `homepage_sections_config`; explicit imports (not string-based auto-import)
// so `<component :is>` resolves correctly without Nuxt global component
// registration (nuxt.config.ts keeps `pathPrefix: false`, not `global: true`).
import PublicAboutCore from '~/components/PublicAboutCore.vue'
import PublicHighlights from '~/components/PublicHighlights.vue'
import PublicFeaturedNews from '~/components/PublicFeaturedNews.vue'
import PublicAnnouncements from '~/components/PublicAnnouncements.vue'
import PublicLatestUpdates from '~/components/PublicLatestUpdates.vue'
import PublicQuickLinks from '~/components/PublicQuickLinks.vue'
import PublicTransparency from '~/components/PublicTransparency.vue'
import PublicFaq from '~/components/PublicFaq.vue'

definePageMeta({
  layout: 'public',
})

useHead({
  title: 'PMO CORE — Caraga State University',
  meta: [
    {
      name: 'description',
      content:
        'PMO CORE — the Centralized Operations and Reporting Engine of Caraga State University. Published infrastructure projects, university operations, and institutional reporting in one transparent platform.',
    },
  ],
})

// T-HOME-CMS-10 (TH10-1): `/` is a PUBLIC route — accessible to guests AND
// authenticated users alike, same as /coi/public/* has always behaved.
// Reverses T-HOME's original D1 redirect (documented reversal, RH10-2):
// authentication expands access, it never removes access to public pages.
// Post-login routing to /dashboard still happens in login.vue, unaffected.
// The TH6-4 ?preview=true bypass was removed with it — dead code once no
// redirect exists to bypass.

const SECTION_COMPONENTS: Record<string, unknown> = {
  about_core: PublicAboutCore,
  highlights: PublicHighlights,
  featured_projects: PublicFeaturedNews,
  announcements: PublicAnnouncements,
  latest_updates: PublicLatestUpdates,
  quick_links: PublicQuickLinks,
  transparency: PublicTransparency,
  faq: PublicFaq,
}

const { fetchOnce, sectionsConfig } = useHomepageContent()
onMounted(fetchOnce)

// T-HOME-CMS-8 (TH8-2/D1): section-band alternation computed HERE, by
// rendered position — the one place that actually knows render order — and
// passed down as a prop. Fixes the root cause of repeated adjacent same-color
// collisions (RH8-1/RH8-2): components no longer choose their own background,
// so alternation stays correct even after an admin reorders sections.
const orderedSections = computed(() =>
  [...sectionsConfig.value]
    .filter(s => s.visible && SECTION_COMPONENTS[s.key])
    .sort((a, b) => a.order - b.order)
    .map((s, index) => ({ ...s, variant: (index % 2 === 0 ? 'white' : 'neutral') as const })),
)
</script>

<template>
  <div>
    <PublicHero />
    <component
      :is="SECTION_COMPONENTS[section.key]"
      v-for="section in orderedSections"
      :key="section.key"
      :variant="section.variant"
    />
  </div>
</template>
