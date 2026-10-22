<script setup lang="ts">
// KB-E: CPES Document Compliance Checklist
// KV-B: adds documents prop + linked-file download chip + document picker in edit dialog
// KV-C: accordion shows submission count + file count + missing count + latest date
// KV-D3: per-group remarks field (admin-editable, emits remarksUpdate event)

interface DocumentItem {
  id: string
  fileName: string
  filePath: string
  documentType?: string
  mimeType?: string
}

interface Props {
  projectId: string
  canEdit: boolean
  documents?: DocumentItem[]
  groupRemarks?: Record<string, GroupRemarkEntry[]>
  canEditRemarks?: boolean
  // Whether a submission may be dragged onto a different document type. Backed by the
  // canEdit project permission the endpoint itself enforces.
  canMove?: boolean
  // WWW-G: cross-section summary counters from CiAttachmentHub
  keyDocCount?: number
  supportingDocCount?: number
  galleryCount?: number
  miscDocCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  documents: () => [],
  groupRemarks: () => ({}),
  canEditRemarks: false,
  canMove: false,
  keyDocCount: 0,
  supportingDocCount: 0,
  galleryCount: 0,
  miscDocCount: 0,
})

const emit = defineEmits<{
  remarksUpdate: [groupCode: string, remarks: GroupRemarkEntry[]]
  navigate: [payload: { groupCode?: string; typeCode?: string }]
  moved: [payload: { fromItemId: string; toItemId: string }]
}>()

const api = useApi()
const toast = useToast()

interface DocumentType {
  id: string
  groupCode: string
  groupLabel: string
  typeCode: string
  typeLabel: string
  isRequired: boolean
  sortOrder: number
  templateUrl?: string | null
}

interface ChecklistItem {
  id: string
  projectId: string
  documentTypeId: string
  submissionStatus: 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISED'
  submittedBy?: string | null
  submittedAt?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNotes?: string | null
  currentVersion: number
  expiryDate?: string | null
  linkedDocumentId?: string | null
  remarks?: string | null
  documentType?: DocumentType
}

interface GroupRemarkEntry {
  text: string
  author?: string | null
  timestamp: string
}

const items = ref<ChecklistItem[]>([])
const loading = ref(false)
const updating = ref<Record<string, boolean>>({})
const groupRemarkDrafts = ref<Record<string, string>>({})
const localGroupRemarks = ref<Record<string, GroupRemarkEntry[]>>({})

const dialog = ref(false)
const editing = ref<ChecklistItem | null>(null)
const submitting = ref(false)
const form = ref({
  submission_status: 'NOT_SUBMITTED' as ChecklistItem['submissionStatus'],
  review_notes: '',
  expiry_date: '',
  linked_document_id: '',
})

// HHH-H: List-based per-item remarks
const authStore = useAuthStore()
const draftRemark = ref<Record<string, string>>({})
const savingRemark = reactive<Record<string, boolean>>({})

// MMM-D: per-item remark editor visibility (toggled from the kebab "Remarks" action)
const showRemark = reactive<Record<string, boolean>>({})
function toggleRemark(id: string) {
  draftRemark.value[id] = draftRemark.value[id] ?? ''
  showRemark[id] = !showRemark[id]
}

interface RemarkEntry { text: string; author?: string | null; timestamp: string }

function parseItemRemarks(item: ChecklistItem): RemarkEntry[] {
  if (!item.remarks) return []
  try {
    const parsed = JSON.parse(item.remarks)
    if (Array.isArray(parsed)) return parsed as RemarkEntry[]
    return [{ text: String(item.remarks), timestamp: '' }]
  } catch {
    return [{ text: String(item.remarks), timestamp: '' }]
  }
}

function formatRemarkDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function addItemRemark(item: ChecklistItem) {
  const text = (draftRemark.value[item.id] ?? '').trim()
  if (!text || !props.canEditRemarks) return
  savingRemark[item.id] = true
  try {
    const existing = parseItemRemarks(item)
    const next: RemarkEntry[] = [...existing, {
      text,
      author: authStore.userFullName || null,
      timestamp: new Date().toISOString(),
    }]
    const serialized = JSON.stringify(next)
    await api.patch(
      `/api/construction-projects/${props.projectId}/document-checklist/${item.id}`,
      { remarks: serialized },
    )
    item.remarks = serialized
    draftRemark.value[item.id] = ''
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to save remark')
  } finally {
    savingRemark[item.id] = false
  }
}

