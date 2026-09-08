/**
 * KC-E: COI Access Composable
 *
 * Centralises per-record edit-permission logic for the COI module.
 * Rule: Admins/SuperAdmins can always edit; Staff may only edit records
 * they created or are assigned to.
 *
 * KE-C: canTabAction(tab, action) — granular tab+action permission matrix.
 *
 * Usage:
 *   const { canEditCurrentProject, isOwnerOrAssigned, canTabAction } = useCoiAccess(project)
 */
import type { ComputedRef, Ref } from 'vue'
import type { UIProjectDetail } from '~/utils/adapters'

// KD-G: tabs eligible for editing. `analytics` is read-only by design; excluded.
const EDITABLE_TABS = ['overview', 'gallery', 'documents', 'team']

// PHASE BBBF (Track 2 / Task B2): tab visibility by COI access LEVEL for institutional users.
// Viewer = Overview only; Contributor = + Progress/Documents/Team; Approver/Manager = all (operator-approved).
const LEVEL_RANK: Record<string, number> = { Viewer: 0, Contributor: 1, Approver: 2, Manager: 3 }
const TAB_MIN_LEVEL: Record<string, number> = {
  overview: 0,    // Project Profile / Strategic Alignment / Financial Summary / Gallery / General Info
  progress: 1,    // Progress & Milestones — Contributor+
  documents: 1,   // Attachments — Contributor+
  team: 1,        // Team — Contributor+
  others: 2,      // Others — Approver+
  analytics: 2,   // Analytics — Approver+
  audit: 3,       // Audit Logs — Manager (or Auditor role / Admin)
}
const TAB_PERMKEY: Record<string, string> = {
  overview: 'tabProjectProfile',
  progress: 'tabProgressReport',
  documents: 'tabAttachments',
  team: 'tabPersonnel',
  others: 'tabOthers',
}

