<script setup lang="ts">
/**
 * PA/PV (2026-05-22): Unified Personnel & Access Control card.
 * Left panel: institutional user search + assignment + 3-section permission matrix.
 * Right panel: external personnel (YA–YD refactor — unified pipeline, invite system removed).
 * PV-E: batch add dialog (YC: dual-mode for institutional / external).
 * PV-F: 3-section permission UI (Section A: Actions, Section B: Tab Access, Section C: Access Level preset).
 */
import { PERSONNEL_GROUPS, PERSONNEL_CATEGORY_OPTIONS, COI_PROJECT_TABS, type FullPermissions } from '~/utils/coiFormState'

const props = withDefaults(defineProps<{
  projectId: string
  readOnly?: boolean
  assignedUsers?: Array<{
    id: string
    name: string
    email?: string | null
    role?: string | null
    department?: string | null
    phone?: string | null
    personnelCategory?: string | null
    personnel_category?: string | null
    projectRole?: string | null
    permissions?: Record<string, any> | null
  }>
}>(), { readOnly: false, assignedUsers: () => [] })

const emit = defineEmits<{ (e: 'assignments-updated'): void }>()

const api = useApi()
const toast = useToast ? useToast() : { success: console.log, error: console.error }
const { isAdmin } = usePermissions()

// ── Interfaces ──────────────────────────────────────────────────────────────
// FullPermissions now lives in ~/utils/coiFormState (single source of truth).
interface DraftUser {
  id: string; name: string; email?: string | null
  role?: string | null; department?: string | null; phone?: string | null
  personnelCategory?: string | null; projectRole?: string | null
  permissions: FullPermissions; _permOpen: boolean
}

// Institutional default: grant common tabs, deny privileged
const DEFAULT_PERMS = (): FullPermissions => ({
  canCreate: false, canEdit: false, canDelete: false,
  canUpload: false, canReview: false, canApprove: false,
  tabProjectProfile: true, tabDatesDuration: true,
  tabProgressReport: true, tabPersonnel: false,
  tabAttachments: true, tabOthers: false,
  accessLevel: 'Viewer',
})

// YA-B: External personnel default to deny-all (VA-A enforcement for new assignments)
const DEFAULT_EXTERNAL_PERMS = (): FullPermissions => ({
  canCreate: false, canEdit: false, canDelete: false,
  canUpload: false, canReview: false, canApprove: false,
  tabProjectProfile: false, tabDatesDuration: false,
  tabProgressReport: false, tabPersonnel: false,
  tabAttachments: false, tabOthers: false,
  accessLevel: 'Viewer',
})

const ACCESS_PRESETS: Record<string, Partial<FullPermissions>> = {
  Viewer:      { canCreate: false, canEdit: false, canDelete: false, canUpload: false, canReview: false, canApprove: false,
                 tabProjectProfile: true, tabDatesDuration: true, tabProgressReport: true,
                 tabPersonnel: false, tabAttachments: true, tabOthers: false },
  Contributor: { canCreate: true,  canEdit: true,  canDelete: false, canUpload: true,  canReview: false, canApprove: false,
                 tabProjectProfile: true, tabDatesDuration: true, tabProgressReport: true,
                 tabPersonnel: false, tabAttachments: true, tabOthers: false },
  Editor:      { canCreate: true,  canEdit: true,  canDelete: true,  canUpload: true,  canReview: true,  canApprove: false,
                 tabProjectProfile: true, tabDatesDuration: true, tabProgressReport: true,
                 tabPersonnel: false, tabAttachments: true, tabOthers: true },
  Manager:     { canCreate: true,  canEdit: true,  canDelete: true,  canUpload: true,  canReview: true,  canApprove: true,
                 tabProjectProfile: true, tabDatesDuration: true, tabProgressReport: true,
                 tabPersonnel: true,  tabAttachments: true, tabOthers: true },
  Admin:       { canCreate: true,  canEdit: true,  canDelete: true,  canUpload: true,  canReview: true,  canApprove: true,
                 tabProjectProfile: true, tabDatesDuration: true, tabProgressReport: true,
                 tabPersonnel: true,  tabAttachments: true, tabOthers: true },
}

// YA-A: External personnel category set — single source for isExternalUser + add panel options
const EXTERNAL_CATEGORIES = new Set([
  'CONTRACTOR', 'CONSTRUCTOR', 'SUPPLIER',
  'CONSULTANT', 'EXTERNAL_AUDITOR', 'EXTERNAL_PARTNER',
])