// ZU-4: Submission history drawer
const historyDrawer = ref(false)
const historyItem = ref<ChecklistItem | null>(null)
const historyEntries = ref<any[]>([])
const loadingHistory = ref(false)

async function openHistory(item: ChecklistItem) {
  historyItem.value = item
  historyDrawer.value = true
  loadingHistory.value = true
  historyEntries.value = []
  try {
    const res = await api.get<any>(
      `/api/construction-projects/${props.projectId}/document-checklist/${item.id}/submissions`,
    )
    historyEntries.value = Array.isArray(res) ? res : (res?.data ?? [])
  } catch (err: unknown) {
    toast.error('Failed to load submission history')
  } finally {
    loadingHistory.value = false
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const statusOptions = [
  { title: 'Not Submitted', value: 'NOT_SUBMITTED', color: 'grey' },
  { title: 'Submitted', value: 'SUBMITTED', color: 'info' },
  { title: 'Revised', value: 'REVISED', color: 'teal' },
  { title: 'Under Review', value: 'UNDER_REVIEW', color: 'warning' },
  { title: 'Approved', value: 'APPROVED', color: 'success' },
  { title: 'Rejected', value: 'REJECTED', color: 'error' },
]

function statusColor(s: string): string {
  return statusOptions.find(o => o.value === s)?.color || 'grey'
}

function statusLabel(s: string): string {
  return statusOptions.find(o => o.value === s)?.title || s
}

// KV-B: resolve linked document from parent's documents prop
function linkedDoc(item: ChecklistItem): DocumentItem | null {
  if (!item.linkedDocumentId || !props.documents.length) return null
  return props.documents.find(d => d.id === item.linkedDocumentId) ?? null
}

// ── Re-filing a submission by dragging one row onto another ─────────────────
// Every checklist row *is* a document type, so dropping a row that holds a submission onto an
// empty row is the whole gesture: the file, its version history and its submitted-on stamp
// move to the type that received the drop. The rules below mirror what the endpoint enforces,
// so an invalid drop is refused by the cursor rather than by a 409 after the fact.
const draggingItemId = ref<string | null>(null)
const dragOverItemId = ref<string | null>(null)
const movingItemId = ref<string | null>(null)

/** Whether a row carries anything a move would take with it. */
function hasSubmission(item: ChecklistItem): boolean {
  return (
    !!item.linkedDocumentId ||
    (item.currentVersion ?? 0) > 0 ||
    item.submissionStatus !== 'NOT_SUBMITTED'
  )
}

const draggingItem = computed(
  () => items.value.find(i => i.id === draggingItemId.value) ?? null,
)

function canDragItem(item: ChecklistItem): boolean {
  return props.canMove && !movingItemId.value && hasSubmission(item)
}

function canDrop(source: ChecklistItem | null, target: ChecklistItem): boolean {
  return (
    !!source &&
    props.canMove &&
    source.id !== target.id &&
    hasSubmission(source) &&
    !hasSubmission(target)
  )
}

const isDropTarget = (item: ChecklistItem) => canDrop(draggingItem.value, item)

function onDragStart(item: ChecklistItem, event: DragEvent) {
  if (!canDragItem(item)) {
    event.preventDefault()
    return
  }
  draggingItemId.value = item.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Firefox starts no drag at all unless the transfer carries some data.
    event.dataTransfer.setData('text/plain', item.id)
  }
}

function onDragEnd() {
  draggingItemId.value = null
  dragOverItemId.value = null
}

function onDragOver(item: ChecklistItem, event: DragEvent) {
  if (!isDropTarget(item)) {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    return
  }
  // A dragover that does not preventDefault means "not a drop zone", and the drop never fires.
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverItemId.value = item.id
}

function onDragLeave(item: ChecklistItem, event: DragEvent) {
  // dragleave also fires when the pointer crosses into a child element, so the highlight is
  // cleared only once the pointer has actually left the row.
  const next = event.relatedTarget as Node | null
  if (next && (event.currentTarget as HTMLElement).contains(next)) return
  if (dragOverItemId.value === item.id) dragOverItemId.value = null
}

function onDrop(target: ChecklistItem, event: DragEvent) {
  event.preventDefault()
  const source = draggingItem.value
  draggingItemId.value = null
  dragOverItemId.value = null
  if (!canDrop(source, target)) return
  void moveSubmission(source as ChecklistItem, target)
}

async function moveSubmission(source: ChecklistItem, target: ChecklistItem) {
  movingItemId.value = source.id
  try {
    await api.patch(
      `/api/construction-projects/${props.projectId}/document-checklist/${source.id}/change-document-type`,
      { documentTypeId: target.documentTypeId },
    )
    const label = target.documentType?.typeLabel ?? 'the selected requirement'
    toast.success(`Moved to ${label}. It is marked Submitted and needs reviewing again.`)
    // Both rows changed, so the whole checklist is refetched rather than patched in place.
    await fetchChecklist()
    // The files were re-typed too: the repositories upstream are now showing them in the
    // wrong card until the parent reloads its documents.
    emit('moved', { fromItemId: source.id, toItemId: target.id })
  } catch (err: unknown) {
    // 409 (target occupied) and 422 (nothing to move) already read as sentences.
    toast.error((err as { message?: string })?.message || 'Could not move the submission')
  } finally {
    movingItemId.value = null
  }
}

// KV-C: group items with per-group metadata
const groupedItems = computed(() => {
  const groups: Record<string, { groupCode: string; groupLabel: string; items: ChecklistItem[] }> = {}
  for (const item of items.value) {
    const code = item.documentType?.groupCode || 'OTHER'
    const label = code === 'ECO_FORMS' ? 'Other Forms' : (item.documentType?.groupLabel || 'Other')
    if (!groups[code]) groups[code] = { groupCode: code, groupLabel: label, items: [] }
    groups[code].items.push(item)
  }
  return Object.values(groups).sort((a, b) => a.groupCode.localeCompare(b.groupCode)).map(g => ({
    ...g,
    submittedCount: g.items.filter(i => i.submissionStatus !== 'NOT_SUBMITTED').length,
    linkedFileCount: g.items.filter(i => !!i.linkedDocumentId).length,
    missingCount: g.items.filter(i => i.submissionStatus === 'NOT_SUBMITTED').length,
    latestSubmittedAt: g.items
      .filter(i => i.submittedAt)
      .map(i => i.submittedAt!)
      .sort()
      .at(-1) ?? null,
  }))
})

const summary = computed(() => {
  const total = items.value.length
  const submitted = items.value.filter(i => i.submissionStatus !== 'NOT_SUBMITTED').length
  const approved = items.value.filter(i => i.submissionStatus === 'APPROVED').length
  const required = items.value.filter(i => i.documentType?.isRequired).length
  const requiredApproved = items.value.filter(
    i => i.documentType?.isRequired && i.submissionStatus === 'APPROVED',
  ).length
  return { total, submitted, approved, required, requiredApproved }
})

async function fetchChecklist() {
  if (!props.projectId) return
  loading.value = true
  try {
    const res = await api.get<any>(
      `/api/construction-projects/${props.projectId}/document-checklist`,
    )
    const list: any[] = Array.isArray(res) ? res : (res?.data || [])
    items.value = list as ChecklistItem[]
  } catch (err: unknown) {
    console.error('[CiDocumentChecklist] fetch failed:', err)
  } finally {
    loading.value = false
  }
}

function openEdit(item: ChecklistItem) {
  editing.value = item
  form.value = {
    submission_status: item.submissionStatus,
    review_notes: item.reviewNotes || '',
    expiry_date: item.expiryDate ? String(item.expiryDate).slice(0, 10) : '',
    linked_document_id: item.linkedDocumentId || '',
  }
  dialog.value = true
}

// NNN-A: read-only status view (for non-editors)
const viewStatusDialog = ref(false)
const viewStatusItem = ref<ChecklistItem | null>(null)
function openViewStatus(item: ChecklistItem) {
  viewStatusItem.value = item
  viewStatusDialog.value = true
}

async function save() {
  if (!editing.value) return
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      submission_status: form.value.submission_status,
      review_notes: form.value.review_notes || undefined,
      expiry_date: form.value.expiry_date || undefined,
      linked_document_id: form.value.linked_document_id || undefined,
    }
    await api.patch(
      `/api/construction-projects/${props.projectId}/document-checklist/${editing.value.id}`,
      payload,
    )
    toast.success('Checklist item updated')
    dialog.value = false
    await fetchChecklist()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Update failed')
  } finally {
    submitting.value = false
  }
}

