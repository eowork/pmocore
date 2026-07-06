<script setup lang="ts">
definePageMeta({
  layout: 'blank',
  middleware: 'guest',
})

// PT-C: prevent horizontal scrollbar on blank layout pages
useHead({ style: [{ innerHTML: 'html, body { overflow-x: hidden; max-width: 100%; }' }] })

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const api = useApi()

const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')

// Phase HQ: Password reset request
const showResetDialog = ref(false)
const resetIdentifier = ref('')
const resetNotes = ref('')
const resetSubmitting = ref(false)
const resetSuccess = ref(false)

async function submitResetRequest() {
  if (!resetIdentifier.value.trim()) return
  resetSubmitting.value = true
  try {
    await api.post('/api/auth/request-password-reset', {
      identifier: resetIdentifier.value.trim(),
      notes: resetNotes.value.trim() || undefined,
    })
    resetSuccess.value = true
  } catch {
    // Silent — show generic confirmation regardless (security best practice)
    resetSuccess.value = true
  } finally {
    resetSubmitting.value = false
  }
}

function closeResetDialog() {
  showResetDialog.value = false
  resetIdentifier.value = ''
  resetNotes.value = ''
  resetSuccess.value = false
}

// Phase HT: Google OAuth (Directive 206)
const runtimeConfig = useRuntimeConfig()
function handleGoogleLogin() {
  window.location.href = `${runtimeConfig.public.apiBase}/api/auth/google`
}

async function handleLogin() {
  errorMessage.value = ''

  if (!identifier.value || !password.value) {
    errorMessage.value = 'Please enter email/username and password'
    return
  }

  try {
    await authStore.login(identifier.value, password.value)
    const redirect = route.query.redirect as string
    router.push(redirect || '/dashboard')
  } catch (error: unknown) {
    // ZF-1: Map backend error codes to user-readable messages
    const err = error as { message?: string; statusCode?: number }
    if (err.statusCode === 429) {
      errorMessage.value = 'Too many login attempts. Please wait a minute and try again.'
    } else if (err.statusCode === 401) {
      if (err.message === 'ACCOUNT_INACTIVE') {
        errorMessage.value = 'Your account is pending activation by an administrator. You will be notified when your account is approved.'
      } else {
        errorMessage.value = 'Invalid credentials. Please check your email/username and password.'
      }
    } else if (err.statusCode === 503) {
      errorMessage.value = 'Backend server not running. Please start the backend first.'
    } else {
      errorMessage.value = err.message || 'Login failed. Please try again.'
    }
  }
}
</script>

<template>
  <div class="login-container">
    <!-- Left Panel: Branding -->
    <div class="branding-panel">
      <div class="branding-content">
        <v-img
          src="/csu-logo.svg"
          alt="Caraga State University"
          width="120"
          class="mb-6"
        />
        <h1 class="branding-title">CSU CORE </h1>
        <h2 class="branding-subtitle">Centralized Operations and Reporting Engine (CORE) Dashboard System</h2>
        <div class="branding-divider" />
        <p class="branding-tagline">
          Caraga State University<br />
          <span class="text-gold">Building Tomorrow, Today</span>
        </p>
      </div>
      <p class="branding-footer">
        &copy; {{ new Date().getFullYear() }} Caraga State University
      </p>
    </div>

    <!-- Right Panel: Login Form -->
    <div class="form-panel">
      <div class="form-wrapper">
        <!-- Mobile Logo (hidden on desktop) -->
        <div class="mobile-logo">
          <v-img
            src="/csu-logo.svg"
            alt="CSU"
            width="40"
            class="mx-auto mb-2"
          />
        </div>

        <!-- CSU Official Seal -->
        <v-img
          src="/csu-official-seal.png"
          alt="CSU Official Seal"
          width="70"
          class="mx-auto mb-4 seal-badge"
        />

        <h1 class="form-title">CSU CORE </h1>
        <p class="form-subtitle">Project Management Office</p>

        <!-- Error Alert -->
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          class="mb-4"
          density="compact"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <!-- Login Form -->
        <v-form @submit.prevent="handleLogin" class="login-form">
          <div class="input-group">
            <label class="input-label">Email or Username</label>
            <v-text-field
              v-model="identifier"
              type="text"
              placeholder="you@carsu.edu.ph or john.doe"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              autocomplete="username"
              required
              bg-color="white"
            />
          </div>

          <div class="input-group">
            <label class="input-label">Password</label>
            <v-text-field
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              autocomplete="current-password"
              required
              bg-color="white"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              @click:append-inner="showPassword = !showPassword"
            />
          </div>

          <v-btn
            type="submit"
            color="primary"
            size="x-large"
            block
            class="login-btn mt-6"
            :loading="authStore.loading"
            :disabled="authStore.loading"
          >
            Sign In
          </v-btn>

          <!-- Phase HT: Google OAuth divider + button -->
          <div class="d-flex align-center my-5">
            <v-divider />
            <span class="text-caption text-medium-emphasis mx-1">or</span>
            <v-divider />
          </div>

          <v-btn
            variant="outlined"
            size="large"
            block
            class="google-btn"
            @click="handleGoogleLogin"
          >
            <v-icon start>mdi-google</v-icon>
            Sign in with Google
          </v-btn>
        </v-form>

        <p class="text-caption text-center text-medium-emphasis mt-3">
          Forgot your password?
          <a href="#" @click.prevent="showResetDialog = true" class="text-primary">Request a reset</a>
        </p>
        <!-- PHASE BBBA (BBBA-0a): public self-registration removed. Accounts are created by
             an administrator; access is granted via Access Control. -->
        <p class="text-caption text-center text-medium-emphasis mt-1">
          Need access? Contact your system administrator.
        </p>

        <p class="form-footer">
          &copy; {{ new Date().getFullYear() }} Caraga State University &bull; All Rights Reserved
        </p>
      </div>
    </div>

    <!-- Phase HQ: Password Reset Request Dialog -->
    <v-dialog v-model="showResetDialog" max-width="420" persistent>
      <v-card>
        <v-card-title class="text-h6">Request Password Reset</v-card-title>
        <v-card-text v-if="!resetSuccess">
          <p class="text-body-2 mb-4">
            Enter your email or username. An administrator will be notified and will contact you.
          </p>
          <v-text-field
            v-model="resetIdentifier"
            label="Email or Username"
            variant="outlined"
            density="compact"
            class="mb-2"
          />
          <v-text-field
            v-model="resetNotes"
            label="Notes (optional)"
            variant="outlined"
            density="compact"
            hint="Describe your request or provide contact info"
            persistent-hint
          />
        </v-card-text>
        <v-card-text v-else>
          <v-alert type="success" variant="tonal" density="compact">
            Reset request submitted. An administrator will contact you.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeResetDialog">
            {{ resetSuccess ? 'Close' : 'Cancel' }}
          </v-btn>
          <v-btn
            v-if="!resetSuccess"
            color="primary"
            variant="flat"
            @click="submitResetRequest"
            :loading="resetSubmitting"
            :disabled="!resetIdentifier.trim()"
          >
            Submit Request
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  min-height: 100vh;
  font-family: 'Poppins', sans-serif;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* Left Panel - Branding */
