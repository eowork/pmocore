<script setup lang="ts">
// T-HOME-CMS (THC-10): admin-managed quick links. Hidden when none published.
const { fetchOnce, itemsFor } = useHomepageContent()

onMounted(fetchOnce)

const links = computed(() => itemsFor('quick_link'))

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

// T-HOME-CMS-8 (TH8-2/TH8-3/TH8-4)
defineProps<{ variant?: 'neutral' | 'white' }>()
</script>

<template>
  <PublicSectionBand
    :variant="variant"
    :is-empty="!links.length"
    empty-behavior="hide"
  >
    <template #heading>
      <h2 class="text-h4 font-weight-bold text-figma-primary mb-8 text-center">Explore PMO CORE</h2>
    </template>
    <!-- T-HOME-CMS-6 (TH6-7): center partial rows — 1–3 links no longer pin left. -->
    <v-row dense justify="center">
      <v-col
        v-for="link in links"
        :key="link.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card
          class="pa-4 h-100 quick-link-card csu-card"
          elevation="1"
          rounded="lg"
          :to="!isExternal(link.link_url) && link.link_url ? link.link_url : undefined"
          :href="isExternal(link.link_url) ? link.link_url : undefined"
          :target="isExternal(link.link_url) ? '_blank' : undefined"
          :rel="isExternal(link.link_url) ? 'noopener' : undefined"
        >
          <div class="d-flex align-center ga-3">
            <v-avatar color="primary" variant="tonal" size="44" class="flex-shrink-0">
              <v-img v-if="link.image_url" :src="link.image_url" :alt="link.alt_text || link.title" cover />
              <v-icon v-else :icon="link.icon || 'mdi-link-variant'" size="22" />
            </v-avatar>
            <div class="flex-grow-1">
              <h3 class="text-subtitle-2 font-weight-bold text-figma-primary mb-0">
                {{ link.title }}
              </h3>
              <p class="text-caption text-figma-muted mb-0">{{ link.body }}</p>
            </div>
            <v-icon size="18" color="figma-muted">mdi-arrow-right</v-icon>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </PublicSectionBand>
</template>

<style scoped>
.quick-link-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.quick-link-card:hover {
  transform: translateY(-2px);
}
</style>
