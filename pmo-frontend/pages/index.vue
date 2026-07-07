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
import PublicFeaturedProjects from '~/components/PublicFeaturedProjects.vue'
import PublicAnnouncements from '~/components/PublicAnnouncements.vue'
import PublicLatestUpdates from '~/components/PublicLatestUpdates.vue'
import PublicTransparency from '~/components/PublicTransparency.vue'
import PublicFaq from '~/components/PublicFaq.vue'

const authStore = useAuthStore()

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

const checked = ref(false)

if (import.meta.client) {
  if (authStore.isAuthenticated) {
    navigateTo('/dashboard', { replace: true })
  } else {
    checked.value = true
  }
}

const SECTION_COMPONENTS: Record<string, unknown> = {
  about_core: PublicAboutCore,
  highlights: PublicHighlights,
  featured_projects: PublicFeaturedProjects,
  announcements: PublicAnnouncements,
  latest_updates: PublicLatestUpdates,
  transparency: PublicTransparency,
  faq: PublicFaq,
}

const { fetchOnce, sectionsConfig } = useHomepageContent()
onMounted(fetchOnce)

const orderedSections = computed(() =>
  [...sectionsConfig.value]
    .filter(s => s.visible && SECTION_COMPONENTS[s.key])
    .sort((a, b) => a.order - b.order),
)
</script>

<template>
  <div v-if="checked && !authStore.isAuthenticated">
    <PublicHero />
    <component
      :is="SECTION_COMPONENTS[section.key]"
      v-for="section in orderedSections"
      :key="section.key"
    />
  </div>
</template>
