<script setup lang="ts">
// Phase HR-5: Dedicated Access Control page (Directive 184)
definePageMeta({
  middleware: ['auth', 'permission'],
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()

const userId = route.params.id as string

if (!userId) {
  router.push('/users')
}

const loading = ref(true)
const userDisplayName = ref('')

// Tab state
const activeTab = ref('modules')

// Permission overrides
interface PermissionOverride {
  id: string
  user_id: string
  module_key: string
  can_access: boolean
}

const permissionOverrides = ref<PermissionOverride[]>([])
const permissionsLoading = ref(false)

// Module assignments
interface ModuleAssignment {
  id: string
  user_id: string
  module: string
  assigned_by: string | null
  assigned_at: string
}

const moduleAssignments = ref<ModuleAssignment[]>([])
const modulesLoading = ref(false)
const selectedModules = ref<string[]>([])

// Available module types for assignment
const moduleTypes = [
  { value: 'CONSTRUCTION', label: 'Infrastructure (COI)', description: 'Access to Infrastructure Projects' },
  { value: 'REPAIR', label: 'Repair Projects', description: 'Access to Repair and Maintenance Projects' },
  { value: 'OPERATIONS', label: 'University Operations', description: 'Access to University Operations/DBM metrics' },
  { value: 'ALL', label: 'All Modules', description: 'Full access to all project modules' },
]

// Confirmation dialog for destructive actions
const revokeConfirmDialog = ref(false)

// Module definitions with display names
const modules = [
  { key: 'coi', name: 'Infrastructure Projects (COI)', description: 'Manage infrastructure project records' },
  { key: 'repairs', name: 'Repair Projects', description: 'Manage repair and maintenance project records' },
  { key: 'contractors', name: 'Contractors', description: 'Manage contractor reference data' },
  { key: 'funding_sources', name: 'Funding Sources', description: 'Manage funding source reference data' },
  { key: 'university_operations', name: 'University Operations', description: 'Manage university operations and DBM metrics' },
  // Phase HU: Sub-module access control for Physical vs Financial (Directives 212–215)
  { key: 'university-operations-physical', name: 'Univ Ops — Physical (BAR No. 1)', description: 'Access to Physical Accomplishment page', parentKey: 'university_operations' },
  { key: 'university-operations-financial', name: 'Univ Ops — Financial (BAR No. 2)', description: 'Access to Financial Accomplishment page', parentKey: 'university_operations' },
  { key: 'users', name: 'User Management', description: 'Manage user accounts and permissions (Admin only)' },
]

// Fetch user name for display
async function fetchUserName() {
  try {
    loading.value = true
    const response = await api.get<{ first_name: string; last_name: string }>(`/api/users/${userId}`)
    userDisplayName.value = `${response.first_name} ${response.last_name}`
  } catch {
    userDisplayName.value = 'User'
  } finally {
    loading.value = false
  }
}

// Fetch permission overrides
async function fetchPermissions() {
  if (!userId) return
  try {
    permissionsLoading.value = true
    const response = await api.get<PermissionOverride[]>(`/api/users/${userId}/permissions`)
    permissionOverrides.value = response
  } catch {
    // Don't show error toast - permissions may not exist yet
  } finally {
    permissionsLoading.value = false
  }
}

// Fetch module assignments
async function fetchModuleAssignments() {
  if (!userId) return
  try {
    modulesLoading.value = true
    const response = await api.get<ModuleAssignment[]>(`/api/users/${userId}/modules`)
    moduleAssignments.value = response
    selectedModules.value = response.map(a => a.module)
  } catch {
    // Don't show error toast - assignments may not exist yet
  } finally {
    modulesLoading.value = false
  }
}

// Handle module assignment change
async function handleModuleChange(module: string, checked: boolean) {
  try {
    if (checked) {
      await api.post(`/api/users/${userId}/modules`, { module })
      toast.success(`${module} module assigned`)
    } else {
      await api.del(`/api/users/${userId}/modules/${module}`)
      toast.success(`${module} module removed`)
    }
    await fetchModuleAssignments()
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to update module assignment')
    await fetchModuleAssignments()
  }
}

// Check if module is assigned
function isModuleAssigned(module: string): boolean {
  if (selectedModules.value.includes('ALL') && module !== 'ALL') return true
  return selectedModules.value.includes(module)
}

// Check if individual module checkbox should be disabled (when ALL is selected)
function isModuleDisabled(module: string): boolean {
  return module !== 'ALL' && selectedModules.value.includes('ALL')
}

// Check if module has override
function hasOverride(moduleKey: string): boolean {
  return permissionOverrides.value.some(p => p.module_key === moduleKey)
}

// Get override access value
function getOverrideAccess(moduleKey: string): boolean | null {
  const override = permissionOverrides.value.find(p => p.module_key === moduleKey)
  return override ? override.can_access : null
}

// Check if module is checked.
// Backend ModuleAccessGuard is default-DENY (PHASE BBBA): with no row in
// user_permission_overrides the user has no module access. The checkbox must
// mirror that, otherwise an ungranted module renders checked and the admin's
// first click emits `false` — revoking instead of granting.
function isModuleChecked(moduleKey: string): boolean {
  return getOverrideAccess(moduleKey) === true
}

// Phase HV: Pillar tab requires parent UO access AND at least one sub-module accessible (Directive 219)
const showPillarTab = computed(() => {
  if (getOverrideAccess('university_operations') === false) return false
  const physRevoked = getOverrideAccess('university-operations-physical') === false
  const finRevoked = getOverrideAccess('university-operations-financial') === false
  return !(physRevoked && finRevoked)
})

watch(showPillarTab, (visible) => {
  if (!visible && activeTab.value === 'pillars') {
    activeTab.value = 'modules'
  }
})

// Handle checkbox change for a module
async function handlePermissionChange(moduleKey: string, checked: boolean) {
  try {
    if (checked) {
      // Granting always writes can_access=true. It must NOT delete the override:
      // under default-deny a missing row means no access, so deleting a revoke
      // row revokes rather than grants.
      if (moduleKey === 'university_operations') {
        // Inverse of the Directive 221 cascade below — without this, a parent
        // revoked earlier can never be restored: the sub-module deny rows survive
        // and University Operations stays inaccessible.
        await api.post(`/api/users/${userId}/permissions/bulk`, {
          updates: [
            { module_key: 'university_operations', can_access: true },
            { module_key: 'university-operations-physical', can_access: true },
            { module_key: 'university-operations-financial', can_access: true },
          ]
        })
        toast.success('University Operations and sub-modules granted')
      } else {
        await api.post(`/api/users/${userId}/permissions`, { module_key: moduleKey, can_access: true })
        toast.success('Access granted')
      }
    } else {
      // Phase HV: Directive 221 — cascade revoke to sub-modules when revoking parent UO
      if (moduleKey === 'university_operations') {
        await api.post(`/api/users/${userId}/permissions/bulk`, {
          updates: [
            { module_key: 'university_operations', can_access: false },
            { module_key: 'university-operations-physical', can_access: false },
            { module_key: 'university-operations-financial', can_access: false },
          ]
        })
        toast.success('University Operations and sub-modules revoked')
      } else {
        await api.post(`/api/users/${userId}/permissions`, { module_key: moduleKey, can_access: false })
        toast.success('Access revoked')
      }
    }
    await fetchPermissions()
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to update permission')
  }
}

// Bulk grant all modules
async function grantAllModules() {
  try {
    const updates = modules.map(m => ({ module_key: m.key, can_access: true }))
    await api.post(`/api/users/${userId}/permissions/bulk`, { updates })
    toast.success('All modules granted')
    await fetchPermissions()
  } catch (err: unknown) {
    const apiError = err as { message?: string; status?: number }
    toast.error(apiError.status === 429 ? 'Too many requests. Please wait and try again.' : (apiError.message || 'Failed to grant all modules'))
  }
}

// Show confirmation dialog for bulk revoke
function confirmRevokeAll() {
  revokeConfirmDialog.value = true
}

// Bulk revoke all modules
async function revokeAllModules() {
  revokeConfirmDialog.value = false
  try {
    const updates = modules.map(m => ({ module_key: m.key, can_access: false }))
    await api.post(`/api/users/${userId}/permissions/bulk`, { updates })
    toast.success('All modules revoked')
    await fetchPermissions()
  } catch (err: unknown) {
    const apiError = err as { message?: string; status?: number }
    toast.error(apiError.status === 429 ? 'Too many requests. Please wait and try again.' : (apiError.message || 'Failed to revoke all modules'))
  }
}

// Reset all overrides
async function resetAllOverrides() {
  try {
    const modulesWithOverrides = modules.filter(m => hasOverride(m.key))
    if (modulesWithOverrides.length === 0) {
      toast.info('No overrides to reset')
      return
    }
    const updates = modulesWithOverrides.map(m => ({ module_key: m.key, can_access: null }))
    await api.post(`/api/users/${userId}/permissions/bulk`, { updates })
    toast.success('All overrides cleared — modules are no longer granted')
    await fetchPermissions()
  } catch (err: unknown) {
    const apiError = err as { message?: string; status?: number }
    toast.error(apiError.status === 429 ? 'Too many requests. Please wait and try again.' : (apiError.message || 'Failed to reset overrides'))
  }
}

// Get permission state label.
// No override is not "role default" — the backend denies module access without an
// explicit grant, so label it for what it is.
function getPermissionLabel(moduleKey: string): string {
  const access = getOverrideAccess(moduleKey)
  if (access === null) return 'Not Granted'
  return access ? 'Granted' : 'Revoked'
}

// Get permission state color
function getPermissionColor(moduleKey: string): string {
  const access = getOverrideAccess(moduleKey)
  if (access === null) return 'grey'
  return access ? 'success' : 'error'
}

// --- Pillar Assignments (Phase HN, Directive 160) ---

const PILLAR_OPTIONS = [
  { value: 'HIGHER_EDUCATION', label: 'Higher Education Program' },
  { value: 'ADVANCED_EDUCATION', label: 'Advanced Education Program' },
  { value: 'RESEARCH', label: 'Research Program' },
  { value: 'TECHNICAL_ADVISORY', label: 'Technical Advisory Extension Program' },
]

const selectedPillars = ref<string[]>([])
const pillarsLoading = ref(false)

async function fetchPillarAssignments() {
  if (!userId) return
  pillarsLoading.value = true
  try {
    selectedPillars.value = await api.get<string[]>(`/api/users/${userId}/pillar-assignments`)
  } catch { /* ignore — no assignments yet */ } finally {
    pillarsLoading.value = false
  }
}

// In array mode (v-model bound to selectedPillars with :value), Vuetify emits the new
// selection array — or null when the selection is cleared. Both must be accepted.
async function handlePillarToggle(pillarType: string, checked: string[] | boolean | null) {
  const isChecked = Array.isArray(checked) ? checked.includes(pillarType) : !!checked
  const pillarLabel = PILLAR_OPTIONS.find(p => p.value === pillarType)?.label || pillarType
  try {
    if (isChecked) {
      await api.post(`/api/users/${userId}/pillar-assignments`, { pillar_type: pillarType })
      toast.success(`${pillarLabel} access granted`)
    } else {
      await api.del(`/api/users/${userId}/pillar-assignments/${pillarType}`)
      toast.success(`${pillarLabel} access revoked`)
    }
  } catch (err: any) {
    toast.error(err.message || 'Failed to update pillar access')
    await fetchPillarAssignments()
  }
}

// Navigation
function goBack() {
  router.back()
}

function goToEditProfile() {
  router.push(`/users/edit-${userId}`)
}

onMounted(async () => {
  await Promise.all([fetchUserName(), fetchPermissions(), fetchModuleAssignments(), fetchPillarAssignments()])
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <h1 class="text-h4 font-weight-bold text-grey-darken-3">
            Manage Access — {{ userDisplayName }}
          </h1>
          <p class="text-subtitle-1 text-grey-darken-1">
            Module, page, and pillar permissions
          </p>
        </div>
      </div>
      <v-btn color="primary" variant="outlined" prepend-icon="mdi-pencil" @click="goToEditProfile">
        Edit Profile
      </v-btn>
    </div>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article, actions" />
    </v-card>

    <!-- Tabs Card -->
    <v-card v-else>
      <v-tabs v-model="activeTab" color="primary">
        <v-tab value="modules">Module Scope</v-tab>
        <v-tab value="permissions">Page Access</v-tab>
        <v-tab v-if="showPillarTab" value="pillars">Pillar Access</v-tab>
      </v-tabs>

      <v-divider />

      <v-window v-model="activeTab">
        <!-- Module Scope Tab -->
        <v-window-item value="modules">
          <v-card-text class="pa-6">
            <v-alert type="info" variant="tonal" density="compact" icon="mdi-view-module" class="mb-4">
              <div class="text-subtitle-2 mb-1">Admin Responsibility Scope</div>
              <div class="text-caption">
                Assign which project modules this Admin user is responsible for managing.
                This controls which pending reviews they can see and approve. Only applicable to Admin role users.
                Selecting "All Modules" grants management responsibility for all project types.
              </div>
            </v-alert>

            <div v-if="modulesLoading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>

            <v-list v-else density="comfortable">
              <v-list-item
                v-for="moduleType in moduleTypes"
                :key="moduleType.value"
                :disabled="isModuleDisabled(moduleType.value)"
              >
                <template #prepend>
                  <v-checkbox
                    :model-value="isModuleAssigned(moduleType.value)"
                    @update:model-value="(val: boolean | null) => handleModuleChange(moduleType.value, !!val)"
                    hide-details
                    density="compact"
                    color="primary"
                    :disabled="isModuleDisabled(moduleType.value)"
                  />
                </template>
                <v-list-item-title class="font-weight-medium">
                  {{ moduleType.label }}
                  <v-chip
                    v-if="moduleType.value === 'ALL'"
                    size="x-small"
                    color="purple"
                    variant="tonal"
                    class="ml-2"
                  >
                    Full Access
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>{{ moduleType.description }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-divider class="my-4" />
            <div class="text-caption text-grey">
              <strong>Current Assignments:</strong>
              <span v-if="selectedModules.length === 0" class="ml-2">None assigned</span>
              <v-chip
                v-for="mod in selectedModules"
                :key="mod"
                size="small"
                color="primary"
                variant="tonal"
                class="ml-2"
              >
                {{ mod }}
              </v-chip>
            </div>

            <v-alert
              v-if="selectedModules.includes('ALL')"
              type="success"
              variant="tonal"
              density="compact"
              icon="mdi-check-circle"
              class="mt-4"
            >
              User has <strong>full access</strong> to all project modules.
            </v-alert>
          </v-card-text>
        </v-window-item>

        <!-- Page Access Tab -->
        <v-window-item value="permissions">
          <v-card-text class="pa-6">
            <v-alert type="info" variant="tonal" density="compact" icon="mdi-shield-account" class="mb-4">
              <div class="text-subtitle-2 mb-1">Page Access Overrides</div>
              <div class="text-caption">
                Grant or restrict access to specific modules. This controls which routes the
                user can access. Access is <strong>denied by default</strong> — a module is
                only accessible once explicitly granted.
                Checked = granted; unchecked = not granted (either never granted, or explicitly revoked).
              </div>
            </v-alert>

            <div class="d-flex justify-space-between align-center mb-4">
              <div class="text-subtitle-2 text-grey-darken-2">Module Permissions</div>
              <div class="d-flex ga-2">
                <v-btn size="small" variant="outlined" color="success" prepend-icon="mdi-check-all" @click="grantAllModules" :disabled="permissionsLoading">
                  Grant All
                </v-btn>
                <v-btn size="small" variant="outlined" color="error" prepend-icon="mdi-close-circle-outline" @click="confirmRevokeAll" :disabled="permissionsLoading">
                  Revoke All
                </v-btn>
                <v-btn size="small" variant="outlined" prepend-icon="mdi-refresh" @click="resetAllOverrides" :disabled="permissionsLoading">
                  Reset to Defaults
                </v-btn>
              </div>
            </div>

            <div v-if="permissionsLoading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>

            <v-table v-else density="comfortable">
              <thead>
                <tr>
                  <th class="text-left" style="width: 60px">Access</th>
                  <th class="text-left">Module</th>
                  <th class="text-left">Description</th>
                  <th class="text-left" style="width: 120px">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="mod in modules" :key="mod.key">
                  <td>
                    <v-checkbox
                      :model-value="isModuleChecked(mod.key)"
                      @update:model-value="(val: boolean | null) => handlePermissionChange(mod.key, !!val)"
                      hide-details
                      density="compact"
                      color="primary"
                    />
                  </td>
                  <!-- Phase HV: Directive 220 — Indent sub-module rows -->
                  <td class="font-weight-medium" :class="mod.parentKey ? 'pl-8 text-grey-darken-2' : ''">
                    <span v-if="mod.parentKey" class="text-caption mr-1 text-grey">↳</span>{{ mod.name }}
                  </td>
                  <td class="text-grey-darken-1">{{ mod.description }}</td>
                  <td>
                    <v-chip :color="getPermissionColor(mod.key)" size="small" variant="tonal">
                      {{ getPermissionLabel(mod.key) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <v-divider class="my-4" />
            <div class="text-caption text-grey">
              <strong>Status Legend:</strong>
              <v-chip size="x-small" color="grey" variant="tonal" class="ml-2">Not Granted</v-chip>
              <span class="ml-1">= No override — access denied by default</span>
              <v-chip size="x-small" color="success" variant="tonal" class="ml-3">Granted</v-chip>
              <span class="ml-1">= Explicit access override</span>
              <v-chip size="x-small" color="error" variant="tonal" class="ml-3">Revoked</v-chip>
              <span class="ml-1">= Explicit deny override</span>
            </div>
          </v-card-text>
        </v-window-item>

        <!-- Pillar Access Tab (Phase HN) -->
        <v-window-item v-if="showPillarTab" value="pillars">
          <v-card flat>
            <v-card-title class="text-subtitle-1">Pillar Access Control</v-card-title>
            <v-card-subtitle class="text-caption mb-2">
              Restrict which BAR No. 1/2 pillar tabs this user can access.
              Leave all unchecked to grant access to all pillars (no restriction).
            </v-card-subtitle>
            <v-card-text>
              <!-- Phase HV: Directive 222 — Warn when sub-module access is partially revoked -->
              <v-alert
                v-if="getOverrideAccess('university-operations-physical') === false || getOverrideAccess('university-operations-financial') === false"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3 text-caption"
              >
                Note: Pillar access only applies to accessible sub-modules.
                <span v-if="getOverrideAccess('university-operations-physical') === false">Physical is revoked. </span>
                <span v-if="getOverrideAccess('university-operations-financial') === false">Financial is revoked.</span>
              </v-alert>
              <div v-if="pillarsLoading" class="d-flex justify-center pa-4">
                <v-progress-circular indeterminate />
              </div>
              <div v-else>
                <v-checkbox
                  v-for="pillar in PILLAR_OPTIONS"
                  :key="pillar.value"
                  v-model="selectedPillars"
                  :value="pillar.value"
                  :label="pillar.label"
                  density="compact"
                  hide-details
                  color="primary"
                  @update:model-value="handlePillarToggle(pillar.value, $event)"
                />
                <v-alert type="info" variant="tonal" density="compact" class="mt-3 text-caption">
                  Admins and SuperAdmins always see all pillars regardless of this setting.
                </v-alert>
              </div>
            </v-card-text>
          </v-card>
        </v-window-item>
      </v-window>
    </v-card>

    <!-- Revoke All Confirmation Dialog -->
    <v-dialog v-model="revokeConfirmDialog" max-width="450" persistent>
      <v-card>
        <v-card-title class="text-h6 text-error">
          <v-icon start color="error">mdi-alert-circle</v-icon>
          Confirm Revoke All Permissions
        </v-card-title>
        <v-card-text>
          <p class="mb-2">
            Are you sure you want to <strong>revoke all module access</strong> for this user?
          </p>
          <p class="text-body-2 text-grey-darken-1">
            This will deny access to all modules. The user will only be able to view the Dashboard.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="revokeConfirmDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="revokeAllModules">
            Revoke All
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
