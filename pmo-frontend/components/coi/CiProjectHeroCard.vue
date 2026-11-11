<script setup lang="ts">
/**
 * KD-C: Executive cover card for COI Overview tab.
 * Two-column hero (image + key facts) plus 4-card KPI strip and progress bars.
 */
import type { UIProjectDetail } from '~/utils/adapters'
import { labelForPrimaryFundingSource } from '~/utils/coiHierarchies'

interface Props {
  project: UIProjectDetail
}
const props = defineProps<Props>()

// AAAK two-level funding: show the Level-1 category label, falling back to the legacy
// funding-source name for projects created before the split (same rule as the COI index).
const fundingSourceLabel = computed(() =>
  props.project.primaryFundingSource
    ? labelForPrimaryFundingSource(props.project.primaryFundingSource)
    : props.project.fundSource,
)

function fmtCurrency(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const physicalProgress = computed(() => Number(props.project.physicalProgress || 0))
const financialUtilization = computed(() => {
  const f = props.project.financials?.[0] as any
  if (!f) return null
  const rate = f.utilizationRate ?? f.utilization_rate
  return rate != null ? Number(rate) : null
})

const daysRemaining = computed(() => {
  if (!props.project.targetCompletionDate) return null
  const target = new Date(props.project.targetCompletionDate).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86400000)
})

const statusColor = computed(() => {
  const s = props.project.status?.toUpperCase?.() || ''
  if (s.includes('COMPLETED')) return 'success'
  if (s.includes('PROGRESS') || s.includes('ONGOING')) return 'primary'
  if (s.includes('SUSPEND') || s.includes('CANCEL')) return 'error'
  return 'grey'
})
</script>

<template>
  <v-card class="mb-4" variant="elevated">
    <v-row no-gutters>
      <v-col cols="12" md="4">
        <v-img
          aspect-ratio="16/9"
          cover
          class="bg-grey-lighten-3"
        >
          <template #placeholder>
            <div class="d-flex align-center justify-center fill-height bg-grey-lighten-3">
              <v-icon icon="mdi-office-building" size="64" color="grey-lighten-1" />
            </div>
          </template>
        </v-img>
      </v-col>
      <v-col cols="12" md="8">
        <v-card-text>
          <div class="d-flex align-center ga-2 flex-wrap mb-2">
            <h2 class="text-h5 font-weight-bold mb-0">{{ project.projectName }}</h2>
            <v-chip :color="statusColor" size="small" variant="tonal">{{ project.status || '—' }}</v-chip>
            <v-chip v-if="project.subcategory" size="small" variant="outlined">{{ project.subcategory }}</v-chip>
          </div>
          <div class="text-caption text-grey mb-3">{{ project.projectCode }}</div>

          <v-row dense>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">Contractor</div>
              <div class="text-body-2">{{ project.contractor || '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">Funding Source</div>
              <div class="text-body-2">{{ fundingSourceLabel || '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">Start Date</div>
              <div class="text-body-2">{{ fmtDate(project.startDate) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">Target Completion</div>
              <div class="text-body-2">{{ fmtDate(project.targetCompletionDate) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">Project Manager</div>
              <div class="text-body-2">{{ project.projectManager || '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">Project Engineer</div>
              <div class="text-body-2">{{ project.projectEngineer || '—' }}</div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-col>
    </v-row>

    <v-divider />

    <!-- KPI strip -->
    <v-card-text class="pa-3">
      <v-row dense>
        <v-col cols="6" md="3">
          <v-card variant="tonal" color="primary" class="pa-3">
            <div class="text-caption text-grey-darken-1">Physical Progress</div>
            <div class="text-h6 font-weight-bold">{{ physicalProgress.toFixed(1) }}%</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card variant="tonal" color="success" class="pa-3">
            <div class="text-caption text-grey-darken-1">Financial Utilization</div>
            <div class="text-h6 font-weight-bold">
              {{ financialUtilization == null ? '—' : `${financialUtilization.toFixed(1)}%` }}
            </div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card variant="tonal" color="info" class="pa-3">
            <div class="text-caption text-grey-darken-1">Contract Amount</div>
            <div class="text-h6 font-weight-bold">{{ fmtCurrency(project.totalContractAmount) }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card
            variant="tonal"
            :color="(daysRemaining ?? 0) < 0 ? 'error' : 'warning'"
            class="pa-3"
          >
            <div class="text-caption text-grey-darken-1">Days Remaining</div>
            <div class="text-h6 font-weight-bold">
              {{ daysRemaining == null ? '—' : daysRemaining }}
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <v-divider />

    <v-card-text>
      <div class="text-caption text-grey mb-1">Physical Progress</div>
      <v-progress-linear
        :model-value="physicalProgress"
        :max="Number(project.targetPhysicalProgress) || 100"
        height="10"
        rounded
        color="primary"
        class="mb-3"
      />
      <div class="text-caption text-grey mb-1">Financial Progress</div>
      <v-progress-linear
        :model-value="Number(project.financialProgress || 0)"
        :max="Number(project.targetFinancialProgress) || 100"
        height="10"
        rounded
        color="success"
      />
    </v-card-text>
  </v-card>
</template>
