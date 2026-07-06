<script setup lang="ts">
// ZY-4 / ZZ-A: CiAttachmentHub — the single attachment renderer for all three
// COI pages (detail = view, edit = edit, new = staging). Owns documents,
// gallery and document-type taxonomy; renders 7 sections:
//   1 Key Documents  2 Gallery  3 Other Forms  4 Supporting Documents
//   5 Compliance Checklist  6 Other Attachments  7 Audit Log
// Directive ZY-D1: this is the ONLY place attachment sections are rendered.

import { KEY_DOC_TYPECODES, type StagedQueue } from '~/utils/coiFormState'
import { qualifyBackendUrl } from '~/utils/adapters'

interface HubDoc {
  id: string
  documentType: string
  fileName: string
  filePath: string
  fileSize?: number
  mimeType?: string
  description?: string
  category?: string
  createdAt?: string
  version?: number
  lifecycleStatus?: string
  uploadedByName?: string
  folderId?: string | null
}

interface HubGallery {
  id: string
  imageUrl: string
  caption?: string
  category?: string
  imageTakenDate?: string
  createdAt?: string
}

interface HubDocType {
  id: string
  typeCode: string
  typeLabel: string
  groupCode: string
  groupLabel: string
  isRequired: boolean
  sortOrder: number
  templateUrl?: string | null
}

interface HubDocTypeGroup {
  groupCode: string
  groupLabel: string
  types: HubDocType[]
}

interface ChecklistRemarkEntry {
  text: string
  author?: string | null
  timestamp: string
}

interface CustomKeySection {
  id: string
  label: string
  typeCode: string
}

interface Props {
  projectId?: string
  mode?: 'view' | 'edit' | 'staging'
  canUpload?: boolean
  canDelete?: boolean
  canEditRemarks?: boolean
  modelValue?: StagedQueue
  customKeySections?: CustomKeySection[]
  customSupportingSections?: CustomKeySection[]
}

const props = withDefaults(defineProps<Props>(), {
  projectId: '',
  mode: 'view',
  canUpload: false,
  canDelete: false,
  canEditRemarks: false,
  modelValue: () => ({ docs: [], images: [], links: [] }),
  customKeySections: () => [],
  customSupportingSections: () => [],
})

const emit = defineEmits<{ 'update:modelValue': [value: StagedQueue] }>()

const api = useApi()
const toast = useToast()
const filter = useAttachmentFilter()
const { public: { apiBase } } = useRuntimeConfig()

const isStaging = computed(() => props.mode === 'staging')
const hasProject = computed(() => !!props.projectId && !isStaging.value)

// ── State ───────────────────────────────────────────────────
const documents = ref<HubDoc[]>([])
const gallery = ref<HubGallery[]>([])
const docTypeGroups = ref<HubDocTypeGroup[]>([])
const loadingDocs = ref(false)
const docsError = ref<string | null>(null)   // VVV-B: surface GET /documents failures
const loadingGallery = ref(false)
const deletingDoc = reactive<Record<string, boolean>>({})
const deletingGallery = reactive<Record<string, boolean>>({})
const checklistGroupRemarks = ref<Record<string, ChecklistRemarkEntry[]>>({})

const activeSection = ref('')

// ── Staging queue proxy ─────────────────────────────────────
const queue = computed<StagedQueue>(() => props.modelValue)

// MMM-C: Immutable staging emit. Builds a fresh StagedQueue from props.modelValue
// (never mutates the computed/prop in place) so Vue's computed dependency chain
// reliably invalidates. Pass only the slice(s) being changed; the rest are cloned.
function emitStaged(next: Partial<StagedQueue>) {
  emit('update:modelValue', {
    docs: next.docs ?? [...(props.modelValue?.docs ?? [])],
    images: next.images ?? [...(props.modelValue?.images ?? [])],
    links: next.links ?? [...(props.modelValue?.links ?? [])],
  })
}

// ── Taxonomy maps ───────────────────────────────────────────
const allDocTypes = computed<HubDocType[]>(() =>
  docTypeGroups.value.flatMap((g) => g.types),
)
const typeCodeToLabel = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  allDocTypes.value.forEach((t) => { m[t.typeCode] = t.typeLabel })
  return m
})
function codesForGroup(groupCode: string): string[] {
  return (docTypeGroups.value.find((g) => g.groupCode === groupCode)?.types ?? []).map((t) => t.typeCode)
}

// LLL-F: Build the seeded official-template list for a group (only types with a templateUrl).
function seededTemplatesForGroup(groupCode: string): Array<{ code: string; label: string; url: string }> {
  return (docTypeGroups.value.find((g) => g.groupCode === groupCode)?.types ?? [])
    .filter((t) => !!t.templateUrl)
    .map((t) => ({ code: t.typeCode, label: t.typeLabel, url: t.templateUrl as string }))
}
const sdOrdersTemplates = computed(() => seededTemplatesForGroup('SD_ORDERS'))
const sdReportsTemplates = computed(() => seededTemplatesForGroup('SD_REPORTS'))
const sdCertsTemplates = computed(() => seededTemplatesForGroup('SD_CERTS'))
const ecoFormsTemplates = computed(() => seededTemplatesForGroup('ECO_FORMS'))

const keyCodes = KEY_DOC_TYPECODES as readonly string[]
const ecoFormCodes = computed(() => codesForGroup('ECO_FORMS'))
const sdOrdersCodes = computed(() => codesForGroup('SD_ORDERS'))
const sdReportsCodes = computed(() => codesForGroup('SD_REPORTS'))
const sdCertsCodes = computed(() => codesForGroup('SD_CERTS'))
const cpesTypes = computed(() => docTypeGroups.value.find((g) => g.groupCode === 'CPES_DOCS')?.types ?? [])
const cpesCodes = computed(() => cpesTypes.value.map((t) => t.typeCode))

// Repository-managed = key docs + ECO forms + all SD groups + CPES.
const managedCodes = computed(() => new Set<string>([
  ...keyCodes,
  ...codesForGroup('ECO_FORMS'),
  ...sdOrdersCodes.value,
  ...sdReportsCodes.value,
  ...sdCertsCodes.value,
  ...cpesCodes.value,
  ...customSections.value.map((s) => s.typeCode),
]))