async function quickStatus(item: ChecklistItem, newStatus: ChecklistItem['submissionStatus']) {
  if (!props.canEdit) return
  updating.value[item.id] = true
  try {
    await api.patch(
      `/api/construction-projects/${props.projectId}/document-checklist/${item.id}`,
      { submission_status: newStatus },
    )
    await fetchChecklist()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Update failed')
  } finally {
    updating.value[item.id] = false
  }
}

// KV-D3: emit group remarks on blur so parent can persist via PATCH
function onRemarksBlur(groupCode: string, event: Event) {
  const value = (event.target as HTMLTextAreaElement).value.trim()
  groupRemarkDrafts.value[groupCode] = value
}

function onRemarkDraftInput(groupCode: string, value: string) {
  groupRemarkDrafts.value[groupCode] = value
}

function addGroupRemark(groupCode: string) {
  if (!props.canEditRemarks) return
  const text = (groupRemarkDrafts.value[groupCode] ?? '').trim()
  if (!text) return
  const next = [...(localGroupRemarks.value[groupCode] ?? []), { text, timestamp: new Date().toISOString() }]
  localGroupRemarks.value = { ...localGroupRemarks.value, [groupCode]: next }
  groupRemarkDrafts.value[groupCode] = ''
  emit('remarksUpdate', groupCode, next)
}