const EXTERNAL_CATEGORY_OPTIONS = [
  { title: 'Contractor',                    value: 'CONTRACTOR' },
  { title: 'Constructor',                   value: 'CONSTRUCTOR' },
  { title: 'Supplier',                      value: 'SUPPLIER' },
  { title: 'Consultant',                    value: 'CONSULTANT' },
  { title: 'External Auditor',              value: 'EXTERNAL_AUDITOR' },
  { title: 'External Implementing Partner', value: 'EXTERNAL_PARTNER' },
]

function applyPreset(user: DraftUser, level: string) {
  const preset = ACCESS_PRESETS[level]
  if (!preset) return
  Object.assign(user.permissions, preset, { accessLevel: level as FullPermissions['accessLevel'] })
}

function actionLabel(key: string): string {
  const m: Record<string, string> = { canCreate: 'Create', canEdit: 'Edit', canDelete: 'Delete', canUpload: 'Upload', canReview: 'Review', canApprove: 'Approve' }
  return m[key] || key
}

// ── Staff search (shared by both panels) ────────────────────────────────────
const staffUsers = ref<{ id: string; first_name: string; last_name: string; email?: string; campus?: string }[]>([])
const staffLoading = ref(false)

async function loadStaff() {
  if (staffLoading.value || staffUsers.value.length > 0) return
  staffLoading.value = true
  try {
    const res = await api.get<{ id: string; first_name: string; last_name: string; email?: string; campus?: string }[]>(
      '/api/users/eligible-for-assignment'
    )
    staffUsers.value = Array.isArray(res) ? res : []
  } catch { /* silent */ } finally {
    staffLoading.value = false
  }
}

// ── Local draft ─────────────────────────────────────────────────────────────
const draft = ref<DraftUser[]>([])

watch(() => props.assignedUsers, (users) => {
  draft.value = (users || []).map(u => {
    const p = u.permissions || {}
    const legacyTimeline = (p as any).tabTimeline
    // VA-A: External personnel default to deny-by-default. When permissions JSONB is
    // null (old record), the admin must explicitly grant tab access.
    // YA-D: expanded isExternal check uses full EXTERNAL_CATEGORIES set.
    const isExternal = EXTERNAL_CATEGORIES.has((u as any).personnel_category ?? '')
      || EXTERNAL_CATEGORIES.has((u as any).personnelCategory ?? '')
      || (u as any).user_role === 'Contractor'
    const defaultTab = isExternal ? false : true
    return {
      id: u.id, name: u.name, email: u.email,
      role: u.role, department: u.department, phone: u.phone,
      personnelCategory: u.personnelCategory ?? u.personnel_category ?? null,
      projectRole: u.projectRole ?? null,
      permissions: {
        canCreate: p.canCreate ?? false, canEdit: p.canEdit ?? false, canDelete: p.canDelete ?? false,
        canUpload: p.canUpload ?? false, canReview: p.canReview ?? false, canApprove: p.canApprove ?? false,
        // RB-E: new keys with legacy migration. VA-A: defaultTab is role-aware.
        tabProjectProfile: p.tabProjectProfile ?? defaultTab,
        tabDatesDuration:  p.tabDatesDuration  ?? legacyTimeline ?? defaultTab,
        tabProgressReport: p.tabProgressReport ?? defaultTab,
        tabPersonnel:      p.tabPersonnel      ?? p.canAccessPersonnel ?? false,
        tabAttachments:    p.tabAttachments    ?? p.tabDocuments       ?? defaultTab,
        tabOthers:         p.tabOthers         ?? p.canAccessOthers    ?? false,
        accessLevel: p.accessLevel ?? 'Viewer',
      },
      _permOpen: false,
    }
  })
}, { immediate: true })

// ── Single-add (institutional) ───────────────────────────────────────────────
const addUserId = ref<string | null>(null)
const addCategory = ref('IMPLEMENTING')
const addProjectRole = ref('')

