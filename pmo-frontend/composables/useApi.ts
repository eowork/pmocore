export interface ApiError {
  message: string
  statusCode: number
}

export function useApi() {
  const config = useRuntimeConfig()
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  // T-JWT-EXPIRY: global 401 handler. When a request that DID carry a token is rejected as
  // unauthorized (expired/invalid token), clear it and redirect to /login — replacing the broken
  // "Viewer/blank-name" limbo with a clean re-login. Guarded on `hadToken` so a failed login
  // (no token) and public calls are unaffected, and on the current path to avoid a redirect loop.
  function handleUnauthorized(status: number, hadToken: boolean): void {
    if (status !== 401 || !hadToken || !import.meta.client) return
    localStorage.removeItem('access_token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    loading.value = true
    error.value = null

    try {
      const token = import.meta.client ? localStorage.getItem('access_token') : null

      // In dev mode, use relative URLs (proxy handles routing to backend)
      // In production, use full URL from config
      const baseUrl = config.public.apiBase

      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      })

      // Handle error responses first
      if (!response.ok) {
        handleUnauthorized(response.status, !!token)
        // Check content type for error responses
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          throw {
            message: 'Backend unreachable. Start backend first: cd pmo-backend && npm run start:dev',
            statusCode: 503,
          }
        }

        const errorData = await response.json().catch(() => ({}))
        throw {
          message: errorData.message || `HTTP error ${response.status}`,
          statusCode: response.status,
        }
      }

      // Handle 204/205 No Content responses (DELETE operations)
      if (response.status === 204 || response.status === 205) {
        return {} as T
      }

      // Check content type for successful responses with body
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw {
          message: 'Invalid response format from server',
          statusCode: 500,
        }
      }

      return await response.json()
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError
      throw apiError
    } finally {
      loading.value = false
    }
  }

  async function get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'GET' })
  }

  async function post<T>(endpoint: string, data: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async function put<T>(endpoint: string, data: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async function patch<T>(endpoint: string, data: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async function del<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' })
  }

  // Phase HL: File upload via FormData (Directive 143)
  async function upload<T>(endpoint: string, formData: FormData): Promise<T> {
    loading.value = true
    error.value = null
    try {
      const token = import.meta.client ? localStorage.getItem('access_token') : null
      const baseUrl = config.public.apiBase
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })
      if (!response.ok) {
        handleUnauthorized(response.status, !!token)
        const contentType = response.headers.get('content-type') || ''
        const errorData = contentType.includes('application/json')
          ? await response.json().catch(() => ({}))
          : {}
        throw {
          message: errorData.message || `Upload error ${response.status}`,
          statusCode: response.status,
        }
      }
      return await response.json()
    } catch (err) {
      const apiError = err as ApiError
      error.value = apiError
      throw apiError
    } finally {
      loading.value = false
    }
  }

  /**
   * Upload with byte-level progress.
   *
   * fetch() cannot report how much of a request body has been sent, so this one call uses
   * XMLHttpRequest, whose upload.onprogress is the only browser API that measures the
   * transfer. Everything after the last byte lands is server-side work the browser cannot
   * observe; that part arrives separately over the SSE channel (see useDocumentUpload).
   *
   * Returns the parsed JSON body like upload(), and rejects with the same ApiError shape,
   * so a caller can be swapped over without changing its error handling.
   */
  function uploadWithProgress<T>(
    endpoint: string,
    formData: FormData,
    options: {
      headers?: Record<string, string>
      onProgress?: (percent: number, loaded: number, total: number) => void
      signal?: AbortSignal
    } = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const token = import.meta.client ? localStorage.getItem('access_token') : null
      const baseUrl = config.public.apiBase
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${baseUrl}${endpoint}`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      for (const [k, v] of Object.entries(options.headers ?? {})) xhr.setRequestHeader(k, v)

      xhr.upload.onprogress = (e) => {
        if (!options.onProgress) return
        // lengthComputable is false for a chunked body; report 0 rather than a wrong number.
        const percent = e.lengthComputable && e.total > 0 ? (e.loaded / e.total) * 100 : 0
        options.onProgress(percent, e.loaded, e.total)
      }

      xhr.onload = () => {
        let body: any = {}
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
        } catch {
          body = {}
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as T)
          return
        }
        handleUnauthorized(xhr.status, !!token)
        reject({ message: body?.message || `Upload error ${xhr.status}`, statusCode: xhr.status })
      }
      xhr.onerror = () => reject({ message: 'Network error during upload', statusCode: 0 })
      xhr.onabort = () => reject({ message: 'Upload cancelled', statusCode: 0 })

      if (options.signal) {
        if (options.signal.aborted) {
          xhr.abort()
          return
        }
        options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
      }

      xhr.send(formData)
    })
  }

  /**
   * Read a Server-Sent Events endpoint with the Authorization header attached.
   *
   * EventSource cannot send headers and every API route here sits behind a JWT guard, so
   * the stream is consumed with fetch plus a ReadableStream reader instead. onEvent gets
   * each parsed 'data:' payload; the promise resolves when the server closes the stream.
   */
  async function streamEvents(
    endpoint: string,
    onEvent: (data: any) => void,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const token = import.meta.client ? localStorage.getItem('access_token') : null
    const baseUrl = config.public.apiBase
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        Accept: 'text/event-stream',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: options.signal,
    })
    if (!response.ok || !response.body) {
      handleUnauthorized(response.status, !!token)
      throw { message: `Event stream error ${response.status}`, statusCode: response.status }
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE frames are separated by a blank line; a partial frame stays in the buffer.
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw) continue
          try {
            onEvent(JSON.parse(raw))
          } catch {
            // Ignore a malformed frame rather than tearing down the stream.
          }
        }
      }
    }
  }

  // CCC-A: Authenticated blob download — preserves original filename via the
  // backend Content-Disposition header; falls back to the passed name.
  async function download(endpoint: string, fileName: string): Promise<void> {
    const token = import.meta.client ? localStorage.getItem('access_token') : null
    const baseUrl = config.public.apiBase
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    })
    if (!response.ok) {
      handleUnauthorized(response.status, !!token)
      const contentType = response.headers.get('content-type') || ''
      const errorData = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {}
      throw {
        message: (errorData as ApiError).message || `Download error ${response.status}`,
        statusCode: response.status,
      }
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return {
    loading,
    error,
    request,
    get,
    post,
    put,
    patch,
    del,
    upload,
    uploadWithProgress,
    streamEvents,
    download,
  }
}