function normalizeGroupRemarks(input: unknown): GroupRemarkEntry[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry: any) => ({
      text: String(entry?.text ?? '').trim(),
      author: entry?.author ? String(entry.author) : null,
      timestamp: String(entry?.timestamp ?? ''),
    }))
    .filter((entry) => entry.text.length > 0)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
}

function remarksForGroup(groupCode: string): GroupRemarkEntry[] {
  return normalizeGroupRemarks(localGroupRemarks.value[groupCode] ?? [])
}

// ZO: Per-item inline remarks — auto-save on blur
async function onItemRemarksBlur(item: ChecklistItem, event: Event) {
  if (!props.canEditRemarks) return
  const value = (event.target as HTMLTextAreaElement).value
  if (value === (item.remarks ?? '')) return
  try {
    await api.patch(
      `/api/construction-projects/${props.projectId}/document-checklist/${item.id}`,
      { remarks: value },
    )
    item.remarks = value
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to save remarks')
  }
}

watch(
  () => props.groupRemarks,
  (value) => {
    const next: Record<string, GroupRemarkEntry[]> = {}
    Object.entries(value ?? {}).forEach(([groupCode, entries]) => {
      next[groupCode] = normalizeGroupRemarks(entries)
    })
    localGroupRemarks.value = next
  },
  { immediate: true, deep: true },
)

watch(() => props.projectId, () => { if (props.projectId) fetchChecklist() })
onMounted(() => { if (props.projectId) fetchChecklist() })

defineExpose({ refresh: fetchChecklist })
</script>

