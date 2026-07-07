<script setup lang="ts">
// T-HOME-CMS (THC-10): admin-managed quick links. Hidden when none published.
const { fetchOnce, itemsFor } = useHomepageContent()

onMounted(fetchOnce)

const links = computed(() => itemsFor('quick_link'))

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
</script>

<template>
  <v-container v-if="links.length" class="py-12">
    <h2 class="text-h4 font-weight-bold text-figma-primary mb-8 text-center">Explore PMO CORE</h2>
    <v-row dense>
      <v-col
        v-for="link in links"
        :key="link.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card
          class="pa-4 h-100 quick-link-card"
          elevation="1"
          rounded="lg"
          :to="!isExternal(link.link_url) && link.link_url ? link.link_url : undefined"
          :href="isExternal(link.link_url) ? link.link_url : undefined"
          :target="isExternal(link.link_url) ? '_blank' : undefined"
          :rel="isExternal(link.link_url) ? 'noopener' : undefined"
        >
          <div class="d-flex align-center ga-3">
            <v-avatar color="primary" variant="tonal" size="44" class="flex-shrink-0">
              <v-icon :icon="link.icon || 'mdi-link-variant'" size="22" />
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
  </v-container>
</template>

<style scoped>
.quick-link-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.quick-link-card:hover {
  transform: translateY(-2px);
}
</style>