function commitAdd() {
  if (!addUserId.value) return
  if (draft.value.some(d => d.id === addUserId.value)) { toast.error('User already assigned'); return }
  const staff = staffUsers.value.find(s => s.id === addUserId.value)
  if (!staff) return
  draft.value.push({
    id: staff.id, name: `${staff.first_name} ${staff.last_name}`, email: staff.email,
    role: null, department: staff.campus ?? null, phone: null,
    personnelCategory: addCategory.value, projectRole: addProjectRole.value || null,
    permissions: DEFAULT_PERMS(), _permOpen: false,
  })
  addUserId.value = null; addProjectRole.value = ''; addCategory.value = 'IMPLEMENTING'
}

function removeUser(user: DraftUser) { draft.value.splice(draft.value.indexOf(user), 1) }

// YA-E: isExternalUser uses EXTERNAL_CATEGORIES set (covers all 6 external types)
function isExternalUser(u: DraftUser): boolean {
  return EXTERNAL_CATEGORIES.has(u.personnelCategory ?? '')
    || (u as any).userRole === 'Contractor'
}

const institutionalDraft = computed(() => draft.value.filter(u => !isExternalUser(u)))
const externalDraft       = computed(() => draft.value.filter(u => isExternalUser(u)))

// ── Single-add (external) ────────────────────────────────────────────────────
// YA-C: mirrors institutional flow; uses DEFAULT_EXTERNAL_PERMS (deny-all)
const addExternalUserId = ref<string | null>(null)
const addExternalCategory = ref('CONTRACTOR')
const addExternalProjectRole = ref('')

function commitAddExternal() {
  if (!addExternalUserId.value) return
  if (draft.value.some(d => d.id === addExternalUserId.value)) { toast.error('User already assigned'); return }
  const staff = staffUsers.value.find(s => s.id === addExternalUserId.value)
  if (!staff) return
  draft.value.push({
    id: staff.id, name: `${staff.first_name} ${staff.last_name}`, email: staff.email,
    role: null, department: staff.campus ?? null, phone: null,
    personnelCategory: addExternalCategory.value, projectRole: addExternalProjectRole.value || null,
    permissions: DEFAULT_EXTERNAL_PERMS(), _permOpen: false,
  })
  addExternalUserId.value = null; addExternalProjectRole.value = ''; addExternalCategory.value = 'CONTRACTOR'
}

// ── Batch add ────────────────────────────────────────────────────────────────
const batchDialog = ref(false)
const batchSelected = ref<string[]>([])
const batchCategory = ref('IMPLEMENTING')
const batchProjectRole = ref('')
const batchSearch = ref('')
// YA-F: batch mode determines category options and default permissions
const batchMode = ref<'institutional' | 'external'>('institutional')

const filteredBatchStaff = computed(() =>
  staffUsers.value.filter(u =>
    !draft.value.some(d => d.id === u.id) &&
    (!batchSearch.value ||
      `${u.first_name} ${u.last_name} ${u.email || ''}`
        .toLowerCase().includes(batchSearch.value.toLowerCase()))
  )
)

function toggleBatchSelect(id: string) {
  const idx = batchSelected.value.indexOf(id)
  if (idx >= 0) batchSelected.value.splice(idx, 1)
  else batchSelected.value.push(id)
}

function openBatchDialog(mode: 'institutional' | 'external' = 'institutional') {
  batchMode.value = mode
  batchSelected.value = []
  batchCategory.value = mode === 'external' ? 'CONTRACTOR' : 'IMPLEMENTING'
  batchProjectRole.value = ''; batchSearch.value = ''
  loadStaff(); batchDialog.value = true
}

function commitBatch() {
  for (const uid of batchSelected.value) {
    if (draft.value.some(d => d.id === uid)) continue
    const staff = staffUsers.value.find(s => s.id === uid)
    if (!staff) continue
    draft.value.push({
      id: staff.id, name: `${staff.first_name} ${staff.last_name}`, email: staff.email,
      role: null, department: staff.campus ?? null, phone: null,
      personnelCategory: batchCategory.value, projectRole: batchProjectRole.value || null,
      permissions: batchMode.value === 'external' ? DEFAULT_EXTERNAL_PERMS() : DEFAULT_PERMS(),
      _permOpen: false,
    })
  }
  batchDialog.value = false
}

// ── Save ─────────────────────────────────────────────────────────────────────
const saving = ref(false)

