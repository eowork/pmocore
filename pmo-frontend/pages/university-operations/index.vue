<script setup lang="ts">
/**
 * Phase DA-B + DE-C: University Operations Landing Page with Analytics Dashboard
 *
 * This is the main entry point for University Operations.
 * It displays two category cards:
 * - Physical Accomplishments (BAR No. 1)
 * - Financial Accomplishments (BAR No. 2) - DEFERRED
 *
 * Phase DE-C: Analytics Dashboard with ApexCharts visualizations
 * - Pillar accomplishment summary (radial bar)
 * - Quarterly trend (line chart)
 * - Yearly comparison (bar chart)
 */

import VueApexCharts from 'vue3-apexcharts'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const router = useRouter()
const route = useRoute()
const api = useApi()
const toast = useToast()
const { canAdd, isAdmin, isSuperAdmin } = usePermissions()

// Phase DW-B: Centralized fiscal year store
import { useFiscalYearStore } from '~/stores/fiscalYear'
import { storeToRefs } from 'pinia'

const fiscalYearStore = useFiscalYearStore()
const { selectedFiscalYear, fiscalYearOptions } = storeToRefs(fiscalYearStore)

// Phase DW-B: Fiscal year creation permission
const canCreateFiscalYear = computed(() => {
  return isSuperAdmin.value || (isAdmin.value && canAdd('operations'))
})

// Fixed Pillar Definitions (BAR1 Standard)
const PILLARS = [
  { id: 'HIGHER_EDUCATION', name: 'Higher Education', fullName: 'Higher Education Program', icon: 'mdi-school', color: '#1976D2' },
  { id: 'ADVANCED_EDUCATION', name: 'Advanced Ed', fullName: 'Advanced Education Program', icon: 'mdi-book-education', color: '#7B1FA2' },
  { id: 'RESEARCH', name: 'Research', fullName: 'Research Program', icon: 'mdi-flask', color: '#00897B' },
  { id: 'TECHNICAL_ADVISORY', name: 'Extension', fullName: 'Technical Advisory Extension', icon: 'mdi-handshake', color: '#F57C00' },
] as const

// State
const loading = ref(true)
// Phase DW-B: Removed local dashboardYear - now using fiscalYearStore.selectedFiscalYear
const pillarProgress = ref<Record<string, number>>({})
const analyticsLoading = ref(true)

// Analytics state
const pillarSummary = ref<any>(null)
const quarterlyTrend = ref<any>(null)
const yearlyComparison = ref<any>(null)

// Phase DW-B: Fiscal year creation dialog
const fiscalYearDialog = ref(false)
const newFiscalYear = ref<number>(new Date().getFullYear() + 1)
const creatingFiscalYear = ref(false)

// Phase DW-B: Open fiscal year creation dialog
function openFiscalYearDialog() {
  newFiscalYear.value = new Date().getFullYear() + 1
  fiscalYearDialog.value = true
}

// Phase DW-B: Create new fiscal year
async function createFiscalYear() {
  if (!newFiscalYear.value || newFiscalYear.value < 2020 || newFiscalYear.value > 2099) {
    toast.error('Please enter a valid fiscal year (2020-2099)')
    return
  }

  try {
    creatingFiscalYear.value = true
    await fiscalYearStore.createFiscalYear(newFiscalYear.value)
    toast.success(`Fiscal year ${newFiscalYear.value} created successfully`)
    fiscalYearDialog.value = false
    newFiscalYear.value = new Date().getFullYear() + 1
  } catch (error: any) {
    if (error.statusCode === 409) {
      toast.error(`Fiscal year ${newFiscalYear.value} already exists`)
    } else {
      toast.error(error.message || 'Failed to create fiscal year')
    }
  } finally {
    creatingFiscalYear.value = false
  }

  // Phase DW-B: Removed local fetchFiscalYears - now handled by store
}

