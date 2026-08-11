<script setup lang="ts">
/**
 * Phase MG-B (2026-05-21): UI refactor — grid layout (cards in columns)
 * replacing stacked expansion panels for better horizontal space utilization
 * and reduced scrolling.
 *
 * Layout (responsive):
 *   Row A (full width)              Core Project Identity
 *   Row B (12/6 + 12/6)             Location          | Implementation Agencies
 *   Row C (12/6 + 12/6)             Funding & Cost    | Other Attributes
 *   Row D (12/6 + 12/6)             Project Objectives| Beneficiary Groups
 *   Row E (full width)              Strategic Alignment
 *
 * Beneficiary aggregate count removed per ECO directive 2026-05-21.
 */
import type { BasicInfoFormState } from '~/utils/coiFormState'
import { LIKHA_OPTIONS, RDP_OPTIONS, SOCIOECONOMIC_OPTIONS, SDG_OPTIONS, RDP2017_OPTIONS, POINT_AGENDA_10_OPTIONS, PRIMARY_FUNDING_SOURCE_OPTIONS } from '~/utils/coiHierarchies'
// NC fix (2026-05-21): Explicit imports — Nuxt default auto-import path-prefixes
// nested-dir components (components/coi/Foo.vue → <CoiFoo>), so the filename-only
// tags in this template would silently fail to render without these imports.
import CiHierarchicalSelectorTrigger from '~/components/coi/CiHierarchicalSelectorTrigger.vue'
import CiBulletListInput from '~/components/coi/CiBulletListInput.vue'

const form = defineModel<BasicInfoFormState>({ required: true })

const props = withDefaults(defineProps<{
  fundingSources: { id: string; name: string; type?: string }[]
  contractors:    { id: string; name: string }[]    // legacy — no longer rendered
  rules?: {
    required:       (v: string)          => boolean | string
    positiveNumber: (v: number | null)   => boolean | string
    projectCode?:   (v: string)          => boolean | string
  }
  readOnly?: boolean
}>(), {
  readOnly: false,
})

// NC: Hierarchy data sourced from utils/coiHierarchies.ts (single source of truth)
const rdpOptions   = RDP_OPTIONS
const socioOptions = SOCIOECONOMIC_OPTIONS
const likhaOptions = LIKHA_OPTIONS
const sdgOptions   = SDG_OPTIONS
// XXX-I: Historical Planning Frameworks (2017–2022)
const rdp2017Options = RDP2017_OPTIONS
const pointAgenda10Options = POINT_AGENDA_10_OPTIONS

// ── Static Option Lists ──────────────────────────────────────────────────────
const campusOptions = [
  { title: 'Main Campus',       value: 'MAIN' },
  { title: 'Cabadbaran Campus', value: 'CABADBARAN' },
  { title: 'Both Campuses',     value: 'BOTH' },
]

const statusOptions = [
  { title: 'Proposal',  value: 'PROPOSAL'  },
  { title: 'Ongoing',   value: 'ONGOING'   },
  { title: 'Complete',  value: 'COMPLETE'  },
  { title: 'On Hold',   value: 'ON_HOLD'   },
  { title: 'Cancelled', value: 'CANCELLED' },
]

const fundingTypeOptions = [
  { title: 'Internal Funds', value: 'INTERNAL' },
  { title: 'External Funds', value: 'EXTERNAL' },
]

// ── Rule helpers ────────────────────────────────────────────────────────────
const r = computed(() => ({
  required:       props.rules?.required       ?? (() => true),
  positiveNumber: props.rules?.positiveNumber ?? (() => true),
}))

// AAAK: Two-Level Funding — Level-1 controlled category options (single source of truth
// in utils/coiHierarchies.ts, mirrors backend PrimaryFundingSource enum).
const primaryFundingSourceOptions = PRIMARY_FUNDING_SOURCE_OPTIONS

// NC: Inline bullet helpers (addObjective/addBeneficiary/etc) removed —
// now handled internally by CiBulletListInput components.

// XXX-J: Implementation Period suggested-duration hint (informational only, R-222)
const implementationPeriodHint = computed(() => {
  const start = form.value.original_start_date
  const end = form.value.original_completion_date
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12
    + (endDate.getMonth() - startDate.getMonth())
  if (endDate.getDate() < startDate.getDate()) months--
  if (months < 0) return null
  return `Suggested: ~${months} month${months === 1 ? '' : 's'} (from Original Start/Completion dates)`
})

