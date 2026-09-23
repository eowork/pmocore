/**
 * Document upload with live feedback.
 *
 * Two independent sources are combined, because neither one sees the whole operation:
 *
 *  1. XMLHttpRequest upload progress — the only way to measure bytes leaving the browser.
 *     Covers the transfer and nothing else; once the last byte is sent it reports 100 %
 *     while the server may still be working.
 *  2. A Server-Sent Events channel — the server publishing what it does after the body
 *     arrives (validate, write to MinIO, commit the row). The browser cannot observe any
 *     of that, which is exactly the stretch where an upload used to look frozen.
 *
 * The client generates the upload id, subscribes to the channel, then sends the file with
 * that id in X-Upload-Id. The backend replays buffered events on subscribe, so a late
 * subscription still shows every phase.
 *
 * The SSE half is best-effort: if the stream cannot be opened (proxy without streaming
 * support, multi-node deployment without sticky sessions), the upload still runs and the
 * bar still moves on transfer progress alone.
 */

export type UploadPhase =
  | 'transferring'
  | 'received'
  | 'validating'
  | 'storing'
  | 'stored'
  | 'persisting'
  | 'done'
  | 'failed'

export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  /**
   * Which sub-resource this upload went to, and — for a document — the type it was filed
   * under. The attachment hub matches these against a repository card's type codes so the
   * progress bar appears inside the card the user uploaded into.
   */
  resource: string
  typeCode: string | null
  /** 0-100, blending transfer progress with the server phases. */
  percent: number
  phase: UploadPhase
  /** Human-readable label for the current phase. */
  label: string
  error: string | null
  done: boolean
}

/**
 * Where each phase sits on the bar.
 *
 * The transfer is given the first 80 % because it dominates wall-clock time on a normal
 * connection. The remaining 20 % is the server's, so the bar keeps moving through the
 * MinIO write instead of parking at 100 % while the request is still open.
 */
const PHASE_PERCENT: Record<UploadPhase, number> = {
  transferring: 0,
  received: 82,
  validating: 86,
  storing: 90,
  stored: 95,
  persisting: 98,
  done: 100,
  failed: 100,
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  transferring: 'Uploading…',
  received: 'Received, checking file…',
  validating: 'Validating file…',
  storing: 'Saving to storage…',
  stored: 'Saved to storage',
  persisting: 'Recording document…',
  done: 'Complete',
  failed: 'Failed',
}

const TRANSFER_SHARE = 0.8

/**
 * projectId may be a plain string or a getter, so a component whose prop changes (or is
 * empty on first render) still uploads against the project current at send time.
 */