// ── Document partitions ─────────────────────────────────────
const stagedDocs = computed<HubDoc[]>(() =>
  queue.value.docs.map((d, i) => ({
    id: `staged-${i}`,
    documentType: d.documentType,
    fileName: d.file.name,
    filePath: '',
    description: d.description,
  })),
)
const allDocs = computed<HubDoc[]>(() =>
  isStaging.value ? stagedDocs.value : documents.value,
)

const isLink = (d: HubDoc) =>
  d.mimeType === 'application/x-google-drive-link' ||
  d.mimeType === 'application/x-external-link' ||
  d.documentType === 'link'

const otherDocs = computed(() =>
  allDocs.value.filter((d) => !managedCodes.value.has(d.documentType) && !isLink(d) && filter.matchesDoc(d)),
)
const documentLinks = computed(() => allDocs.value.filter((d) => isLink(d) && filter.matchesDoc(d)))

// ── Repository card stats ───────────────────────────────────
function repoStats(codes: string[]) {
  const docs = allDocs.value.filter((d) => codes.includes(d.documentType))
  const completed = new Set(docs.map((d) => d.documentType)).size
  const latest = docs.reduce<string | null>((acc, d) => {
    if (!d.createdAt) return acc
    return !acc || d.createdAt > acc ? d.createdAt : acc
  }, null)
  return { docCount: docs.length, completedCount: completed, totalTypes: codes.length, latestUpload: latest }
}
// MMM-E: ecoStats removed — the Other Forms flat CiRepositoryCard was replaced by
// the CiFolderRepository, which computes its own stats.

// ── Shared repository modal ─────────────────────────────────
const repoModalOpen = ref(false)
const repoExpandUpload = ref(false)
const activeRepo = ref<{ title: string; icon: string; color: string; typeCodes: string[] }>({
  title: '', icon: '', color: 'primary', typeCodes: [],
})
function openRepo(title: string, icon: string, color: string, typeCodes: string[], expand = false) {
  activeRepo.value = { title, icon, color, typeCodes }
  repoExpandUpload.value = expand
  repoModalOpen.value = true
}
// WWW-C: open Miscellaneous using sentinel so activeRepoDocs returns otherDocs
function openMiscRepo(expand = false) {
  openRepo('Miscellaneous & Uncategorized', 'mdi-paperclip', 'blue-grey', ['__MISC__'], expand)
}
const miscLatestUpload = computed(() =>
  otherDocs.value.length > 0 ? (otherDocs.value[0].createdAt ?? null) : null,
)
const activeRepoDocs = computed(() => {
  // WWW-C: '__MISC__' sentinel → return all non-managed docs (otherDocs / Miscellaneous)
  if (activeRepo.value.typeCodes[0] === '__MISC__') return otherDocs.value as HubDoc[]
  return allDocs.value.filter((d) => activeRepo.value.typeCodes.includes(d.documentType))
})
const activeRepoStaged = computed(() =>
  queue.value.docs
    .map((d, i) => ({ tempId: String(i), documentType: d.documentType, fileName: d.file.name }))
    .filter((s) => activeRepo.value.typeCodes.includes(s.documentType)),
)

// ── Fetch ───────────────────────────────────────────────────
async function fetchDocuments() {
  if (!hasProject.value) return
  loadingDocs.value = true
  docsError.value = null
  try {
    const res = await api.get<{ data: HubDoc[] }>(`/api/construction-projects/${props.projectId}/documents`)
    documents.value = res.data || []
  } catch (err: unknown) {
    console.error('[CiAttachmentHub] fetch documents failed:', err)
    // VVV-B: never let a failed load masquerade as an empty repository
    docsError.value = (err as { message?: string })?.message || 'Failed to load documents. Please retry.'
  } finally {
    loadingDocs.value = false
  }
}
async function fetchGallery() {
  if (!hasProject.value) return
  loadingGallery.value = true
  try {
    const res = await api.get<{ data: HubGallery[] }>(`/api/construction-projects/${props.projectId}/gallery`)
    gallery.value = (res.data || []).map((img) => ({ ...img, imageUrl: qualifyBackendUrl(img.imageUrl, apiBase) }))
  } catch (err) {
    console.error('[CiAttachmentHub] fetch gallery failed:', err)
  } finally {
    loadingGallery.value = false
  }
}
async function fetchDocTypes() {
  try {
    const res = await api.get<HubDocTypeGroup[] | { data: HubDocTypeGroup[] }>(
      '/api/construction-projects/document-types/grouped',
    )
    const raw: HubDocTypeGroup[] = Array.isArray(res) ? res : (res?.data || [])
    docTypeGroups.value = raw.map((g) => ({
      ...g,
      types: g.types.map((t) => ({
        ...t,
        templateUrl: qualifyBackendUrl(t.templateUrl, apiBase) || null,
      })),
    }))
  } catch (err) {
    console.error('[CiAttachmentHub] fetch grouped doc types failed:', err)
    docTypeGroups.value = []
  }
}

function normalizeChecklistRemarks(raw: unknown): Record<string, ChecklistRemarkEntry[]> {
  const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {}
  const normalized: Record<string, ChecklistRemarkEntry[]> = {}
  Object.entries(source).forEach(([groupCode, value]) => {
    if (Array.isArray(value)) {
      normalized[groupCode] = value
        .map((entry: any) => ({
          text: String(entry?.text ?? '').trim(),
          author: entry?.author ? String(entry.author) : null,
          timestamp: String(entry?.timestamp ?? ''),
        }))
        .filter((entry) => entry.text.length > 0)
    } else if (typeof value === 'string' && value.trim()) {
      normalized[groupCode] = [{ text: value.trim(), author: null, timestamp: '' }]
    }
  })
  return normalized
}

async function fetchChecklistRemarks() {
  if (!hasProject.value) return
  try {
    const res = await api.get<any>(`/api/construction-projects/${props.projectId}`)
    checklistGroupRemarks.value = normalizeChecklistRemarks(res?.documentChecklistRemarks ?? {})
  } catch (err) {
    console.error('[CiAttachmentHub] fetch checklist remarks failed:', err)
    checklistGroupRemarks.value = {}
  }
}

