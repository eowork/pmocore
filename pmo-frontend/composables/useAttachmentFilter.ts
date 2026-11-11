/**
 * ZY-1: useAttachmentFilter — file search inside one repository (CiRepositoryModal).
 *
 * Finding WHICH repository to open is useDocumentTypeSearch's job (the hub's search box,
 * matching document types). Once a repository is open, this narrows its uploaded files by
 * file name, description, and document type label/code.
 */

export interface FilterableDoc {
  fileName?: string
  description?: string
  documentType?: string
}

export function useAttachmentFilter() {
  // v-text-field's clear button writes null, not ''.
  const searchText = ref<string | null>('')

  const query = computed(() => (searchText.value ?? '').trim().toLowerCase())
  const isActive = computed(() => query.value.length > 0)

  /**
   * @param typeLabel Human-readable label of the document's type. Users search by what the
   *   UI shows ("Feasibility Study"), not by the stored code, which for custom sections is
   *   an opaque `CKS_<uuid>`.
   */
  function matchesDoc(doc: FilterableDoc, typeLabel?: string): boolean {
    if (!query.value) return true
    return [doc.fileName, doc.description, typeLabel, doc.documentType]
      .some((f) => (f ?? '').toLowerCase().includes(query.value))
  }

  function reset() {
    searchText.value = ''
  }

  return { searchText, query, isActive, matchesDoc, reset }
}
