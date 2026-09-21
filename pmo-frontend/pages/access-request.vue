<script setup lang="ts">
// PHASE BBBD (Track 5, BBBD-5c): standalone "Request Access" page reached from the User Menu.
// Replaces the dashboard panel (Task F) — keeps the dashboard analytics-first.
import {
  ACCESS_REQUEST_MODULE_OPTIONS,
  ACCESS_LEVEL_OPTIONS,
  labelForAccessModule,
  type AccessRequest,
} from '~/utils/accessControl'
import {SELF_SERVICE_LEVEL_OPTIONS} from "../utils/accessControl";

definePageMeta({ middleware: ['auth'] })

const api = useApi()
const toast = useToast()
// PHASE BBBE (Track 2): view is universal — a "request" is for CONTRIBUTE access (Contributor+),
// so offer modules where the user lacks a contribute level and has no pending request.
const { moduleLevels } = usePermissions()

const myRequests = ref<AccessRequest[]>([])
const submitting = ref(false)
const form = ref({ requested_module: '', requested_level: 'Contributor', justification: '' })

const levelOptions = SELF_SERVICE_LEVEL_OPTIONS
const pendingModules = computed(
  () => new Set(myRequests.value.filter(r => r.status === 'PENDING').map(r => r.requested_module)),
)
const requestableModules = computed(() =>
  ACCESS_REQUEST_MODULE_OPTIONS.filter(m => {
    const level = moduleLevels.value[m.value]
    const hasContribute = !!level && level !== 'Viewer'
    return !hasContribute && !pendingModules.value.has(m.value)
  }),
)

async function loadMine() {
  try {
    myRequests.value = await api.get<AccessRequest[]>('/api/access-requests/mine')
  } catch { /* non-fatal */ }
}

async function submit() {
  if (!form.value.requested_module) return
  submitting.value = true
  try {
    await api.post('/api/access-requests', { ...form.value })
    toast.success('Request submitted — pending administrator approval.')
    form.value = { requested_module: '', requested_level: 'Viewer', justification: '' }
    await loadMine()
  } catch (e: any) {
    toast.error(e?.data?.message || e?.message || 'Could not submit request.')
  } finally {
    submitting.value = false
  }
}

function statusColor(s: string): string {
  return s === 'APPROVED' ? 'success' : s === 'DENIED' ? 'error' : s === 'CANCELLED' ? 'blue-grey' : 'warning'
}

// PHASE BBBG (Track 2): let users withdraw their own pending request.
const cancelling = ref<string | null>(null)
async function cancelRequest(r: AccessRequest) {
  cancelling.value = r.id
  try {
    await api.patch(`/api/access-requests/${r.id}/cancel`, {})
    toast.success('Request cancelled.')
    await loadMine()
  } catch (e: any) {
    toast.error(e?.data?.message || e?.message || 'Could not cancel the request.')
  } finally {
    cancelling.value = null
  }
}

onMounted(loadMine)
</script>

<template>
  <v-container class="py-6" style="max-width: 720px">
    <div class="d-flex align-center ga-2 mb-4">
      <v-icon color="primary">mdi-lock-open-outline</v-icon>
      <h1 class="text-h6 font-weight-bold mb-0">Request Module Access</h1>
    </div>

    <v-card elevation="1" rounded="lg" class="mb-4">
      <v-card-text>
        <template v-if="requestableModules.length">
          <v-select v-model="form.requested_module" :items="requestableModules" item-title="title"
                    item-value="value" label="Module" variant="outlined" density="compact" />
          <v-select v-model="form.requested_level" :items="levelOptions" item-title="title" item-value="value"
                    label="Responsibility" variant="outlined" density="compact"
                    :hint="levelOptions.find(l => l.value === form.requested_level)?.hint" persistent-hint />
          <v-textarea v-model="form.justification" label="Reason (optional)" variant="outlined" density="compact"
                      rows="2" class="mt-3" counter="1000" maxlength="1000" />
          <p class="text-caption text-medium-emphasis mt-2">
            Your create/edit ability follows the access level an administrator grants.
          </p>
          <div class="d-flex justify-end">
            <v-btn color="primary" variant="flat" :loading="submitting"
                   :disabled="!form.requested_module" @click="submit">Submit Request</v-btn>
          </div>
        </template>
        <v-alert v-else type="info" variant="tonal" density="compact">
          You already have access to all available modules, or your requests are pending review.
        </v-alert>
      </v-card-text>
    </v-card>

    <template v-if="myRequests.length">
      <div class="text-caption text-medium-emphasis mb-2">Your requests</div>
      <v-card elevation="1" rounded="lg">
        <v-list density="compact">
          <v-list-item v-for="r in myRequests" :key="r.id">
            <v-list-item-title>{{ labelForAccessModule(r.requested_module) }} · {{ r.requested_level }}</v-list-item-title>
            <template #append>
              <div class="d-flex align-center ga-2">
                <v-chip size="small" :color="statusColor(r.status)" variant="tonal">{{ r.status }}</v-chip>
                <v-btn v-if="r.status === 'PENDING'" size="x-small" variant="text" color="blue-grey"
                       :loading="cancelling === r.id" @click="cancelRequest(r)">Cancel</v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </template>
  </v-container>
</template>