// ── Custom funding source row ───────────────────────────────────────────────
const newCustomFundType = ref<'INTERNAL' | 'EXTERNAL' | 'CUSTOM'>('CUSTOM')
const newCustomFundName = ref('')
const newCustomFundNotes = ref('')

function addCustomFundingSource() {
  const name = newCustomFundName.value.trim()
  if (!name) return
  if (!Array.isArray(form.value.additional_funding_sources)) {
    form.value.additional_funding_sources = []
  }
  if (form.value.additional_funding_sources.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    return
  }
  form.value.additional_funding_sources.push({
    type: newCustomFundType.value,
    name,
    notes: newCustomFundNotes.value.trim() || undefined,
  })
  newCustomFundName.value = ''
  newCustomFundNotes.value = ''
  newCustomFundType.value = 'CUSTOM'
}
function removeCustomFundingSource(i: number) {
  form.value.additional_funding_sources.splice(i, 1)
}

// ZZZ-H: HCI — collapsible custom-funding sub-form + alignment count for expansion panel
const showAddFundingSource = ref(false)
const totalAlignmentCount = computed(() =>
  (form.value.sdg_goals?.length || 0) +
  (form.value.rdp_alignment?.length || 0) +
  (form.value.socioeconomic_agenda?.length || 0) +
  (form.value.csu_likha_goals?.length || 0),
)
</script>

