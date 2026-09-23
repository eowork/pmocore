<script setup lang="ts">
// ZY-3 / AAA-H: Repository detail modal. Dumb/controlled — the hub owns documents,
// docTypes and all API logic; this modal renders and emits upload/delete.
// AAA-H adds modal-local search/filter/sort, drag-drop batch upload, client-side
// pagination, uploader info, and a recent-activity panel.

import type { UploadTask } from '~/composables/useDocumentUpload'

interface RepoDocType {
  typeCode: string
  typeLabel: string
  templateUrl?: string | null
}

interface RepoDoc {
  id: string
  documentType?: string
  fileName: string
  filePath: string
  mimeType?: string
  fileSize?: number
  description?: string
  createdAt?: string
  version?: number
  lifecycleStatus?: string
  uploadedByName?: string
}

interface StagedDoc {
  tempId: string
  documentType: string
  fileName: string
}

interface Props {
  modelValue: boolean
  title: string
  icon: string
  color: string
  typeCodes: string[]
  docTypes: RepoDocType[]
  documents: RepoDoc[]
  staged?: StagedDoc[]
  canUpload?: boolean
  canDelete?: boolean
  mode?: 'view' | 'edit' | 'staging'
  expandUpload?: boolean
  projectId?: string
  /**
   * Uploads in flight for this repository.
   *
   * The card underneath shows the same tasks, but the modal sits on top of it while the
   * upload runs, so the progress is repeated here rather than hidden behind the overlay.
   */
  uploads?: UploadTask[]
}

const props = withDefaults(defineProps<Props>(), {
  staged: () => [],
  canUpload: false,
  canDelete: false,
  mode: 'view',
  expandUpload: false,
  projectId: '',
  uploads: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  upload: [payload: { file: File; documentType: string; title: string; description: string }]
  delete: [docId: string]
  'remove-staged': [tempId: string]
  link: [payload: { url: string; title: string; description: string }]  // XXX-A
}>()

const api = useApi()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

// Restrict the relevant doc types to the typeCodes this repository covers.
const relevantTypes = computed(() =>
  props.typeCodes
    .map((code) => props.docTypes.find((t) => t.typeCode === code) ?? { typeCode: code, typeLabel: code, templateUrl: null }),
)
const typeSelectItems = computed(() =>
  relevantTypes.value.map((t) => ({ title: t.typeLabel, value: t.typeCode })),
)
function typeLabel(code?: string): string {
  if (!code) return ''
  return props.docTypes.find((t) => t.typeCode === code)?.typeLabel ?? code
}
// Blank-form templates available for this repository.
const templates = computed(() => relevantTypes.value.filter((t) => !!t.templateUrl))

// AAA-H-1: modal-local search / filter / sort
const modalSearch = ref('')
const modalFilterType = ref<string | null>(null)
const modalSort = ref<'date-desc' | 'date-asc' | 'name-asc'>('date-desc')

// Type filter dropdown shows only types actually present in this repository.
const typeFilterItems = computed(() => {
  const present = new Set(props.documents.map((d) => d.documentType).filter(Boolean) as string[])
  return relevantTypes.value
    .filter((t) => present.has(t.typeCode))
    .map((t) => ({ title: t.typeLabel, value: t.typeCode }))
})

const filteredModalDocs = computed(() => {
  let docs = [...props.documents]
  if (modalSearch.value) {
    const q = modalSearch.value.toLowerCase()
    docs = docs.filter((d) => d.fileName.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q))
  }
  if (modalFilterType.value) docs = docs.filter((d) => d.documentType === modalFilterType.value)
  if (modalSort.value === 'date-asc') docs.sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1))
  else if (modalSort.value === 'name-asc') docs.sort((a, b) => a.fileName.localeCompare(b.fileName))
  else docs.sort((a, b) => ((a.createdAt ?? '') > (b.createdAt ?? '') ? -1 : 1))
  return docs
})

// AAA-H-3: client-side pagination
const MODAL_PAGE_SIZE = 20
const modalDisplayLimit = ref(MODAL_PAGE_SIZE)

// ZZZ-C: split filteredModalDocs into file entries and external link entries for separate rendering
const fileModalDocs = computed(() => filteredModalDocs.value.filter(d => !isLinkDoc(d)))
const linkModalDocs = computed(() => filteredModalDocs.value.filter(d => isLinkDoc(d)))
const pagedModalDocs = computed(() => fileModalDocs.value.slice(0, modalDisplayLimit.value))
const hasMoreModalDocs = computed(() => fileModalDocs.value.length > modalDisplayLimit.value)
watch([modalSearch, modalFilterType], () => { modalDisplayLimit.value = MODAL_PAGE_SIZE })