// ── Upload / delete (mode-aware) ────────────────────────────
async function persistDoc(payload: { file: File; documentType: string; title?: string; description?: string }) {
  if (payload.file.size > 20 * 1024 * 1024) { toast.error('File exceeds 20 MB'); return }
  if (isStaging.value) {
    emitStaged({
      docs: [
        ...(props.modelValue?.docs ?? []),
        {
          file: payload.file,
          documentType: payload.documentType,
          description: payload.description || payload.title || '',
        },
      ],
    })
    return
  }
  try {
    const fd = new FormData()
    fd.append('file', payload.file)
    fd.append('documentType', payload.documentType)
    if (payload.title) fd.append('title', payload.title)
    if (payload.description) fd.append('description', payload.description)
    await api.upload(`/api/construction-projects/${props.projectId}/documents`, fd)
    toast.success('Document uploaded')
    await fetchDocuments()
    // SSS-C / OOO-C: keep the compliance checklist in sync (backend auto-links on upload)
    checklistRef.value?.refresh()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Upload failed')
  }
}

async function deleteDocument(docId: string) {
  if (isStaging.value) {
    const idx = Number(docId.replace('staged-', ''))
    if (!Number.isNaN(idx)) {
      const docs = [...(props.modelValue?.docs ?? [])]
      docs.splice(idx, 1)
      emitStaged({ docs })
    }
    return
  }
  deletingDoc[docId] = true
  try {
    await api.del(`/api/construction-projects/${props.projectId}/documents/${docId}`)
    documents.value = documents.value.filter((d) => d.id !== docId)
    toast.success('Attachment removed')
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to remove attachment')
  } finally {
    deletingDoc[docId] = false
  }
}

function removeStaged(tempId: string) {
  const idx = Number(tempId)
  if (!Number.isNaN(idx)) {
    const docs = [...(props.modelValue?.docs ?? [])]
    docs.splice(idx, 1)
    emitStaged({ docs })
  }
}

// Key Documents — enterprise card definitions
const keyDocCardDefs = [
  { typeCode: 'PROJECT_PROFILE',   label: 'Project Profile',    icon: 'mdi-file-account-outline',  color: 'warning' },
  { typeCode: 'FEASIBILITY_STUDY', label: 'Feasibility Study',  icon: 'mdi-file-search-outline',   color: 'indigo' },
  { typeCode: 'HGDG_FORM',         label: 'HGDG Form',          icon: 'mdi-file-certificate-outline', color: 'teal' },
]
const primaryKeyTypeCodes = keyDocCardDefs.map((k) => k.typeCode)
const otherKeyCodes = computed(() => (keyCodes as string[]).filter((c) => !primaryKeyTypeCodes.includes(c)))

const keyDocsByType = computed<Record<string, HubDoc[]>>(() => {
  const m: Record<string, HubDoc[]> = {}
  allDocs.value.filter((d) => (keyCodes as string[]).includes(d.documentType)).forEach((d) => {
    ;(m[d.documentType] ??= []).push(d)
  })
  return m
})
const otherKeyDocCount = computed(() => allDocs.value.filter((d) => otherKeyCodes.value.includes(d.documentType)).length)
const otherKeyDocCompletedCount = computed(() => new Set(allDocs.value.filter((d) => otherKeyCodes.value.includes(d.documentType)).map((d) => d.documentType)).size)
const otherKeyLatest = computed(() => {
  const dates = allDocs.value.filter((d) => otherKeyCodes.value.includes(d.documentType)).map((d) => d.createdAt).filter((v): v is string => !!v)
  return dates.sort().at(-1) ?? null
})

const keyCardStats = computed<Record<string, ReturnType<typeof repoStats>>>(() => {
  const m: Record<string, ReturnType<typeof repoStats>> = {}
  for (const def of keyDocCardDefs) m[def.typeCode] = repoStats([def.typeCode])
  return m
})
const otherKeyStats = computed(() => repoStats(otherKeyCodes.value))

// AAA-F-3: per-project custom Key Document sections
const customSections = ref<CustomKeySection[]>([])
watch(() => props.customKeySections, (v) => { customSections.value = Array.isArray(v) ? [...v] : [] }, { immediate: true })
const customSectionStats = computed<Record<string, ReturnType<typeof repoStats>>>(() => {
  const m: Record<string, ReturnType<typeof repoStats>> = {}
  for (const s of customSections.value) m[s.typeCode] = repoStats([s.typeCode])
  return m
})
const addSectionOpen = ref(false)
const newSectionLabel = ref('')
const savingSection = ref(false)
async function saveCustomSection() {
  const label = newSectionLabel.value.trim()
  if (!label || !props.projectId) return
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const next = [...customSections.value, { id, label, typeCode: `CKS_${id}` }]
  savingSection.value = true
  try {
    await api.patch(`/api/construction-projects/${props.projectId}/custom-key-sections`, { sections: next })
    customSections.value = next
    toast.success('Section added')
    addSectionOpen.value = false
    newSectionLabel.value = ''
  } catch {
    toast.error('Failed to add section')
  } finally {
    savingSection.value = false
  }
}
async function removeCustomSection(id: string) {
  if (!props.projectId) return
  const next = customSections.value.filter((s) => s.id !== id)
  try {
    await api.patch(`/api/construction-projects/${props.projectId}/custom-key-sections`, { sections: next })
    customSections.value = next
    toast.success('Section removed')
  } catch {
    toast.error('Failed to remove section')
  }
}

// ── SSS-C: Supporting Documents repository-card model ───────────────────────
// One repository card per seeded template typeCode, grouped by category.
const supportingTemplateGroups = computed(() => [
  { key: 'SD_ORDERS',  label: 'Orders',                           icon: 'mdi-file-document-edit', color: 'deep-orange', templates: sdOrdersTemplates.value },
  { key: 'SD_REPORTS', label: 'Reports & Monitoring',             icon: 'mdi-clipboard-text',     color: 'blue',        templates: sdReportsTemplates.value },
  { key: 'SD_CERTS',   label: 'Certifications & Other Documents', icon: 'mdi-certificate',        color: 'green',       templates: sdCertsTemplates.value },
  { key: 'ECO_FORMS',  label: 'Other Forms',                      icon: 'mdi-form-select',        color: 'purple',      templates: ecoFormsTemplates.value },
])
const supportingCardStats = computed<Record<string, ReturnType<typeof repoStats>>>(() => {
  const m: Record<string, ReturnType<typeof repoStats>> = {}
  for (const g of supportingTemplateGroups.value)
    for (const t of g.templates) m[t.code] = repoStats([t.code])
  return m
})

