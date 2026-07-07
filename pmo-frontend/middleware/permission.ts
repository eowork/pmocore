/**
 * Permission Middleware
 *
 * Checks if user has permission to access specific routes.
 * Works in conjunction with auth middleware - auth checks authentication,
 * this checks authorization (role-based access).
 *
 * SECURITY: Backend must still enforce permissions. This is UX enhancement only.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { canManageUsers, isSuperAdmin, isAdmin, canAdd, canEdit, isContractor, canApprove } = usePermissions()

  // QB: Contractor route isolation — allow only /dashboard, /coi, /login, /contractor paths
  if (isContractor.value) {
    // TB: Block project creation routes for contractors before prefix check
    const contractorCreationBlocked = ['/coi/new']
    if (contractorCreationBlocked.some(p => to.path === p)) {
      console.warn(`[Permission] Contractor blocked from creation route: ${to.path}`)
      return navigateTo('/dashboard')
    }
    // XC-A: Redirect contractors from edit routes to the read-only detail page.
    // Contractors are read-only users; the edit page is an authoring surface.
    // This guard fires before the allowlist so the early-return below cannot bypass it.
    const editMatch = to.path.match(/^\/coi\/edit-(.+)/)
    if (editMatch) {
      return navigateTo(`/coi/detail-${editMatch[1]}`)
    }
    const allowedPrefixes = ['/dashboard', '/coi', '/login', '/contractor']
    const allowed = allowedPrefixes.some(prefix => to.path === prefix || to.path.startsWith(prefix + '/') || to.path.startsWith(prefix + '?'))
    if (!allowed) {
      console.warn(`[Permission] Contractor access denied to ${to.path} — redirecting to /dashboard`)
      return navigateTo('/dashboard')
    }
    return // Skip all other guards for contractors
  }

  // PHASE BBBE (Track 2 / Task H): module VIEW routes (/coi, /repairs, /university-operations and
  // their detail pages) are open to all authenticated users — the dashboard/list/analytics/overview
  // are universally viewable. WRITE routes (/coi/new, /coi/edit-*, …) remain gated by canAdd/canEdit
  // below (level-based), and the backend ModuleAccessGuard is authoritative. The former BBBA-1b
  // default-deny view redirect was removed (it caused the broken-dashboard 403 UX, R-342/R-344).

  // User management routes: SuperAdmin or Admin with canManageUsers permission
  if (to.path.startsWith('/users')) {
    if (!canManageUsers.value && !isSuperAdmin.value) {
      console.warn('[Permission] Access denied to /users - insufficient permissions')
      return navigateTo('/dashboard')
    }
  }

  // PHASE BBCH (Track 1, R-372): the review queue is open to approval authority (Admin OR a
  // module-level Approver/Manager). Carve it out before the broad /admin admin-only guard so a
  // non-admin approver can reach it by URL; per-item actions stay gated by canApprove(item.module).
  if (to.path.startsWith('/admin/pending-reviews')) {
    const canReviewAny =
      isSuperAdmin.value ||
      canManageUsers.value ||
      canApprove('coi') ||
      canApprove('repairs') ||
      canApprove('university_operations')
    if (!canReviewAny) {
      console.warn('[Permission] Access denied to /admin/pending-reviews - no approval authority')
      return navigateTo('/dashboard')
    }
  }
  // T-HOME-CMS (THC-6): Homepage Management — any Admin/SuperAdmin (backend RolesGuard
  // allows the Admin role; no 'users' grant required). Carved out before the broad
  // /admin guard, which additionally demands canManageUsers.
  else if (to.path.startsWith('/admin/homepage-management')) {
    if (!isAdmin.value && !isSuperAdmin.value) {
      console.warn('[Permission] Access denied to /admin/homepage-management - insufficient permissions')
      return navigateTo('/dashboard')
    }
  }
  // Admin-only routes (everything else under /admin)
  else if (to.path.startsWith('/admin')) {
    if (!isSuperAdmin.value && !canManageUsers.value) {
      console.warn('[Permission] Access denied to /admin - insufficient permissions')
      return navigateTo('/dashboard')
    }
  }

  // MMM-F: COI Activity Logs — Admin/SuperAdmin only (backend enforces via RolesGuard;
  // this is the UX-layer guard so non-admins cannot reach the page by direct URL).
  if (to.path.startsWith('/coi/activity-logs')) {
    if (!isAdmin.value && !isSuperAdmin.value) {
      console.warn('[Permission] Access denied to /coi/activity-logs - insufficient permissions')
      return navigateTo('/dashboard')
    }
  }

  // Phase HU: University Operations sub-module guards (Directives 213–215)
  // Admins/SuperAdmins bypass — only restrict Staff with explicit can_access=false overrides
  if (!isAdmin.value && !isSuperAdmin.value) {
    const uoSubModuleGuards = [
      { path: '/university-operations/physical', key: 'university-operations-physical' },
      { path: '/university-operations/financial', key: 'university-operations-financial' },
    ]

    const authStore = useAuthStore()
    for (const { path: guardPath, key } of uoSubModuleGuards) {
      if (to.path.startsWith(guardPath)) {
        const overrides = authStore.user?.moduleOverrides || {}
        if (key in overrides && overrides[key] === false) {
          console.warn(`[Permission] Access denied to ${guardPath} - module override ${key}=false`)
          return navigateTo('/dashboard')
        }
        break
      }
    }
  }

  // Project module edit routes - check canEdit permission
  const editRoutePatterns = [
    { pattern: /^\/coi\/edit-/, module: 'coi' },
    { pattern: /^\/repairs\/edit-/, module: 'repairs' },
    { pattern: /^\/university-operations\/edit-/, module: 'university_operations' },
    { pattern: /^\/contractors\/edit-/, module: 'contractors' },
    { pattern: /^\/funding-sources\/edit-/, module: 'funding_sources' },
  ]

  for (const { pattern, module } of editRoutePatterns) {
    if (pattern.test(to.path)) {
      if (!canEdit(module)) {
        console.warn(`[Permission] Access denied to ${to.path} - cannot edit ${module}`)
        return navigateTo('/dashboard')
      }
      break
    }
  }

  // Project module create routes - check canAdd permission
  const createRoutePatterns = [
    { path: '/coi/new', module: 'coi' },
    { path: '/repairs/new', module: 'repairs' },
    { path: '/university-operations/new', module: 'university_operations' },
    { path: '/contractors/new', module: 'contractors' },
    { path: '/funding-sources/new', module: 'funding_sources' },
  ]

  for (const { path, module } of createRoutePatterns) {
    if (to.path === path) {
      if (!canAdd(module)) {
        console.warn(`[Permission] Access denied to ${path} - cannot add ${module}`)
        return navigateTo('/dashboard')
      }
      break
    }
  }
})
