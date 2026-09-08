<script setup lang="ts">
import { formatDateTime as formatDate, formatDate as formatDateSimple } from '~/utils/userFormat'
import { rankLabel } from '~/utils/userVocab'
import { labelForCampus } from '~/utils/campus'
import { labelForAccessModule } from '~/utils/accessControl'
import type { BackendUserDetail } from '~/utils/adapters'

definePageMeta({
  middleware: ['auth', 'permission'],
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
// 'users' module-level scope: a Viewer-level grant is read-only — Reset Password,
// Manage Access, and Edit Profile are writes and need Contributor+ (see usePermissions.ts).
const { canEdit } = usePermissions()
const canManageUsers = computed(() => canEdit('users'))

const user = ref<BackendUserDetail | null>(null)
const loading = ref(true)
const unlocking = ref(false)
const resetPasswordDialog = ref(false)
const newPassword = ref('')
const newPasswordConfirm = ref('')
const showPassword = ref(false)
const resettingPassword = ref(false)

const passwordsMatch = computed(() =>
  !newPasswordConfirm.value || newPassword.value === newPasswordConfirm.value
)

const userId = route.params.id as string

if (!userId) {
  console.error('[User Detail] No user ID in route, redirecting to list')
  router.push('/users')
}

// Computed properties
const fullName = computed(() => {
  if (!user.value) return ''
  return `${user.value.first_name} ${user.value.last_name}`
})

const isAccountLocked = computed(() => {
  if (!user.value?.account_locked_until) return false
  return new Date(user.value.account_locked_until) > new Date()
})

const isSuperAdmin = computed(() => {
  // PHASE BBBD (Track 1c): flag OR rank 10 (unified with auth, R-321).
  return (
    (user.value?.roles?.some(r => r.is_superadmin) || false) ||
    user.value?.rank_level === 10
  )
})

// formatDate / formatDateSimple imported from utils/userFormat (single source).

// PHASE BBCH (Track 2, R-373): effective module grants from approved access requests
// (user_permission_overrides), surfaced as module + CRUD-level chips. Revoked (can_access=false)
// entries are excluded — only live access is shown.
const moduleGrants = computed(() => {
  const levels = user.value?.module_levels || {}
  const overrides = user.value?.module_overrides || {}
  return Object.keys(overrides)
    .filter(key => overrides[key])
    .map(key => ({ module: key, level: levels[key] || 'Viewer' }))
})

function levelColor(level: string): string {
  const map: Record<string, string> = {
    Manager: 'deep-purple',
    Approver: 'indigo',
    Contributor: 'teal',
    Viewer: 'blue-grey',
  }
  return map[level] || 'grey'
}

// Fetch user details
async function fetchUser() {
  if (!userId) {
    toast.error('Invalid user ID')
    loading.value = false
    return
  }

  try {
    loading.value = true
    console.log('[User Detail] Fetching user:', userId)
    const response = await api.get<BackendUserDetail>(`/api/users/${userId}`)
    user.value = response
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to load user details')
    console.error('[User Detail] Failed to fetch user:', err)
  } finally {
    loading.value = false
  }
}

// Navigation
function goBack() {
  router.push('/users')
}

function editUser() {
  if (!canManageUsers.value) {
    toast.error('You do not have permission to edit this user')
    return
  }
  router.push(`/users/edit-${userId}`)
}

// Unlock account
async function unlockAccount() {
  if (!userId) return
  if (!canManageUsers.value) {
    toast.error('You do not have permission to unlock this account')
    return
  }

  unlocking.value = true
  try {
    await api.post(`/api/users/${userId}/unlock`, {})
    toast.success('Account unlocked successfully')
    await fetchUser() // Refresh data
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to unlock account')
    console.error('[User Detail] Failed to unlock account:', err)
  } finally {
    unlocking.value = false
  }
}

// Reset password
async function resetPassword() {
  if (!canManageUsers.value) {
    toast.error('You do not have permission to reset this password')
    return
  }
  if (!newPassword.value) {
    toast.error('Please enter a new password')
    return
  }

  if (newPassword.value.length < 8) {
    toast.error('Password must be at least 8 characters')
    return
  }

  if (newPassword.value !== newPasswordConfirm.value) {
    toast.error('Passwords do not match')
    return
  }

  resettingPassword.value = true
  try {
    await api.post(`/api/users/${userId}/reset-password`, { password: newPassword.value })
    toast.success('Password reset successfully')
    resetPasswordDialog.value = false
    newPassword.value = ''
    newPasswordConfirm.value = ''
    await fetchUser() // Refresh data
  } catch (err: unknown) {
    const apiError = err as { message?: string }
    toast.error(apiError.message || 'Failed to reset password')
    console.error('[User Detail] Failed to reset password:', err)
  } finally {
    resettingPassword.value = false
  }
}

onMounted(() => {
  console.log('[User Detail] Mounted with ID:', userId)
  fetchUser()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="d-flex align-center ga-3">
        <v-btn icon="mdi-arrow-left" variant="text" @click="goBack" />
        <div>
          <h1 class="text-h5 font-weight-bold text-grey-darken-3">
            {{ fullName || 'User Details' }}
          </h1>
          <p class="text-subtitle-2 text-grey-darken-1">
            View user information and permissions
          </p>
        </div>
      </div>
      <div class="d-flex ga-2">
        <v-btn
          v-if="isAccountLocked && canManageUsers"
          color="warning"
          prepend-icon="mdi-lock-open"
          @click="unlockAccount"
          :loading="unlocking"
        >
          Unlock Account
        </v-btn>
        <v-btn
          v-if="canManageUsers"
          color="primary"
          prepend-icon="mdi-key"
          @click="resetPasswordDialog = true"
        >
          Reset Password
        </v-btn>
        <v-btn
          v-if="canManageUsers"
          color="primary"
          variant="outlined"
          prepend-icon="mdi-shield-account"
          @click="router.push(`/users/access-${userId}`)"
        >
          Manage Access
        </v-btn>
        <v-btn
          v-if="canManageUsers"
          color="primary"
          prepend-icon="mdi-pencil"
          @click="editUser"
        >
          Edit Profile
        </v-btn>
      </div>
    </div>

    <!-- Loading State -->
    <v-card v-if="loading" class="pa-6">
      <v-skeleton-loader type="article, actions" />
    </v-card>

    <!-- User Details (Phase HR-4: 2-column grid layout, Directive 189) -->
    <div v-else-if="user">
      <!-- Row 1: Basic Info + Roles & Permissions -->
      <v-row class="mb-4">
        <v-col cols="12" md="7">
          <v-card rounded="lg" elevation="1" class="fill-height">
            <v-card-title class="d-flex align-center justify-space-between">
              <span>Basic Information</span>
              <v-chip
                :color="user.is_active ? 'success' : 'error'"
                variant="tonal"
              >
                {{ user.is_active ? 'Active' : 'Inactive' }}
              </v-chip>
            </v-card-title>
            <v-divider />
            <v-card-text>
              <div class="d-flex align-center mb-6">
                <v-avatar size="80" color="primary" class="mr-4">
                  <v-img v-if="user.avatar_url" :src="user.avatar_url" />
                  <span v-else class="text-h4 text-white">
                    {{ user.first_name[0] }}{{ user.last_name[0] }}
                  </span>
                </v-avatar>
                <div>
                  <h2 class="text-h5 font-weight-bold">{{ fullName }}</h2>
                  <p class="text-body-1 text-grey-darken-1">{{ user.email }}</p>
                  <v-chip v-if="isSuperAdmin" size="small" color="purple" variant="tonal" class="mt-1">
                    SuperAdmin
                  </v-chip>
                </div>
              </div>

              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Email</div>
                    <div class="text-body-1">{{ user.email }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Phone</div>
                    <div class="text-body-1">{{ user.phone || '-' }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">First Name</div>
                    <div class="text-body-1">{{ user.first_name }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Last Name</div>
                    <div class="text-body-1">{{ user.last_name }}</div>
                  </div>
                </v-col>
              </v-row>

              <!-- PHASE BBBF (Track 5): Professional Information section -->
              <v-divider class="mb-4" />
              <div class="d-flex align-center ga-2 mb-3">
                <v-icon size="18" color="grey-darken-2">mdi-briefcase-outline</v-icon>
                <span class="text-caption text-grey-darken-2 font-weight-bold text-uppercase">Professional Information</span>
              </div>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Username</div>
                    <div class="text-body-1">{{ user.username || '—' }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Rank</div>
                    <div class="text-body-1">{{ rankLabel(user.rank_level) }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Position</div>
                    <div class="text-body-1" style="white-space: pre-wrap">{{ user.metadata?.position || '—' }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Office</div>
                    <div class="text-body-1" style="white-space: pre-wrap">{{ user.metadata?.office || '—' }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Campus</div>
                    <div class="text-body-1">{{ labelForCampus(user.campus) }}</div>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card rounded="lg" elevation="1" class="fill-height">
            <v-card-title>Role Assignments &amp; Module Access</v-card-title>
            <v-divider />
            <v-card-text>
              <div class="mb-4">
                <div class="text-caption text-grey-darken-1 mb-2">Assigned Roles</div>
                <div v-if="user.roles && user.roles.length > 0" class="d-flex flex-wrap ga-2">
                  <v-chip
                    v-for="role in user.roles"
                    :key="role.id"
                    color="blue"
                    variant="tonal"
                  >
                    {{ role.name }}
                    <v-tooltip activator="parent" location="bottom">
                      Assigned: {{ formatDateSimple(role.assigned_at) }}
                    </v-tooltip>
                  </v-chip>
                </div>
                <div v-else class="text-grey">No roles assigned</div>
              </div>

              <!-- PHASE BBCH (Track 2): effective module-level grants from approved access requests -->
              <div class="mb-4">
                <div class="text-caption text-grey-darken-1 mb-2">Module Access Grants</div>
                <div v-if="moduleGrants.length > 0" class="d-flex flex-wrap ga-2">
                  <v-chip
                    v-for="grant in moduleGrants"
                    :key="grant.module"
                    :color="levelColor(grant.level)"
                    variant="tonal"
                    size="small"
                  >
                    {{ labelForAccessModule(grant.module) }}
                    <span class="font-weight-bold ml-1">· {{ grant.level }}</span>
                  </v-chip>
                </div>
                <div v-else class="text-grey">No module grants</div>
              </div>

              <div>
                <div class="text-caption text-grey-darken-1 mb-2">Permissions (via Roles)</div>
                <v-chip-group v-if="user.permissions && user.permissions.length > 0" column>
                  <v-chip
                    v-for="permission in user.permissions"
                    :key="permission.id"
                    size="small"
                    variant="outlined"
                  >
                    {{ permission.resource }}: {{ permission.action }}
                  </v-chip>
                </v-chip-group>
                <div v-else class="text-grey">No permissions</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Row 2: Account Status + Audit Information -->
      <v-row>
        <v-col cols="12" md="7">
          <v-card rounded="lg" elevation="1" class="fill-height">
            <v-card-title>Account Status</v-card-title>
            <v-divider />
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Last Login</div>
                    <div class="text-body-1">{{ formatDate(user.last_login_at) }}</div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Failed Login Attempts</div>
                    <div class="text-body-1">
                      <v-chip
                        :color="user.failed_login_attempts >= 5 ? 'error' : 'success'"
                        size="small"
                        variant="tonal"
                      >
                        {{ user.failed_login_attempts }}
                      </v-chip>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Account Locked Until</div>
                    <div class="text-body-1">
                      <v-chip
                        v-if="isAccountLocked"
                        color="error"
                        size="small"
                        variant="tonal"
                      >
                        {{ formatDate(user.account_locked_until) }}
                      </v-chip>
                      <span v-else class="text-grey">Not locked</span>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1">Account Status</div>
                    <div class="text-body-1">
                      <v-chip
                        :color="user.is_active ? 'success' : 'error'"
                        size="small"
                        variant="tonal"
                      >
                        {{ user.is_active ? 'Active' : 'Inactive' }}
                      </v-chip>
                    </div>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card rounded="lg" elevation="1" class="fill-height">
            <v-card-title>Audit Information</v-card-title>
            <v-divider />
            <v-card-text>
              <div class="mb-4">
                <div class="text-caption text-grey-darken-1">Created At</div>
                <div class="text-body-1">{{ formatDate(user.created_at) }}</div>
              </div>
              <div class="mb-4">
                <div class="text-caption text-grey-darken-1">Last Updated</div>
                <div class="text-body-1">{{ formatDate(user.updated_at) }}</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Reset Password Dialog -->
    <v-dialog v-model="resetPasswordDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">Reset Password</v-card-title>
        <v-card-text>
          <p class="mb-4">Enter a new password for <strong>{{ fullName }}</strong></p>
          <v-text-field
            v-model="newPassword"
            label="New Password"
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            variant="outlined"
            density="compact"
            :rules="[v => v.length >= 8 || 'Minimum 8 characters']"
            class="mb-2"
          />
          <v-text-field
            v-model="newPasswordConfirm"
            label="Confirm Password"
            :type="showPassword ? 'text' : 'password'"
            :error="!passwordsMatch"
            :error-messages="!passwordsMatch ? 'Passwords do not match' : ''"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="resetPasswordDialog = false; newPassword = ''; newPasswordConfirm = ''"
            :disabled="resettingPassword"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            @click="resetPassword"
            :loading="resettingPassword"
            :disabled="!newPassword || newPassword.length < 8 || !passwordsMatch || resettingPassword"
          >
            Reset Password
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