<template>
  <!-- ══════════════════════════════════════════════════════════════════════
       ROW A — Core Project Identity (always visible, required)
       ══════════════════════════════════════════════════════════════════════ -->
  <v-card class="mb-3" elevation="2" rounded="lg">
    <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
      <v-icon size="small" icon="mdi-identifier" color="primary" />
      <span class="text-subtitle-1 font-weight-medium">Project Identity</span>
      <v-chip size="x-small" color="error" variant="tonal" class="ml-1">Required</v-chip>
    </v-card-title>
    <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
      Core identifying information. All starred (*) fields are required to create or update the project record.
    </v-card-subtitle>
    <v-divider />
    <v-card-text class="py-3">
      <v-row dense>
        <!-- ZZZ-H: Project Title promoted to full-width primary field -->
        <v-col cols="12">
          <v-text-field
            v-model="form.title"
            label="Project Title"
            placeholder="e.g., College of Engineering Building"
            :rules="[r.required]"
            density="compact"
            variant="outlined"
            hide-details="auto"
          >
            <template #label>Project Title <span class="required-star">*</span></template>
          </v-text-field>
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="form.project_code"
            label="Project Code"
            placeholder="e.g., CP-2026-001"
            :rules="[r.required]"
            density="compact"
            variant="outlined"
            hide-details="auto"
          >
            <template #label>Project Code <span class="required-star">*</span></template>
          </v-text-field>
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="form.campus"
            label="Campus"
            :items="campusOptions"
            :rules="[r.required]"
            density="compact"
            variant="outlined"
            hide-details="auto"
          >
            <template #label>Campus <span class="required-star">*</span></template>
          </v-select>
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="form.status"
            label="Project Status"
            :items="statusOptions"
            :rules="[r.required]"
            density="compact"
            variant="outlined"
            hide-details="auto"
          >
            <template #label>Project Status <span class="required-star">*</span></template>
          </v-select>
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="form.description"
            label="Project Description"
            placeholder="Describe the project scope, purpose, and intended outcome..."
            rows="2"
            auto-grow
            density="compact"
            variant="outlined"
            hide-details="auto"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <!-- XXX-F: Section overline header for Row B -->
  <div class="d-flex align-center ga-2 mb-2 mt-3">
    <v-icon size="18" color="grey-darken-2">mdi-map-marker-outline</v-icon>
    <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Location &amp; Implementation</span>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       ROW B — Location | Implementation Agencies (side-by-side)
       ══════════════════════════════════════════════════════════════════════ -->
  <v-row dense class="mb-1">
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-map-marker-outline" color="info" />
          <span class="text-subtitle-1 font-weight-medium">Location</span>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Geographic scope of the project: spatial coverage area, municipality, and province for COA / GPPA reporting.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="form.spatial_coverage"
                label="Spatial Coverage"
                placeholder="e.g., 1.5 hectares main quadrangle"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.municipality"
                label="Municipality"
                placeholder="e.g., Butuan City"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.province"
                label="Province"
                placeholder="e.g., Agusan del Norte"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-office-building-outline" color="info" />
          <span class="text-subtitle-1 font-weight-medium">Implementation Agencies</span>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Agencies responsible for project execution. Implementing Agency is the primary owner; co-implementing and attached agencies are supporting parties.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="form.implementing_agency"
                label="Implementing Agency"
                placeholder="e.g., CSU Engineering and Construction Office (ECO)"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.co_implementing_agency"
                label="Co-Implementing Agency"
                placeholder="Optional"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.attached_agency"
                label="Attached Agency"
                placeholder="Optional"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <!-- XXX-F: Section overline header for Row C -->
  <div class="d-flex align-center ga-2 mb-2 mt-3">
    <v-icon size="18" color="grey-darken-2">mdi-cash-multiple</v-icon>
    <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Funding &amp; Project Details</span>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       ROW C — Funding & Cost | Other Attributes (side-by-side)
       ══════════════════════════════════════════════════════════════════════ -->
  <v-row dense class="mb-1">
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-cash-multiple" color="success" />
          <span class="text-subtitle-1 font-weight-medium">Funding Source &amp; Cost</span>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Choose a standardized Funding Source (used for analytics), optionally add a specific Funding Source Description (e.g. GAA FY2025), and enter cost in PHP. Use the chip area to register additional co-funding sources.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.funding_source_type"
                label="Funding Type"
                :items="fundingTypeOptions"
                clearable
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.cost_amount"
                label="Cost Amount (PHP)"
                type="number"
                placeholder="1000000.00"
                :rules="[r.positiveNumber]"
                prefix="₱"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <!-- AAAK: Two-Level Funding — Level 1 (controlled category, required) -->
            <v-col cols="12">
              <v-select
                v-model="form.primary_funding_source"
                label="Funding Source"
                :items="primaryFundingSourceOptions"
                item-title="title"
                item-value="value"
                :rules="[r.required]"
                clearable
                density="compact"
                variant="outlined"
                hide-details="auto"
              >
                <template #label>Funding Source <span class="required-star">*</span></template>
              </v-select>
            </v-col>
            <!-- AAAK: Two-Level Funding — Level 2 (free-text description, optional) -->
            <v-col cols="12">
              <v-text-field
                v-model="form.funding_source_description"
                label="Funding Source Description"
                placeholder="e.g., GAA FY2025, GAA Savings, CHED Grant"
                hint="Provide a specific funding description such as GAA FY2025, GAA Savings, CHED Grant, DOST Grant, etc."
                persistent-hint
                density="compact"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <!-- Chip list of additional funding sources -->
          <div v-if="form.additional_funding_sources?.length" class="mt-3 d-flex flex-wrap ga-1">
            <v-chip
              v-for="(src, i) in form.additional_funding_sources"
              :key="i"
              closable
              :color="src.type === 'INTERNAL' ? 'primary' : src.type === 'EXTERNAL' ? 'success' : 'grey'"
              variant="tonal"
              size="small"
              @click:close="removeCustomFundingSource(i)"
            >
              <strong>{{ src.type }}</strong>:&nbsp;{{ src.name }}
              <span v-if="src.notes" class="ml-1 text-caption">({{ src.notes }})</span>
            </v-chip>
          </div>

          <v-divider class="my-3" />

          <!-- ZZZ-H: collapsible custom funding sub-form -->
          <v-btn
            size="x-small" variant="text" color="primary" prepend-icon="mdi-plus"
            @click="showAddFundingSource = !showAddFundingSource"
          >
            Add another funding source
          </v-btn>
          <v-expand-transition>
            <v-row v-if="showAddFundingSource" dense align="end" class="mt-1">
              <v-col cols="4" sm="3">
                <v-select
                  v-model="newCustomFundType"
                  label="Type"
                  :items="[
                    { title: 'Internal', value: 'INTERNAL' },
                    { title: 'External', value: 'EXTERNAL' },
                    { title: 'Custom',   value: 'CUSTOM'   },
                  ]"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
              <v-col cols="8" sm="6">
                <v-text-field
                  v-model="newCustomFundName"
                  label="Source Name"
                  placeholder="e.g., DPWH Counterpart Fund"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @keydown.enter.prevent="addCustomFundingSource"
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-btn
                  color="primary"
                  variant="tonal"
                  block
                  :disabled="!newCustomFundName.trim()"
                  prepend-icon="mdi-plus"
                  @click="addCustomFundingSource"
                >
                  Add
                </v-btn>
              </v-col>
            </v-row>
          </v-expand-transition>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-cube-outline" color="warning" />
          <span class="text-subtitle-1 font-weight-medium">Other Attributes</span>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Contractor (free-text, no dropdown), Project Engineer, building classification, and floor area in square meters.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="form.contractor"
                label="Contractor"
                placeholder="Free-text name of contracting firm or builder"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="form.project_engineer"
                label="Project Engineer (Contractor)"
                placeholder="e.g., Engr. Juan Dela Cruz"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.building_type"
                label="Building Type"
                placeholder="e.g., Academic, Laboratory"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.floor_area"
                label="Floor Area (sqm)"
                type="number"
                placeholder="e.g., 1200"
                :rules="[r.positiveNumber]"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
            </v-col>
            <!-- XXX-J: Implementation Period (free-text, R-222) -->
            <v-col cols="12">
              <v-text-field
                v-model="form.implementation_period"
                label="Implementation Period"
                placeholder="e.g., 18 Months"
                density="compact"
                variant="outlined"
                hide-details="auto"
              />
              <div v-if="implementationPeriodHint" class="text-caption text-grey-darken-1 mt-1">
                {{ implementationPeriodHint }}
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <!-- XXX-F: Section overline header for Row D -->
  <div class="d-flex align-center ga-2 mb-2 mt-3">
    <v-icon size="18" color="grey-darken-2">mdi-target</v-icon>
    <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Objectives &amp; Beneficiaries</span>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       ROW D — Project Objectives | Beneficiary Groups (side-by-side)
       ══════════════════════════════════════════════════════════════════════ -->
  <v-row dense class="mb-1">
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-target" color="primary" />
          <span class="text-subtitle-1 font-weight-medium">Project Objectives</span>
          <v-chip size="x-small" variant="tonal" color="primary">
            {{ (form.objectives_list || []).filter(s => s.trim()).length }}
          </v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          List specific, measurable objectives (one per bullet). These map to MPR/WAR planning sections.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiBulletListInput
            v-model="form.objectives_list"
            add-label="Add Objective"
            color="primary"
            :placeholder="(i: number) => `Objective ${i + 1}`"
            :read-only="readOnly"
            empty-state-text="No objectives listed."
          />
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-account-group-outline" color="success" />
          <span class="text-subtitle-1 font-weight-medium">Beneficiary Groups</span>
          <v-chip size="x-small" variant="tonal" color="success">
            {{ (form.beneficiary_list || []).filter(s => s.trim()).length }}
          </v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          List who benefits from this project (one group per bullet, e.g., "College of Engineering students"). Used for impact reporting.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiBulletListInput
            v-model="form.beneficiary_list"
            add-label="Add Beneficiary Group"
            color="success"
            icon="mdi-circle-medium"
            :placeholder="(i: number) => `Group ${i + 1} (e.g., students, faculty, community)`"
            :read-only="readOnly"
            empty-state-text="No beneficiary groups listed."
          />
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <!-- XXX-F: Section overline header for Row E -->
  <div class="d-flex align-center ga-2 mb-2 mt-3">
    <v-icon size="18" color="grey-darken-2">mdi-strategy</v-icon>
    <span class="text-subtitle-2 font-weight-semibold text-grey-darken-2">Strategic Alignment</span>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       ROW E — Strategic Alignment (SSS-A: balanced container layout)
       Row 1: Narrative (full width)  |  Row 2: SDG + RDP  |  Row 3: SEA + LIKHA
       ══════════════════════════════════════════════════════════════════════ -->
  <!-- Row 1: Narrative -->
  <v-card elevation="2" rounded="lg" class="mb-1">
    <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
      <v-icon size="small" icon="mdi-strategy" color="purple" />
      <span class="text-subtitle-1 font-weight-medium">Strategic Alignment Narrative</span>
      <v-chip size="x-small" variant="tonal" color="grey">Optional</v-chip>
    </v-card-title>
    <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
      Describe how this project aligns with institutional strategic priorities — used in strategic dashboard rollups.
    </v-card-subtitle>
    <v-divider />
    <v-card-text class="py-3">
      <v-textarea
        v-model="form.strategic_alignment"
        label="Strategic Alignment Narrative (optional)"
        placeholder="Describe how this project aligns with institutional strategic priorities..."
        rows="3"
        auto-grow
        density="compact"
        variant="outlined"
        hide-details="auto"
        :readonly="readOnly"
      />
    </v-card-text>
  </v-card>

  <!-- ZZZ-H: Collapsible Strategic Framework Alignment (SDG / RDP / SEA / LIKHA) -->
  <!-- Row 2: SDG + RDP -->
  <v-row dense class="mb-1">
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-earth" color="teal" />
          <span class="text-subtitle-1 font-weight-medium">UN SDGs</span>
          <v-chip v-if="(form.sdg_goals || []).length" size="x-small" variant="tonal" color="teal">{{ (form.sdg_goals || []).length }}</v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          UN Sustainable Development Goals addressed by this project.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiHierarchicalSelectorTrigger
            v-model="form.sdg_goals"
            label="Sustainable Development Goals"
            title="UN Sustainable Development Goals"
            :options="sdgOptions"
            icon="mdi-earth"
            color="teal"
            description="Select all UN SDGs that this project contributes to."
            search-placeholder="Search SDGs…"
            :read-only="readOnly"
            :max-visible-chips="5"
          />
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-map-outline" color="primary" />
          <span class="text-subtitle-1 font-weight-medium">RDP 2023–2028</span>
          <v-chip v-if="(form.rdp_alignment || []).length" size="x-small" variant="tonal" color="primary">{{ (form.rdp_alignment || []).length }}</v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Caraga Regional Development Plan chapters and sub-chapters.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiHierarchicalSelectorTrigger
            v-model="form.rdp_alignment"
            label="RDP 2023–2028 (Caraga)"
            title="RDP 2023–2028 — Caraga Regional Development Plan"
            :options="rdpOptions"
            icon="mdi-map-outline"
            color="primary"
            description="Select all applicable Parts, Chapters, and Sub-chapters."
            search-placeholder="Search RDP chapters…"
            :read-only="readOnly"
            :max-visible-chips="5"
          />
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <!-- Row 3: Socio-Economic Agenda + LIKHA -->
  <v-row dense class="mb-1">
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-flag-variant-outline" color="warning" />
          <span class="text-subtitle-1 font-weight-medium">0+8 Socio-Economic Agenda</span>
          <v-chip v-if="(form.socioeconomic_agenda || []).length" size="x-small" variant="tonal" color="warning">{{ (form.socioeconomic_agenda || []).length }}</v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Socio-Economic Agenda priorities (sub-items independently selectable).
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiHierarchicalSelectorTrigger
            v-model="form.socioeconomic_agenda"
            label="0+8 Socio-Economic Agenda"
            title="0+8 Socio-Economic Agenda (Marcos Administration)"
            :options="socioOptions"
            icon="mdi-flag-variant-outline"
            color="warning"
            description="Sub-items are independently selectable."
            search-placeholder="Search agenda items…"
            :read-only="readOnly"
            :max-visible-chips="5"
          />
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" icon="mdi-school-outline" color="success" />
          <span class="text-subtitle-1 font-weight-medium">CSU LIKHA Goals</span>
          <v-chip v-if="(form.csu_likha_goals || []).length" size="x-small" variant="tonal" color="success">{{ (form.csu_likha_goals || []).length }}</v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Caraga State University institutional strategic plan goals.
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiHierarchicalSelectorTrigger
            v-model="form.csu_likha_goals"
            label="CSU LIKHA Goals"
            title="CSU LIKHA Strategic Goals"
            :options="likhaOptions"
            icon="mdi-school-outline"
            color="success"
            description="Caraga State University institutional strategic plan."
            search-placeholder="Search LIKHA goals…"
            :read-only="readOnly"
            :max-visible-chips="5"
          />
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <!-- XXX-J: Historical Planning Frameworks (2017–2022) — collapsed by default,
       visually deprioritized vs the always-visible "Current Planning Frameworks"
       cards above. R-221 Option B. -->
  <v-expansion-panels class="mb-1" variant="accordion">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <div class="d-flex align-center ga-2">
          <v-icon size="small" color="grey-darken-1">mdi-archive-clock-outline</v-icon>
          <span class="text-subtitle-2 font-weight-medium">Historical Planning Frameworks (2017–2022)</span>
          <v-chip size="x-small" variant="tonal" color="grey">Optional</v-chip>
        </div>
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-row dense class="mt-1">
          <v-col cols="12" md="6">
            <v-card elevation="2" rounded="lg" class="h-100">
              <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
                <v-icon size="small" icon="mdi-map-outline" color="grey-darken-1" />
                <span class="text-subtitle-1 font-weight-medium">RDP 2017–2022</span>
                <v-chip v-if="(form.rdp2017_alignment || []).length" size="x-small" variant="tonal" color="grey-darken-1">{{ (form.rdp2017_alignment || []).length }}</v-chip>
              </v-card-title>
              <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
                Caraga Regional Development Plan 2017–2022 chapters (historical).
              </v-card-subtitle>
              <v-divider />
              <v-card-text class="py-3">
                <CiHierarchicalSelectorTrigger
                  v-model="form.rdp2017_alignment"
                  label="RDP 2017–2022 (Caraga)"
                  title="RDP 2017–2022 — Caraga Regional Development Plan"
                  :options="rdp2017Options"
                  icon="mdi-map-outline"
                  color="grey-darken-1"
                  description="Select all applicable Parts and Chapters."
                  search-placeholder="Search RDP chapters…"
                  :read-only="readOnly"
                  :max-visible-chips="5"
                />
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card elevation="2" rounded="lg" class="h-100">
              <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
                <v-icon size="small" icon="mdi-flag-variant-outline" color="grey-darken-1" />
                <span class="text-subtitle-1 font-weight-medium">0+10 Point Agenda</span>
                <v-chip v-if="(form.point_agenda_10 || []).length" size="x-small" variant="tonal" color="grey-darken-1">{{ (form.point_agenda_10 || []).length }}</v-chip>
              </v-card-title>
              <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
                0+10 Point Socioeconomic Agenda (2016, historical).
              </v-card-subtitle>
              <v-divider />
              <v-card-text class="py-3">
                <CiHierarchicalSelectorTrigger
                  v-model="form.point_agenda_10"
                  label="0+10 Point Agenda"
                  title="0+10 Point Socioeconomic Agenda (2016)"
                  :options="pointAgenda10Options"
                  icon="mdi-flag-variant-outline"
                  color="grey-darken-1"
                  description="Select all applicable agenda points."
                  search-placeholder="Search agenda points…"
                  :read-only="readOnly"
                  :max-visible-chips="5"
                />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>

  <!-- ══════════════════════════════════════════════════════════════════════
       ROW G — Output / Outcome Indicators (OD: 2 dedicated cards)
       OD (2026-05-21): Extracted from Strategic Alignment card. Each gets
       its own card with clear shadow/padding boundary.
       ══════════════════════════════════════════════════════════════════════ -->
  <v-row dense class="mb-1">
    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" color="info">mdi-arrow-right-thick</v-icon>
          <span class="text-subtitle-1 font-weight-medium">Output Indicators</span>
          <v-chip size="x-small" variant="tonal" color="info">
            {{ (form.output_indicators_list || []).filter((s: string) => s.trim()).length }}
          </v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          What the project delivers (e.g., 1 building constructed).
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiBulletListInput
            v-model="form.output_indicators_list"
            add-label="Add Output Indicator"
            color="info"
            :placeholder="(i: number) => `Output ${i + 1}`"
            :read-only="readOnly"
            empty-state-text="No output indicators listed."
          />
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card elevation="2" rounded="lg" class="h-100">
        <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
          <v-icon size="small" color="purple">mdi-target-account</v-icon>
          <span class="text-subtitle-1 font-weight-medium">Outcome Indicators</span>
          <v-chip size="x-small" variant="tonal" color="purple">
            {{ (form.outcome_indicators_list || []).filter((s: string) => s.trim()).length }}
          </v-chip>
        </v-card-title>
        <v-card-subtitle class="pt-2 pb-1 text-caption text-grey-darken-1">
          Long-term impact (e.g., 500 students served).
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="py-3">
          <CiBulletListInput
            v-model="form.outcome_indicators_list"
            add-label="Add Outcome Indicator"
            color="purple"
            :placeholder="(i: number) => `Outcome ${i + 1}`"
            :read-only="readOnly"
            empty-state-text="No outcome indicators listed."
          />
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
/*
 * Required-field marker. The asterisk previously lived inside the `label` string,
 * so it inherited Vuetify's muted label colour (~38% opacity) and was effectively
 * invisible. Rendering it through the #label slot lets it carry its own colour.
 * !important is needed because Vuetify sets the label colour on the wrapping
 * .v-label at a higher specificity than a plain scoped class.
 */
:deep(.required-star) {
  color: rgb(var(--v-theme-error)) !important;
  font-weight: 700;
  opacity: 1 !important;
  margin-left: 1px;
}
</style>