// KE-C: Tab × Action permission matrix.
// 'Admin' encompasses SuperAdmin (isAdmin guard handles both).
// Staff requires assignment check (isOwnerOrAssigned) for write actions.
type TabAction = 'read' | 'edit' | 'submit' | 'approve' | 'audit'
const TAB_ACTION_MATRIX: Record<string, Partial<Record<TabAction, string[]>>> = {
  basic:      { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
  schedule:   { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
  pow:        { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
  financial:  { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
  personnel:  { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
  documents:  { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
  analytics:  { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], audit: ['Auditor', 'Admin'] },
  overview:   { read: ['Admin', 'Staff', 'Viewer', 'Auditor'], edit: ['Admin', 'Staff'], approve: ['Admin'], audit: ['Auditor', 'Admin'] },
}

export function useCoiAccess(project: Ref<UIProjectDetail | null>) {
  const authStore = useAuthStore()
  const { isAdmin, moduleLevels } = usePermissions()

  // PHASE BBBF (Track 2): the user's COI access level (institutional users with COI view access but
  // no explicit grant default to Viewer — view-only Overview).
  const coiLevel = computed(() => moduleLevels.value['coi'] || 'Viewer')
  // VG-A: session-loaded permission map (stateless at render time)
  const permStore = useProjectPermissionsStore()

  const isContractor = computed(() => {
    const role = authStore.user?.roleName ?? (authStore.user as any)?.role
    return typeof role === 'string' && role.toLowerCase() === 'contractor'
  })

  // FIX: mirrors construction-projects.service.ts's assertProjectPermission(), the
  // backend's actual authority for every CRUD action (milestones, documents, gallery,
  // etc.) — it has an explicit "Owner bypass" (created_by === userId ⇒ allow,
  // unconditionally) BEFORE checking record_assignments.permissions; that permission
  // check only applies to non-owner assigned users. The gates below previously
  // required effectivePermissions.X for owner and assigned alike, so an owner with no
  // explicit permissions.canEdit on their (often nonexistent) record_assignments row
  // saw no Edit button at all, even though the backend would have allowed the edit.
  const isOwner = computed(() => {
    if (!project.value) return false
    const userId = authStore.user?.id
    if (!userId) return false
    return (project.value as any).createdBy === userId
  })

  const isOwnerOrAssigned = computed(() => {
    if (!project.value) return false
    const userId = authStore.user?.id
    if (!userId) return false
    const projectId = (project.value as any).id
    // VG-A: store assignment counts as "assigned" (stateless, login-time)
    if (permStore.loaded && projectId && permStore.get(projectId) !== null) {
      return true
    }
    return (
      (project.value as any).createdBy === userId
      || (project.value as any).delegatedTo === userId
      || ((project.value as any).assignedUsers?.some((u: { id: string }) => u.id === userId) ?? false)
    )
  })

  // PA-E: current user's assignment record (includes permissions override from PA-A)
  // VG-A: prefer the session-loaded permission store (stateless, login-time) over the
  // runtime-stateful project.assignedUsers lookup. Falls back to assignedUsers when the
  // store has not loaded (e.g. SSR before auth init).
  const myAssignment = computed(() => {
    const userId = authStore.user?.id
    if (!userId || !project.value) return null
    const projectId = (project.value as any).id
    if (permStore.loaded && projectId) {
      const storePerms = permStore.get(projectId)
      if (storePerms !== null) {
        return { id: userId, permissions: storePerms }
      }
    }
    return ((project.value as any).assignedUsers || []).find((u: any) => u.id === userId) ?? null
  })

  // PA-E / PR-B / RC-A: merge system-role defaults with per-assignment overrides.
  // Tab keys now exactly match COI_PROJECT_TABS permKeys (RA phase).
  const effectivePermissions = computed(() => {
    const adminAll = isAdmin.value
    const base = {
      // Action permissions
      canCreate: adminAll, canEdit: adminAll, canDelete: adminAll,
      canUpload: adminAll, canReview: adminAll, canApprove: adminAll,
      // Tab access (RC-A: aligned to COI_PROJECT_TABS)
      tabProjectProfile: adminAll,
      tabDatesDuration: adminAll,
      tabProgressReport: adminAll,
      tabPersonnel: adminAll,
      tabAttachments: adminAll,
      tabOthers: adminAll,
      // Legacy aliases retained for back-compat with old JSONB overrides
      canAccessFinancials: adminAll,
      canAccessOthers: adminAll,
      canAccessPersonnel: adminAll,
      accessLevel: adminAll ? 'Admin' : 'Viewer' as string,
    }
    const override = myAssignment.value?.permissions
    if (!override || isAdmin.value) return base
    // Merge override fields
    const merged = { ...base }
    for (const [k, v] of Object.entries(override)) {
      if (v !== null && v !== undefined) (merged as any)[k] = v
    }
    // RC-B: Legacy field migration
    // Old tabTimeline covered both schedule+timeline — propagate to tabDatesDuration if absent
    if ((override as any).tabTimeline !== undefined && (override as any).tabDatesDuration === undefined) {
      merged.tabDatesDuration = !!(override as any).tabTimeline
    }
    // Old tabDocuments -> tabAttachments
    if ((override as any).tabDocuments !== undefined && (override as any).tabAttachments === undefined) {
      merged.tabAttachments = !!(override as any).tabDocuments
    }
    // canAccess* legacy aliases
    if (override.canAccessOthers !== undefined && (override as any).tabOthers === undefined) {
      merged.tabOthers = !!override.canAccessOthers
    }
    if (override.canAccessPersonnel !== undefined && (override as any).tabPersonnel === undefined) {
      merged.tabPersonnel = !!override.canAccessPersonnel
    }
    return merged
  })

  // WA-A: accessResolved — true only when RBAC inputs are known. Until then, callers
  // must render NOTHING (filter-before-render). Prevents the hydration-window leak
  // where tabs render before authStore.user / project load.
  const accessResolved = computed(() => {
    if (!authStore.user) return false        // auth not hydrated → decision unknown
    if (isAdmin.value) return true           // admin decision is immediate
    if (!project.value) return false         // need project (carries assignment + perms)
    return true
  })

  // WA-A: SINGLE tab-authorization engine. Both edit and detail pages call this with
  // the COI_PROJECT_TABS permKey for each tab. No duplicated decision logic.
  function canViewTab(permKey: string): boolean {
    if (isAdmin.value) return true
    const ep = effectivePermissions.value
    const hasExplicitPerms = isOwnerOrAssigned.value && !!myAssignment.value?.permissions
    if (hasExplicitPerms) return !!(ep as any)[permKey]
    if (isContractor.value) return false     // fail-closed: external personnel deny
    return true                               // institutional non-assigned: role gates apply
  }

  // PHASE BBBF (Track 2 / Task B2): tab visibility by COI access LEVEL (keyed by tab VALUE, not permKey).
  // This is the authoritative tab gate for the detail page — a Viewer sees only the Overview tab.
  function canViewCoiTab(tabValue: string): boolean {
    if (isAdmin.value) return true
    const role = (authStore.user?.roleName ?? (authStore.user as any)?.role) as string | undefined
    // Audit log tab: Auditor role (admins handled above).
    if (tabValue === 'audit') return role === 'Auditor'
    // Assigned users with explicit project permissions → per-assignment overrides (unchanged engine).
    const hasExplicitPerms = isOwnerOrAssigned.value && !!myAssignment.value?.permissions
    if (hasExplicitPerms) {
      if (tabValue === 'analytics') return true
      const permKey = TAB_PERMKEY[tabValue]
      return permKey ? !!(effectivePermissions.value as any)[permKey] : true
    }
    if (isContractor.value) return false      // fail-closed: external personnel
    // Institutional non-assigned: gate by the COI access level.
    const min = TAB_MIN_LEVEL[tabValue] ?? 0
    const rank = LEVEL_RANK[coiLevel.value] ?? 0
    return rank >= min
  }

  const canEditCurrentProject = computed(() => {
    if (!project.value) return false
    if (isAdmin.value || isOwner.value) return true
    return isOwnerOrAssigned.value && (effectivePermissions.value.canEdit ?? false)
  })

  // KD-G: tab-level edit gate. Returns false for read-only tabs (e.g., analytics)
  // even when the user otherwise has edit access to the project.
  function canEditTab(tabName: string): ComputedRef<boolean> {
    return computed(() => EDITABLE_TABS.includes(tabName) && canEditCurrentProject.value)
  }

  // KE-F: true iff the user can edit at least one tab (gates the "Edit Project Details" button).
  const canEditAnyTab = computed(() => canEditCurrentProject.value && EDITABLE_TABS.length > 0)

  // KE-C: Granular tab × action gate.
  // Staff requires assignment for write actions (edit/submit/approve).
  function canTabAction(tab: string, action: TabAction): ComputedRef<boolean> {
    return computed(() => {
      const allowed = TAB_ACTION_MATRIX[tab]?.[action] || []
      const userRole = (authStore.user?.roleName ?? (authStore.user as any)?.role) as string | undefined
      if (!userRole) return false
      const roleMatches = isAdmin.value ? allowed.some(r => r === 'Admin') : allowed.includes(userRole)
      if (!roleMatches) return false
      if (!isAdmin.value && ['edit', 'submit', 'approve'].includes(action)) {
        return isOwnerOrAssigned.value
      }
      return true
    })
  }

  // PQ-B: Per-tab edit flags — Admin/owner always allowed; non-owner assigned users
  // need the explicit per-assignment permission (mirrors assertProjectPermission's
  // owner bypass on the backend).
  const canEditMilestones = computed(() =>
    isAdmin.value || isOwner.value || (isOwnerOrAssigned.value && (effectivePermissions.value.canEdit ?? false))
  )
  const canEditWorkLog = computed(() => canEditCurrentProject.value)
  const canEditFinancial = computed(() => canEditCurrentProject.value)
  const canEditPow = computed(() =>
    isAdmin.value || isOwner.value || (isOwnerOrAssigned.value && (effectivePermissions.value.canEdit ?? false))
  )
  const canEditPersonnel = computed(() =>
    isAdmin.value || isOwner.value || (isOwnerOrAssigned.value && (effectivePermissions.value.tabPersonnel ?? false))
  )
  const canUploadDocuments = computed(() =>
    isAdmin.value || isOwner.value || (isOwnerOrAssigned.value && (effectivePermissions.value.canUpload ?? false))
  )
  // PS-B: granular action permissions for sub-resource CRUD buttons
  const canDeleteResources = computed(() =>
    isAdmin.value || isOwner.value || (isOwnerOrAssigned.value && (effectivePermissions.value.canDelete ?? false))
  )
  const canCreateResources = computed(() =>
    isAdmin.value || isOwner.value || (isOwnerOrAssigned.value && (effectivePermissions.value.canCreate ?? false))
  )

  return {
    accessResolved,
    canViewTab,
    canViewCoiTab,
    canEditCurrentProject,
    isOwner,
    isOwnerOrAssigned,
    myAssignment,
    effectivePermissions,
    isContractor,
    canEditTab,
    canEditAnyTab,
    canTabAction,
    canEditMilestones,
    canEditWorkLog,
    canEditFinancial,
    canEditPow,
    canEditPersonnel,
    canUploadDocuments,
    canDeleteResources,
    canCreateResources,
  }
}
