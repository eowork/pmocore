/**
 * Permission Composable - Role-based authorization for UI elements
 *
 * Implements Tier 1 authorization model with override support.
 * Permission resolution order: SuperAdmin > User Override > Role Default > Deny
 *
 * Role Hierarchy:
 * - SuperAdmin: Full access to all modules, bypasses all checks
 * - Admin: Full CRUD on assigned modules (not User Management by default)
 * - Staff: CRU on assigned modules (no Delete)
 * - Viewer: Read-only access
 */

export interface ModulePermissions {
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

export type RoleName = 'SuperAdmin' | 'Admin' | 'Staff' | 'Viewer' | 'Auditor' | string

/**
 * Module key mapping for consistency between routes and overrides
 * Route path (e.g., /coi) -> Override key (e.g., coi)
 */
const MODULE_KEY_MAP: Record<string, string> = {
  'coi': 'coi',
  'repairs': 'repairs',
  'contractors': 'contractors',
  'funding-sources': 'funding_sources',
  'funding_sources': 'funding_sources',
  'university-operations': 'university_operations',
  'university_operations': 'university_operations',
  'users': 'users',
}

/**
 * Default permission matrix by role
 * Maps role names to CRUD capabilities
 *
 * NOTE: Universal Draft Governance (Feb 15, 2026)
 * - Staff can create and edit records (all saved as DRAFT)
 * - ALL users (Staff, Admin, SuperAdmin) create DRAFT initially
 * - Publishing requires explicit approval action by authorized Admin
 * - Staff cannot delete records or publish (requires Admin approval)
 * - See research.md Section 1.29 for rationale
 */
const ROLE_PERMISSIONS: Record<RoleName, ModulePermissions> = {
  SuperAdmin: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  Admin: { canView: true, canAdd: true, canEdit: true, canDelete: true },
  Staff: { canView: true, canAdd: true, canEdit: true, canDelete: false },
  Viewer: { canView: true, canAdd: false, canEdit: false, canDelete: false },
  // Phase JT-E: read-only role with activity-log access (see canViewActivityLog).
  Auditor: { canView: true, canAdd: false, canEdit: false, canDelete: false },
}

// PHASE BBBC (Track 8d): per-module access LEVEL → CRUD. For non-admin users a granted module's
// level governs CRUD (module entry ≠ write). Default grants are Viewer (view-only).
const LEVEL_PERMISSIONS: Record<string, ModulePermissions> = {
  Viewer: { canView: true, canAdd: false, canEdit: false, canDelete: false },
  Contributor: { canView: true, canAdd: true, canEdit: true, canDelete: false },
  Approver: { canView: true, canAdd: true, canEdit: true, canDelete: false },
  Manager: { canView: true, canAdd: true, canEdit: true, canDelete: true },
}

// Phase JT-E-3 — Restricted Editor (section overrides) — DESIGN ONLY (no enforcement here).
// Override keys: 'coi:contract', 'coi:progress', 'coi:documents', 'coi:personnel'.
// Pattern: moduleOverrides['coi:contract'] === true → allow contract section actions
// regardless of base role. Enforcement deferred to a follow-up phase per JT-D4.
// Example consumer (future): v-if="canEditCurrentProject || moduleOverrides['coi:contract']"

/**
 * Modules that require Admin or SuperAdmin access by default (no override)
 * Includes User Management and Reference Data modules (Contractors, Funding Sources)
 * Per research.md Section 1.33.E: Reference Data hidden from sidebar for non-Admin users
 */
const ADMIN_ONLY_MODULES = ['users', 'contractors', 'funding-sources', 'funding_sources', 'homepage']

/**
 * Reference data modules - Contractors and Funding Sources
 *
 * PURPOSE CLARIFICATION (Phase R cleanup):
 * - ADMIN_ONLY_MODULES: Controls sidebar visibility (Admin/SuperAdmin see menu items)
 * - REFERENCE_DATA_MODULES: Controls form-level access (Staff can read for dropdowns)
 *
 * Even though these overlap with ADMIN_ONLY_MODULES, this constant is still used
 * in getModulePermissions() to grant Staff view-only access when accessing
 * contractor/funding source data via form dropdowns or API calls.
 */
const REFERENCE_DATA_MODULES = ['contractors', 'funding-sources', 'funding_sources']

// QA-A: Modules contractors are permitted to access (sidebar + route guard)
const CONTRACTOR_ALLOWED_MODULES = ['coi', 'dashboard']

// PHASE BBBE (Track 2): project/operational modules where WRITE is gated by the per-module level
// (view is universal). Non-admins without a granted level get view-only here (aligns with the
// backend ModuleAccessGuard: no override ⇒ reads pass, writes 403).
const GATED_MODULES = ['coi', 'repairs', 'university_operations']

export function usePermissions() {
  const authStore = useAuthStore()

  /**
   * Check if current user is SuperAdmin
   */
  const isSuperAdmin = computed(() => {
    return authStore.user?.isSuperAdmin ?? false
  })

  /**
   * Check if current user is Admin (or higher)
   */
  const isAdmin = computed(() => {
    if (isSuperAdmin.value) return true
    const roleName = authStore.user?.roleName?.toLowerCase() ?? ''
    return roleName === 'admin'
  })

  /**
   * Check if current user is Staff (or higher)
   */
  const isStaff = computed(() => {
    if (isAdmin.value) return true
    const roleName = authStore.user?.roleName?.toLowerCase() ?? ''
    return roleName === 'staff'
  })

  /**
   * Get the current user's role name
   */
  const currentRole = computed((): RoleName => {
    if (isSuperAdmin.value) return 'SuperAdmin'
    const roleName = authStore.user?.roleName ?? ''
    // Normalize role name to match our permission matrix
    if (roleName.toLowerCase() === 'admin') return 'Admin'
    if (roleName.toLowerCase() === 'staff') return 'Staff'
    if (roleName.toLowerCase() === 'viewer') return 'Viewer'
    if (roleName.toLowerCase() === 'auditor') return 'Auditor'
    return roleName || 'Viewer' // Default to Viewer for unknown roles
  })

  /**
   * QA-A: Check if current user is a Contractor
   * Contractors have scoped project access — COI + Dashboard only.
   */
  const isContractor = computed(() => {
    return currentRole.value === 'Contractor'
  })

  /**
   * Get user's module overrides
   */
  const moduleOverrides = computed(() => {
    return authStore.user?.moduleOverrides ?? {}
  })

  // PHASE BBBC (Track 8d): per-module CRUD levels.
  const moduleLevels = computed(() => {
    return authStore.user?.moduleLevels ?? {}
  })

  /**
   * Get user's module assignments (for approval visibility)
   */
  const moduleAssignments = computed(() => {
    return authStore.user?.moduleAssignments ?? []
  })

  /**
   * Get user's rank level
   *
   * GOVERNANCE DECISION (research.md Section 1.35):
   * Rank is APPROVAL-AUTHORITY ONLY, not CRUD-tier.
   * - Used for: approval chain validation, user hierarchy management
   * - NOT used for: canAdd, canEdit, canDelete (these are role-based)
   *
   * Lower rank_level = higher authority (10 = SuperAdmin, 100 = Viewer)
   */
  const rankLevel = computed(() => {
    return authStore.user?.rankLevel ?? 100
  })

  /**
   * Normalize module ID to override key
   */
  function normalizeModuleKey(moduleId: string): string {
    const lowered = moduleId.toLowerCase()
    return MODULE_KEY_MAP[lowered] || lowered
  }

  /**
   * Check if user has an override for a module
   * Returns: true (granted), false (revoked), or undefined (use role default)
   */
  function getModuleOverride(moduleId: string): boolean | undefined {
    const key = normalizeModuleKey(moduleId)
    const overrides = moduleOverrides.value
    if (key in overrides) {
      return overrides[key]
    }
    return undefined
  }

  /**
   * Check if user can access a module (for sidebar filtering)
   * Resolution: SuperAdmin > Override > Role Default
   */
  function canAccessModule(moduleId: string): boolean {
    // SuperAdmin bypasses all checks
    if (isSuperAdmin.value) return true

    // QA-A: Contractors see only their permitted modules — no override bypass
    if (isContractor.value) {
      return CONTRACTOR_ALLOWED_MODULES.includes(moduleId.toLowerCase())
    }

    const role = currentRole.value
    const normalizedId = moduleId.toLowerCase()

    // Dashboard is always accessible.
    if (normalizedId === 'dashboard') return true

    // Admin-only modules (User Management + reference-data management) — Admin/SuperAdmin only.
    if (ADMIN_ONLY_MODULES.includes(normalizedId)) {
      return role === 'Admin' || role === 'SuperAdmin'
    }

    // PHASE BBBE (Track 2 / Task H): VISIBILITY LAYER — any authenticated CSU user may VIEW
    // project/operational modules (read-only). "Viewing ≠ modifying." Write capability is gated
    // separately by canAdd/canEdit (level-based). Supersedes the BBBA default-deny on reads (R-344).
    return true
  }

  /**
   * Get permissions for a specific module
   */
  function getModulePermissions(moduleId: string): ModulePermissions {
    // SuperAdmin bypasses all checks
    if (isSuperAdmin.value) {
      return { canView: true, canAdd: true, canEdit: true, canDelete: true }
    }

    const role = currentRole.value
    const normalizedId = moduleId.toLowerCase()

    // Check if module access is denied via override (explicit revoke).
    // PHASE BBBE: a revoke removes WRITE but keeps VIEW for gated modules (view is universal).
    const override = getModuleOverride(moduleId)
    if (override === false) {
      if (GATED_MODULES.includes(normalizeModuleKey(moduleId))) {
        return { canView: true, canAdd: false, canEdit: false, canDelete: false }
      }
      return { canView: false, canAdd: false, canEdit: false, canDelete: false }
    }

    // PHASE BBBC (Track 8d) + BBBE (Track 2): for non-admins, a granted module's LEVEL governs CRUD —
    // module entry never implies write. On gated modules, NO level ⇒ view-only (write needs a grant,
    // aligning with the backend ModuleAccessGuard). Admins/SuperAdmins bypass (role matrix below).
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      const level = moduleLevels.value[normalizeModuleKey(moduleId)]
      if (level && LEVEL_PERMISSIONS[level]) {
        return LEVEL_PERMISSIONS[level]
      }
      if (GATED_MODULES.includes(normalizeModuleKey(moduleId))) {
        return { canView: true, canAdd: false, canEdit: false, canDelete: false }
      }
    }

    // Admin-only modules
    if (ADMIN_ONLY_MODULES.includes(normalizedId)) {
      if (role === 'Admin' || role === 'SuperAdmin') {
        return ROLE_PERMISSIONS[role]
      }
      return { canView: false, canAdd: false, canEdit: false, canDelete: false }
    }

    // Reference data modules - Staff can only view
    if (REFERENCE_DATA_MODULES.includes(normalizedId)) {
      if (role === 'Staff') {
        return { canView: true, canAdd: false, canEdit: false, canDelete: false }
      }
      if (role === 'Viewer') {
        return { canView: true, canAdd: false, canEdit: false, canDelete: false }
      }
    }

    // Return role-based permissions
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer
  }

