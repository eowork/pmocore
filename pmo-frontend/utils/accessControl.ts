/**
 * PHASE BBBA (BBBA-3b) — access-request shared constants (frontend mirror of the backend
 * AccessLevel enum + ACCESS_REQUEST_MODULE_VALUES). Levels are ADVISORY until Phase-2
 * per-action enforcement (R-293).
 */
// PHASE BBBD (Track 6): business-friendly descriptions (no raw CRUD wording) per R-330.
export const ACCESS_LEVEL_OPTIONS: { value: string; title: string; hint: string }[] = [
  { value: 'Viewer', title: 'Viewer', hint: 'View information only' },
  { value: 'Contributor', title: 'Contributor', hint: 'Add, update and submit information for review' },
  { value: 'Approver', title: 'Approver', hint: 'Review submissions, approve changes and manage records' },
  { value: 'Manager', title: 'Manager', hint: 'Full administrative control' },
]

// Self-service requesting is capped at Contributor — Approver/Manager confers approval
// authority (and, for university_operations, maps into admin/pending-reviews.vue's
// review queue), so it's never something a user can request for themselves. A
// SuperAdmin grants those two levels manually per-user via users/access-[id].vue.
// Used by onboarding.vue's Request Access step.
export const SELF_SERVICE_LEVEL_OPTIONS = ACCESS_LEVEL_OPTIONS.filter(
  o => o.value === 'Viewer' || o.value === 'Contributor',
)

export const ACCESS_REQUEST_MODULE_OPTIONS: { value: string; title: string }[] = [
  { value: 'coi', title: 'Infrastructure Projects (COI)' },
  { value: 'repairs', title: 'Repair Projects' },
  { value: 'university_operations', title: 'University Operations' },
]

const _moduleTitle = new Map(ACCESS_REQUEST_MODULE_OPTIONS.map(o => [o.value, o.title]))
export function labelForAccessModule(value: string | null | undefined): string {
  if (!value) return ''
  return _moduleTitle.get(value) || value
}

export interface AccessRequest {
  id: string
  user_id: string
  requested_module: string
  requested_level: string
  justification: string | null
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  granted_level: string | null
  decision_note: string | null
  decided_by: string | null
  decided_at: string | null
  requested_at: string
  user?: { id: string; email: string; first_name: string; last_name: string } | null
}
