<script setup lang="ts">
// T-HOME (TH-7): university snapshot — two lightweight charts aggregated
// client-side from the shared published list (no analytics endpoint; D7).
import VueApexCharts from 'vue3-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { STATUS_HEX } from '~/utils/status-colors'
import { labelForCampus } from '~/utils/campus'

const { fetchOnce, loading, byStatus, byCampus } = usePublicProjects()

onMounted(fetchOnce)

const hasStatusData = computed(() => byStatus.value.length > 0)
const hasCampusData = computed(() => byCampus.value.length > 0)

const statusChart = computed<{ series: number[]; options: ApexOptions }>(() => ({
  series: byStatus.value.map(s => s.count),
  options: {
    chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
    labels: byStatus.value.map(s => s.status),
    colors: byStatus.value.map(s => STATUS_HEX[s.status] || '#94a3b8'),
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '62%' } } },
    stroke: { width: 2 },
  },
}))

const campusChart = computed<{ series: { name: string; data: number[] }[]; options: ApexOptions }>(() => ({
  series: [{ name: 'Projects', data: byCampus.value.map(c => c.count) }],
  options: {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Poppins, sans-serif' },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%' } },
    colors: ['#0EA5E9'],
    xaxis: {
      categories: byCampus.value.map(c => labelForCampus(c.campus)),
      labels: { formatter: (v: string) => `${Math.round(Number(v))}` },
    },
    dataLabels: { enabled: false },
    grid: { borderColor: '#E2E8F0' },
  },
}))
</script>

<template>
  <div class="py-12" style="background-color: rgb(var(--v-theme-figma-surface));">
    <v-container>
      <div class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">University Snapshot</h2>
        <p class="text-subtitle-1 text-figma-muted">
          Distribution of published infrastructure projects across the University.
        </p>
      </div>

      <v-row dense>
        <v-col cols="12" md="6">
          <v-card class="pa-4 h-100" variant="elevated">
            <h3 class="text-subtitle-1 font-weight-bold text-figma-primary mb-2">Projects by Status</h3>
            <v-skeleton-loader v-if="loading" type="image" height="300" />
            <VueApexCharts
              v-else-if="hasStatusData"
              type="donut"
              height="300"
              :series="statusChart.series"
              :options="statusChart.options"
            />
            <div v-else class="d-flex flex-column align-center justify-center py-10">
              <v-icon size="48" color="grey-lighten-2">mdi-chart-donut</v-icon>
              <p class="text-body-2 text-figma-muted mt-2 mb-0">No data available</p>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="pa-4 h-100" variant="elevated">
            <h3 class="text-subtitle-1 font-weight-bold text-figma-primary mb-2">Projects by Campus</h3>
            <v-skeleton-loader v-if="loading" type="image" height="300" />
            <VueApexCharts
              v-else-if="hasCampusData"
              type="bar"
              height="300"
              :series="campusChart.series"
              :options="campusChart.options"
            />
            <div v-else class="d-flex flex-column align-center justify-center py-10">
              <v-icon size="48" color="grey-lighten-2">mdi-chart-bar</v-icon>
              <p class="text-body-2 text-figma-muted mt-2 mb-0">No data available</p>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>