async function saveAssignments() {
  if (!props.projectId) return
  saving.value = true
  try {
    await api.patch(`/api/construction-projects/${props.projectId}`, {
      assignments: draft.value.map(d => ({
        user_id: d.id,
        role: d.role ?? undefined,
        department: d.department ?? undefined,
        phone: d.phone ?? undefined,
        personnel_category: d.personnelCategory ?? undefined,
        project_role: d.projectRole ?? undefined,
        permissions: d.permissions,
      })),
    })
    toast.success('Personnel assignments saved')
    emit('assignments-updated')
  } catch (err: any) {
    toast.error(err?.message || 'Failed to save assignments')
  } finally { saving.value = false }
}

// PW-A: expose live draft state to parent for unified Save Changes flow
function getDraftAssignments() {
  return draft.value.map(d => ({
    user_id: d.id,
    role: d.role ?? undefined,
    department: d.department ?? undefined,
    phone: d.phone ?? undefined,
    personnel_category: d.personnelCategory ?? undefined,
    project_role: d.projectRole ?? undefined,
    permissions: d.permissions,
  }))
}

defineExpose({ getDraftAssignments })

// ── Helpers ──────────────────────────────────────────────────────────────────
function categoryColor(cat: string | null | undefined): string {
  return (PERSONNEL_GROUPS.find(g => g.code === cat)?.color ?? 'grey') as string
}
function categoryIcon(cat: string | null | undefined): string {
  return PERSONNEL_GROUPS.find(g => g.code === cat)?.icon ?? 'mdi-account'
}
function categoryLabel(cat: string | null | undefined): string {
  return PERSONNEL_GROUPS.find(g => g.code === cat)?.label ?? (cat || '—')
}
function externalCategoryLabel(cat: string | null | undefined): string {
  return EXTERNAL_CATEGORY_OPTIONS.find(o => o.value === cat)?.title ?? cat ?? 'External'
}
function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
function accessLevelColor(level: string): string {
  const m: Record<string, string> = { Viewer: 'grey', Contributor: 'info', Editor: 'primary', Manager: 'warning', Admin: 'error' }
  return m[level] || 'grey'
}
function accessLevelDisplayLabel(level: string): string {
  return level === 'Contributor' ? 'Contributor (Can Edit)' : level
}
</script>