// SSS-C: per-project custom Supporting Document folders (rendered as cards)
const customSupportingSections = ref<CustomKeySection[]>([])
watch(() => props.customSupportingSections, (v) => { customSupportingSections.value = Array.isArray(v) ? [...v] : [] }, { immediate: true })
const supportingSectionStats = computed<Record<string, ReturnType<typeof repoStats>>>(() => {
  const m: Record<string, ReturnType<typeof repoStats>> = {}
  for (const s of customSupportingSections.value) m[s.typeCode] = repoStats([s.typeCode])
  return m
})
// WWW-B: per-CPES-type repository card stats
const cpesCardStats = computed<Record<string, ReturnType<typeof repoStats>>>(() => {
  const m: Record<string, ReturnType<typeof repoStats>> = {}
  for (const t of cpesTypes.value) m[t.typeCode] = repoStats([t.typeCode])
  return m
})
const addSupportingOpen = ref(false)
const newSupportingLabel = ref('')
const savingSupporting = ref(false)
async function saveSupportingSection() {
  const label = newSupportingLabel.value.trim()
  if (!label || !props.projectId) return
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const next = [...customSupportingSections.value, { id, label, typeCode: `CSS_${id}` }]
  savingSupporting.value = true
  try {
    await api.patch(`/api/construction-projects/${props.projectId}/custom-supporting-sections`, { sections: next })
    customSupportingSections.value = next
    toast.success('Folder added')
    addSupportingOpen.value = false
    newSupportingLabel.value = ''
  } catch {
    toast.error('Failed to add folder')
  } finally {
    savingSupporting.value = false
  }
}
async function removeSupportingSection(id: string) {
  if (!props.projectId) return
  const next = customSupportingSections.value.filter((s) => s.id !== id)
  try {
    await api.patch(`/api/construction-projects/${props.projectId}/custom-supporting-sections`, { sections: next })
    customSupportingSections.value = next
    toast.success('Folder removed')
  } catch {
    toast.error('Failed to remove folder')
  }
}

// Other Attachments upload form
const otherDocFile = ref<File | null>(null)
const otherDocType = ref('attachment')
const otherDocTitle = ref('')
const otherDocDescription = ref('')
const otherDocFallback = [
  { title: 'Attachment', value: 'attachment' },
  { title: 'MOV', value: 'mov' },
  { title: 'Specification', value: 'specification' },
  { title: 'Contract', value: 'contract' },
  { title: 'Other', value: 'other' },
]
const otherDocTypeItems = computed(() => {
  const fromTax = allDocTypes.value
    .filter((t) => !managedCodes.value.has(t.typeCode))
    .map((t) => ({ title: `[${t.groupLabel}] ${t.typeLabel}`, value: t.typeCode }))
  return fromTax.length ? fromTax : otherDocFallback
})
const showOtherUpload = ref(false)
async function uploadOtherDoc() {
  if (!otherDocFile.value) return
  await persistDoc({
    file: otherDocFile.value,
    documentType: otherDocType.value,
    title: otherDocTitle.value,
    description: otherDocDescription.value,
  })
  otherDocFile.value = null; otherDocType.value = 'attachment'; otherDocTitle.value = ''; otherDocDescription.value = ''
}

// AAA-G: gallery repository modal
const galleryModalOpen = ref(false)

async function persistGallery(file: File, caption: string, category: string, takenDate: string) {
  if (file.size > 10 * 1024 * 1024) { toast.error('Image exceeds 10 MB'); return }
  if (isStaging.value) {
    emitStaged({ images: [...(props.modelValue?.images ?? []), { file, caption, category }] })
    return
  }
  try {
    const fd = new FormData()
    fd.append('file', file)
    if (caption) fd.append('caption', caption)
    fd.append('category', category)
    if (takenDate) fd.append('image_taken_date', takenDate)
    await api.upload(`/api/construction-projects/${props.projectId}/gallery`, fd)
    toast.success('Image uploaded')
    await fetchGallery()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to upload image')
  }
}
async function deleteGalleryItem(id: string) {
  if (isStaging.value) {
    const idx = Number(id.replace('staged-img-', ''))
    if (!Number.isNaN(idx)) {
      const images = [...(props.modelValue?.images ?? [])]
      images.splice(idx, 1)
      emitStaged({ images })
    }
    return
  }
  deletingGallery[id] = true
  try {
    await api.del(`/api/construction-projects/${props.projectId}/gallery/${id}`)
    gallery.value = gallery.value.filter((g) => g.id !== id)
    toast.success('Image removed')
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to remove image')
  } finally {
    deletingGallery[id] = false
  }
}

// External links
const linkUrl = ref('')
const linkTitle = ref('')
const linkDescription = ref('')
const URL_RE = /^https?:\/\/.+/i
// MMM-C: immutable removal of a staged external link
function removeStagedLink(i: number) {
  const links = [...(props.modelValue?.links ?? [])]
  links.splice(i, 1)
  emitStaged({ links })
}
async function submitLink() {
  if (!linkUrl.value || !URL_RE.test(linkUrl.value)) { toast.error('Must be a valid URL starting with https://'); return }
  if (isStaging.value) {
    emitStaged({ links: [...(props.modelValue?.links ?? []), { url: linkUrl.value, title: linkTitle.value, description: linkDescription.value }] })
    linkUrl.value = ''; linkTitle.value = ''; linkDescription.value = ''
    return
  }
  try {
    await api.post(`/api/construction-projects/${props.projectId}/documents`, {
      documentType: 'link',
      externalLink: linkUrl.value,
      title: linkTitle.value || undefined,
      description: linkDescription.value || undefined,
    })
    toast.success('External link added')
    linkUrl.value = ''; linkTitle.value = ''; linkDescription.value = ''
    await fetchDocuments()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to add link')
  }
}

// CCC-B: checklist → repository navigation. Maps a checklist item's group to a
// hub section and, for repository-backed groups, opens the matching modal.
function onChecklistNavigate(p: { groupCode?: string; typeCode?: string }) {
  const groupToSection: Record<string, string> = {
    SD_ORDERS: 'supporting',
    SD_REPORTS: 'supporting',
    SD_CERTS: 'supporting',
    ECO_FORMS: 'supporting',
    CPES_DOCS: 'cpes',
  }
  const code = p.groupCode ?? ''
  const target = groupToSection[code]
    ?? ((keyCodes as string[]).includes(p.typeCode ?? '') ? 'key' : 'other')
  activeSection.value = target
  if (target === 'supporting' && p.typeCode) {
    const label = typeCodeToLabel.value[p.typeCode] ?? 'Supporting Documents'
    openRepo(label, 'mdi-folder-multiple-outline', 'primary', [p.typeCode])
  }
}