export function useDocumentUpload(projectId: MaybeRefOrGetter<string>) {
  const api = useApi()
  const resolveProjectId = () => toValue(projectId)
  const tasks = ref<UploadTask[]>([])

  const activeTasks = computed(() => tasks.value.filter(t => !t.done))
  const isUploading = computed(() => activeTasks.value.length > 0)
  /** Aggregate percentage across everything still running, for a single summary bar. */
  const overallPercent = computed(() => {
    if (!activeTasks.value.length) return 0
    const total = activeTasks.value.reduce((sum, t) => sum + t.percent, 0)
    return Math.round(total / activeTasks.value.length)
  })

  function newId(): string {
    // randomUUID needs a secure context; the fallback keeps http://<lan-ip> dev hosts working.
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-4000-8000-${Math.random().toString(16).slice(2, 14)}`
  }

  function setPhase(task: UploadTask, phase: UploadPhase) {
    // Never move the bar backwards: a phase event can arrive while the transfer figure is
    // still climbing, and a bar that jumps back reads as a fault.
    task.phase = phase
    task.label = PHASE_LABEL[phase]
    task.percent = Math.max(task.percent, PHASE_PERCENT[phase])
  }

  /** Remove finished tasks so the panel does not grow without bound. */
  function clearFinished() {
    tasks.value = tasks.value.filter(t => !t.done)
  }

  /**
   * Upload one file to a project sub-resource and track it.
   *
   * resource is the path after the project id — 'documents', 'gallery' or
   * 'mov-entries/<id>/upload-file'; fields are the multipart fields that endpoint expects.
   * Resolves with the created record, or rejects the way api.upload() does, so existing
   * try/catch at a call site keeps working.
   */
  async function uploadToResource(
    resource: string,
    file: File,
    fields: Record<string, string | undefined>,
  ): Promise<any> {
    const uploadId = newId()
    const task = reactive<UploadTask>({
      id: uploadId,
      fileName: file.name,
      fileSize: file.size,
      resource,
      typeCode: fields.documentType ?? null,
      percent: 0,
      phase: 'transferring',
      label: PHASE_LABEL.transferring,
      error: null,
      done: false,
    })
    tasks.value.push(task)

    // Abort the stream when the upload settles, so a dropped connection cannot leave a
    // reader running for the lifetime of the page.
    const controller = new AbortController()

    // Subscribe BEFORE sending, so the early phases are seen live. Failure here is not
    // fatal: the upload proceeds and the bar falls back to transfer progress only.
    const streamed = api
      .streamEvents(
        `/api/construction-projects/${resolveProjectId()}/uploads/progress/${uploadId}`,
        (event: { phase?: UploadPhase | 'ping'; message?: string }) => {
          if (!event?.phase || event.phase === 'ping') return
          if (event.phase === 'failed') {
            task.error = event.message || 'Upload failed'
            setPhase(task, 'failed')
            return
          }
          setPhase(task, event.phase)
        },
        { signal: controller.signal },
      )
      .catch(() => {
        // Stream unavailable — transfer progress alone still drives the bar.
      })

    const formData = new FormData()
    formData.append('file', file)
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== '') formData.append(key, value)
    }

    try {
      const result = await api.uploadWithProgress<any>(
        `/api/construction-projects/${resolveProjectId()}/${resource}`,
        formData,
        {
          headers: { 'X-Upload-Id': uploadId },
          onProgress: (percent) => {
            if (task.phase !== 'transferring') return
            task.percent = Math.max(task.percent, percent * TRANSFER_SHARE)
          },
        },
      )
      setPhase(task, 'done')
      return result
    } catch (err) {
      task.error = (err as { message?: string })?.message || 'Upload failed'
      setPhase(task, 'failed')
      throw err
    } finally {
      task.done = true
      controller.abort()
      await streamed
      // Keep a failure on screen until the next upload starts; a success disappears on its
      // own so the panel does not need dismissing after every file.
      if (!task.error) {
        setTimeout(() => {
          tasks.value = tasks.value.filter(t => t.id !== task.id)
        }, 1500)
      }
    }
  }

  /** Upload a document (file plus documentType/title/description). */
  function uploadDocument(
    file: File,
    fields: Record<string, string | undefined>,
  ): Promise<any> {
    return uploadToResource('documents', file, fields)
  }

  /** Upload a gallery image (file plus caption/category/image_taken_date). */
  function uploadGalleryItem(
    file: File,
    fields: Record<string, string | undefined>,
  ): Promise<any> {
    return uploadToResource('gallery', file, fields)
  }

  /**
   * Attach a file to an existing MOV entry.
   *
   * The MOV endpoint takes the file alone; the entry itself is created first with a JSON
   * POST. Kept here so MOV evidence is tracked like every other upload.
   */
  function uploadMovFile(movEntryId: string, file: File): Promise<any> {
    return uploadToResource(`mov-entries/${movEntryId}/upload-file`, file, {})
  }

  /** Upload several files one after another, so the progress list stays readable. */
  async function uploadDocuments(
    files: File[],
    fields: Record<string, string | undefined>,
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0
    let failed = 0
    for (const file of files) {
      try {
        await uploadDocument(file, fields)
        succeeded++
      } catch {
        failed++
      }
    }
    return { succeeded, failed }
  }

  return {
    tasks,
    activeTasks,
    isUploading,
    overallPercent,
    uploadDocument,
    uploadGalleryItem,
    uploadMovFile,
    uploadDocuments,
    clearFinished,
  }
}