// Fetch pillar completion data
async function fetchPillarProgress() {
  loading.value = true
  try {
    // Fetch indicators for each pillar to determine quarters with data
    const promises = PILLARS.map(async (pillar) => {
      const res = await api.get<any>(
        `/api/university-operations/indicators?pillar_type=${pillar.id}&fiscal_year=${selectedFiscalYear.value}`
      )

      // Phase DJ-B: Normalize response structure (array or {data: []})
      const indicators = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : []

      // Phase DJ-B: Debug logging for progress malfunction diagnosis
      if (indicators.length === 0) {
        console.log(`[Progress] No indicators for ${pillar.id} FY${selectedFiscalYear.value}. Response type:`, typeof res)
      }

      // Count quarters with data (at least one indicator has data for that quarter)
      let quartersComplete = 0
      for (const q of ['q1', 'q2', 'q3', 'q4']) {
        const hasData = indicators.some((ind: any) =>
          ind[`target_${q}`] !== null || ind[`accomplishment_${q}`] !== null
        )
        if (hasData) quartersComplete++
      }
      return { pillar: pillar.id, quartersComplete }
    })

    const results = await Promise.all(promises)
    const progress: Record<string, number> = {}
    results.forEach(r => {
      progress[r.pillar] = r.quartersComplete
    })
    pillarProgress.value = progress
  } catch (err: any) {
    console.error('[UniOps Landing] Failed to fetch progress:', err)
    pillarProgress.value = {}
  } finally {
    loading.value = false
  }
}

// Phase DE-C: Fetch analytics data
async function fetchAnalytics() {
  analyticsLoading.value = true
  try {
    const [summaryRes, trendRes, comparisonRes] = await Promise.all([
      api.get<any>(`/api/university-operations/analytics/pillar-summary?fiscal_year=${selectedFiscalYear.value}`),
      api.get<any>(`/api/university-operations/analytics/quarterly-trend?fiscal_year=${selectedFiscalYear.value}`),
      api.get<any>(`/api/university-operations/analytics/yearly-comparison?years=${fiscalYearOptions.value.slice(0, 3).join(',')}`),
    ])
    pillarSummary.value = summaryRes
    quarterlyTrend.value = trendRes
    yearlyComparison.value = comparisonRes
  } catch (err: any) {
    console.error('[UniOps Analytics] Failed to fetch:', err)
    toast.warning('Analytics data unavailable')
    pillarSummary.value = null
    quarterlyTrend.value = null
    yearlyComparison.value = null
  } finally {
    analyticsLoading.value = false
  }
}

// Get quarters complete for a pillar
function getQuartersComplete(pillarId: string): number {
  return pillarProgress.value[pillarId] || 0
}

// Phase DE-C + DN-E: Chart configurations with interactive click handlers
const pillarChartOptions = computed(() => ({
  chart: {
    type: 'radialBar' as const,
    height: 280,
    toolbar: { show: false },
    // Phase DN-E: Add click event for pillar drill-down navigation
    events: {
      dataPointSelection: (_event: any, _chartContext: any, config: any) => {
        const pillarIndex = config.dataPointIndex
        if (pillarIndex >= 0 && pillarIndex < PILLARS.length) {
          navigateToPhysical(PILLARS[pillarIndex].id)
        }
      },
      legendClick: (_chartContext: any, seriesIndex: number) => {
        if (seriesIndex >= 0 && seriesIndex < PILLARS.length) {
          navigateToPhysical(PILLARS[seriesIndex].id)
        }
      },
    },
  },
  plotOptions: {
    radialBar: {
      offsetY: 0,
      startAngle: 0,
      endAngle: 270,
      hollow: {
        margin: 5,
        size: '30%',
        background: 'transparent',
      },
      dataLabels: {
        name: {
          show: true,
          fontSize: '14px',
        },
        value: {
          show: true,
          fontSize: '16px',
          formatter: (val: number) => `${val.toFixed(0)}%`,
        },
      },
    },
  },
  colors: PILLARS.map(p => p.color),
  labels: PILLARS.map(p => p.name),
  legend: {
    show: true,
    position: 'bottom' as const,
    horizontalAlign: 'center' as const,
  },
  responsive: [{
    breakpoint: 480,
    options: {
      chart: { height: 260 },
      legend: { show: false },
    },
  }],
}))

const pillarChartSeries = computed(() => {
  if (!pillarSummary.value?.pillars) return [0, 0, 0, 0]
  return PILLARS.map(p => {
    const pillarData = pillarSummary.value.pillars.find((ps: any) => ps.pillar_type === p.id)
    return pillarData?.average_accomplishment_rate || 0
  })
})