  /**
   * Check if user can view a module
   */
  function canView(moduleId: string): boolean {
    return getModulePermissions(moduleId).canView
  }

  /**
   * Check if user can add records to a module
   */
  function canAdd(moduleId: string): boolean {
    return getModulePermissions(moduleId).canAdd
  }

  /**
   * Check if user can edit records in a module
   */
  function canEdit(moduleId: string): boolean {
    return getModulePermissions(moduleId).canEdit
  }

  /**
   * Check if user can delete records in a module
   */
  function canDelete(moduleId: string): boolean {
    return getModulePermissions(moduleId).canDelete
  }

  /**
   * Check if user can approve records in a module (Draft Governance Workflow)
   *
   * PHASE BBCH (Track 1, R-372): approval authority is Layer 1 (system role) OR Layer 3
   * (per-module level). The prior implementation read only the system role (isAdmin), so a
   * user granted Approver/Manager via an approved access request (written to
   * user_permission_overrides → moduleLevels) was wrongly denied Submit/Approve/Publish even
   * though their CRUD already worked. Module level is the authority here.
   *
   * Approval authority:
   * - SuperAdmin / Admin: approve any module
   * - Module level Approver / Manager: approve THIS module
   * - Contributor / Viewer / none: cannot approve (must submit for review)
   *
   * @param moduleId - The module identifier (e.g., 'coi', 'repairs', 'university_operations')
   * @returns true if user can approve records in this module
   */
  function canApprove(moduleId: string): boolean {
    // SuperAdmin / Admin can approve everything (Layer 1)
    if (isSuperAdmin.value) return true
    if (isAdmin.value) return true

    // Layer 3: an Approver/Manager module-level grant confers approval authority for this module.
    const level = moduleLevels.value[normalizeModuleKey(moduleId)]
    return level === 'Approver' || level === 'Manager'
  }