<template>
  <v-card elevation="1" border rounded="lg">
    <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
      <v-icon size="small" icon="mdi-shield-account-outline" color="primary" />
      <span class="text-subtitle-1 font-weight-medium">Personnel &amp; Access Control</span>
      <v-chip size="x-small" variant="tonal" color="primary">{{ draft.length }}</v-chip>
      <v-spacer />
      <v-btn
        v-if="!readOnly && projectId"
        size="small"
        color="primary"
        variant="tonal"
        :loading="saving"
        prepend-icon="mdi-content-save"
        @click="saveAssignments"
      >
        Save Personnel
      </v-btn>
    </v-card-title>
    <v-divider />

    <!-- New project placeholder -->
    <div v-if="!projectId" class="pa-6 text-center text-grey">
      <v-icon size="40" color="grey-lighten-1">mdi-account-plus-outline</v-icon>
      <div class="text-body-2 mt-2">Personnel can be assigned after the project is saved.</div>
    </div>

    <v-card-text v-else class="pa-3">
      <v-row>
        <!-- ═══════════ LEFT: CSU / Institutional ═══════════ -->
        <v-col cols="12" md="7" style="border-right: 1px solid rgba(0,0,0,0.08)">
          <div class="d-flex align-center ga-2 mb-3">
            <v-icon size="small" color="primary" icon="mdi-school-outline" />
            <span class="text-body-2 font-weight-semibold">CSU / Institutional Users</span>
            <v-chip size="x-small" variant="tonal" color="primary">{{ institutionalDraft.length }}</v-chip>
          </div>

          <!-- Add user panel (Admin, edit mode) -->
          <v-sheet v-if="!readOnly && isAdmin" rounded="lg" border class="pa-3 mb-3">
            <div class="text-caption text-grey-darken-1 mb-2">Quick assign a user</div>
            <v-row dense>
              <v-col cols="12" sm="5">
                <v-autocomplete
                  v-model="addUserId"
                  :items="staffUsers"
                  :item-title="(u: any) => `${u.first_name} ${u.last_name}`"
                  item-value="id"
                  label="Search user"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  :loading="staffLoading"
                  @update:focused="(v: boolean) => v && loadStaff()"
                >
                  <template #item="{ item, props: iProps }">
                    <v-list-item v-bind="iProps">
                      <template #prepend>
                        <v-avatar size="28" color="primary" variant="tonal" class="text-caption font-weight-bold mr-2">
                          {{ initials(`${(item.raw as any).first_name} ${(item.raw as any).last_name}`) }}
                        </v-avatar>
                      </template>
                      <v-list-item-subtitle class="text-caption">{{ (item.raw as any).email }}</v-list-item-subtitle>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              <v-col cols="12" sm="4">
                <v-select v-model="addCategory" :items="PERSONNEL_CATEGORY_OPTIONS" label="Category" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="12" sm="3">
                <v-text-field v-model="addProjectRole" label="Project Role" placeholder="e.g. Engineer" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="12" class="d-flex ga-2">
                <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" :disabled="!addUserId" @click="commitAdd">
                  Add to Project
                </v-btn>
                <v-btn size="small" color="secondary" variant="tonal" prepend-icon="mdi-account-multiple-plus" @click="openBatchDialog('institutional')">
                  Add Multiple
                </v-btn>
              </v-col>
            </v-row>
          </v-sheet>

          <!-- Assigned user cards -->
          <div v-if="institutionalDraft.length === 0" class="text-caption text-grey py-4 text-center">No institutional personnel assigned yet.</div>
          <div class="d-flex flex-column ga-2">
            <v-card v-for="user in institutionalDraft" :key="user.id" variant="outlined" rounded="lg" class="pa-0">
              <div class="d-flex align-center pa-3 ga-3">
                <v-avatar size="40" :color="categoryColor(user.personnelCategory)" variant="tonal">
                  <span class="text-caption font-weight-bold">{{ initials(user.name) }}</span>
                </v-avatar>
                <div class="flex-grow-1 min-width-0">
                  <div class="text-body-2 font-weight-medium text-truncate">{{ user.name }}</div>
                  <div class="text-caption text-grey-darken-1 text-truncate">{{ user.email || user.department || '—' }}</div>
                  <div class="d-flex flex-wrap ga-1 mt-1">
                    <v-chip size="x-small" variant="tonal" :color="categoryColor(user.personnelCategory)" :prepend-icon="categoryIcon(user.personnelCategory)">
                      {{ categoryLabel(user.personnelCategory) }}
                    </v-chip>
                    <v-chip v-if="user.projectRole" size="x-small" variant="outlined" color="primary">{{ user.projectRole }}</v-chip>
                    <v-chip size="x-small" variant="tonal" :color="accessLevelColor(user.permissions.accessLevel)">
                      {{ accessLevelDisplayLabel(user.permissions.accessLevel) }}
                    </v-chip>
                  </div>
                </div>
                <!-- Edit-mode actions (Admin) -->
                <div v-if="!readOnly && isAdmin" class="d-flex align-center ga-1">
                  <v-btn :icon="user._permOpen ? 'mdi-shield-check' : 'mdi-shield-edit-outline'" size="x-small" variant="text" :color="user._permOpen ? 'primary' : 'grey'" title="Edit permissions" @click="user._permOpen = !user._permOpen" />
                  <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" title="Remove" @click="removeUser(user)" />
                </div>
                <!-- Read-only badge -->
                <v-chip v-else-if="readOnly" size="x-small" variant="tonal" :color="accessLevelColor(user.permissions.accessLevel)">
                  {{ accessLevelDisplayLabel(user.permissions.accessLevel) }}
                </v-chip>
              </div>

              <!-- ── Permission panel (Admin + edit mode) ── -->
              <v-expand-transition>
                <div v-if="!readOnly && isAdmin && user._permOpen">
                  <v-divider />
                  <div class="pa-3 d-flex flex-column ga-2">

                    <!-- Section C: Access Level Preset -->
                    <v-sheet rounded="lg" class="overflow-hidden" elevation="0" border>
                      <div class="d-flex align-center ga-2 px-3 py-2 bg-green-lighten-5">
                        <v-icon size="13" color="success">mdi-shield-star-outline</v-icon>
                        <span class="text-caption font-weight-bold text-green-darken-2">Project Access Level</span>
                        <v-chip v-if="user.permissions.accessLevel" size="x-small" :color="accessLevelColor(user.permissions.accessLevel)" variant="tonal" class="ml-auto">
                          {{ accessLevelDisplayLabel(user.permissions.accessLevel) }}
                        </v-chip>
                      </div>
                      <div class="px-3 py-2 d-flex flex-wrap ga-1">
                        <v-chip
                          v-for="level in ['Viewer','Contributor','Editor','Manager','Admin']"
                          :key="level"
                          :color="user.permissions.accessLevel === level ? accessLevelColor(level) : 'grey-lighten-2'"
                          :variant="user.permissions.accessLevel === level ? 'flat' : 'outlined'"
                          size="small"
                          class="cursor-pointer"
                          @click="applyPreset(user, level)"
                        >{{ accessLevelDisplayLabel(level) }}</v-chip>
                      </div>
                    </v-sheet>

                    <!-- Section A: Action Permissions -->
                    <v-sheet rounded="lg" class="overflow-hidden" elevation="0" border>
                      <div class="d-flex align-center ga-2 px-3 py-2 bg-blue-lighten-5">
                        <v-icon size="13" color="primary">mdi-pencil-circle-outline</v-icon>
                        <span class="text-caption font-weight-bold text-blue-darken-2">Action Permissions</span>
                      </div>
                      <v-row dense class="px-3 py-1">
                        <v-col v-for="p in (['canCreate','canEdit','canDelete','canUpload','canReview','canApprove'] as const)" :key="p" cols="6" sm="4">
                          <v-checkbox v-model="user.permissions[p]" :label="actionLabel(p)" density="compact" hide-details color="primary" />
                        </v-col>
                      </v-row>
                    </v-sheet>

                    <!-- Section B: Tab Access -->
                    <v-sheet rounded="lg" class="overflow-hidden" elevation="0" border>
                      <div class="d-flex align-center ga-2 px-3 py-2 bg-teal-lighten-5">
                        <v-icon size="13" color="teal">mdi-tab</v-icon>
                        <span class="text-caption font-weight-bold text-teal-darken-2">Tab Access</span>
                      </div>
                      <v-row dense class="px-3 py-1">
                        <v-col v-for="tab in COI_PROJECT_TABS" :key="tab.permKey" cols="6" sm="4">
                          <v-checkbox v-model="(user.permissions as any)[tab.permKey]" :label="tab.label" density="compact" hide-details color="teal" />
                        </v-col>
                      </v-row>
                    </v-sheet>

                  </div>
                </div>
              </v-expand-transition>
            </v-card>
          </div>
        </v-col>

        <!-- ═══════════ RIGHT: External Personnel (YA–YD: unified pipeline) ═══════════ -->
        <v-col cols="12" md="5">
          <div class="d-flex align-center ga-2 mb-3">
            <v-icon size="small" color="warning" icon="mdi-account-hard-hat" />
            <span class="text-body-2 font-weight-semibold">External Personnel</span>
            <v-chip size="x-small" variant="tonal" color="warning">{{ externalDraft.length }}</v-chip>
          </div>

          <!-- YB-A: External add panel — mirrors institutional; same staffUsers source, external categories -->
          <v-sheet v-if="!readOnly && isAdmin" rounded="lg" border class="pa-3 mb-3">
            <div class="text-caption text-grey-darken-1 mb-2">Assign external personnel</div>
            <v-row dense>
              <v-col cols="12" sm="5">
                <v-autocomplete
                  v-model="addExternalUserId"
                  :items="staffUsers"
                  :item-title="(u: any) => `${u.first_name} ${u.last_name}`"
                  item-value="id"
                  label="Search user"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  :loading="staffLoading"
                  @update:focused="(v: boolean) => v && loadStaff()"
                >
                  <template #item="{ item, props: iProps }">
                    <v-list-item v-bind="iProps">
                      <template #prepend>
                        <v-avatar size="28" color="warning" variant="tonal" class="text-caption font-weight-bold mr-2">
                          {{ initials(`${(item.raw as any).first_name} ${(item.raw as any).last_name}`) }}
                        </v-avatar>
                      </template>
                      <v-list-item-subtitle class="text-caption">{{ (item.raw as any).email }}</v-list-item-subtitle>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              <v-col cols="12" sm="4">
                <v-select v-model="addExternalCategory" :items="EXTERNAL_CATEGORY_OPTIONS" label="External Role" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="12" sm="3">
                <v-text-field v-model="addExternalProjectRole" label="Project Role" placeholder="e.g. Site Inspector" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="12" class="d-flex ga-2">
                <v-btn size="small" color="warning" variant="tonal" prepend-icon="mdi-plus" :disabled="!addExternalUserId" @click="commitAddExternal">
                  Add to Project
                </v-btn>
                <v-btn size="small" color="secondary" variant="tonal" prepend-icon="mdi-account-multiple-plus" @click="openBatchDialog('external')">
                  Add Multiple
                </v-btn>
              </v-col>
            </v-row>
          </v-sheet>

          <!-- External personnel cards -->
          <div v-if="externalDraft.length === 0" class="text-caption text-grey py-4 text-center">No external personnel assigned yet.</div>
          <div class="d-flex flex-column ga-2">
            <v-card v-for="user in externalDraft" :key="user.id" variant="outlined" rounded="lg" class="pa-0">
              <div class="d-flex align-center pa-3 ga-3">
                <v-avatar size="40" color="warning" variant="tonal">
                  <span class="text-caption font-weight-bold">{{ initials(user.name) }}</span>
                </v-avatar>
                <div class="flex-grow-1 min-width-0">
                  <div class="text-body-2 font-weight-medium text-truncate">{{ user.name }}</div>
                  <div class="text-caption text-grey-darken-1 text-truncate">{{ user.email || user.department || '—' }}</div>
                  <div class="d-flex flex-wrap ga-1 mt-1">
                    <v-chip size="x-small" variant="tonal" color="warning" prepend-icon="mdi-account-hard-hat">
                      {{ externalCategoryLabel(user.personnelCategory) }}
                    </v-chip>
                    <v-chip v-if="user.projectRole" size="x-small" variant="outlined" color="warning">{{ user.projectRole }}</v-chip>
                    <v-chip size="x-small" variant="tonal" :color="accessLevelColor(user.permissions.accessLevel)">
                      {{ accessLevelDisplayLabel(user.permissions.accessLevel) }}
                    </v-chip>
                  </div>
                </div>
                <!-- Edit-mode actions (Admin) -->
                <div v-if="!readOnly && isAdmin" class="d-flex align-center ga-1">
                  <v-btn :icon="user._permOpen ? 'mdi-shield-check' : 'mdi-shield-edit-outline'" size="x-small" variant="text" :color="user._permOpen ? 'warning' : 'grey'" title="Edit permissions" @click="user._permOpen = !user._permOpen" />
                  <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" title="Remove" @click="removeUser(user)" />
                </div>
                <!-- Read-only badge -->
                <v-chip v-else-if="readOnly" size="x-small" variant="tonal" :color="accessLevelColor(user.permissions.accessLevel)">
                  {{ accessLevelDisplayLabel(user.permissions.accessLevel) }}
                </v-chip>
              </div>

              <!-- ── Permission panel (Admin + edit mode) ── -->
              <v-expand-transition>
                <div v-if="!readOnly && isAdmin && user._permOpen">
                  <v-divider />
                  <div class="pa-3 d-flex flex-column ga-2">

                    <!-- Section C: Access Level Preset -->
                    <v-sheet rounded="lg" class="overflow-hidden" elevation="0" border>
                      <div class="d-flex align-center ga-2 px-3 py-2 bg-orange-lighten-5">
                        <v-icon size="13" color="warning">mdi-shield-star-outline</v-icon>
                        <span class="text-caption font-weight-bold text-orange-darken-2">Project Access Level</span>
                        <v-chip v-if="user.permissions.accessLevel" size="x-small" :color="accessLevelColor(user.permissions.accessLevel)" variant="tonal" class="ml-auto">
                          {{ accessLevelDisplayLabel(user.permissions.accessLevel) }}
                        </v-chip>
                      </div>
                      <div class="px-3 py-2 d-flex flex-wrap ga-1">
                        <v-chip
                          v-for="level in ['Viewer','Contributor','Editor','Manager','Admin']"
                          :key="level"
                          :color="user.permissions.accessLevel === level ? accessLevelColor(level) : 'grey-lighten-2'"
                          :variant="user.permissions.accessLevel === level ? 'flat' : 'outlined'"
                          size="small"
                          class="cursor-pointer"
                          @click="applyPreset(user, level)"
                        >{{ accessLevelDisplayLabel(level) }}</v-chip>
                      </div>
                    </v-sheet>

                    <!-- Section A: Action Permissions -->
                    <v-sheet rounded="lg" class="overflow-hidden" elevation="0" border>
                      <div class="d-flex align-center ga-2 px-3 py-2 bg-blue-lighten-5">
                        <v-icon size="13" color="primary">mdi-pencil-circle-outline</v-icon>
                        <span class="text-caption font-weight-bold text-blue-darken-2">Action Permissions</span>
                      </div>
                      <v-row dense class="px-3 py-1">
                        <v-col v-for="p in (['canCreate','canEdit','canDelete','canUpload','canReview','canApprove'] as const)" :key="p" cols="6" sm="4">
                          <v-checkbox v-model="user.permissions[p]" :label="actionLabel(p)" density="compact" hide-details color="primary" />
                        </v-col>
                      </v-row>
                    </v-sheet>

                    <!-- Section B: Tab Access -->
                    <v-sheet rounded="lg" class="overflow-hidden" elevation="0" border>
                      <div class="d-flex align-center ga-2 px-3 py-2 bg-teal-lighten-5">
                        <v-icon size="13" color="teal">mdi-tab</v-icon>
                        <span class="text-caption font-weight-bold text-teal-darken-2">Tab Access</span>
                      </div>
                      <v-row dense class="px-3 py-1">
                        <v-col v-for="tab in COI_PROJECT_TABS" :key="tab.permKey" cols="6" sm="4">
                          <v-checkbox v-model="(user.permissions as any)[tab.permKey]" :label="tab.label" density="compact" hide-details color="teal" />
                        </v-col>
                      </v-row>
                    </v-sheet>

                  </div>
                </div>
              </v-expand-transition>
            </v-card>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <!-- ══════ Batch Add Dialog (YC: dual-mode institutional / external) ══════ -->
  <v-dialog v-model="batchDialog" max-width="600" scrollable>
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
        <v-icon icon="mdi-account-multiple-plus" size="small" :color="batchMode === 'external' ? 'warning' : 'primary'" />
        Add Multiple {{ batchMode === 'external' ? 'External Personnel' : 'Users' }}
        <v-chip size="x-small" variant="tonal" :color="batchMode === 'external' ? 'warning' : 'primary'">{{ batchSelected.length }} selected</v-chip>
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-3">
        <v-text-field
          v-model="batchSearch"
          placeholder="Search by name or email..."
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-magnify"
          class="mb-3"
        />
        <v-row dense class="mb-3">
          <v-col cols="6">
            <v-select
              v-model="batchCategory"
              :items="batchMode === 'external' ? EXTERNAL_CATEGORY_OPTIONS : PERSONNEL_CATEGORY_OPTIONS"
              :label="batchMode === 'external' ? 'External Role (all selected)' : 'Category (all selected)'"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="batchProjectRole" label="Project Role (all selected)" density="compact" variant="outlined" hide-details />
          </v-col>
        </v-row>
        <v-list density="compact" max-height="300" style="overflow-y: auto; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px">
          <div v-if="filteredBatchStaff.length === 0" class="pa-4 text-center text-caption text-grey">
            No users found or all eligible users are already assigned.
          </div>
          <v-list-item
            v-for="user in filteredBatchStaff"
            :key="user.id"
            :class="{ 'bg-primary-lighten-5': batchSelected.includes(user.id) }"
            @click="toggleBatchSelect(user.id)"
          >
            <template #prepend>
              <v-checkbox-btn :model-value="batchSelected.includes(user.id)" :color="batchMode === 'external' ? 'warning' : 'primary'" class="mr-1" />
              <v-avatar size="28" :color="batchMode === 'external' ? 'warning' : 'primary'" variant="tonal" class="mr-2 text-caption font-weight-bold">
                {{ initials(`${user.first_name} ${user.last_name}`) }}
              </v-avatar>
            </template>
            <v-list-item-title>{{ user.first_name }} {{ user.last_name }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ user.email || user.campus || '' }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-3">
        <v-btn variant="text" @click="batchDialog = false">Cancel</v-btn>
        <v-spacer />
        <v-btn
          :color="batchMode === 'external' ? 'warning' : 'primary'"
          variant="tonal"
          :disabled="batchSelected.length === 0"
          prepend-icon="mdi-account-multiple-plus"
          @click="commitBatch"
        >
          Add {{ batchSelected.length }} {{ batchMode === 'external' ? 'External Personnel' : `User${batchSelected.length !== 1 ? 's' : ''}` }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
