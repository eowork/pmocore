<script setup lang="ts">
// ZY-2: Summary card for a repository section (Key Docs / Orders / Reports /
// Certifications / Other Forms). Shows document count, latest upload metadata,
// and action buttons. Detail lives in CiRepositoryModal (opened via @open).
// III-E: Extended with optional templateUrl, statusBreakdown, and uploaderName props.
// WWW-A: Removed misleading "Type coverage" progress bar (completedCount/totalTypes
// has no defined meaning for open-ended document repositories). Shows file count
// chip + latest upload line instead.

import type { UploadTask } from '~/composables/useDocumentUpload'

interface StatusBreakdown {
  submitted: number
  approved: number
  rejected: number
  underReview: number
}

interface Props {
  title: string
  icon: string
  color: string
  docCount: number
  latestUpload?: string | null
  canUpload?: boolean
  loading?: boolean
  templateUrl?: string | null
  statusBreakdown?: StatusBreakdown | null
  uploaderName?: string | null
  canDownloadTemplate?: boolean
  /**
   * Uploads currently in flight for THIS repository.
   *
   * Progress used to be shown in one panel at the top of the attachment hub, far from the
   * card the user clicked and usually scrolled out of view behind the repository modal.
   * The owner passes each card only its own tasks, so the bar appears where the file was
   * dropped.
   */
  uploads?: UploadTask[]
}

const props = withDefaults(defineProps<Props>(), {
  latestUpload: null,
  canUpload: false,
  loading: false,
  templateUrl: null,
  statusBreakdown: null,
  uploaderName: null,
  canDownloadTemplate: false,
  uploads: () => [],
})

const emit = defineEmits<{ open: []; upload: [] }>()

const activeUploads = computed(() => props.uploads.filter((t) => !t.done))
const uploadsRunning = computed(() => activeUploads.value.length > 0)
const failedUploads = computed(() => props.uploads.filter((t) => !!t.error))

/** Mean progress across the running uploads, for the single headline figure. */
const uploadPercent = computed(() => {
  if (!activeUploads.value.length) return 0
  const total = activeUploads.value.reduce((sum, t) => sum + t.percent, 0)
  return Math.round(total / activeUploads.value.length)
})

function barColor(task: UploadTask): string {
  if (task.error) return 'error'
  return task.phase === 'done' ? 'success' : 'info'
}

const latestLabel = computed(() => {
  if (!props.latestUpload) return 'No uploads yet'
  const d = new Date(props.latestUpload)
  if (Number.isNaN(d.getTime())) return 'No uploads yet'
  const date = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  return props.uploaderName ? `${props.uploaderName} — ${date}` : `Latest: ${date}`
})
</script>

<template>
  <v-card
    variant="outlined"
    class="d-flex flex-column"
    :class="{ 'upload-active': uploadsRunning, 'upload-failed': !uploadsRunning && failedUploads.length }"
    style="height: 100%"
  >
    <v-card-title class="d-flex align-center ga-2 text-body-1 flex-wrap" style="min-height:48px">
      <v-icon :icon="icon" :color="color" size="small" class="flex-shrink-0" />
      <span class="font-weight-medium flex-grow-1" style="white-space:normal;word-break:break-word;min-width:0;line-height:1.3">{{ title }}</span>
      <v-progress-circular
        v-if="uploadsRunning"
        indeterminate
        size="16"
        width="2"
        color="info"
        class="flex-shrink-0"
      />
      <v-chip size="x-small" variant="tonal" :color="color" class="flex-shrink-0 ml-1">{{ docCount }}</v-chip>
    </v-card-title>

    <!-- Live upload progress for this repository, above the summary so it is the first
         thing that moves when the user uploads here. -->
    <v-expand-transition>
      <div v-if="uploads.length" class="px-4 pt-3">
        <div v-if="uploadsRunning" class="text-caption text-info font-weight-medium mb-1">
          Uploading {{ activeUploads.length }}
          {{ activeUploads.length === 1 ? 'file' : 'files' }} — {{ uploadPercent }}%
        </div>
        <div v-for="task in uploads" :key="task.id" class="mb-2">
          <div class="d-flex justify-space-between align-center ga-2 text-caption">
            <span class="text-truncate" style="max-width: 58%">{{ task.fileName }}</span>
            <span :class="task.error ? 'text-error' : 'text-grey-darken-1'" class="text-right text-truncate">
              {{ task.error || task.label }}
            </span>
          </div>
          <v-progress-linear
            :model-value="task.percent"
            :color="barColor(task)"
            height="6"
            rounded
            class="mt-1"
          />
        </div>
      </div>
    </v-expand-transition>
    <v-divider />
    <v-card-text class="flex-grow-1">
      <!-- WWW-A: File count summary (replaces misleading progress bar) -->
      <div class="d-flex align-center ga-2 flex-wrap mb-2">
        <v-chip size="x-small" variant="tonal" :color="color" prepend-icon="mdi-file-multiple-outline">
          {{ docCount }} {{ docCount === 1 ? 'file' : 'files' }}
        </v-chip>
      </div>

      <!-- Status breakdown chips (III-E) -->
      <div v-if="statusBreakdown" class="d-flex flex-wrap ga-1 mb-2">
        <v-chip v-if="statusBreakdown.approved" size="x-small" color="success" variant="tonal" prepend-icon="mdi-check-circle">{{ statusBreakdown.approved }} Approved</v-chip>
        <v-chip v-if="statusBreakdown.underReview" size="x-small" color="warning" variant="tonal" prepend-icon="mdi-clock-outline">{{ statusBreakdown.underReview }} Under Review</v-chip>
        <v-chip v-if="statusBreakdown.submitted" size="x-small" color="info" variant="tonal" prepend-icon="mdi-send">{{ statusBreakdown.submitted }} Submitted</v-chip>
        <v-chip v-if="statusBreakdown.rejected" size="x-small" color="error" variant="tonal" prepend-icon="mdi-close-circle">{{ statusBreakdown.rejected }} Rejected</v-chip>
      </div>

      <!-- Template download (III-E) -->
      <div v-if="templateUrl" class="mb-2">
        <v-btn
          :href="templateUrl"
          target="_blank"
          rel="noopener"
          variant="text"
          size="x-small"
          color="indigo"
          prepend-icon="mdi-download"
        >
          Download Template
        </v-btn>
      </div>

      <!-- Latest upload line -->
      <div class="text-caption text-grey">
        <v-icon size="x-small" icon="mdi-clock-outline" /> {{ latestLabel }}
      </div>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn variant="text" size="small" :color="color" prepend-icon="mdi-folder-open-outline" @click="emit('open')">
        Open Repository
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="canUpload"
        variant="tonal"
        size="small"
        :color="color"
        prepend-icon="mdi-upload"
        :loading="loading"
        @click="emit('upload')"
      >
        Upload
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
/* A tinted border points at the card an upload belongs to when several sit in one grid. */
.upload-active {
  border-color: rgb(var(--v-theme-info));
}
.upload-failed {
  border-color: rgb(var(--v-theme-error));
}
</style>
