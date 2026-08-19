import { defineStore } from 'pinia'
import { adaptUser, type UIUser, type BackendUser } from '~/utils/adapters'

interface LoginResponse {
  access_token: string
  user: BackendUser
}

export const useAuthStore = defineStore('auth', () => {
  const api = useApi()

  // State
  const user = ref<UIUser | null>(null)
  const token = ref<string | null>(null)

  // Initialize token from localStorage (client-side only)
  if (import.meta.client) {
    token.value = localStorage.getItem('access_token')
  }

  // T-JWT-EXPIRY: treat an expired token as logged-out by decoding its `exp` client-side, so the
  // app redirects to login cleanly instead of rendering a stale "authenticated" (Viewer/blank) state
  // when the token has lapsed but its string still sits in localStorage.
  function isTokenValid(t: string | null): boolean {
    if (!t) return false
    try {
      const part = t.split('.')[1]
      const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
    } catch {
      return false
    }
  }

  // Getters
  const isAuthenticated = computed(() => isTokenValid(token.value))
  const userFullName = computed(() => user.value?.fullName || '')
  const userEmail = computed(() => user.value?.email || '')
  // NNN-F: avatar URL surfaced for app-bar + profile page
  const userAvatarUrl = computed(() => user.value?.avatarUrl || '')

  // NNN-I: merge a partial profile update into the cached user (after PATCH /auth/me)
  function patchUser(partial: Partial<UIUser>): void {
    if (user.value) user.value = { ...user.value, ...partial }
  }

  // Actions
  async function login(identifier: string, password: string): Promise<void> {
    const response = await api.post<LoginResponse>('/api/auth/login', {
      identifier,
      password,
    })

    token.value = response.access_token
    if (import.meta.client) {
      localStorage.setItem('access_token', response.access_token)
    }
    user.value = adaptUser(response.user)
    // VG-B: load per-project permission map for stateless render-time access
    if (import.meta.client) {
      await useProjectPermissionsStore().fetch()
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout', {})
    } catch {
      // Ignore logout API errors - clear state anyway
    } finally {
      token.value = null
      user.value = null
      if (import.meta.client) {
        localStorage.removeItem('access_token')
        // VG-B: clear cached project permissions on logout
        useProjectPermissionsStore().clear()
      }
    }
  }

  async function fetchCurrentUser(): Promise<void> {
    if (!token.value) return

    try {
      const backendUser = await api.get<BackendUser>('/api/auth/me')
      user.value = adaptUser(backendUser)
      // VG-B: load per-project permission map for stateless render-time access
      if (import.meta.client) {
        await useProjectPermissionsStore().fetch()
      }
    } catch (err: any) {
      if (err?.statusCode === 401) {
        token.value = null
        user.value = null
        if (import.meta.client) {
          localStorage.removeItem('access_token')
        }
      } else {
        console.warn('[Auth] Failed to fetch user (non-401), preserving token:', err?.message)
      }
    }
  }

  // Phase HT: Google OAuth token-based login (Directive 208)
  async function loginWithToken(accessToken: string): Promise<void> {
    token.value = accessToken
    if (import.meta.client) {
      localStorage.setItem('access_token', accessToken)
    }
    await fetchCurrentUser()
  }

  function hasPermission(permission: string): boolean {
    if (!user.value) return false
    if (user.value.isSuperAdmin) return true
    return user.value.permissions.includes(permission)
  }

  function hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((p) => hasPermission(p))
  }

  // Initialize: fetch user if token exists
  async function initialize(): Promise<void> {
    if (token.value) {
      await fetchCurrentUser()
    }
  }

  // PHASE BBBD (Track 2): live permission refresh without re-login. Re-fetches /auth/me so a
  // newly-approved access level / SuperAdmin designation propagates to the active session.
  // Throttled (default 60s) so on-navigation calls stay cheap.
  const lastRefreshAt = ref(0)
  async function refreshPermissions(force = false): Promise<void> {
    if (!token.value || !user.value) return
    const now = Date.now()
    if (!force && now - lastRefreshAt.value < 60000) return
    lastRefreshAt.value = now
    await fetchCurrentUser()
  }

  return {
    // State
    user,
    token,
    // Getters
    isAuthenticated,
    userFullName,
    userEmail,
    userAvatarUrl,
    // Actions
    login,
    loginWithToken,
    logout,
    fetchCurrentUser,
    patchUser,
    hasPermission,
    hasAnyPermission,
    initialize,
    refreshPermissions,
    // Loading state from API
    loading: api.loading,
    error: api.error,
  }
})
