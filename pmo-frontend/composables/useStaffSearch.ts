/**
 * Server-side search over the users eligible for record assignment.
 *
 * `/api/users/eligible-for-assignment` takes an optional `search` term and matches it against
 * first name, last name and email. Every picker used to fetch the whole active-user list once
 * and filter it in the browser, which meant each one could only match what it rendered — the
 * name — so typing an email found nothing, and the full table was pulled on every page load.
 */
export interface StaffUser {
  id: string
  first_name: string
  last_name: string
  email?: string
  campus?: string
}

export interface UseStaffSearchOptions {
  /**
   * Ids that must survive a narrower search: whatever the field currently has selected. A
   * result set that no longer contains a selected user leaves the autocomplete rendering a
   * blank chip, and any code that looks the selection up in the list stops finding it.
   */
  heldIds?: () => string[]
  /** How long to wait after the last keystroke before asking the server. */
  debounceMs?: number
}

export function useStaffSearch(options: UseStaffSearchOptions = {}) {
  const api = useApi()
  const { heldIds = () => [], debounceMs = 300 } = options

  const staffUsers = ref<StaffUser[]>([])
  const staffLoading = ref(false)
  /**
   * The term the current contents of staffUsers were fetched for, or null when nothing has
   * been loaded yet. Vuetify re-emits update:search when an item is picked, and this is what
   * stops that from firing a second identical request.
   */
  const staffLoadedTerm = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function loadStaff(search = ''): Promise<void> {
    const term = search.trim()
    if (staffLoadedTerm.value === term) return

    staffLoading.value = true
    staffLoadedTerm.value = term
    try {
      const query = term ? `?search=${encodeURIComponent(term)}` : ''
      const res = await api.get<StaffUser[]>(`/api/users/eligible-for-assignment${query}`)
      const rows = Array.isArray(res) ? res : []

      const byId = new Map(rows.map(u => [u.id, u]))
      const held = new Set(heldIds())
      for (const user of staffUsers.value) {
        if (held.has(user.id) && !byId.has(user.id)) byId.set(user.id, user)
      }
      staffUsers.value = [...byId.values()]
    } catch {
      // Leave the previous results in place, and allow the same term to be retried.
      staffLoadedTerm.value = null
    } finally {
      staffLoading.value = false
    }
  }

  /** Debounced, so typing a name is one request rather than one per character. */
  function onStaffSearch(search: string | null): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void loadStaff(search ?? '') }, debounceMs)
  }

  /**
   * The first focus populates the list; after that the search term decides what is fetched,
   * so focusing the field again must not throw away the results being looked at.
   */
  function onStaffFocus(focused: boolean): void {
    if (focused && staffLoadedTerm.value === null) void loadStaff()
  }

  onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

  return { staffUsers, staffLoading, staffLoadedTerm, loadStaff, onStaffSearch, onStaffFocus }
}
