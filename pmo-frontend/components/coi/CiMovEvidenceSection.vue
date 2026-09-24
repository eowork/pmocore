<script setup lang="ts">
/**
 * Phase KO-D / KO-E: MOV (Means of Verification) Evidence Section.
 * Embedded inside milestone and work-log detail modals.
 * Lists existing evidence + provides an inline add form + per-row delete.
 */
import { useToast } from '~/composables/useToast'
import { useMovSafe } from '~/composables/useMovSafe'

interface MovEntry {
  id: string
  projectId: string
  relatedEntityType: 'MILESTONE' | 'TIMELINE_ENTRY'
  relatedEntityId: string
  movLink?: string | null
  movTitle: string
  movDescription?: string | null
  evidenceCategory: string
  entryDate?: string | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  remarks?: string | null
  createdAt?: string | null
  // LC-C: file upload fields
  filePath?: string | null
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
}

interface Props {
  projectId: string
  relatedEntityType: 'MILESTONE' | 'TIMELINE_ENTRY'
  relatedEntityId: string
  canEdit: boolean
  /** Key that changes when the parent modal re-opens with a new entity — triggers refetch. */
  openKey?: string
}
const props = defineProps<Props>()

const api = useApi()
const toast = useToast()
const { openMovSafely, openFileSafely } = useMovSafe()

const MOV_EVIDENCE_CATEGORIES = [
  { title: 'Photo Documentation', value: 'photo_documentation' },
  { title: 'Inspection Report', value: 'inspection_report' },
  { title: 'Completion Certificate', value: 'completion_certificate' },
  { title: 'Site Visit Record', value: 'site_visit' },
  { title: 'Progress Report', value: 'progress_report' },
  { title: 'Test/Quality Result', value: 'test_result' },
  { title: 'Meeting Minutes', value: 'meeting_minutes' },
  { title: 'Official Document', value: 'official_document' },
  { title: 'Other', value: 'other' },
] as const

const MOV_URL_REGEX = /^https?:\/\/.+/i

const entries = ref<MovEntry[]>([])
const loading = ref(false)

// Add-form state
const showAddForm = ref(false)
// LC-C: input mode toggle — 'link' (URL) or 'file' (upload)
const inputMode = ref<'link' | 'file'>('link')
const formLink = ref('')
const formTitle = ref('')
const formDescription = ref('')
const formCategory = ref<string>('other')
const formEntryDate = ref('')
const formRemarks = ref('')
const submitting = ref(false)

// LC-C: file upload state
const fileInput = ref<File | null>(null)

const deleting = ref<Record<string, boolean>>({})

async function fetchEntries() {
  if (!props.projectId || !props.relatedEntityId) return
  loading.value = true
  try {
    const res = await api.get<MovEntry[] | { data: MovEntry[] }>(
      `/api/construction-projects/${props.projectId}/mov-entries?relatedEntityType=${props.relatedEntityType}&relatedEntityId=${props.relatedEntityId}`,
    )
    entries.value = Array.isArray(res) ? res : (res?.data || [])
  } catch (err) {
    console.error('[CiMovEvidenceSection] fetch failed:', err)
    entries.value = []
  } finally {
    loading.value = false
  }
}

function resetForm() {
  formLink.value = ''
  formTitle.value = ''
  formDescription.value = ''
  formCategory.value = 'other'
  formEntryDate.value = ''
  formRemarks.value = ''
  fileInput.value = null
  showAddForm.value = false
}

async function submit() {
  if (inputMode.value === 'file') {
    await submitFile()
  } else {
    await submitLink()
  }
}