// ZZZ-C: copy external link URL to clipboard
const toast = useToast ? useToast() : { success: (m: string) => console.log(m), error: (m: string) => console.error(m) }
async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  } catch {
    toast.error('Could not copy link — please copy manually')
  }
}

// Upload form state
const showUpload = ref(props.expandUpload)
const uploadFile = ref<File | null>(null)
const uploadType = ref<string>(props.typeCodes[0] ?? '')

// WWW-F: dismissible guidance text (stored per-browser in localStorage)
const guidanceDismissed = ref(false)
onMounted(() => {
  guidanceDismissed.value = localStorage.getItem('coi-repo-modal-guide-dismissed') === '1'
})
function dismissGuidance() {
  guidanceDismissed.value = true
  localStorage.setItem('coi-repo-modal-guide-dismissed', '1')
}
const uploadTitle = ref('')
const uploadDescription = ref('')

function submitUpload() {
  if (!uploadFile.value || !uploadType.value) return
  emit('upload', {
    file: uploadFile.value,
    documentType: uploadType.value,
    title: uploadTitle.value,
    description: uploadDescription.value,
  })
  uploadFile.value = null
  uploadTitle.value = ''
  uploadDescription.value = ''
  // PPP-B: collapse upload zone so the newly uploaded file is immediately visible in the list below
  showUpload.value = false
}

// AAA-H-2: drag-and-drop + batch upload
const isDragOver = ref(false)
const modalFileInputRef = ref<HTMLInputElement | null>(null)
function triggerModalFileInput() { modalFileInputRef.value?.click() }
function handleModalFileBatch(files: File[]) {
  const type = uploadType.value || props.typeCodes[0] || 'other'
  for (const file of files) {
    emit('upload', { file, documentType: type, title: file.name, description: '' })
  }
  // PPP-B: collapse upload zone after batch so the file list is visible
  showUpload.value = false
}
function handleModalDrop(e: DragEvent) {
  isDragOver.value = false
  handleModalFileBatch(Array.from(e.dataTransfer?.files ?? []))
}
function handleModalFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  handleModalFileBatch(Array.from(input.files ?? []))
  input.value = ''
}

// AAA-H-5: recent activity
interface RecentEvent { id: string; userName: string; action: string; createdAt: string }
const recentActivity = ref<RecentEvent[]>([])
async function fetchRecentActivity() {
  if (!props.projectId) return
  try {
    const res = await api.get<{ data: RecentEvent[] }>(`/api/activity-logs/CONSTRUCTION_PROJECT/${props.projectId}?pageSize=5`)
    recentActivity.value = (Array.isArray(res) ? res : res?.data) ?? []
  } catch {
    recentActivity.value = []
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      showUpload.value = props.expandUpload
      showLinkForm.value = false  // XXX-A: reset link form on open
      // TTT-A: always reset to THIS repository's primary type. The modal is a shared
      // instance; a stale uploadType from a previously-opened repo would file uploads
      // under the wrong documentType, making them invisible in the current repository.
      uploadType.value = props.typeCodes[0] ?? ''
      modalDisplayLimit.value = MODAL_PAGE_SIZE
      fetchRecentActivity()
    }
  },
)

// TTT-A: resync uploadType when the active repository changes (covers reactive swap
// of activeRepo.typeCodes while the shared modal is open).
watch(
  () => props.typeCodes,
  (codes) => {
    uploadType.value = codes?.[0] ?? ''
  },
)

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH')
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

// XXX-A: link submission form state
const showLinkForm = ref(false)
const linkUrl = ref('')
const linkTitle = ref('')
const linkDescription = ref('')
const URL_RE = /^https?:\/\/.+/i

function submitLink() {
  if (!linkUrl.value || !URL_RE.test(linkUrl.value)) return
  emit('link', { url: linkUrl.value, title: linkTitle.value || linkUrl.value, description: linkDescription.value })
  linkUrl.value = ''
  linkTitle.value = ''
  linkDescription.value = ''
  showLinkForm.value = false
}

