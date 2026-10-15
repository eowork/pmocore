import type { ComputedRef, Ref } from 'vue'

export type ProjectCodeStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'error'

/** The shape the form field renders from — one object so it travels as a single prop. */
export interface ProjectCodeCheck {
  status: ProjectCodeStatus
  message: string | null
  suggestions: string[]
}

interface ProjectCodeConflict {
  scope: 'construction_project' | 'project'
  project_id: string
  title: string
  deleted: boolean
}

interface ProjectCodeAvailabilityResponse {
  code: string
  available: boolean
  conflict: ProjectCodeConflict | null
  recommended: string | null
  suggestions: string[]
}

// Long enough that a code is typed out rather than probed character by character, short
// enough that the answer is there before the user reaches for the next field.
const DEFAULT_DEBOUNCE_MS = 500

/**
 * Live availability of a construction project code.
 *
 * The endpoint is NOT called per keystroke: typing restarts a debounce timer and only the
 * pause at the end sends a request. Leaving the field (`checkNow`) skips the remaining wait,
 * and a code that was already answered is not asked about again.
 *
 * Responses are matched against the request that is still current, so a slow answer for an
 * earlier code cannot overwrite the answer for what is in the field now.
 */
export function useProjectCodeAvailability(
  code: Ref<string> | ComputedRef<string>,
  options: { debounceMs?: number } = {},
) {
  const api = useApi()
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  const status = ref<ProjectCodeStatus>('idle')
  const message = ref<string | null>(null)
  const suggestions = ref<string[]>([])

  let timer: ReturnType<typeof setTimeout> | null = null
  let requestCount = 0
  let lastChecked: string | null = null

  const state = computed<ProjectCodeCheck>(() => ({
    status: status.value,
    message: message.value,
    suggestions: suggestions.value,
  }))

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** Drop any pending work and go back to saying nothing about the code. */
  function reset() {
    clearTimer()
    // Bumping the counter orphans whatever request is in flight, so its answer is ignored.
    requestCount++
    lastChecked = null
    status.value = 'idle'
    message.value = null
    suggestions.value = []
  }

  function describeConflict(code: string, conflict: ProjectCodeConflict | null): string {
    if (!conflict) return `Project code ${code} is already in use.`
    if (conflict.deleted) {
      // A soft-deleted project keeps its code reserved — the backend refuses to reuse it —
      // so saying only "already in use" would send the user hunting for a project they
      // cannot find in any list.
      return `Project code ${code} belongs to a deleted project (${conflict.title}) and stays reserved.`
    }
    if (conflict.scope === 'project') {
      return `Project code ${code} is already used by another module's project (${conflict.title}).`
    }
    return `Project code ${code} is already used by ${conflict.title}.`
  }

  async function run(value: string) {
    const requestId = ++requestCount
    status.value = 'checking'
    message.value = null
    suggestions.value = []

    try {
      const result = await api.get<ProjectCodeAvailabilityResponse>(
        `/api/construction-projects/code/availability?code=${encodeURIComponent(value)}`,
      )
      if (requestId !== requestCount) return
      lastChecked = value

      if (result.available) {
        status.value = 'available'
        message.value = 'Project code is available.'
        suggestions.value = []
        return
      }
      status.value = 'taken'
      message.value = describeConflict(value, result.conflict)
      suggestions.value = result.suggestions ?? []
    } catch {
      if (requestId !== requestCount) return
      // A failed check must not block the form: the code is validated again on save, which
      // is the check that actually decides.
      lastChecked = null
      status.value = 'error'
      message.value = 'Could not check this code right now; it will be verified on save.'
      suggestions.value = []
    }
  }

  function schedule(value: string, immediate: boolean) {
    clearTimer()
    const trimmed = (value ?? '').trim()

    if (!trimmed) {
      reset()
      return
    }
    // Already answered — re-asking on every blur would be a request per focus change.
    if (trimmed === lastChecked && status.value !== 'error') return

    if (immediate) {
      void run(trimmed)
      return
    }
    // Shown straight away so the field never looks settled while a check is still owed.
    status.value = 'checking'
    message.value = null
    suggestions.value = []
    timer = setTimeout(() => {
      timer = null
      void run(trimmed)
    }, debounceMs)
  }

  /** Check now rather than waiting out the debounce — for blur, or before a save. */
  function checkNow() {
    schedule(code.value, true)
  }

  watch(code, (value) => schedule(value, false))

  onScopeDispose(clearTimer)

  return { state, status, message, suggestions, checkNow, reset }
}