async function submitLink() {
  if (!formLink.value || !MOV_URL_REGEX.test(formLink.value)) {
    toast.error('Evidence link must be a valid https:// URL.')
    return
  }
  if (!formTitle.value.trim()) {
    toast.error('Evidence title is required.')
    return
  }
  submitting.value = true
  try {
    await api.post(`/api/construction-projects/${props.projectId}/mov-entries`, {
      related_entity_type: props.relatedEntityType,
      related_entity_id: props.relatedEntityId,
      mov_link: formLink.value,
      mov_title: formTitle.value,
      mov_description: formDescription.value || undefined,
      evidence_category: formCategory.value || 'other',
      entry_date: formEntryDate.value || undefined,
      remarks: formRemarks.value || undefined,
    })
    toast.success('Evidence link added.')
    resetForm()
    await fetchEntries()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to add evidence.')
  } finally {
    submitting.value = false
  }
}

// LC-C: two-step file upload — create entry first, then upload file
// Transfer progress plus the server's post-transfer phases for the evidence file. A MOV
// is often a photo or a scanned form, so the wait is long enough to need feedback.
const {
  tasks: movUploadTasks,
  isUploading: movUploadRunning,
  overallPercent: movUploadPercent,
  uploadMovFile: trackedUploadMovFile,
} = useDocumentUpload(() => props.projectId)

async function submitFile() {
  if (!fileInput.value) { toast.error('Please select a file.'); return }
  if (fileInput.value.size > 15 * 1024 * 1024) { toast.error('File must be ≤ 15 MB.'); return }
  if (!formTitle.value.trim()) { toast.error('Evidence title is required.'); return }
  submitting.value = true
  try {
    const created = await api.post<{ id: string }>(`/api/construction-projects/${props.projectId}/mov-entries`, {
      related_entity_type: props.relatedEntityType,
      related_entity_id: props.relatedEntityId,
      mov_title: formTitle.value,
      mov_description: formDescription.value || undefined,
      evidence_category: formCategory.value || 'other',
      entry_date: formEntryDate.value || undefined,
      remarks: formRemarks.value || undefined,
    })
    await trackedUploadMovFile((created as any).id, fileInput.value)
    toast.success('File evidence added.')
    resetForm()
    await fetchEntries()
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to upload file evidence.')
  } finally {
    submitting.value = false
  }
}

async function removeEntry(entryId: string) {
  deleting.value[entryId] = true
  try {
    await api.del(`/api/construction-projects/${props.projectId}/mov-entries/${entryId}`)
    entries.value = entries.value.filter(e => e.id !== entryId)
    toast.success('Evidence removed.')
  } catch (err: unknown) {
    toast.error((err as { message?: string })?.message || 'Failed to remove evidence.')
  } finally {
    deleting.value[entryId] = false
  }
}

function categoryLabel(value: string): string {
  return MOV_EVIDENCE_CATEGORIES.find(c => c.value === value)?.title || value
}

function statusColor(s: string): string {
  if (s === 'VERIFIED') return 'success'
  if (s === 'REJECTED') return 'error'
  return 'warning'
}