// CCC-A / XXX-A: authenticated download; links open raw href.
function isLinkDoc(doc: RepoDoc): boolean {
  return doc.mimeType === 'application/x-google-drive-link' ||
    doc.mimeType === 'application/x-external-link' ||
    doc.documentType === 'link'
}
async function downloadDoc(doc: RepoDoc) {
  if (isLinkDoc(doc) || !props.projectId) {
    window.open(doc.filePath, '_blank', 'noopener')
    return
  }
  try {
    await api.download(`/api/construction-projects/${props.projectId}/documents/${doc.id}/download`, doc.fileName)
  } catch {
    window.open(doc.filePath, '_blank', 'noopener')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="1100" scrollable>
    <v-card>
      <v-toolbar :color="color" density="comfortable">
        <v-icon :icon="icon" class="ml-4" />
        <v-toolbar-title>{{ title }}</v-toolbar-title>
        <v-chip size="small" variant="tonal" class="mr-2">{{ documents.length }} files</v-chip>
        <v-btn icon="mdi-close" @click="open = false" />
      </v-toolbar>

      <!-- AAA-H-1 / EEE-D: search / filter / sort (responsive grid, no wrap) -->
      <v-row dense class="px-4 pt-3 align-center">
        <v-col cols="12" sm="6" md="5">
          <v-text-field
            v-model="modalSearch"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search files…"
            variant="outlined" density="compact" hide-details single-line clearable
            clear-icon="mdi-close-circle-outline"
          />
        </v-col>
        <v-col cols="12" sm="4" md="4">
          <v-select
            v-model="modalFilterType"
            :items="typeFilterItems"
            label="Type"
            variant="outlined" density="compact" hide-details clearable
          />
        </v-col>
        <v-col cols="12" sm="15" md="3" class="d-flex justify-end align-center ga-1">
          <v-btn-toggle v-model="modalSort" mandatory density="compact" variant="outlined">
            <v-btn value="date-desc" icon="mdi-sort-calendar-descending" size="medium" density="compact" />
            <v-btn value="date-asc" icon="mdi-sort-calendar-ascending" size="medium" density="compact" />
            <v-btn value="name-asc" icon="mdi-sort-alphabetical-ascending" size="medium" density="compact" />
          </v-btn-toggle>
          <v-btn
            v-if="canUpload && mode !== 'view'"
            :color="color" variant="tonal" size="medium"
            :icon="showUpload ? 'mdi-chevron-up' : 'mdi-upload'"
            @click="showUpload = !showUpload; if (showUpload) showLinkForm = false"
          />
          <!-- XXX-A: Submit Link toggle -->
          <v-btn
            v-if="canUpload && mode !== 'view'"
            :color="color" variant="tonal" size="small"
            :icon="showLinkForm ? 'mdi-chevron-up' : 'mdi-link-plus'"
            title="Submit Link"
            @click="showLinkForm = !showLinkForm; if (showLinkForm) showUpload = false"
          />
        </v-col>
      </v-row>

      <v-card-text style="max-height:78vh;overflow-y:auto">
        <!-- WWW-F: Dismissible usage guidance (shown once per browser, hidden in staging mode) -->
        <v-alert
          v-if="!guidanceDismissed && mode !== 'staging'"
          type="info"
          variant="tonal"
          density="compact"
          closable
          class="mb-3"
          @click:close="dismissGuidance"
        >
          Download the official template · Upload your accomplished form · View and download previous submissions · Track version history.
        </v-alert>

        <!-- Blank-form templates -->
        <div v-if="templates.length" class="d-flex align-center ga-2 flex-wrap mb-3">
          <span class="text-caption text-medium-emphasis">Blank forms:</span>
          <v-btn
            v-for="t in templates" :key="t.typeCode"
            :href="t.templateUrl!" target="_blank" rel="noopener"
            size="x-small" variant="tonal" color="indigo" prepend-icon="mdi-download"
          >
            {{ t.typeLabel }}
          </v-btn>
        </div>

        <!-- Live progress for uploads started from this repository. -->
        <v-expand-transition>
          <v-card v-if="uploads.length" variant="tonal" color="info" class="mb-3" rounded="lg">
            <v-card-text class="py-3">
              <div v-for="task in uploads" :key="task.id" class="mb-2">
                <div class="d-flex justify-space-between align-center ga-2 text-caption">
                  <span class="text-truncate" style="max-width: 60%">{{ task.fileName }}</span>
                  <span :class="task.error ? 'text-error' : 'text-grey-darken-1'" class="text-right">
                    {{ task.error || task.label }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="task.percent"
                  :color="task.error ? 'error' : task.phase === 'done' ? 'success' : 'info'"
                  height="6"
                  rounded
                  class="mt-1"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-expand-transition>

        <!-- Upload form + drag-drop zone (AAA-H-2) -->
        <v-expand-transition>
          <v-card v-if="showUpload && canUpload && mode !== 'view'" variant="tonal" :color="color" class="mb-4">
            <v-card-text>
              <div
                class="pa-5 rounded text-center mb-3"
                :style="{ border: '2px dashed', borderColor: isDragOver ? 'rgb(var(--v-theme-' + color + '))' : 'rgba(var(--v-border-color),0.4)', cursor: 'pointer' }"
                @dragover.prevent="isDragOver = true"
                @dragleave="isDragOver = false"
                @drop.prevent="handleModalDrop"
                @click="triggerModalFileInput"
              >
                <v-icon icon="mdi-cloud-upload-outline" size="32" color="grey" />
                <div class="text-body-2 text-grey mt-1">Drag files here or click to browse (multiple allowed)</div>
                <div class="text-caption text-grey-darken-1 mt-1">Accepted: PDF, Word, Excel, PowerPoint, images, ZIP · Max 20 MB per file</div>
                <input ref="modalFileInputRef" type="file" multiple style="display:none" @change="handleModalFileChange" >
              </div>
              <v-row dense align="center">
                <v-col cols="12" sm="5">
                  <v-file-input
                    v-model="uploadFile"
                    label="Single file (≤ 20 MB)"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,image/*"
                    prepend-icon="mdi-paperclip" show-size variant="outlined" density="compact" hide-details
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select v-model="uploadType" :items="typeSelectItems" label="Document Type" variant="outlined" density="compact" hide-details />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field v-model="uploadTitle" label="Title (optional)" variant="outlined" density="compact" hide-details />
                </v-col>
                <v-col cols="12">
                  <div class="d-flex justify-end">
                    <v-btn :color="color" :disabled="!uploadFile || !uploadType" prepend-icon="mdi-upload" @click="submitUpload">
                      {{ mode === 'staging' ? 'Stage File' : 'Upload' }}
                    </v-btn>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-expand-transition>

        <!-- XXX-A: Link submission form panel -->
        <v-expand-transition>
          <v-card v-if="showLinkForm && canUpload && mode !== 'view'" variant="tonal" color="blue-grey" class="mb-4">
            <v-card-title class="d-flex align-center ga-2 text-body-2 py-2 px-3">
              <v-icon icon="mdi-link-plus" size="small" />
              Submit External Link
            </v-card-title>
            <v-card-text class="py-2">
              <v-row dense>
                <v-col cols="12">
                  <v-text-field
                    v-model="linkUrl"
                    label="URL *"
                    placeholder="https://drive.google.com/..."
                    prepend-inner-icon="mdi-link"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                    :rules="[(v: string) => !v || URL_RE.test(v) || 'Must be a valid https:// URL']"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="linkTitle" label="Title (optional)" variant="outlined" density="compact" hide-details />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="linkDescription" label="Description (optional)" variant="outlined" density="compact" hide-details />
                </v-col>
                <v-col cols="12" class="d-flex justify-end">
                  <v-btn color="blue-grey" :disabled="!linkUrl || !URL_RE.test(linkUrl)" prepend-icon="mdi-link-plus" @click="submitLink">
                    {{ mode === 'staging' ? 'Stage Link' : 'Submit Link' }}
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-expand-transition>

        <!-- Staged documents (new.vue) -->
        <template v-if="staged.length">
          <div class="text-overline text-medium-emphasis">Pending ({{ staged.length }})</div>
          <v-list density="compact" class="mb-3">
            <v-list-item v-for="s in staged" :key="s.tempId">
              <template #prepend><v-icon icon="mdi-file-clock-outline" color="orange" size="small" /></template>
              <v-list-item-title>{{ s.fileName }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ typeLabel(s.documentType) }} · will upload on save</v-list-item-subtitle>
              <template #append><v-btn icon="mdi-close" size="small" variant="text" color="error" @click.stop="emit('remove-staged', s.tempId)" /></template>
            </v-list-item>
          </v-list>
        </template>

        <!-- ZZZ-C: FILES section (uploaded files only, links in separate section below) -->
        <div v-if="!fileModalDocs.length && !linkModalDocs.length" class="text-center text-grey py-10">
          <v-icon icon="mdi-file-outline" size="40" color="grey-lighten-1" />
          <div class="text-body-2 mt-2">No files match the current filters.</div>
        </div>

        <template v-if="fileModalDocs.length">
          <div class="text-overline font-weight-bold mb-1">
            <v-icon size="14" class="mr-1">mdi-file-multiple-outline</v-icon>
            Files ({{ fileModalDocs.length }})
          </div>
          <v-list density="compact">
            <v-list-item v-for="doc in pagedModalDocs" :key="doc.id">
              <template #prepend>
                <v-icon icon="mdi-file-document" :color="color" size="small" />
              </template>
              <v-list-item-title>
                <a href="#" class="text-decoration-none" @click.prevent="downloadDoc(doc)">{{ doc.fileName }}</a>
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ typeLabel(doc.documentType) }}
                <span v-if="doc.uploadedByName"> · {{ doc.uploadedByName }}</span>
                <span v-if="doc.createdAt"> · {{ formatDate(doc.createdAt) }}</span>
                <span v-if="doc.version != null"> · v{{ doc.version }}</span>
                <span v-if="doc.fileSize"> · {{ formatSize(doc.fileSize) }}</span>
                <v-chip v-if="doc.lifecycleStatus && doc.lifecycleStatus !== 'ACTIVE'" size="x-small" variant="tonal" color="grey" class="ml-1">{{ doc.lifecycleStatus }}</v-chip>
              </v-list-item-subtitle>
              <template #append>
                <div class="d-flex align-center ga-1">
                  <v-btn variant="text" size="small" icon="mdi-download" title="Download file" @click.stop="downloadDoc(doc)" />
                  <v-btn v-if="canDelete" icon="mdi-delete" size="small" variant="text" color="error" title="Delete from repository" @click.stop="emit('delete', doc.id)" />
                </div>
              </template>
            </v-list-item>
          </v-list>
          <div v-if="hasMoreModalDocs" class="text-center mt-2">
            <v-btn variant="text" size="small" @click="modalDisplayLimit += MODAL_PAGE_SIZE">
              Load more ({{ fileModalDocs.length - modalDisplayLimit }} remaining)
            </v-btn>
          </div>
        </template>

        <!-- ZZZ-C: EXTERNAL LINKS section (separate from files) -->
        <template v-if="linkModalDocs.length">
          <v-divider class="my-3" />
          <div class="text-overline font-weight-bold mb-1">
            <v-icon size="14" class="mr-1">mdi-link-variant</v-icon>
            External Links ({{ linkModalDocs.length }})
          </div>
          <v-list density="compact">
            <v-list-item v-for="doc in linkModalDocs" :key="doc.id">
              <template #prepend>
                <v-icon
                  :icon="doc.mimeType === 'application/x-google-drive-link' ? 'mdi-google-drive' : 'mdi-link-variant'"
                  color="info"
                  size="small"
                />
              </template>
              <v-list-item-title>
                <a :href="doc.filePath" target="_blank" rel="noopener" class="text-decoration-none">
                  {{ doc.fileName }}
                </a>
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                <span v-if="doc.uploadedByName">{{ doc.uploadedByName }}</span>
                <span v-if="doc.createdAt"> · {{ formatDate(doc.createdAt) }}</span>
                <span v-if="doc.description"> · {{ doc.description }}</span>
              </v-list-item-subtitle>
              <template #append>
                <div class="d-flex align-center ga-1">
                  <v-btn
                    variant="text" size="small" icon="mdi-open-in-new"
                    title="Open link in new tab"
                    tag="a" :href="doc.filePath" target="_blank" rel="noopener"
                  />
                  <v-btn
                    variant="text" size="small" icon="mdi-content-copy"
                    title="Copy link URL"
                    @click.stop="copyLink(doc.filePath)"
                  />
                  <v-btn
                    v-if="canDelete"
                    icon="mdi-delete" size="small" variant="text" color="error"
                    title="Remove link"
                    @click.stop="emit('delete', doc.id)"
                  />
                </div>
              </template>
            </v-list-item>
          </v-list>
        </template>

        <!-- AAA-H-5: recent activity -->
        <template v-if="projectId">
          <v-divider class="mt-4" />
          <v-expansion-panels variant="accordion" class="mt-2">
            <v-expansion-panel>
              <v-expansion-panel-title class="text-caption text-medium-emphasis">
                <v-icon icon="mdi-history" size="small" class="mr-1" />Recent Activity
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div v-if="!recentActivity.length" class="text-caption text-grey pa-2">No recent events.</div>
                <v-list v-else density="compact" class="pa-0">
                  <v-list-item v-for="ev in recentActivity" :key="ev.id" class="px-0">
                    <v-list-item-title class="text-caption">{{ ev.userName }} · {{ ev.action.toLowerCase() }}</v-list-item-title>
                    <v-list-item-subtitle class="text-caption text-grey">{{ formatDate(ev.createdAt) }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
