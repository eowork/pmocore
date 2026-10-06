<script setup lang="ts">
// PHASE BBBD (Track 5, BBBD-5b): first-login onboarding wizard. Forced by middleware/auth.ts when
// the authenticated user's profile is incomplete. Collects identity confirmation + professional
// info, lets them request module access (business-friendly), then shows an approval timeline.
import { CAMPUS_OPTIONS } from '~/utils/campus'
import { ACCESS_REQUEST_MODULE_OPTIONS, SELF_SERVICE_LEVEL_OPTIONS, labelForAccessModule, type AccessRequest } from '~/utils/accessControl'

definePageMeta({ middleware: ['auth'] })

const api = useApi()
const toast = useToast()
const authStore = useAuthStore()

const STEPS = ['Identity', 'Professional Info', 'Request Access', 'Submit', 'Status']
const step = ref(0)
const submitting = ref(false)
const myRequests = ref<AccessRequest[]>([])

const form = ref({
  position: '',
  office: '',
  campus: (authStore.user as any)?.campus || '',
  justification: '',
})

// PHASE BBBF (Track 3 / Task A): multi-module selection + a single requested ROLE per module.
// Self-service requests are capped at Viewer/Contributor — Approver/Manager is granted
// manually by a SuperAdmin per-user (users/access-[id].vue), never requested directly.
const roleOptions = SELF_SERVICE_LEVEL_OPTIONS
const moduleOptions = ACCESS_REQUEST_MODULE_OPTIONS
const moduleSelections = ref<Record<string, { checked: boolean; role: string }>>(
  Object.fromEntries(moduleOptions.map(m => [m.value, { checked: false, role: 'Viewer' }])),
)
const selectedModules = computed(() => moduleOptions.filter(m => moduleSelections.value[m.value]?.checked))

const fullName = computed(() => authStore.userFullName)
const email = computed(() => authStore.userEmail)

// Step 2 is the only required gate (professional info).
const canProceedProfessional = computed(() => !!form.value.position && !!form.value.campus)

function next() {
  if (step.value < STEPS.length - 1) step.value++
}
function back() {
  if (step.value > 0) step.value--
}

async function submit() {
  submitting.value = true
  try {
    // Complete the profile.
    await api.patch('/api/auth/me', {
      position: form.value.position || undefined,
      office: form.value.office || undefined,
      campus: form.value.campus || undefined,
      profile_completed: true,
    })
    // One access request per selected module, using the chosen role.
    for (const m of selectedModules.value) {
      await api.post('/api/access-requests', {
        requested_module: m.value,
        requested_level: moduleSelections.value[m.value].role,
        justification: form.value.justification || undefined,
      })
    }
    // Refresh the session so the onboarding gate releases.
    await authStore.fetchCurrentUser()
    await loadMyRequests()
    toast.success('Onboarding complete.')
    step.value = 4 // Status
  } catch (e: any) {
    toast.error(e?.data?.message || e?.message || 'Could not complete onboarding.')
  } finally {
    submitting.value = false
  }
}

async function loadMyRequests() {
  try {
    myRequests.value = await api.get<AccessRequest[]>('/api/access-requests/mine')
  } catch {
    // non-fatal
  }
}

function finish() {
  navigateTo('/dashboard')
}

function statusColor(s: string): string {
  return s === 'APPROVED' ? 'success' : s === 'DENIED' ? 'error' : 'warning'
}
</script>

