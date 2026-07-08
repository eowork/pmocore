<script setup lang="ts">
import { useDisplay } from 'vuetify'

const router = useRouter()
const authStore = useAuthStore()
const api = useApi()
const { canAccessAdmin, canManageUsers, canAccessModule, currentRole, isSuperAdmin, isContractor, canApprove } = usePermissions()

// PHASE BBCH (Track 1, R-372): approval authority via Layer 1 (admin) OR Layer 3 (Approver/Manager
// module level) in any reviewable module — drives Pending Reviews nav visibility.
const canReviewAny = computed(
  () =>
    canAccessAdmin.value ||
    canApprove('coi') ||
    canApprove('repairs') ||
    canApprove('university_operations'),
)

// Responsive drawer - closed on mobile, open on desktop
const { mdAndUp } = useDisplay()
const drawer = ref(mdAndUp.value)

// Dropdown expand states - persist in localStorage
const referenceDataOpen = ref(false)
// PHASE BBBB (BBBB-1a): User Management multi-level group expand state.
const userMgmtOpen = ref(false)
// T-NAV: Expandable module group states for UO and COI.
const uoOpen = ref(false)
const coiOpen = ref(false)
// T-HOME-CMS-3 (TH3-6): Public Website group (Homepage Management + reserved
// future children) — same expand/persist pattern as the groups above.
const publicWebsiteOpen = ref(false)
// PHASE BBBB (BBBB-2a): pending access-request count for the nav badge (admins only).
const pendingAccessCount = ref(0)

// Initialize states from localStorage
onMounted(() => {
  if (import.meta.client) {
    // Drawer state: use saved preference if exists, otherwise use screen size default
    const savedDrawer = localStorage.getItem('sidebar_drawer')
    if (savedDrawer !== null) {
      drawer.value = savedDrawer === 'true'
    }
    // Dropdown states
    referenceDataOpen.value = localStorage.getItem('sidebar_referenceData') === 'true'
    userMgmtOpen.value = localStorage.getItem('sidebar_userMgmt') === 'true'
    uoOpen.value = localStorage.getItem('sidebar_uo') === 'true'
    coiOpen.value = localStorage.getItem('sidebar_coi') === 'true'
    publicWebsiteOpen.value = localStorage.getItem('sidebar_publicWebsite') === 'true'
  }
  // PHASE BBBB (BBBB-2a): load the pending access-request count for the badge.
  loadPendingAccessCount()
})

// PHASE BBBB (BBBB-2a): poll-light pending access-request count (admins only).
async function loadPendingAccessCount() {
  if (!canAccessAdmin.value) return
  try {
    const res = await api.get<{ count: number }>('/api/access-requests/pending-count')
    pendingAccessCount.value = res?.count ?? 0
  } catch {
    // non-fatal — leave at 0
  }
}

// Watch and persist drawer state
watch(drawer, (val) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar_drawer', String(val))
  }
})

// Watch and persist expand states
watch(referenceDataOpen, (val) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar_referenceData', String(val))
  }
})
watch(userMgmtOpen, (val) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar_userMgmt', String(val))
  }
})
watch(uoOpen, (val) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar_uo', String(val))
  }
})
watch(coiOpen, (val) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar_coi', String(val))
  }
})
watch(publicWebsiteOpen, (val) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar_publicWebsite', String(val))
  }
})