const quarterlyTrendOptions = computed(() => ({
  chart: {
    type: 'line' as const,
    height: 280,
    toolbar: { show: false },
    zoom: { enabled: false },
  },
  stroke: {
    curve: 'smooth' as const,
    width: 3,
  },
  colors: ['#1976D2', '#4CAF50'],
  xaxis: {
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  },
  yaxis: {
    title: { text: 'Value' },
    min: 0,
  },
  legend: {
    position: 'top' as const,
    horizontalAlign: 'center' as const,
  },
  markers: {
    size: 5,
  },
  tooltip: {
    shared: true,
  },
}))

const quarterlyTrendSeries = computed(() => {
  if (!quarterlyTrend.value?.quarters) {
    return [
      { name: 'Target', data: [0, 0, 0, 0] },
      { name: 'Accomplishment', data: [0, 0, 0, 0] },
    ]
  }
  const quarters = quarterlyTrend.value.quarters
  return [
    { name: 'Target', data: quarters.map((q: any) => q.total_target || 0) },
    { name: 'Accomplishment', data: quarters.map((q: any) => q.total_accomplishment || 0) },
  ]
})

const yearlyComparisonOptions = computed(() => ({
  chart: {
    type: 'bar' as const,
    height: 280,
    toolbar: { show: false },
    // Phase DN-E: Add click event for year selection
    events: {
      dataPointSelection: (_event: any, _chartContext: any, config: any) => {
        const yearIndex = config.dataPointIndex
        if (yearlyComparison.value?.years && yearIndex >= 0 && yearIndex < yearlyComparison.value.years.length) {
          const selectedYear = yearlyComparison.value.years[yearIndex]?.fiscal_year
          if (selectedYear && selectedYear !== selectedFiscalYear.value) {
            selectedFiscalYear.value = selectedYear
          }
        }
      },
    },
  },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: '55%',
      borderRadius: 4,
    },
  },
  colors: ['#1976D2', '#4CAF50'],
  xaxis: {
    categories: yearlyComparison.value?.years?.map((y: any) => `FY ${y.fiscal_year}`) || [],
  },
  yaxis: {
    title: { text: 'Value' },
    min: 0,
  },
  legend: {
    position: 'top' as const,
    horizontalAlign: 'center' as const,
  },
  dataLabels: {
    enabled: false,
  },
}))

const yearlyComparisonSeries = computed(() => {
  if (!yearlyComparison.value?.years || yearlyComparison.value.years.length === 0) {
    return [
      { name: 'Target', data: [] },
      { name: 'Accomplishment', data: [] },
    ]
  }
  const years = yearlyComparison.value.years
  return [
    { name: 'Target', data: years.map((y: any) => y.total_target || 0) },
    { name: 'Accomplishment', data: years.map((y: any) => y.total_accomplishment || 0) },
  ]
})

// Phase DW-D: Target vs Actual bar chart configuration
const targetVsActualOptions = computed(() => ({
  chart: {
    type: 'bar' as const,
    height: 280,
    toolbar: { show: false },
    events: {
      dataPointSelection: (_event: any, _chartContext: any, config: any) => {
        const pillarIndex = config.dataPointIndex
        if (pillarIndex >= 0 && pillarIndex < PILLARS.length) {
          navigateToPhysical(PILLARS[pillarIndex].id)
        }
      },
    },
  },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: '55%',
      borderRadius: 4,
      dataLabels: {
        position: 'top',
      },
    },
  },
  colors: ['#1976D2', '#4CAF50'],  // Blue for Target, Green for Actual
  xaxis: {
    categories: PILLARS.map(p => p.name),
  },
  yaxis: {
    title: { text: 'Total Value' },
    min: 0,
    labels: {
      formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0),
    },
  },
  legend: {
    position: 'top' as const,
    horizontalAlign: 'center' as const,
  },
  dataLabels: {
    enabled: false,
  },
  tooltip: {
    y: {
      formatter: (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    },
  },
}))

// Phase DQ-C: Use unit-type-aware fields from backend
// COUNT/WEIGHTED_COUNT pillars show cumulative totals; PERCENTAGE-only pillars show avg rates
const targetVsActualSeries = computed(() => {
  if (!pillarSummary.value?.pillars) {
    return [
      { name: 'Target', data: [0, 0, 0, 0] },
      { name: 'Actual', data: [0, 0, 0, 0] },
    ]
  }
  return [
    {
      name: 'Target',
      data: PILLARS.map(p => {
        const pd = pillarSummary.value.pillars.find((ps: any) => ps.pillar_type === p.id)
        if (!pd) return 0
        // If pillar has count indicators, show count_target; otherwise pct_avg_target
        if (pd.count_indicator_count > 0) return pd.count_target || 0
        return pd.pct_avg_target || 0
      }),
    },
    {
      name: 'Actual',
      data: PILLARS.map(p => {
        const pd = pillarSummary.value.pillars.find((ps: any) => ps.pillar_type === p.id)
        if (!pd) return 0
        if (pd.count_indicator_count > 0) return pd.count_accomplishment || 0
        return pd.pct_avg_accomplishment || 0
      }),
    },
  ]
})