watch(
  () => [props.relatedEntityId, props.openKey],
  () => {
    if (props.relatedEntityId) fetchEntries()
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <CiUploadProgressPanel
      :tasks="movUploadTasks"
      :running="movUploadRunning"
      :overall-percent="movUploadPercent"
    />
    <div class="d-flex align-center mb-2 ga-2">
      <v-icon icon="mdi-link-variant" size="small" color="primary" />
      <span class="text-subtitle-2 font-weight-medium">Means of Verification (MOV)</span>
      <v-chip size="x-small" variant="tonal" color="primary">{{ entries.length }}</v-chip>
      <v-spacer />
      <v-btn
        v-if="canEdit && !showAddForm"
        variant="text"
        size="small"
        prepend-icon="mdi-plus"
        color="primary"
        @click="showAddForm = true"
      >
        Add Evidence
      </v-btn>
    </div>

    <div v-if="loading" class="text-center py-4">
      <v-progress-circular indeterminate size="20" color="primary" />
    </div>

    <div v-else-if="entries.length === 0 && !showAddForm" class="text-caption text-grey py-2">
      No evidence attached yet.
    </div>

    <!-- LC-C: entry list — distinguish URL vs file entries -->
    <v-list v-else-if="entries.length > 0" density="compact" class="pa-0 mb-2">
      <v-list-item v-for="e in entries" :key="e.id" class="px-2 border-b">
        <template #prepend>
          <v-icon size="small" :color="e.filePath ? 'teal' : 'primary'">{{ e.filePath ? 'mdi-paperclip' : 'mdi-link-variant' }}</v-icon>
        </template>
        <v-list-item-title class="d-flex align-center ga-2 flex-wrap">
          <template v-if="e.filePath">
            <span
              class="text-teal text-decoration-none"
              style="cursor: pointer"
              @click="openFileSafely(e.filePath)"
            >{{ e.fileName || e.movTitle }}</span>
          </template>
          <!-- URL entry -->
          <template v-else>
            <span
              class="text-primary text-decoration-none"
              style="cursor: pointer"
              @click="openMovSafely(e.movLink)"
            >{{ e.movTitle }}</span>
          </template>
          <v-chip size="x-small" variant="tonal" color="info">{{ categoryLabel(e.evidenceCategory) }}</v-chip>
          <v-chip size="x-small" variant="tonal" :color="statusColor(e.verificationStatus)">
            {{ e.verificationStatus }}
          </v-chip>
        </v-list-item-title>
        <v-list-item-subtitle v-if="e.movDescription || e.entryDate" class="mt-1">
          <span v-if="e.entryDate" class="text-caption text-grey">{{ e.entryDate }}</span>
          <span v-if="e.movDescription"> · {{ e.movDescription }}</span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            v-if="canEdit"
            icon="mdi-delete"
            size="x-small"
            variant="text"
            color="error"
            :loading="!!deleting[e.id]"
            @click.stop="removeEntry(e.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <!-- Add form -->
    <v-card v-if="showAddForm" variant="outlined" class="pa-3 mb-2">
      <!-- LC-C: mode toggle -->
      <v-btn-toggle v-model="inputMode" density="compact" variant="outlined" :mandatory="true" class="mb-3">
        <v-btn value="link" size="small" prepend-icon="mdi-link-variant">URL Link</v-btn>
        <v-btn value="file" size="small" prepend-icon="mdi-paperclip">File Upload</v-btn>
      </v-btn-toggle>
      <v-row dense>
        <!-- URL mode -->
        <template v-if="inputMode === 'link'">
          <v-col cols="12" sm="8">
            <v-text-field
              v-model="formLink"
              label="Evidence Link (https://...)"
              placeholder="https://drive.google.com/..., https://sharepoint.com/..."
              variant="outlined"
              density="compact"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="formEntryDate"
              type="date"
              label="Entry Date"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
        </template>
        <!-- File mode -->
        <template v-else>
          <v-col cols="12">
            <v-file-input
              v-model="fileInput"
              label="File (image or document, ≤ 15 MB)"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              prepend-icon="mdi-paperclip"
              show-size
              variant="outlined"
              density="compact"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" sm="8">
            <v-text-field
              v-model="formEntryDate"
              type="date"
              label="Entry Date"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
        </template>
        <v-col cols="12" sm="8">
          <v-text-field
            v-model="formTitle"
            label="Title *"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="formCategory"
            :items="MOV_EVIDENCE_CATEGORIES"
            label="Category"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="formDescription"
            label="Description (optional)"
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            hide-details
          />
        </v-col>
        <v-col cols="12">
          <v-text-field
            v-model="formRemarks"
            label="Remarks (optional)"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
      </v-row>
      <div class="d-flex justify-end mt-3 ga-2">
        <v-btn variant="text" size="small" @click="resetForm">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          :loading="submitting"
          prepend-icon="mdi-content-save"
          @click="submit"
        >
          Save Evidence
        </v-btn>
      </div>
    </v-card>
  </div>
</template>
