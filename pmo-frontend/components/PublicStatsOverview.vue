<script setup lang="ts">
// T-HOME (TH-5): quick statistics — consumes the shared published-projects
// composable (no fetch of its own) and renders responsive stat tiles.
const { fetchOnce, loading, total, ongoing, completed, totalContractValue } = usePublicProjects()

onMounted(fetchOnce)

const pesoCompact = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const tiles = computed(() => [
  { label: 'Published Projects', value: String(total.value), icon: 'mdi-clipboard-list-outline' },
  { label: 'Ongoing', value: String(ongoing.value), icon: 'mdi-progress-clock' },
  { label: 'Completed', value: String(completed.value), icon: 'mdi-check-circle-outline' },
  { label: 'Total Contract Value', value: pesoCompact.format(totalContractValue.value), icon: 'mdi-cash-multiple' },
])
</script>

<template>
  <div class="py-12" style="background-color: rgb(var(--v-theme-figma-surface));">
    <v-container>
      <div class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">Public Snapshot</h2>
        <p class="text-subtitle-1 text-figma-muted">
          Live counts from PMO-published infrastructure data.
        </p>
      </div>
      <v-row dense>
        <v-col
          v-for="tile in tiles"
          :key="tile.label"
          cols="6"
          sm="3"
        >
          <v-skeleton-loader v-if="loading" type="card" height="150" rounded="lg" />
          <v-card
            v-else
            class="pa-4 pa-sm-6 text-center h-100"
            variant="elevated"
            role="status"
            :aria-label="`${tile.label}: ${tile.value}`"
          >
            <v-icon :icon="tile.icon" size="36" color="figma-accent" class="mb-3" />
            <div class="text-h4 text-sm-h3 font-weight-bold text-figma-primary">
              {{ tile.value }}
            </div>
            <div class="text-subtitle-2 text-figma-muted mt-1">{{ tile.label }}</div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>