<template>
  <v-container class="py-6" style="max-width: 720px">
    <div class="text-center mb-4">
      <v-icon color="primary" size="40">mdi-account-arrow-right-outline</v-icon>
      <h1 class="text-h5 font-weight-bold mt-2">Welcome — let's set up your account</h1>
      <p class="text-body-2 text-medium-emphasis">A few quick steps before you get started.</p>
    </div>

    <!-- Step header -->
    <div class="d-flex align-center justify-center ga-2 mb-4 flex-wrap">
      <template v-for="(s, i) in STEPS" :key="s">
        <v-chip :color="i === step ? 'primary' : i < step ? 'success' : 'grey-lighten-1'"
                :variant="i <= step ? 'flat' : 'tonal'" size="small">
          {{ i + 1 }}. {{ s }}
        </v-chip>
      </template>
    </div>

    <v-card elevation="1" rounded="lg">
      <v-window v-model="step">
        <!-- Step 1 — Identity -->
        <v-window-item :value="0">
          <v-card-text>
            <div class="text-subtitle-1 font-weight-bold mb-3">Confirm your identity</div>
            <v-text-field :model-value="fullName" label="Full name" variant="outlined" density="compact" readonly />
            <v-text-field :model-value="email" label="Email" variant="outlined" density="compact" readonly />
            <p class="text-caption text-medium-emphasis">These come from your institutional account and can't be changed here.</p>
          </v-card-text>
        </v-window-item>

        <!-- Step 2 — Professional -->
        <v-window-item :value="1">
          <v-card-text>
            <div class="text-subtitle-1 font-weight-bold mb-3">Professional information</div>
            <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
              Please spell out your complete titles. Some positions and offices are project-based and
              may be lengthy — avoid abbreviations where possible.
            </v-alert>
            <v-textarea v-model="form.position" label="Position"
                        placeholder="e.g., Project Development Officer III — Infrastructure Monitoring Unit"
                        hint="Please spell out your complete position title. Avoid abbreviations where possible."
                        persistent-hint auto-grow rows="2" counter="300" maxlength="300"
                        variant="outlined" density="compact" :rules="[(v: string) => !!v || 'Required']" />
            <v-textarea v-model="form.office" label="Office / Unit / Department"
                        placeholder="e.g., Planning, Development and Physical Infrastructure Office"
                        hint="Please provide your complete office, unit, or department name."
                        persistent-hint auto-grow rows="2" counter="300" maxlength="300"
                        variant="outlined" density="compact" class="mt-3" />
            <v-select v-model="form.campus" :items="CAMPUS_OPTIONS" item-title="title" item-value="value"
                      label="Campus" variant="outlined" density="compact" class="mt-3"
                      :rules="[(v: string) => !!v || 'Required']" />
          </v-card-text>
        </v-window-item>

        <!-- Step 3 — Request Access (multi-module + a single requested role each) -->
        <v-window-item :value="2">
          <v-card-text>
            <div class="text-subtitle-1 font-weight-bold mb-1">Request access (optional)</div>
            <p class="text-caption text-medium-emphasis mb-3">
              The CSU Core Dashboard is already available to you. Select any additional modules you need
              and the role you're requesting — an administrator will determine your final permissions.
            </p>
            <v-row dense>
              <v-col v-for="m in moduleOptions" :key="m.value" cols="12" sm="6">
                <v-card variant="outlined" rounded="lg" class="pa-3 h-100">
                  <v-checkbox
                    v-model="moduleSelections[m.value].checked"
                    :label="m.title"
                    density="compact"
                    hide-details
                    color="primary"
                  />
                  <v-expand-transition>
                    <div v-if="moduleSelections[m.value].checked" class="ms-2 mt-2">
                      <v-select
                        v-model="moduleSelections[m.value].role"
                        :items="roleOptions"
                        item-title="title"
                        item-value="value"
                        label="Requested role"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :hint="roleOptions.find(r => r.value === moduleSelections[m.value].role)?.hint"
                      />
                    </div>
                  </v-expand-transition>
                </v-card>
              </v-col>
            </v-row>
            <v-textarea v-model="form.justification" label="Reason (optional)" variant="outlined"
                        density="compact" rows="2" class="mt-3" :disabled="selectedModules.length === 0" />
          </v-card-text>
        </v-window-item>

        <!-- Step 4 — Submit -->
        <v-window-item :value="3">
          <v-card-text>
            <div class="text-subtitle-1 font-weight-bold mb-3">Review &amp; submit</div>
            <v-list density="compact" class="bg-transparent">
              <v-list-item title="Position" :subtitle="form.position || '—'" />
              <v-list-item title="Office" :subtitle="form.office || '—'" />
              <v-list-item title="Campus" :subtitle="CAMPUS_OPTIONS.find(c => c.value === form.campus)?.title || '—'" />
            </v-list>
            <div v-if="selectedModules.length" class="mt-2">
              <div class="text-caption text-medium-emphasis mb-1">Requested access</div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip v-for="m in selectedModules" :key="m.value" size="small" variant="tonal" color="primary">
                  {{ m.title }} · {{ moduleSelections[m.value].role }}
                </v-chip>
              </div>
            </div>
            <p v-else class="text-caption text-medium-emphasis mt-2">No additional access requested (dashboard only).</p>
          </v-card-text>
        </v-window-item>

        <!-- Step 5 — Status -->
        <v-window-item :value="4">
          <v-card-text>
            <div class="text-subtitle-1 font-weight-bold mb-3">You're all set</div>
            <v-alert type="success" variant="tonal" density="compact" class="mb-3">
              Your profile is complete. You now have dashboard access.
            </v-alert>
            <template v-if="myRequests.length">
              <div class="text-caption text-medium-emphasis mb-2">Access request status</div>
              <v-timeline density="compact" side="end" truncate-line="both">
                <v-timeline-item v-for="r in myRequests" :key="r.id" :dot-color="statusColor(r.status)" size="small">
                  <div class="text-body-2 font-weight-medium">{{ labelForAccessModule(r.requested_module) }} · {{ r.requested_level }}</div>
                  <div class="text-caption" :class="`text-${statusColor(r.status)}`">{{ r.status }}</div>
                </v-timeline-item>
              </v-timeline>
            </template>
          </v-card-text>
        </v-window-item>
      </v-window>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-btn v-if="step > 0 && step < 4" variant="text" @click="back">Back</v-btn>
        <v-spacer />
        <v-btn v-if="step === 0" color="primary" variant="flat" @click="next">Continue</v-btn>
        <v-btn v-else-if="step === 1" color="primary" variant="flat" :disabled="!canProceedProfessional" @click="next">Continue</v-btn>
        <v-btn v-else-if="step === 2" color="primary" variant="flat" @click="next">Continue</v-btn>
        <v-btn v-else-if="step === 3" color="primary" variant="flat" :loading="submitting" @click="submit">Submit</v-btn>
        <v-btn v-else color="primary" variant="flat" @click="finish">Go to Dashboard</v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