async function handleRemarksUpdate(groupCode: string, remarks: ChecklistRemarkEntry[] | string) {
  if (!hasProject.value) return
  const nextRemarks = Array.isArray(remarks)
    ? remarks
    : (remarks.trim() ? [{ text: remarks.trim(), author: null, timestamp: '' }] : [])
  checklistGroupRemarks.value = { ...checklistGroupRemarks.value, [groupCode]: nextRemarks }
  try {
    await api.patch(`/api/construction-projects/${props.projectId}/document-remarks`, {
      groupCode,
      remarks: nextRemarks,
    })
  } catch (err) {
    console.error('[CiAttachmentHub] save remarks failed:', err)
  }
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH')
}

// CCC-A: authenticated download with original filename; links open raw href.
async function downloadDoc(doc: HubDoc) {
  if (isLink(doc) || !hasProject.value) {
    window.open(doc.filePath, '_blank', 'noopener')
    return
  }
  try {
    await api.download(`/api/construction-projects/${props.projectId}/documents/${doc.id}/download`, doc.fileName)
  } catch {
    window.open(doc.filePath, '_blank', 'noopener')
  }
}

// ── Repository modal upload bridge ──────────────────────────
function onRepoUpload(payload: { file: File; documentType: string; title: string; description: string }) {
  void persistDoc(payload)
}

// YYY-D: repository modal link submission bridge — mimeType removed from payload
// (UploadDocumentDto does not declare mimeType; service auto-detects GDrive vs generic).
function onRepoLink(payload: { url: string; title: string; description: string }) {
  if (isStaging.value) {
    emitStaged({ links: [...(props.modelValue?.links ?? []), { url: payload.url, title: payload.title, description: payload.description }] })
    return
  }
  api.post(`/api/construction-projects/${props.projectId}/documents`, {
    documentType: activeRepo.value.typeCodes[0] === '__MISC__' ? 'attachment' : (activeRepo.value.typeCodes[0] ?? 'link'),
    externalLink: payload.url,
    title: payload.title || undefined,
    description: payload.description || undefined,
  }).then(() => {
    fetchDocuments()
    checklistRef.value?.refresh()
    toast.success('External link successfully added.')
  }).catch((err: unknown) => {
    const msg = (err as { message?: string })?.message || 'Unable to save external link.'
    toast.error(msg)
    console.error('[CiAttachmentHub] onRepoLink failed:', err)
  })
}

const sections = computed(() => {
  const base: { value: string; label: string; icon: string }[] = []
  if (hasProject.value) base.push({ value: 'checklist', label: 'Compliance Checklist', icon: 'mdi-clipboard-check-outline' })
  base.push(
    { value: 'key',        label: 'Key Documents',       icon: 'mdi-file-star-outline' },
    { value: 'gallery',    label: 'Gallery',              icon: 'mdi-image-multiple' },
    { value: 'supporting', label: 'Supporting Documents', icon: 'mdi-folder-multiple-outline' },
  )
  if (cpesTypes.value.length) base.push({ value: 'cpes', label: 'Compliance Repository', icon: 'mdi-certificate-outline' })
  base.push({ value: 'other', label: 'Miscellaneous & Uncategorized', icon: 'mdi-paperclip' })
  if (hasProject.value) base.push({ value: 'audit', label: 'Audit Log', icon: 'mdi-history' })
  return base
})

// SSS-D8: Supporting Documents now use the repository-card model (SSS-C), not the
// folder-tree. The preset CONTAINER/FORM seeding (HHH-G/PPP-C/RRR-A) is retired —
// no longer seeded on the 'supporting' watch. CiFolderRepository remains only in the
// Miscellaneous section's optional folder workspace.

// OOO-C: after a folder/document upload, refresh documents AND re-sync the
// compliance checklist (backend auto-links checklist items on upload).
const checklistRef = ref<{ refresh: () => void } | null>(null)
async function onFolderUploaded() {
  await fetchDocuments()
  checklistRef.value?.refresh()
}
function onFolderDeleted() { fetchDocuments() }

onMounted(() => {
  activeSection.value = hasProject.value ? 'checklist' : 'key'
  fetchDocTypes()
  if (hasProject.value) {
    fetchDocuments()
    fetchGallery()
    fetchChecklistRemarks()
  }
})

defineExpose({ fetchDocuments, fetchGallery })
</script>

