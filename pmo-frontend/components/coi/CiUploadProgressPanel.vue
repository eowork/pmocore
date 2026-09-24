<script setup lang="ts">
/**
 * Live upload feedback, shared by every place that uploads a file for a project.
 *
 * Dumb and controlled: the owner runs useDocumentUpload() and passes its tasks here, so a
 * page with several upload entry points still shows one consistent panel.
 *
 * The bar blends two measurements the caller has already combined — bytes leaving the
 * browser, then the phases the server reports over SSE — which is why it keeps moving
 * after the transfer reaches 100 %.
 */
import type { UploadTask } from '~/composables/useDocumentUpload'

const props = withDefaults(
  defineProps<{
    tasks: UploadTask[]
    /** Shown while at least one task is still running. */
    running?: boolean
    /** Mean percentage across running tasks, for the header line. */
    overallPercent?: number
    title?: string
  }>(),
  { running: false, overallPercent: 0, title: 'Uploading' },
)

const headline = computed(() => {
  if (!props.running) return 'Upload finished'
  const count = props.tasks.filter(t => !t.done).length
  const suffix = count === 1 ? 'file' : 'files'
  return `${props.title} ${count} ${suffix} — ${props.overallPercent}%`
})

function barColor(task: UploadTask): string {
  if (task.error) return 'error'
  return task.phase === 'done' ? 'success' : 'info'
}
</script>

<template>
  <v-expand-transition>
    <v-card v-if="tasks.length" variant="tonal" color="info" class="mb-3" rounded="lg">
      <v-card-text class="py-3">
        <div class="d-flex align-center ga-2 mb-2">
          <v-progress-circular v-if="running" indeterminate size="18" width="2" color="info" />
          <v-icon v-else icon="mdi-check-circle-outline" size="18" color="success" />
          <span class="text-subtitle-2 font-weight-medium">{{ headline }}</span>
        </div>
        <div v-for="task in tasks" :key="task.id" class="mb-2">
          <div class="d-flex justify-space-between align-center ga-2 text-caption">
            <span class="text-truncate" style="max-width: 60%">{{ task.fileName }}</span>
            <span :class="task.error ? 'text-error' : 'text-grey-darken-1'" class="text-right">
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
      </v-card-text>
    </v-card>
  </v-expand-transition>
</template>