  /**
   * Phase JT-E-2: Activity log access — SuperAdmin, Admin, or Auditor only.
   */
  function canViewActivityLog(): boolean {
    if (isSuperAdmin.value) return true
    const role = currentRole.value
    return role === 'Admin' || role === 'Auditor'
  }

  /**
   * Check if user can access administration section
   */
  const canAccessAdmin = computed(() => {
    return isSuperAdmin.value || canAccessModule('users')
  })

  /**
   * Check if user can manage users / access System Administration.
   * PHASE BBBC (Task E, decision 2): SuperAdmin by default; an Admin qualifies ONLY with an
   * explicit 'users' module grant (override === true) — not by role alone.
   */
  const canManageUsers = computed(() => {
    return isSuperAdmin.value || moduleOverrides.value['users'] === true
  })

  return {
    // Role checks
    isSuperAdmin,
    isAdmin,
    isStaff,
    isContractor,
    currentRole,
    rankLevel,

    // Module access (for sidebar filtering)
    canAccessModule,
    moduleOverrides,
    moduleLevels,
    moduleAssignments,

    // Permission checks
    getModulePermissions,
    canView,
    canAdd,
    canEdit,
    canDelete,
    canApprove,
    canViewActivityLog,

    // Special permissions
    canAccessAdmin,
    canManageUsers,
  }
}