// Main operational modules - filtered by user permissions
const mainModules = computed(() => {
  // MMM-C: workflow-ordered — Dashboard → Repair → GAD
  // T-NAV: UO and COI are now expandable groups rendered separately in the template.
  const allModules = [
    { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/dashboard', key: 'dashboard' },
    { title: 'Repair Projects', icon: 'mdi-tools', to: '/repairs', key: 'repairs' },
    { title: 'GAD Parity', icon: 'mdi-gender-male-female', to: '/gad', key: 'gad' },
  ]

  return allModules.filter(m => {
    // Dashboard always visible
    if (m.key === 'dashboard') return true
    // QA-B: GAD uses canAccessModule (contractors excluded via CONTRACTOR_ALLOWED_MODULES)
    if (m.key === 'gad') return canAccessModule('gad')
    // Check module access
    return canAccessModule(m.key)
  })
})

// Reference data management - filtered by user permissions
const referenceData = computed(() => {
  const allReferenceData = [
    { title: 'Contractors', icon: 'mdi-account-hard-hat', to: '/contractors', key: 'contractors' },
    { title: 'Funding Sources', icon: 'mdi-cash-multiple', to: '/funding-sources', key: 'funding_sources' },
  ]

  return allReferenceData.filter(m => canAccessModule(m.key))
})

// Check if any reference data modules are accessible
const hasReferenceDataAccess = computed(() => referenceData.value.length > 0)

// PHASE BBBB (BBBB-1a, Option 2): Administration → "User Management" multi-level group.
// Children: Users, Access Requests (badged), Identity Review, Password Resets.
interface NavChild { title: string; icon: string; to: string; badge?: number }
const userManagementItems = computed<NavChild[]>(() => {
  if (!canManageUsers.value) return []
  return [
    { title: 'Users', icon: 'mdi-account-group', to: '/users' },
    { title: 'Access Requests', icon: 'mdi-account-key-outline', to: '/admin/access-requests', badge: pendingAccessCount.value || undefined },
    { title: 'Password Resets', icon: 'mdi-lock-reset', to: '/admin/password-resets' },
    { title: 'Identity Review', icon: 'mdi-account-multiple-check-outline', to: '/admin/identity-review' },
  ]
})
const hasUserManagementAccess = computed(() => userManagementItems.value.length > 0)

// Administration — operational items (daily workflows), outside the User Management group.
const operationsItems = computed(() => {
  const items: Array<{ title: string; icon: string; to: string }> = []
  // PHASE BBCH (Track 1): Pending Reviews is visible to anyone with approval authority (module
  // level Approver/Manager included), not just system admins. Activity Logs stays admin-only.
  if (canReviewAny.value) {
    items.push({ title: 'Pending Reviews', icon: 'mdi-clipboard-check-outline', to: '/admin/pending-reviews' })
  }
  if (canAccessAdmin.value) {
    items.push({ title: 'Activity Logs', icon: 'mdi-history', to: '/coi/activity-logs' })
  }
  // T-HOME-CMS-3 (TH3-6): Homepage Management moved into its own "Public
  // Website" v-list-group (below) — no longer a flat operationsItems entry.
  return items
})
const hasPublicWebsiteAccess = computed(() => canAccessModule('homepage'))
const hasOperationsAccess = computed(() => operationsItems.value.length > 0)

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div>
    <!-- App Bar -->
    <v-app-bar color="primary" elevation="2">
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <v-toolbar-title class="font-weight-bold">
        CSU CORE Dashboard
      </v-toolbar-title>

      <v-spacer />

      <!-- User Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text">
            <!-- NNN-F: avatar image when present, else initials fallback -->
            <v-avatar color="secondary" size="32" class="mr-2">
              <v-img
                v-if="authStore.userAvatarUrl"
                :src="authStore.userAvatarUrl"
                alt="Profile"
                cover
              />
              <span v-else class="text-caption font-weight-bold text-primary">
                {{ authStore.userFullName?.charAt(0) || 'U' }}
              </span>
            </v-avatar>
            <span class="d-none d-sm-inline">{{ authStore.userFullName }}</span>
            <v-icon end>mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item prepend-icon="mdi-account" :title="authStore.userEmail">
            <template #subtitle>
              <v-chip
                size="x-small"
                :color="isSuperAdmin ? 'purple' : 'primary'"
                variant="tonal"
                class="mt-1"
              >
                {{ currentRole }}
              </v-chip>
            </template>
          </v-list-item>
          <v-divider />
          <!-- T-HOME-CMS-11 (TH11-1): Home relocated from the app bar into
           the user menu — cleaner navbar, conventional placement. Every
           authenticated user (all roles) can reach both Dashboard and Home,
           since the public homepage is accessible while logged in (TH10-1). -->
          <v-list-item
            prepend-icon="mdi-view-dashboard-outline"
            title="Dashboard"
            to="/dashboard"
          />
          <v-list-item
            prepend-icon="mdi-home-outline"
            title="Home"
            to="/"
          />
          <v-divider />
          <!-- MMM-E: account navigation (hidden for contractors) -->
          <template v-if="!isContractor">
            <v-list-item
              prepend-icon="mdi-account-circle"
              title="My Profile"
              to="/profile"
            />
            <!-- PHASE BBBD (Track 5/Task F): Request Access relocated here from the dashboard. -->
            <v-list-item
              prepend-icon="mdi-lock-open-outline"
              title="Request Access"
              to="/access-request"
            />
            <v-list-item
              prepend-icon="mdi-cog-outline"
              title="Account Settings"
              to="/profile?tab=settings"
            />
            <v-list-item
              prepend-icon="mdi-lock-reset"
              title="Change Password"
              to="/profile?tab=security"
            />
            <v-divider />
          </template>
          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            base-color="error"
            @click="handleLogout"
          />
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" elevation="1">
      <!-- Logo Header - Horizontal Layout
           NNN-A: logo restored to 44×44 (branding proportions preserved per Section C1);
           horizontal gap kept at me-1 (~50% reduction from original me-2). -->
      <div class="d-flex align-center px-2 py-2">
        <v-img
          src="/csu-logo.svg"
          alt="CSU Logo"
          width="44"
          height="44"
          class="flex-shrink-0 me-1"
        />
        <span class="font-weight-bold text-darken-2 sidebar-header-text">
          Caraga State University
        </span>
      </div>

      <v-divider />

      <!-- Main Modules -->
      <v-list nav density="comfortable">
        <v-list-subheader>MODULES</v-list-subheader>

        <!-- T-HOME-CMS-6 (TH6-1): required order — Dashboard, University
             Operations, Infrastructure Projects, Repair Projects, GAD Parity.
             Dashboard renders alone first; Repair/GAD render after the two
             expandable groups from the same (unchanged) mainModules array.
             Template-order-only; mainModules/guards/routes untouched. -->
        <v-list-item
          v-for="item in mainModules.filter(m => m.key === 'dashboard')"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          color="primary"
          rounded="lg"
          class="mb-1 ga-1"
        />

        <!-- T-NAV: University Operations — expandable group (same v-list-group pattern as User Management) -->
        <v-list-group v-if="canAccessModule('university_operations')" v-model="uoOpen" value="universityOps">
          <template #activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-school" title="University Operations" color="primary" rounded="lg" class="mb-1" />
          </template>
          <v-list-item
            to="/university-operations"
            prepend-icon="mdi-chart-bar"
            title="BAR"
            color="primary"
            rounded="lg"
            class="mb-1 nav-child-item"
          />
          <v-list-item
            prepend-icon="mdi-file-chart-outline"
            color="primary"
            rounded="lg"
            class="mb-1 nav-child-item"
            disabled
          >
            <template #title>
              BED
              <v-chip size="x-small" variant="tonal" color="grey" class="ml-2">Soon</v-chip>
            </template>
          </v-list-item>
          <v-list-item
            prepend-icon="mdi-file-document-outline"
            color="primary"
            rounded="lg"
            class="mb-1 nav-child-item"
            disabled
          >
            <template #title>
              FAR
              <v-chip size="x-small" variant="tonal" color="grey" class="ml-2">Soon</v-chip>
            </template>
          </v-list-item>
        </v-list-group>

        <!-- T-NAV: Infrastructure Projects (COI) — expandable group (same v-list-group pattern as User Management) -->
        <v-list-group v-if="canAccessModule('coi')" v-model="coiOpen" value="infraProjects">
          <template #activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-office-building" title="Infrastructure Projects" color="primary" rounded="lg" class="mb-1" />
          </template>
          <v-list-item
            to="/coi"
            prepend-icon="mdi-office-building-outline"
            title="Infrastructure Projects"
            color="primary"
            rounded="lg"
            class="mb-1 nav-child-item"
          />
          <v-list-item
            prepend-icon="mdi-file-send-outline"
            color="primary"
            rounded="lg"
            class="mb-1 nav-child-item"
            disabled
          >
            <template #title>
              Project Proposals
              <v-chip size="x-small" variant="tonal" color="grey" class="ml-2">Soon</v-chip>
            </template>
          </v-list-item>
          <v-list-item
            prepend-icon="mdi-layers-outline"
            color="primary"
            rounded="lg"
            class="mb-1 nav-child-item"
            disabled
          >
            <template #title>
              Tranche Management
              <v-chip size="x-small" variant="tonal" color="grey" class="ml-2">Soon</v-chip>
            </template>
          </v-list-item>
        </v-list-group>

        <!-- T-HOME-CMS-6 (TH6-1): Repair Projects + GAD Parity after the
             expandable groups. T-HOME-CMS-5 (TH5-2) "Soon" chip retained —
             dev-status indicator only; pages stay fully accessible. -->
        <v-list-item
          v-for="item in mainModules.filter(m => m.key !== 'dashboard')"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          color="primary"
          rounded="lg"
          class="mb-1 ga-1"
        >
          <template #title>
            {{ item.title }}
            <v-chip
              v-if="item.key === 'repairs' || item.key === 'gad'"
              size="x-small"
              variant="tonal"
              color="grey"
              class="ml-2"
            >
              Soon
            </v-chip>
          </template>
        </v-list-item>
      </v-list>

      <!-- PHASE BBBC (Task A): three labelled administration sections. -->

      <!-- A. Operations & Monitoring (Admin + SuperAdmin) -->
      <template v-if="hasOperationsAccess || hasPublicWebsiteAccess">
        <v-divider class="my-2" />
        <v-list nav density="comfortable">
          <v-list-subheader>OPERATIONS &amp; MONITORING</v-list-subheader>
          <v-list-item
            v-for="item in operationsItems"
            :key="item.to"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            color="primary"
            rounded="lg"
            class="mb-1"
          />

          <!-- T-HOME-CMS-3 (TH3-6): Public Website group — Homepage is real;
               remaining children are reserved placeholders (same disabled +
               "Soon"-chip pattern as University Operations/Infrastructure
               Projects above) so future public-site pages need no nav
               restructuring later. -->
          <v-list-group v-if="hasPublicWebsiteAccess" v-model="publicWebsiteOpen" value="publicWebsite">
            <template #activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-web" title="Public Website" color="primary" rounded="lg" class="mb-1" />
            </template>
            <v-list-item
              to="/admin/homepage-management"
              prepend-icon="mdi-home-outline"
              title="Homepage"
              color="primary"
              rounded="lg"
              class="mb-1 nav-child-item"
            />
            <v-list-item
              v-for="future in ['Announcements', 'Carousel', 'Quick Links', 'Contact Information', 'Footer', 'Themes', 'Future Public Pages']"
              :key="future"
              prepend-icon="mdi-file-outline"
              color="primary"
              rounded="lg"
              class="mb-1 nav-child-item"
              disabled
            >
              <template #title>
                {{ future }}
                <v-chip size="x-small" variant="tonal" color="grey" class="ml-2">Soon</v-chip>
              </template>
            </v-list-item>
          </v-list-group>
        </v-list>
      </template>

      <!-- B. System Administration (SuperAdmin, or Admin with explicit Users access) -->
      <template v-if="hasUserManagementAccess">
        <v-divider class="my-2" />
        <v-list nav density="comfortable">
          <v-list-subheader>SYSTEM ADMINISTRATION</v-list-subheader>
          <v-list-group v-model="userMgmtOpen" value="userMgmt">
            <template #activator="{ props }">
              <v-list-item
                v-bind="props"
                prepend-icon="mdi-account-cog"
                title="User Management"
                color="primary"
              />
            </template>
            <v-list-item
              v-for="item in userManagementItems"
              :key="item.to"
              :to="item.to"
              :prepend-icon="item.icon"
              color="primary"
              rounded="lg"
              class="mb-1"
            >
              <template #title>
                <span class="d-inline-flex align-center ga-2">
                  {{ item.title }}
                  <v-chip v-if="item.badge" size="x-small" color="error" variant="flat">{{ item.badge }}</v-chip>
                </span>
              </template>
            </v-list-item>
          </v-list-group>
        </v-list>
      </template>

      <!-- C. References (reference-data management) -->
      <template v-if="hasReferenceDataAccess">
        <v-divider class="my-2" />
        <v-list nav density="comfortable">
          <v-list-subheader>REFERENCES</v-list-subheader>
          <v-list-group v-model="referenceDataOpen" value="referenceData">
            <template #activator="{ props }">
              <v-list-item
                v-bind="props"
                prepend-icon="mdi-database"
                title="Reference Data"
                color="primary"
              />
            </template>
            <v-list-item
              v-for="item in referenceData"
              :key="item.to"
              :to="item.to"
              :prepend-icon="item.icon"
              :title="item.title"
              color="primary"
              rounded="lg"
              class="mb-1"
            />
          </v-list-group>
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- Main Content — NNN-B: subtle grey background so white cards visibly float -->
    <v-main class="bg-grey-lighten-5">
      <v-container fluid class="pa-4">
        <slot />
      </v-container>
    </v-main>
  </div>
</template>

<style>
/* GLOBAL TYPOGRAPHY REDUCTION - Reduce font size by 1.5px */
/* Per research.md Section 1.3: Root font-size adjustment */
html {
  font-size: 14.5px !important;
}
</style>

<style scoped>
/* SIDEBAR HEADER - Ensure text doesn't wrap */
.sidebar-header-text {
  font-size: 0.85rem;
  line-height: 1.2;
}

/* SIDEBAR DROPDOWN NORMALIZATION - No indentation for child items */
/* Override Vuetify's default indent size to 0 for flush alignment */
:deep(.v-list-group__items) {
  --indent-padding: 0px !important;
}

/* SIDEBAR ICON GRID ALIGNMENT - Match parent and child icon positions */
/* Per research.md Section 1.2: All icons share same X-axis */
:deep(.v-list-group__items .v-list-item) {
  padding-inline-start: 16px !important;
  margin-inline-start: 0 !important;
}

/* Ensure icon containers have consistent width */
:deep(.v-navigation-drawer .v-list-item__prepend) {
  width: 24px;
  min-width: 24px;
}

/* SIDEBAR LAYOUT STABILITY - Prioritize stable layout over wrapping */
/* Per research.md Section 1.3: Use nowrap to prevent layout cascade */
:deep(.v-navigation-drawer .v-list-item-title) {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.3;
}

/* T-NAV: Child nav items — flush indent matching v-list-group__items override above */
.nav-child-item {
  padding-inline-start: 16px !important;
  margin-inline-start: 0 !important;
}
</style>