<template>
  <div>
    <!-- WWW-G: Cross-section attachment overview (master summary) -->
    <v-card variant="outlined" class="mb-4" rounded="lg">
      <v-card-title class="d-flex align-center ga-2 py-2 px-4 bg-grey-lighten-4">
        <v-icon icon="mdi-view-dashboard-outline" size="small" color="primary" />
        <span class="text-subtitle-2 font-weight-medium">Attachment Overview</span>
        <v-chip size="x-small" variant="tonal" color="primary">All Sections</v-chip>
      </v-card-title>
      <v-card-text class="py-3">
        <v-row dense>
          <v-col cols="6" sm="3">
            <div class="text-caption text-grey">Key Documents</div>
            <div class="text-body-1 font-weight-bold">{{ keyDocCount ?? 0 }} <span class="text-caption text-grey">files</span></div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-grey">Supporting Docs</div>
            <div class="text-body-1 font-weight-bold">{{ supportingDocCount ?? 0 }} <span class="text-caption text-grey">files</span></div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-grey">Gallery</div>
            <div class="text-body-1 font-weight-bold">{{ galleryCount ?? 0 }} <span class="text-caption text-grey">images</span></div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-grey">Miscellaneous</div>
            <div class="text-body-1 font-weight-bold">{{ miscDocCount ?? 0 }} <span class="text-caption text-grey">files</span></div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Compliance summary card -->
    <v-card class="mb-4">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-clipboard-check-outline" />
        <span>Document Compliance Checklist</span>
      </v-card-title>
      <v-divider />
      <v-card-text class="py-3">
        <!-- MMM-D4: compact single-row chip summary -->
        <div class="d-flex flex-wrap align-center ga-2">
          <v-chip size="small" variant="tonal" color="grey-darken-1" prepend-icon="mdi-format-list-checks">
            Total {{ summary.total }}
          </v-chip>
          <v-chip size="small" variant="tonal" color="info" prepend-icon="mdi-send">
            Submitted {{ summary.submitted }}/{{ summary.total }}
          </v-chip>
          <v-chip size="small" variant="tonal" color="success" prepend-icon="mdi-check-circle">
            Approved {{ summary.approved }}
          </v-chip>
          <v-chip size="small" variant="tonal" color="error" prepend-icon="mdi-asterisk">
            Required {{ summary.requiredApproved }}/{{ summary.required }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>

    <div v-if="loading" class="text-center pa-4 text-grey">
      <v-progress-circular indeterminate size="24" />
      <div class="mt-2 text-caption">Loading checklist…</div>
    </div>

    <div v-else-if="items.length === 0" class="text-center pa-6 text-grey">
      <v-icon size="48" color="grey-lighten-1">mdi-clipboard-text-outline</v-icon>
      <div class="mt-2">No checklist initialized yet.</div>
    </div>

    <template v-else>
      <v-alert
        v-if="canMove"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-3"
        icon="mdi-drag-variant"
      >
        Filed something under the wrong requirement? Drag its row onto an empty one to move the
        file and its history there. Only requirements with no submission of their own can
        receive a drop, and a moved submission goes back to Submitted for review.
      </v-alert>

      <!-- BBB-D: Collapsible accordion — header shows group progress, items expand on click -->
      <v-expansion-panels variant="accordion" multiple class="mb-4">
      <v-expansion-panel v-for="g in groupedItems" :key="g.groupCode">
        <v-expansion-panel-title>
          <div class="d-flex align-center ga-2 w-100">
            <v-icon icon="mdi-folder-outline" size="small" />
            <span class="text-subtitle-2 font-weight-bold text-truncate">{{ g.groupLabel }}</span>
            <v-spacer />
            <v-chip
              size="x-small"
              variant="tonal"
              :color="g.submittedCount === g.items.length ? 'success' : (g.missingCount > 0 ? 'warning' : 'info')"
              class="mr-2"
            >
              {{ g.submittedCount }}/{{ g.items.length }}
            </v-chip>
            <v-progress-linear
              :model-value="g.items.length ? (g.submittedCount / g.items.length) * 100 : 0"
              :color="g.submittedCount === g.items.length ? 'success' : 'primary'"
              height="4"
              rounded
              style="max-width:80px"
            />
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
            <!-- MMM-D: compact grid rows (type code | label | status | date | kebab) -->
            <div class="pa-0">
              <div
                v-for="item in g.items"
                :key="item.id"
                class="border-b checklist-row"
                :class="{
                  'checklist-row--draggable': canDragItem(item),
                  'checklist-row--dragging': draggingItemId === item.id,
                  'checklist-row--target': isDropTarget(item),
                  'checklist-row--over': dragOverItemId === item.id,
                }"
                :draggable="canDragItem(item)"
                @dragstart="onDragStart(item, $event)"
                @dragend="onDragEnd"
                @dragover="onDragOver(item, $event)"
                @dragleave="onDragLeave(item, $event)"
                @drop="onDrop(item, $event)"
              >
                <!-- Main row -->
                <div class="d-flex align-center ga-2 py-2 px-1">
                  <!-- Col 0: drag affordance. Only rows holding a submission can be moved,
                       and the spinner marks the one currently being re-filed. -->
                  <div v-if="canMove" style="min-width: 20px" class="flex-shrink-0 text-center">
                    <v-progress-circular
                      v-if="movingItemId === item.id"
                      indeterminate
                      size="16"
                      width="2"
                      color="primary"
                    />
                    <v-icon
                      v-else-if="canDragItem(item)"
                      icon="mdi-drag-vertical"
                      size="small"
                      color="grey"
                    />
                  </div>
                  <!-- Col 1: required badge + type code -->
                  <div style="min-width: 92px; max-width: 92px">
                    <v-chip size="x-small" :color="item.documentType?.isRequired ? 'error' : 'grey'" variant="tonal">
                      {{ item.documentType?.isRequired ? 'Required' : 'Optional' }}
                    </v-chip>
                    <div class="text-caption text-grey-darken-1 mt-1 text-truncate">{{ item.documentType?.typeCode }}</div>
                  </div>
                  <!-- Col 2: type label (+ remark count indicator) -->
                  <div class="flex-grow-1 d-flex align-center ga-2" style="min-width: 0">
                    <span class="text-body-2 font-weight-medium text-truncate">{{ item.documentType?.typeLabel || 'Unknown type' }}</span>
                    <v-chip
                      v-if="parseItemRemarks(item).length"
                      size="x-small"
                      variant="tonal"
                      color="blue-grey"
                      prepend-icon="mdi-comment-text-outline"
                      class="flex-shrink-0 cursor-pointer"
                      @click="toggleRemark(item.id)"
                    >
                      {{ parseItemRemarks(item).length }}
                    </v-chip>
                  </div>
                  <!-- Col 3: status chip -->
                  <v-chip :color="statusColor(item.submissionStatus)" size="small" variant="tonal" style="min-width: 110px; justify-content: center" class="flex-shrink-0">
                    {{ statusLabel(item.submissionStatus) }}
                  </v-chip>
                  <!-- Col 4: latest date -->
                  <div class="text-caption text-grey d-none d-sm-block flex-shrink-0" style="min-width: 92px; text-align: right">
                    {{ item.submittedAt ? formatDate(item.submittedAt) : '—' }}
                  </div>
                  <!-- Col 5: kebab menu (replaces inline Edit + History buttons) -->
                  <v-menu location="bottom end">
                    <template #activator="{ props: menuProps }">
                      <v-btn v-bind="menuProps" icon="mdi-dots-vertical" size="small" variant="text" color="grey-darken-1" class="flex-shrink-0" />
                    </template>
                    <v-list density="compact" nav>
                      <v-list-item
                        prepend-icon="mdi-folder-arrow-right-outline"
                        title="Navigate"
                        @click="emit('navigate', { groupCode: item.documentType?.groupCode, typeCode: item.documentType?.typeCode })"
                      />
                      <!-- NNN-A: open the linked submission file (only when one is attached) -->
                      <v-list-item
                        v-if="linkedDoc(item)"
                        prepend-icon="mdi-open-in-new"
                        title="Open Linked File"
                        :href="linkedDoc(item)!.filePath"
                        target="_blank"
                        rel="noopener"
                        tag="a"
                      />
                      <v-list-item
                        v-if="item.documentType?.templateUrl"
                        prepend-icon="mdi-file-download"
                        title="Download Template"
                        :href="item.documentType.templateUrl"
                        target="_blank"
                        rel="noopener"
                        tag="a"
                      />
                      <v-list-item
                        v-if="canEdit"
                        prepend-icon="mdi-pencil-outline"
                        title="Update Status"
                        @click="openEdit(item)"
                      />
                      <!-- NNN-A: read-only status view for non-editors -->
                      <v-list-item
                        v-else
                        prepend-icon="mdi-eye-outline"
                        title="View Status"
                        @click="openViewStatus(item)"
                      />
                      <v-list-item
                        v-if="canEditRemarks"
                        prepend-icon="mdi-comment-text-outline"
                        title="Remarks"
                        @click="toggleRemark(item.id)"
                      />
                      <v-list-item
                        prepend-icon="mdi-history"
                        title="Submission History"
                        @click="openHistory(item)"
                      />
                    </v-list>
                  </v-menu>
                </div>

                <!-- Linked file chip (if a document is attached) -->
                <div v-if="linkedDoc(item)" class="px-1 pb-1">
                  <v-chip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-download"
                    :href="linkedDoc(item)!.filePath"
                    target="_blank"
                    rel="noopener"
                    tag="a"
                    class="text-decoration-none"
                  >
                    {{ linkedDoc(item)!.fileName }}
                  </v-chip>
                </div>

                <!-- Inline remark editor (toggled via kebab "Remarks") -->
                <div v-if="showRemark[item.id]" class="pa-2 bg-grey-lighten-5">
                  <!-- Remark history -->
                  <div v-if="parseItemRemarks(item).length" class="d-flex flex-column ga-1 mb-2">
                    <div
                      v-for="(remark, ri) in parseItemRemarks(item)"
                      :key="ri"
                      class="d-flex align-start ga-2 pa-2 bg-white rounded text-body-2"
                    >
                      <v-icon size="14" color="grey" class="mt-1 flex-shrink-0">mdi-comment-text-outline</v-icon>
                      <div class="flex-grow-1">
                        <div class="text-body-2">{{ remark.text }}</div>
                        <div class="text-caption text-grey mt-1">
                          <span v-if="remark.author">{{ remark.author }}</span>
                          <span v-if="remark.author && remark.timestamp"> · </span>
                          <span v-if="remark.timestamp">{{ formatRemarkDate(remark.timestamp) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Add remark input (canEditRemarks) -->
                  <div v-if="canEditRemarks" class="d-flex align-center ga-1">
                    <v-text-field
                      v-model="draftRemark[item.id]"
                      placeholder="Add a remark…"
                      density="compact"
                      variant="outlined"
                      hide-details
                      single-line
                      style="flex: 1"
                      @keydown.enter="addItemRemark(item)"
                    />
                    <v-btn
                      size="small"
                      color="primary"
                      variant="tonal"
                      :loading="savingRemark[item.id]"
                      :disabled="!(draftRemark[item.id] ?? '').trim()"
                      icon="mdi-send"
                      @click="addItemRemark(item)"
                    />
                  </div>
                  <div v-else-if="!parseItemRemarks(item).length" class="text-caption text-grey">
                    No remarks yet.
                  </div>
                </div>
              </div>
            </div>

            <!-- KV-D3: Per-group remarks field (always at card bottom) -->
            <div v-if="canEditRemarks || remarksForGroup(g.groupCode).length" class="mt-2 pt-2 border-t">
              <p class="text-caption text-grey mb-1 font-weight-medium">
                <v-icon size="x-small" class="mr-1">mdi-comment-text-outline</v-icon>Evaluator Remarks
              </p>
              <v-list v-if="remarksForGroup(g.groupCode).length" density="compact" class="pa-0 mb-2">
                <v-list-item v-for="(remark, idx) in remarksForGroup(g.groupCode)" :key="`${g.groupCode}-${idx}-${remark.timestamp}`" class="px-0">
                  <v-list-item-title class="text-body-2">{{ remark.text }}</v-list-item-title>
                  <v-list-item-subtitle class="text-caption text-grey">
                    {{ remark.author || 'Unspecified user' }} • {{ formatDate(remark.timestamp) }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
              <div v-if="canEditRemarks" class="d-flex ga-2 align-start">
                <v-textarea
                  :model-value="groupRemarkDrafts[g.groupCode] ?? ''"
                  placeholder="Add compliance remark…"
                  rows="2"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-grow-1"
                  @update:model-value="onRemarkDraftInput(g.groupCode, String($event ?? ''))"
                />
                <v-btn color="primary" variant="tonal" size="small" class="mt-1" @click="addGroupRemark(g.groupCode)">
                  Add
                </v-btn>
              </div>
            </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <!-- ZU-4: Submission history drawer -->
    <v-navigation-drawer
      v-model="historyDrawer"
      location="right"
      temporary
      width="380"
    >
      <div class="d-flex align-center pa-3 border-b">
        <v-icon class="mr-2">mdi-history</v-icon>
        <span class="font-weight-medium">Submission History</span>
        <v-spacer />
        <v-btn icon="mdi-close" size="small" variant="text" @click="historyDrawer = false" />
      </div>
      <div class="pa-3">
        <p class="text-caption text-grey mb-3">{{ historyItem?.documentType?.typeLabel }}</p>
        <div v-if="loadingHistory" class="text-center py-6">
          <v-progress-circular indeterminate size="24" />
        </div>
        <div v-else-if="!historyEntries.length" class="text-center py-6 text-grey">
          <v-icon size="40" color="grey-lighten-1">mdi-inbox-outline</v-icon>
          <p class="text-caption mt-2">No submissions recorded yet.</p>
        </div>
        <v-timeline v-else density="compact" align="start">
          <v-timeline-item
            v-for="entry in historyEntries"
            :key="entry.id"
            dot-color="primary"
            size="small"
          >
            <div class="d-flex flex-column ga-1">
              <div class="d-flex align-center ga-2">
                <v-chip size="x-small" color="primary" variant="tonal">v{{ entry.version }}</v-chip>
                <span class="text-caption text-grey">{{ formatDate(entry.submitted_at) }}</span>
              </div>
              <div class="text-body-2">{{ entry.submitter_name || 'Unknown' }}</div>
              <v-chip
                size="x-small"
                color="grey"
                variant="tonal"
                prepend-icon="mdi-download"
                :href="entry.file_path"
                target="_blank"
                rel="noopener"
                tag="a"
                class="text-decoration-none"
              >
                {{ entry.original_name }}
              </v-chip>
              <p v-if="entry.submission_notes" class="text-caption text-grey mt-1">
                {{ entry.submission_notes }}
              </p>
            </div>
          </v-timeline-item>
        </v-timeline>
      </div>
    </v-navigation-drawer>

    <!-- Edit dialog -->
    <v-dialog v-model="dialog" max-width="560" persistent>
      <v-card>
        <v-card-title>Update Checklist Item</v-card-title>
        <v-card-subtitle>{{ editing?.documentType?.typeLabel }}</v-card-subtitle>
        <v-divider />
        <v-card-text class="pt-4">
          <v-row dense>
            <v-col cols="12">
              <v-select
                v-model="form.submission_status"
                :items="statusOptions"
                item-title="title"
                item-value="value"
                label="Submission Status"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.review_notes"
                label="Review Notes"
                rows="2"
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.expiry_date"
                label="Expiry Date"
                type="date"
                hint="For licenses or accreditations"
                persistent-hint
                variant="outlined"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <!-- KV-B4: document picker replaces UUID text field -->
              <v-select
                v-if="documents.length"
                v-model="form.linked_document_id"
                label="Link Uploaded Document"
                :items="documents"
                :item-title="(d: DocumentItem) => d.fileName"
                item-value="id"
                clearable
                variant="outlined"
                density="comfortable"
                hint="Select a file from the Attachments tab"
                persistent-hint
              />
              <v-text-field
                v-else
                v-model="form.linked_document_id"
                label="Linked Document ID (UUID)"
                hint="Paste UUID of the uploaded file in Documents tab"
                persistent-hint
                variant="outlined"
                density="comfortable"
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="submitting" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="submitting" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- NNN-A: Read-only status view (non-editors) -->
    <v-dialog v-model="viewStatusDialog" max-width="480">
      <v-card>
        <v-card-title>Submission Status</v-card-title>
        <v-card-subtitle>{{ viewStatusItem?.documentType?.typeLabel }}</v-card-subtitle>
        <v-divider />
        <v-card-text class="pt-4">
          <v-chip :color="statusColor(viewStatusItem?.submissionStatus ?? 'NOT_SUBMITTED')" class="mb-3" variant="tonal">
            {{ statusLabel(viewStatusItem?.submissionStatus ?? 'NOT_SUBMITTED') }}
          </v-chip>
          <p v-if="viewStatusItem?.reviewNotes" class="text-body-2 mb-2">{{ viewStatusItem.reviewNotes }}</p>
          <p v-if="viewStatusItem?.submittedAt" class="text-caption text-grey">Submitted: {{ formatDate(viewStatusItem.submittedAt) }}</p>
          <p v-if="viewStatusItem?.reviewedAt" class="text-caption text-grey">Reviewed: {{ formatDate(viewStatusItem.reviewedAt) }}</p>
          <p v-if="viewStatusItem?.expiryDate" class="text-caption text-grey">Expires: {{ formatDate(viewStatusItem.expiryDate) }}</p>
          <p v-if="!viewStatusItem?.reviewNotes && !viewStatusItem?.submittedAt" class="text-caption text-grey">
            No submission recorded yet.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="viewStatusDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.checklist-row {
  transition: background-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

/* grab, not pointer: the row is picked up, not clicked through. */
.checklist-row--draggable {
  cursor: grab;
}

.checklist-row--dragging {
  opacity: 0.45;
  cursor: grabbing;
}

/* Every row that could receive the current drag is tinted, so the legal targets are visible
   the moment the drag starts rather than one hover at a time. */
.checklist-row--target {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.checklist-row--over {
  background-color: rgba(var(--v-theme-primary), 0.12);
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary));
}
</style>
