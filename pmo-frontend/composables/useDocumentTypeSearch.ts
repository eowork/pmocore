/**
 * useDocumentTypeSearch — the COI attachment hub's search box.
 *
 * The hub shows one repository card per document type, spread across section tabs. This
 * search finds the CARDS (document types), not individual uploaded files: typing
 * "feasibility" surfaces the Feasibility Study repository so it can be opened directly.
 * Searching files inside a repository is the repository modal's job (useAttachmentFilter).
 *
 * Matching runs server-side through GET /construction-projects/document-types?search=,
 * which matches group label, type code and type label (case-insensitive, active types only).
 * Requests are debounced, and a response that arrives after a newer one is discarded so a
 * slow early request can never overwrite the results for what the user typed last.
 *
 * If the request fails, `failed` is set and the caller falls back to matching the taxonomy it
 * already holds, so search keeps working (minus server-side matching) instead of going blank.
 */

export interface DocTypeHit {
  id: string
  typeCode: string
  typeLabel: string
  groupCode: string
  groupLabel: string
  sortOrder: number
  templateUrl?: string | null
}

export function useDocumentTypeSearch(options: { debounceMs?: number } = {}) {
  const debounceMs = options.debounceMs ?? 300
  const api = useApi()

  // v-text-field's clear button writes null, not ''.
  const searchText = ref<string | null>('')
  const query = computed(() => (searchText.value ?? '').trim())
  const isActive = computed(() => query.value.length > 0)

  const hits = ref<DocTypeHit[]>([])
  const loading = ref(false)
  const failed = ref(false)

  let seq = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function run(q: string) {
    const mySeq = ++seq
    loading.value = true
    try {
      const params = new URLSearchParams({ search: q })
      const res = await api.get<DocTypeHit[] | { data: DocTypeHit[] }>(
        `/api/construction-projects/document-types?${params.toString()}`,
      )
      if (mySeq !== seq) return // a newer query has been issued; drop this stale result
      hits.value = Array.isArray(res) ? res : (res?.data ?? [])
      failed.value = false
    } catch (err) {
      if (mySeq !== seq) return
      console.error('[useDocumentTypeSearch] search failed:', err)
      hits.value = []
      failed.value = true
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  watch(query, (q) => {
    clearTimeout(timer)
    if (!q) {
      seq++ // invalidate any request still in flight
      hits.value = []
      loading.value = false
      failed.value = false
      return
    }
    loading.value = true
    timer = setTimeout(() => { void run(q) }, debounceMs)
  })

  onBeforeUnmount(() => clearTimeout(timer))

  function reset() {
    searchText.value = ''
  }

  return { searchText, query, isActive, hits, loading, failed, reset }
}
