/**
 * Read every page of a paginated list endpoint.
 *
 * The list endpoints answer with `{ data, meta }` and default to 20 rows. A caller that
 * requests the bare URL gets those 20 and nothing else — which is invisible when the page
 * then paginates in the browser, because the pager reports the rows it was handed rather
 * than the rows that exist.
 *
 * This is for pages that genuinely work over the whole set in the browser: filtering,
 * sorting and paging client-side across several view modes. A page that only ever shows one
 * page of rows at a time should ask the server for that page instead (see pages/users for
 * the server-driven form).
 */
export interface ApiPage<T> {
  data?: T[]
  meta?: { total?: number; totalPages?: number }
}

export interface FetchAllPagesOptions {
  /** Rows per request. 100 is the maximum the PaginationDto allows. */
  limit?: number
  /** Ceiling on requests, so a larger-than-expected table cannot fan out without bound. */
  maxPages?: number
}

export interface FetchAllPagesResult<T> {
  rows: T[]
  /** The server's count of matching rows, which is >= rows.length when truncated. */
  total: number
  /** True when maxPages stopped the read before the last page. */
  truncated: boolean
}

export async function fetchAllPages<T>(
  get: (page: number, limit: number) => Promise<ApiPage<T>>,
  options: FetchAllPagesOptions = {},
): Promise<FetchAllPagesResult<T>> {
  const { limit = 100, maxPages = 25 } = options

  const first = await get(1, limit)
  const rows = [...(first.data ?? [])]
  const total = first.meta?.total ?? rows.length
  const totalPages = first.meta?.totalPages ?? 1

  const lastPage = Math.min(totalPages, maxPages)
  if (lastPage > 1) {
    // The remaining pages are independent reads, so they go out together rather than in a
    // chain. maxPages is what bounds the burst.
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) => get(i + 2, limit)),
    )
    for (const response of rest) rows.push(...(response.data ?? []))
  }

  return { rows, total, truncated: totalPages > lastPage }
}