.branding-panel {
  display: none;
  width: 45%;
  background:
    linear-gradient(
      135deg,
      #003300 0%,
      rgba(0, 102, 0, 0.90) 100%
    ),
    url('/csu-admin-building.png');
  background-size: cover;
  background-position: center;
  color: white;
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

.branding-panel::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
  pointer-events: none;
}

.branding-content {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.branding-title {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 0.5rem;
}

.branding-subtitle {
  font-size: 1.1rem;
  font-weight: 400;
  opacity: 0.9;
  margin-bottom: 2rem;
}

.branding-divider {
  width: 60px;
  height: 4px;
  background: #f9dc07;
  border-radius: 2px;
  margin-bottom: 2rem;
}

.branding-tagline {
  font-size: 1rem;
  line-height: 1.8;
  opacity: 0.85;
}

.text-gold {
  color: #f9dc07;
  font-weight: 600;
}

.branding-footer {
  position: absolute;
  bottom: 2rem;
  left: 3rem;
  font-size: 0.85rem;
  opacity: 0.7;
}

/* Right Panel - Form */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  overflow-x: hidden;
  max-width: 100%;
  min-width: 0;
}

.form-wrapper {
  width: 100%;
  max-width: 400px;
  overflow-x: hidden;
}

.mobile-logo {
  display: block;
  text-align: center;
  margin-bottom: 1.5rem;
}

.seal-badge {
  opacity: 0.95;
}

.form-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 0.5rem;
  text-align: center;
}

.form-subtitle {
  font-size: 0.95rem;
  color: #6b7280;
  margin-bottom: 2rem;
  text-align: center;
}

.login-form {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 20px 20px rgba(0, 0, 0, 0.06);
}

.input-group {
  margin-bottom: 1.25rem;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.login-btn {
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: none;
  border-radius: 12px;
  color: #003300;
}

.google-btn {
  border-color: #dadce0;
  color: #3c4043;
  font-weight: 500;
  text-transform: none;
  border-radius: 12px;
}
.google-btn:hover {
  background-color: #f8f9fa;
}

.form-footer {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.8rem;
  color: #9ca3af;
  font-weight: 400;
}

/* Desktop: Show split layout */
@media (min-width: 960px) {
  .branding-panel {
    display: flex;
    flex-direction: column;
  }

  .mobile-logo {
    display: none;
  }

  .form-panel {
    background: #fafbfc;
  }

  .login-form {
    padding: 2.5rem;
  }
}

/* Large screens */
@media (min-width: 1280px) {
  .branding-panel {
    width: 50%;
    padding: 4rem;
  }

  .branding-title {
    font-size: 3rem;
  }

  .form-wrapper {
    max-width: 420px;
  }
}
</style>