<template>
  <div>
    <!-- Global filter bar (DDD-B: responsive grid — no label collision / clipping) -->
    <v-row dense class="mb-3 align-center">
      <v-col cols="12" sm="6" md="5">
        <v-text-field
          v-model="filter.searchText.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search attachments by name, caption, or type…"
          variant="outlined"
          density="compact"
          hide-details
          single-line
          clearable
          clear-icon="mdi-close-circle-outline"
        />
      </v-col>
      <v-col cols="6" sm="3" md="3">
        <v-text-field v-model="filter.filterDateFrom.value" type="date" label="From" variant="outlined" density="compact" hide-details style="min-width: 140px" />
      </v-col>
      <v-col cols="6" sm="3" md="3">
        <v-text-field v-model="filter.filterDateTo.value" type="date" label="To" variant="outlined" density="compact" hide-details style="min-width: 140px" />
      </v-col>
      <v-col cols="12" md="1" class="d-flex justify-end">
        <v-btn v-if="filter.activeCount.value" variant="text" size="small" prepend-icon="mdi-filter-off" @click="filter.reset()">
          Clear ({{ filter.activeCount.value }})
        </v-btn>
      </v-col>
    </v-row>

    <!-- Internal section navigation -->
    <v-tabs v-model="activeSection" color="primary" density="comfortable" show-arrows class="mb-3">
      <v-tab v-for="s in sections" :key="s.value" :value="s.value">
        <v-icon :icon="s.icon" start size="small" />{{ s.label }}
      </v-tab>
    </v-tabs>

    <!-- VVV-B: document-load error state (covers Key + Supporting Documents) -->
    <v-alert
      v-if="docsError && hasProject"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
      icon="mdi-alert-circle-outline"
    >
      <div class="d-flex align-center ga-2 flex-wrap">
        <span>{{ docsError }}</span>
        <v-spacer />
        <v-btn size="small" variant="tonal" color="error" prepend-icon="mdi-refresh" :loading="loadingDocs" @click="fetchDocuments">
          Retry
        </v-btn>
      </div>
    </v-alert>

    <v-window v-model="activeSection">
      <!-- ===== Section 1: Key Documents ===== -->
      <v-window-item value="key">
        <v-row dense>
          <v-col v-for="def in keyDocCardDefs" :key="def.typeCode" cols="12" md="6" lg="3">
            <CiRepositoryCard
              :title="def.label" :icon="def.icon" :color="def.color"
              :doc-count="keyCardStats[def.typeCode].docCount"
              :latest-upload="keyCardStats[def.typeCode].latestUpload"
              :can-upload="canUpload"
              @open="openRepo(def.label, def.icon, def.color, [def.typeCode])"
              @upload="openRepo(def.label, def.icon, def.color, [def.typeCode], true)"
            />
          </v-col>
          <v-col cols="12" md="6" lg="3">
            <CiRepositoryCard
              title="Other Key Documents" icon="mdi-file-star-outline" color="warning"
              :doc-count="otherKeyStats.docCount"
              :latest-upload="otherKeyStats.latestUpload"
              :can-upload="canUpload"
              @open="openRepo('Other Key Documents', 'mdi-file-star-outline', 'warning', otherKeyCodes)"
              @upload="openRepo('Other Key Documents', 'mdi-file-star-outline', 'warning', otherKeyCodes, true)"
            />
          </v-col>
          <v-col v-for="sec in customSections" :key="sec.id" cols="12" md="6" lg="3">
            <div class="position-relative" style="height:100%">
              <CiRepositoryCard
                :title="sec.label" icon="mdi-folder-plus-outline" color="blue-grey"
                :doc-count="customSectionStats[sec.typeCode].docCount"
                :latest-upload="customSectionStats[sec.typeCode].latestUpload"
                :can-upload="canUpload"
                @open="openRepo(sec.label, 'mdi-folder-plus-outline', 'blue-grey', [sec.typeCode])"
                @upload="openRepo(sec.label, 'mdi-folder-plus-outline', 'blue-grey', [sec.typeCode], true)"
              />
              <v-btn
                v-if="canUpload && hasProject"
                icon="mdi-close" size="x-small" variant="text" color="error"
                style="position:absolute;top:4px;right:4px"
                @click="removeCustomSection(sec.id)"
              />
            </div>
          </v-col>
          <v-col v-if="canUpload && hasProject" cols="12" md="6" lg="3">
            <v-card variant="outlined" class="d-flex align-center justify-center" style="height:100%;min-height:140px;border-style:dashed" @click="addSectionOpen = true">
              <div class="text-center text-medium-emphasis pa-4" style="cursor:pointer">
                <v-icon icon="mdi-plus-circle-outline" size="32" color="blue-grey" />
                <div class="text-body-2 mt-1">Add Section</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-alert type="info" variant="tonal" density="compact" class="mt-2">
              Key governance documents (Project Profile, Feasibility Study, HGDG Form, Plans, BOQ, POW). Open a repository to view, upload, and track each document type. PDF/DOCX up to 20 MB.
            </v-alert>
          </v-col>
        </v-row>
      </v-window-item>

      <!-- ===== Section 2: Gallery (BBB-C: thumbnail strip + Open Gallery CTA) ===== -->
      <v-window-item value="gallery">
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center ga-2 text-body-1">
            <v-icon icon="mdi-image-multiple" size="small" />Gallery
            <v-chip v-if="gallery.length" size="x-small" variant="tonal" color="grey" class="ml-1">{{ gallery.length }}</v-chip>
            <v-spacer />
            <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-folder-open-outline" @click="galleryModalOpen = true">
              Open Gallery
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <!-- XXX-E: Construction documentation guide -->
            <v-alert type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-camera-outline">
              Document site progress regularly. Photos are used for accomplishment validation, inspection evidence, and milestone verification.
            </v-alert>
            <!-- Thumbnail strip preview (first 8 images) -->
            <div v-if="gallery.length" class="d-flex flex-wrap ga-2 mb-3">
              <v-img
                v-for="img in gallery.slice(0, 8)" :key="img.id"
                :src="img.imageUrl"
                width="100" height="72" cover class="rounded cursor-pointer"
                style="flex: 0 0 auto" loading="lazy"
                @click="galleryModalOpen = true"
              />
              <div
                v-if="gallery.length > 8"
                class="d-flex align-center justify-center rounded bg-surface-variant cursor-pointer"
                style="width:100px;height:72px;flex:0 0 auto"
                @click="galleryModalOpen = true"
              >
                <span class="text-caption text-medium-emphasis">+{{ gallery.length - 8 }} more</span>
              </div>
            </div>
            <p v-else class="text-grey text-body-2 mb-3">No gallery images yet. Open the gallery to upload.</p>

            <!-- Staging queue preview (new.vue mode) -->
            <template v-if="isStaging && queue.images.length">
              <v-divider class="my-3" />
              <div class="text-overline text-medium-emphasis mb-1">STAGED IMAGES ({{ queue.images.length }})</div>
              <v-list density="compact">
                <v-list-item v-for="(im, i) in queue.images" :key="`stg-img-${i}`">
                  <template #prepend><v-icon icon="mdi-image-outline" color="orange" /></template>
                  <v-list-item-title>{{ im.file.name }}</v-list-item-title>
                  <v-list-item-subtitle>{{ im.category }}<span v-if="im.caption"> — {{ im.caption }}</span></v-list-item-subtitle>
                  <template #append><v-btn icon="mdi-close" size="small" variant="text" color="error" @click="deleteGalleryItem(`staged-img-${i}`)" /></template>
                </v-list-item>
              </v-list>
            </template>

            <!-- Upload CTA -->
            <v-alert v-if="isStaging && canUpload" type="info" variant="tonal" density="compact" class="mt-2">
              Images will be uploaded after the project is created.
              <v-btn variant="text" size="small" class="ml-2" @click="galleryModalOpen = true">Add Images</v-btn>
            </v-alert>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- ===== Section 4: Supporting Documents (SSS-C: repository-card grid, identical to Key Documents) ===== -->
      <v-window-item value="supporting">
        <template v-if="hasProject">
          <!-- One repository card per seeded template, grouped by category -->
          <template v-for="g in supportingTemplateGroups" :key="g.key">
            <div v-if="g.templates.length" class="d-flex align-center ga-2 mb-2 mt-1">
              <v-icon size="25" :color="g.color">{{ g.icon }}</v-icon>
              <span class="text-subtitle-5 font-weight-bold">{{ g.label }}</span>
              <v-chip size="x-small" variant="tonal" :color="g.color">{{ g.templates.length }}</v-chip>
            </div>
            <v-row v-if="g.templates.length" dense class="mb-3">
              <v-col v-for="t in g.templates" :key="t.code" cols="12" md="6" lg="3">
                <CiRepositoryCard
                  :title="t.label" :icon="g.icon" :color="g.color"
                  :doc-count="supportingCardStats[t.code]?.docCount ?? 0"
                  :latest-upload="supportingCardStats[t.code]?.latestUpload ?? null"
                  :template-url="t.url"
                  :can-upload="canUpload"
                  @open="openRepo(t.label, g.icon, g.color, [t.code])"
                  @upload="openRepo(t.label, g.icon, g.color, [t.code], true)"
                />
              </v-col>
            </v-row>
          </template>

          <!-- Custom Supporting Folders (rendered as repository cards) -->
          <v-divider class="my-3" />
          <div class="d-flex align-center ga-2 mb-2 mt-1">
            <v-icon size="25" color="blue-grey">mdi-folder-multiple-outline</v-icon>
            <span class="text-subtitle-1 font-weight-bold">Custom Folders</span>
            <v-chip v-if="customSupportingSections.length" size="x-small" variant="tonal" color="blue-grey">{{ customSupportingSections.length }}</v-chip>
          </div>
          <v-row dense class="mb-2">
            <v-col v-for="sec in customSupportingSections" :key="sec.id" cols="12" md="6" lg="3">
              <div class="position-relative" style="height:100%">
                <CiRepositoryCard
                  :title="sec.label" icon="mdi-folder-outline" color="blue-grey"
                  :doc-count="supportingSectionStats[sec.typeCode]?.docCount ?? 0"
                  :latest-upload="supportingSectionStats[sec.typeCode]?.latestUpload ?? null"
                  :can-upload="canUpload"
                  @open="openRepo(sec.label, 'mdi-folder-outline', 'blue-grey', [sec.typeCode])"
                  @upload="openRepo(sec.label, 'mdi-folder-outline', 'blue-grey', [sec.typeCode], true)"
                />
                <v-btn
                  v-if="canUpload"
                  icon="mdi-close" size="x-small" variant="text" color="error"
                  style="position:absolute;top:4px;right:4px"
                  @click="removeSupportingSection(sec.id)"
                />
              </div>
            </v-col>
            <v-col v-if="canUpload" cols="12" md="6" lg="3">
              <v-card variant="outlined" class="d-flex align-center justify-center" style="height:100%;min-height:140px;border-style:dashed" @click="addSupportingOpen = true">
                <div class="text-center text-medium-emphasis pa-4" style="cursor:pointer">
                  <v-icon icon="mdi-folder-plus-outline" size="32" color="blue-grey" />
                  <div class="text-body-2 mt-1">Add Folder</div>
                </div>
              </v-card>
            </v-col>
          </v-row>

          <v-alert type="info" variant="tonal" density="compact" class="mt-2">
            Each card is a dedicated repository for an official ECO support document. Open a repository to download the official template, upload submissions (version-tracked), search, and review history. PDF/DOCX/XLSX up to 20 MB.
          </v-alert>
        </template>
        <v-alert v-else type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
          Supporting-document repositories become available once the project is saved.
        </v-alert>
      </v-window-item>

      <!-- ===== Section 5: CPES Documents (WWW-B + CPES-fix: 3-col, text-wrap, guide) ===== -->
      <v-window-item v-if="cpesTypes.length" value="cpes">
        <!-- Blockquote-style guide -->
        <blockquote class="mb-4 pa-3 rounded" style="border-left:4px solid rgb(var(--v-theme-teal));background:rgba(var(--v-theme-teal),0.06)">
          <div class="d-flex align-start ga-2">
            <v-icon icon="mdi-information-outline" color="teal" size="18" class="mt-1 flex-shrink-0" />
            <div>
              <div class="text-body-2 font-weight-medium text-teal-darken-2 mb-1">How to use this repository</div>
              <div class="text-caption text-grey-darken-2">
                Each card represents a CPES documentary requirement. Open a repository to upload your accomplished document, download the official template, and track submission history.
                Uploading a document here automatically updates the <strong>Compliance Checklist</strong> status for that requirement.
              </div>
            </div>
          </div>
        </blockquote>

        <!-- 3-column grid (lg="4" → 3 cards per row on large screens) -->
        <v-row dense>
          <v-col v-for="t in cpesTypes" :key="t.typeCode" cols="12" sm="6" lg="4">
            <CiRepositoryCard
              :title="t.typeLabel"
              icon="mdi-certificate-outline"
              color="teal"
              :doc-count="cpesCardStats[t.typeCode]?.docCount ?? 0"
              :latest-upload="cpesCardStats[t.typeCode]?.latestUpload ?? null"
              :template-url="t.templateUrl ?? null"
              :can-upload="canUpload"
              @open="openRepo(t.typeLabel, 'mdi-certificate-outline', 'teal', [t.typeCode])"
              @upload="openRepo(t.typeLabel, 'mdi-certificate-outline', 'teal', [t.typeCode], true)"
            />
          </v-col>
        </v-row>
      </v-window-item>

      <!-- ===== Section 6: Compliance Checklist ===== -->
      <!-- ZZZ-B: eager ensures CiDocumentChecklist is always mounted when hasProject,
           so checklistRef.value is never null and .refresh() fires correctly after
           uploads regardless of whether the user has visited this tab. -->
      <v-window-item v-if="hasProject" value="checklist" eager>
        <CiDocumentChecklist
          ref="checklistRef"
          :project-id="projectId"
          :can-edit="canUpload"
          :documents="documents"
          :group-remarks="checklistGroupRemarks"
          :can-edit-remarks="canEditRemarks"
          :key-doc-count="allDocs.filter(d => (keyCodes as string[]).includes(d.documentType)).length"
          :supporting-doc-count="[...sdOrdersCodes, ...sdReportsCodes, ...sdCertsCodes, ...ecoFormCodes].reduce((acc, c) => acc + allDocs.filter(d => d.documentType === c).length, 0)"
          :gallery-count="gallery.length"
          :misc-doc-count="otherDocs.length"
          @remarks-update="handleRemarksUpdate"
          @navigate="onChecklistNavigate"
        />
      </v-window-item>

      <!-- ===== Section 6: Other Attachments ===== -->
      <!-- ===== Section 6b: Miscellaneous & Uncategorized (WWW-C: repository-card architecture) ===== -->
      <v-window-item value="other">
        <v-col cols="12">
            <v-alert type="info" variant="tonal" density="compact" class="mt-1" icon="mdi-information-outline">
              Documents without a recognized type are stored here. Use specific repositories (Key Documents, Supporting Documents) for structured submissions.
            </v-alert>
          </v-col>
        <!-- Repository card for all unclassified documents -->
        <v-row dense class="mb-3">
          <v-col cols="12" md="6" lg="4">
            <CiRepositoryCard
              title="Miscellaneous & Uncategorized"
              icon="mdi-paperclip"
              color="blue-grey"
              :doc-count="otherDocs.length"
              :latest-upload="miscLatestUpload"
              :can-upload="canUpload"
              @open="openMiscRepo()"
              @upload="openMiscRepo(true)"
            />
          </v-col>
          
        </v-row>

        <!-- External links (preserved) -->
        <v-divider class="my-4" />
        <div class="text-overline text-medium-emphasis mb-2">EXTERNAL LINKS</div>
        <v-list v-if="documentLinks.length" density="compact" class="mb-3">
          <v-list-item v-for="doc in documentLinks" :key="doc.id">
            <template #prepend><v-icon icon="mdi-google-drive" color="info" /></template>
            <v-list-item-title>
              <a v-if="doc.filePath" :href="doc.filePath" target="_blank" rel="noopener" class="text-decoration-none">{{ doc.fileName || doc.filePath }}</a>
              <span v-else>{{ doc.fileName }}</span>
            </v-list-item-title>
            <template #append>
              <v-btn v-if="canDelete" icon="mdi-delete" size="small" variant="text" color="error" :loading="deletingDoc[doc.id]" @click.stop="deleteDocument(doc.id)" />
            </template>
          </v-list-item>
        </v-list>
        <template v-if="isStaging && queue.links.length">
          <v-list density="compact" class="mb-3">
            <v-list-item v-for="(lk, i) in queue.links" :key="`stg-lk-${i}`">
              <template #prepend><v-icon icon="mdi-link-variant" color="orange" /></template>
              <v-list-item-title>{{ lk.title || lk.url }}</v-list-item-title>
              <template #append><v-btn icon="mdi-close" size="small" variant="text" color="error" @click="removeStagedLink(i)" /></template>
            </v-list-item>
          </v-list>
        </template>
        <v-row v-if="canUpload" dense>
          <v-col cols="12" sm="7"><v-text-field v-model="linkUrl" label="External URL" placeholder="https://..." prepend-inner-icon="mdi-link" variant="outlined" density="comfortable" hide-details /></v-col>
          <v-col cols="12" sm="3"><v-text-field v-model="linkTitle" label="Title" variant="outlined" density="comfortable" hide-details /></v-col>
          <v-col cols="12" sm="2"><v-btn color="info" block prepend-icon="mdi-link-plus" :disabled="!linkUrl" @click="submitLink">{{ isStaging ? 'Stage' : 'Add' }}</v-btn></v-col>
        </v-row>
      </v-window-item>

      <!-- ===== Section 7: Audit Log ===== -->
      <v-window-item v-if="hasProject" value="audit">
        <CiAuditLogPanel :project-id="projectId" />
      </v-window-item>
    </v-window>

    <!-- Shared repository modal -->
    <CiRepositoryModal
      v-model="repoModalOpen"
      :title="activeRepo.title"
      :icon="activeRepo.icon"
      :color="activeRepo.color"
      :type-codes="activeRepo.typeCodes"
      :doc-types="allDocTypes"
      :documents="activeRepoDocs"
      :staged="activeRepoStaged"
      :can-upload="canUpload"
      :can-delete="canDelete"
      :mode="mode"
      :expand-upload="repoExpandUpload"
      :project-id="hasProject ? projectId : ''"
      @upload="onRepoUpload"
      @link="onRepoLink"
      @delete="deleteDocument"
      @remove-staged="removeStaged"
    />

    <!-- AAA-G: Gallery repository modal -->
    <CiGalleryModal
      v-model="galleryModalOpen"
      :project-id="projectId"
      title="Project Gallery"
      :images="gallery"
      :can-upload="canUpload"
      :can-delete="canDelete"
      :mode="mode"
      @upload="persistGallery"
      @delete="deleteGalleryItem"
    />

    <!-- AAA-F-3: Add custom Key Document section -->
    <v-dialog v-model="addSectionOpen" max-width="420">
      <v-card>
        <v-card-title class="text-body-1">Add Key Document Section</v-card-title>
        <v-divider />
        <v-card-text>
          <v-text-field
            v-model="newSectionLabel"
            label="Section name"
            placeholder="e.g. Permits & Clearances"
            variant="outlined"
            density="comfortable"
            autofocus
            hide-details
            @keyup.enter="saveCustomSection"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addSectionOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingSection" :disabled="!newSectionLabel.trim()" @click="saveCustomSection">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SSS-C: Add custom Supporting Document folder -->
    <v-dialog v-model="addSupportingOpen" max-width="420">
      <v-card>
        <v-card-title class="text-body-1">Add Supporting Document Folder</v-card-title>
        <v-divider />
        <v-card-text>
          <v-text-field
            v-model="newSupportingLabel"
            label="Folder name"
            placeholder="e.g. Notice to Proceed"
            variant="outlined"
            density="comfortable"
            autofocus
            hide-details
            @keyup.enter="saveSupportingSection"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addSupportingOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingSupporting" :disabled="!newSupportingLabel.trim()" @click="saveSupportingSection">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }
</style>
