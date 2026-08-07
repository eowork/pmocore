/**
 * PHASE BBBA (BBBA-3b) — access-request levels.
 *
 * Levels are ADVISORY labels over the existing role + permissions (R-293). They are recorded on
 * the request for admin intent/audit; actual CRUD within a module follows the user's role tier
 * until Phase-2 per-action enforcement ships. NOT a new enforcement schema.
 */
export enum AccessLevel {
  VIEWER = 'Viewer',
  CONTRIBUTOR = 'Contributor',
  APPROVER = 'Approver',
  MANAGER = 'Manager',
}

export const ACCESS_LEVEL_VALUES: string[] = Object.values(AccessLevel);

/**
 * Modules a user can request access to. Must match `user_permission_overrides.module_key`
 * and the keys the `ModuleAccessGuard` / `usePermissions.canAccessModule` enforce.
 */
export const ACCESS_REQUEST_MODULE_VALUES: string[] = [
  'coi',
  'repairs',
  'university_operations',
];

// PHASE BBBC (Track 8b): level → permitted actions. Module ENTRY is separate (can_access);
// these govern CRUD within a module for non-admin users.
const LEVEL_ACTIONS: Record<string, Set<string>> = {
  [AccessLevel.VIEWER]: new Set(['read']),
  [AccessLevel.CONTRIBUTOR]: new Set(['read', 'create', 'update']),
  [AccessLevel.APPROVER]: new Set([
    'read',
    'create',
    'update',
    'approve',
    'publish',
  ]),
  [AccessLevel.MANAGER]: new Set([
    'read',
    'create',
    'update',
    'approve',
    'publish',
    'delete',
  ]),
};

export type ModuleAction = 'read' | 'create' | 'update' | 'delete';

export function levelAllowsAction(
  level: string | null | undefined,
  action: string,
): boolean {
  if (!level) return false;
  return LEVEL_ACTIONS[level]?.has(action) ?? false;
}

export function actionForHttpMethod(method: string): ModuleAction {
  switch ((method || '').toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}