// Phase DW-B: Watch for fiscal year changes from store
watch(selectedFiscalYear, (newYear) => {
  // URL update handled by store's setFiscalYear()
  fetchPillarProgress()
  fetchAnalytics()
}, { immediate: false })

// Navigation
function navigateToPhysical(pillarId?: string) {
  router.push({
    path: '/university-operations/physical',
    query: {
      year: selectedFiscalYear.value.toString(),
      ...(pillarId && { pillar: pillarId })
    }
  })
}

function navigateToFinancial() {
  toast.info('Financial Accomplishments coming soon')
}

// Phase DW-B: Initialize from store on mount
onMounted(async () => {
  await fiscalYearStore.fetchFiscalYears()
  fetchPillarProgress()
  fetchAnalytics()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold text-grey-darken-3">
          University Operations
        </h1>
        <p class="text-subtitle-1 text-grey-darken-1">
          Manage BAR reporting and accomplishment tracking
        </p>
      </div>
      <!-- Phase DW-B: Fiscal year controls (selector + Add button) -->
      <div class="d-flex align-center ga-2">
        <v-select
          :model-value="selectedFiscalYear"
          @update:model-value="fiscalYearStore.setFiscalYear"
          :items="fiscalYearOptions"
          label="Fiscal Year"
          density="compact"
          variant="outlined"
          hide-details
          style="width: 130px"
          prepend-inner-icon="mdi-calendar"
        />
        <v-btn
          v-if="canCreateFiscalYear"
          color="success"
          variant="outlined"
          prepend-icon="mdi-calendar-plus"
          @click="openFiscalYearDialog"
        >
          <span class="d-none d-sm-inline">Add Year</span>
          <v-icon class="d-sm-none">mdi-calendar-plus</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Category Cards -->
    <v-row class="mb-6">
      <!-- Physical Accomplishments -->
      <v-col cols="12" md="6">
        <v-card
          class="pa-6 h-100 cursor-pointer"
          variant="outlined"
          hover
          @click="navigateToPhysical"
        >
          <div class="d-flex align-center mb-4">
            <v-avatar color="primary" size="56" class="mr-4">
              <v-icon size="28" color="white">mdi-chart-bar</v-icon>
            </v-avatar>
            <div>
              <h2 class="text-h5 font-weight-bold">Physical Accomplishments</h2>
              <p class="text-body-2 text-grey">BAR No. 1</p>
            </div>
          </div>
          <p class="text-body-1 mb-4">
            Quarterly Physical Report of Operations. Track outcome and output indicators
            across the four pillars: Higher Education, Advanced Education, Research, and
            Technical Advisory Extension.
          </p>
          <div class="d-flex align-center text-primary">
            <span class="font-weight-medium">Enter Physical Accomplishments</span>
            <v-icon end>mdi-arrow-right</v-icon>
          </div>
        </v-card>
      </v-col>

      <!-- Financial Accomplishments (DEFERRED) -->
      <v-col cols="12" md="6">
        <v-card
          class="pa-6 h-100"
          variant="outlined"
          disabled
        >
          <div class="d-flex align-center mb-4">
            <v-avatar color="grey" size="56" class="mr-4">
              <v-icon size="28" color="white">mdi-currency-php</v-icon>
            </v-avatar>
            <div>
              <h2 class="text-h5 font-weight-bold text-grey">Financial Accomplishments</h2>
            </div>
          </div>
          <p class="text-body-1 mb-4 text-grey">
            Budget utilization and financial performance tracking. Monitor allotments,
            obligations, and disbursements across fund types.
          </p>
          <div class="d-flex align-center text-grey">
            <v-chip color="grey" variant="tonal" size="small">
              <v-icon start size="small">mdi-clock-outline</v-icon>
              Coming Soon - Phase 2
            </v-chip>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Phase DE-C: Analytics Dashboard -->
    <v-card class="mb-6">
      <v-card-title class="d-flex align-center">
        <v-icon start color="primary">mdi-chart-areaspline</v-icon>
        Analytics Dashboard - FY {{ selectedFiscalYear }}
      </v-card-title>

      <v-divider />

      <!-- Analytics Loading State -->
      <v-card-text v-if="analyticsLoading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" size="48" />
        <div class="mt-4 text-grey">Loading analytics...</div>
      </v-card-text>

      <!-- Analytics Charts -->
      <v-card-text v-else>
        <!-- Phase DW-D: Target vs Actual Bar Chart (Full Width Row) -->
        <v-row class="mb-4">
          <v-col cols="12">
            <v-card variant="tonal" class="h-100">
              <v-card-title class="text-subtitle-1 d-flex align-center">
                <v-icon start size="small" color="primary">mdi-chart-bar-stacked</v-icon>
                Target vs Actual by Pillar - FY {{ selectedFiscalYear }}
              </v-card-title>
              <v-card-text>
                <ClientOnly>
                  <VueApexCharts
                    v-if="pillarSummary?.pillars?.length"
                    type="bar"
                    height="280"
                    :options="targetVsActualOptions"
                    :series="targetVsActualSeries"
                  />
                  <div v-else class="text-center py-8 text-grey">
                    <v-icon size="48">mdi-chart-bar</v-icon>
                    <div class="mt-2">No pillar data available</div>
                  </div>
                </ClientOnly>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <!-- Pillar Accomplishment Rates -->
          <v-col cols="12" md="4">
            <v-card variant="tonal" class="h-100">
              <v-card-title class="text-subtitle-1 d-flex align-center">
                <v-icon start size="small" color="primary">mdi-chart-donut</v-icon>
                Pillar Accomplishment Rates
              </v-card-title>
              <v-card-text>
                <ClientOnly>
                  <VueApexCharts
                    type="radialBar"
                    height="280"
                    :options="pillarChartOptions"
                    :series="pillarChartSeries"
                  />
                </ClientOnly>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Quarterly Trend -->
          <v-col cols="12" md="4">
            <v-card variant="tonal" class="h-100">
              <v-card-title class="text-subtitle-1 d-flex align-center">
                <v-icon start size="small" color="success">mdi-trending-up</v-icon>
                Quarterly Trend
              </v-card-title>
              <v-card-text>
                <ClientOnly>
                  <VueApexCharts
                    type="line"
                    height="280"
                    :options="quarterlyTrendOptions"
                    :series="quarterlyTrendSeries"
                  />
                </ClientOnly>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Yearly Comparison -->
          <v-col cols="12" md="4">
            <v-card variant="tonal" class="h-100">
              <v-card-title class="text-subtitle-1 d-flex align-center">
                <v-icon start size="small" color="orange">mdi-chart-bar</v-icon>
                Year-over-Year Comparison
              </v-card-title>
              <v-card-text>
                <ClientOnly>
                  <VueApexCharts
                    v-if="yearlyComparison?.years?.length"
                    type="bar"
                    height="280"
                    :options="yearlyComparisonOptions"
                    :series="yearlyComparisonSeries"
                  />
                  <div v-else class="text-center py-8 text-grey">
                    <v-icon size="48">mdi-chart-bar</v-icon>
                    <div class="mt-2">No historical data available</div>
                  </div>
                </ClientOnly>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Phase DN-D: Pillar Summary Cards with click navigation -->
        <v-row class="mt-4" v-if="pillarSummary?.pillars">
          <v-col v-for="pillar in PILLARS" :key="pillar.id" cols="6" md="3">
            <v-card
              variant="outlined"
              class="h-100 cursor-pointer"
              hover
              @click="navigateToPhysical(pillar.id)"
            >
              <v-card-text class="pa-3">
                <div class="d-flex align-center mb-2">
                  <v-avatar :color="pillar.color" size="32" class="mr-2">
                    <v-icon size="18" color="white">{{ pillar.icon }}</v-icon>
                  </v-avatar>
                  <span class="text-subtitle-2 font-weight-medium">{{ pillar.name }}</span>
                </div>
                <div
                  v-if="pillarSummary?.pillars?.find((p: any) => p.pillar_type === pillar.id)"
                  class="d-flex flex-column"
                >
                  <div class="d-flex justify-space-between text-caption mb-1">
                    <span class="text-grey">Indicators:</span>
                    <span class="font-weight-medium">
                      {{ pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.indicators_with_data || 0 }}
                      / {{ pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.total_taxonomy_indicators || 0 }}
                    </span>
                  </div>
                  <div class="d-flex justify-space-between text-caption mb-1">
                    <span class="text-grey">Outcomes:</span>
                    <span>{{ pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.outcome_indicators || 0 }}</span>
                  </div>
                  <div class="d-flex justify-space-between text-caption">
                    <span class="text-grey">Outputs:</span>
                    <span>{{ pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.output_indicators || 0 }}</span>
                  </div>
                  <!-- Phase DW-E: Completion rate chip -->
                  <div class="d-flex ga-1 mt-2 flex-wrap">
                    <v-chip
                      :color="(pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.completion_rate || 0) >= 80 ? 'success' : (pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.completion_rate || 0) >= 50 ? 'warning' : 'error'"
                      size="small"
                      variant="tonal"
                    >
                      <v-icon start size="x-small">mdi-check-circle</v-icon>
                      {{ (pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.completion_rate || 0).toFixed(0) }}% Data
                    </v-chip>
                    <v-chip
                      :color="(pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.average_accomplishment_rate || 0) >= 80 ? 'success' : 'warning'"
                      size="small"
                      variant="tonal"
                    >
                      {{ (pillarSummary.pillars.find((p: any) => p.pillar_type === pillar.id)?.average_accomplishment_rate || 0).toFixed(1) }}% Rate
                    </v-chip>
                  </div>
                </div>
                <div v-else class="text-center text-grey text-caption py-2">
                  No data
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- FY Completion Dashboard -->
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon start>mdi-chart-donut</v-icon>
        Quarterly Data Entry Progress
      </v-card-title>

      <v-divider />

      <!-- Loading State -->
      <v-card-text v-if="loading" class="text-center py-6">
        <v-progress-circular indeterminate color="primary" />
        <div class="mt-2 text-grey">Loading progress...</div>
      </v-card-text>

      <!-- Progress Cards -->
      <v-card-text v-else>
        <v-row>
          <v-col v-for="pillar in PILLARS" :key="pillar.id" cols="6" md="3">
            <v-card
              variant="tonal"
              :color="pillar.color"
              class="text-center pa-4 cursor-pointer"
              @click="navigateToPhysical(pillar.id)"
            >
              <v-icon size="32" class="mb-2">{{ pillar.icon }}</v-icon>
              <div class="text-subtitle-2">{{ pillar.name }}</div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ getQuartersComplete(pillar.id) }}/4
              </div>
              <div class="text-caption">Quarters with Data</div>
              <v-progress-linear
                :model-value="(getQuartersComplete(pillar.id) / 4) * 100"
                :color="pillar.color"
                class="mt-2"
                height="6"
                rounded
              />
            </v-card>
          </v-col>
        </v-row>

        <div class="text-center mt-4">
          <v-btn
            color="primary"
            variant="tonal"
            @click="navigateToPhysical"
          >
            <v-icon start>mdi-pencil</v-icon>
            Enter Quarterly Data
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Phase DW-B: Fiscal Year Creation Dialog -->
    <v-dialog v-model="fiscalYearDialog" max-width="450" persistent>
      <v-card>
        <v-card-title class="text-h6 bg-success text-white">
          <v-icon class="mr-2">mdi-calendar-plus</v-icon>
          Add Fiscal Year
        </v-card-title>

        <v-card-text class="pt-4">
          <p class="text-body-2 mb-4">
            Create a new fiscal year configuration for University Operations reporting.
          </p>

          <v-text-field
            v-model.number="newFiscalYear"
            type="number"
            label="Fiscal Year"
            placeholder="2027"
            variant="outlined"
            density="comfortable"
            :min="2020"
            :max="2099"
            prepend-inner-icon="mdi-calendar"
            hint="Enter a year between 2020 and 2099"
            persistent-hint
            autofocus
            @keydown.enter="createFiscalYear"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="fiscalYearDialog = false"
            :disabled="creatingFiscalYear"
          >
            Cancel
          </v-btn>
          <v-btn
            color="success"
            variant="flat"
            prepend-icon="mdi-check"
            :loading="creatingFiscalYear"
            @click="createFiscalYear"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
