/**
 * Project creation wizard — finite state machine (XState v5).
 *
 * SCOPE: this machine owns the *flow* of the create-project wizard — which tab is
 * active, whether the user may advance, and the submit lifecycle. It deliberately
 * does NOT own the ~100 form fields themselves: those stay in the page's `form` ref
 * so `v-model` binding to CiBasicInfoForm / CiAttachmentHub, the localStorage
 * autosave, and draft restore all keep working unchanged. The page pushes a
 * derived per-tab validity map in via SET_VALIDITY, and the machine gates
 * navigation on that.
 *
 * The submit side effect is declared here as an actor but NOT implemented — the
 * page injects the real one with `.provide({ actors: { submitProject } })`, so this
 * file stays free of API/toast/router imports and is unit-testable in isolation.
 */
import { assign, emit, fromPromise, setup } from 'xstate'

/** Wizard steps, in navigation order. Single source of truth for tab sequencing. */
export const PROJECT_TAB_ORDER = [
  'basic',
  'schedule',
  'progress',
  'personnel',
  'documents',
  'others',
] as const

export type ProjectTabId = (typeof PROJECT_TAB_ORDER)[number]

/** Whether each tab's *required* fields are satisfied. Optional tabs are always true. */
export type TabValidity = Record<ProjectTabId, boolean>

/** Outcome of a successful create + staged-attachment upload pass. */
export interface SubmitResult {
  /** Null when the API created the project but returned no id (uploads skipped). */
  projectId: string | null
  uploaded: number
  /** Human-readable "<name>: <reason>" entries for attachments that failed to upload. */
  failed: string[]
  total: number
}

export interface ProjectContext {
  tabValidity: TabValidity
  /** Last tab that refused to advance — drives the inline "fix this first" hint. */
  blockedTab: ProjectTabId | null
  submitError: string | null
  result: SubmitResult | null
}

export type ProjectEvent =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GOTO'; tab: ProjectTabId }
  | { type: 'SET_VALIDITY'; validity: TabValidity }
  | { type: 'SUBMIT' }
  | { type: 'RETRY' }

/**
 * One-off notifications for the UI (toasts). Emitted rather than stored in context
 * because they are moments, not state — a toast should fire once per occurrence,
 * which a watched context value cannot express without a nonce hack.
 */
export type ProjectEmitted =
  | { type: 'blocked'; tab: ProjectTabId }
  | { type: 'submitSucceeded'; result: SubmitResult }
  | { type: 'submitFailed'; message: string }

/** Every tab starts invalid-until-proven; the page sends real values on mount. */
const INITIAL_VALIDITY: TabValidity = {
  basic: false,
  schedule: true,
  progress: true,
  personnel: true,
  documents: true,
  others: true,
}

export const projectMachine = setup({
  types: {
    context: {} as ProjectContext,
    events: {} as ProjectEvent,
    emitted: {} as ProjectEmitted,
  },
  guards: {
    /** Required fields for `tab` are satisfied. */
    isTabValid: ({ context }, params: { tab: ProjectTabId }) =>
      context.tabValidity[params.tab],
    /** Inverse of isTabValid — used to pick a jump target on a blocked submit. */
    isTabInvalid: ({ context }, params: { tab: ProjectTabId }) =>
      !context.tabValidity[params.tab],
    allTabsValid: ({ context }) =>
      PROJECT_TAB_ORDER.every((tab) => context.tabValidity[tab]),
  },
  actions: {
    applyValidity: assign({
      tabValidity: ({ event }) =>
        event.type === 'SET_VALIDITY' ? event.validity : INITIAL_VALIDITY,
    }),
    flagBlocked: assign({
      blockedTab: (_, params: { tab: ProjectTabId }) => params.tab,
    }),
    clearBlocked: assign({ blockedTab: null }),
    notifyBlocked: emit((_, params: { tab: ProjectTabId }) => ({
      type: 'blocked' as const,
      tab: params.tab,
    })),
  },
  actors: {
    /**
     * Placeholder. The page overrides this via `.provide()`; if it ever runs
     * un-provided that is a wiring bug, so fail loudly rather than silently.
     */
    submitProject: fromPromise<SubmitResult, void>(async () => {
      throw new Error(
        'projectMachine: `submitProject` actor was not provided. ' +
          'Call projectMachine.provide({ actors: { submitProject } }) before useMachine().',
      )
    }),
  },
}).createMachine({
  id: 'projectWizard',
  initial: 'basic',
  context: {
    tabValidity: INITIAL_VALIDITY,
    blockedTab: null,
    submitError: null,
    result: null,
  },
  // Validity streams in continuously from the page's watcher, and GOTO (clicking a
  // tab header directly) is allowed from any step — both are handled once here
  // rather than repeated in every state.
  on: {
    SET_VALIDITY: { actions: 'applyValidity' },
  },
  states: {
    basic: {
      on: {
        GOTO: [
          { target: 'schedule', guard: ({ event }) => event.tab === 'schedule' },
          { target: 'progress', guard: ({ event }) => event.tab === 'progress' },
          { target: 'personnel', guard: ({ event }) => event.tab === 'personnel' },
          { target: 'documents', guard: ({ event }) => event.tab === 'documents' },
          { target: 'others', guard: ({ event }) => event.tab === 'others' },
        ],
        NEXT: [
          {
            target: 'schedule',
            guard: { type: 'isTabValid', params: { tab: 'basic' } },
            actions: 'clearBlocked',
          },
          {
            actions: [
              { type: 'flagBlocked', params: { tab: 'basic' } },
              { type: 'notifyBlocked', params: { tab: 'basic' } },
            ],
          },
        ],
      },
    },
    schedule: {
      on: {
        GOTO: [
          { target: 'basic', guard: ({ event }) => event.tab === 'basic' },
          { target: 'progress', guard: ({ event }) => event.tab === 'progress' },
          { target: 'personnel', guard: ({ event }) => event.tab === 'personnel' },
          { target: 'documents', guard: ({ event }) => event.tab === 'documents' },
          { target: 'others', guard: ({ event }) => event.tab === 'others' },
        ],
        PREV: { target: 'basic' },
        NEXT: [
          {
            target: 'progress',
            guard: { type: 'isTabValid', params: { tab: 'schedule' } },
            actions: 'clearBlocked',
          },
          {
            actions: [
              { type: 'flagBlocked', params: { tab: 'schedule' } },
              { type: 'notifyBlocked', params: { tab: 'schedule' } },
            ],
          },
        ],
      },
    },
    progress: {
      on: {
        GOTO: [
          { target: 'basic', guard: ({ event }) => event.tab === 'basic' },
          { target: 'schedule', guard: ({ event }) => event.tab === 'schedule' },
          { target: 'personnel', guard: ({ event }) => event.tab === 'personnel' },
          { target: 'documents', guard: ({ event }) => event.tab === 'documents' },
          { target: 'others', guard: ({ event }) => event.tab === 'others' },
        ],
        PREV: { target: 'schedule' },
        NEXT: [
          {
            target: 'personnel',
            guard: { type: 'isTabValid', params: { tab: 'progress' } },
            actions: 'clearBlocked',
          },
          {
            actions: [
              { type: 'flagBlocked', params: { tab: 'progress' } },
              { type: 'notifyBlocked', params: { tab: 'progress' } },
            ],
          },
        ],
      },
    },
    personnel: {
      on: {
        GOTO: [
          { target: 'basic', guard: ({ event }) => event.tab === 'basic' },
          { target: 'schedule', guard: ({ event }) => event.tab === 'schedule' },
          { target: 'progress', guard: ({ event }) => event.tab === 'progress' },
          { target: 'documents', guard: ({ event }) => event.tab === 'documents' },
          { target: 'others', guard: ({ event }) => event.tab === 'others' },
        ],
        PREV: { target: 'progress' },
        NEXT: [
          {
            target: 'documents',
            guard: { type: 'isTabValid', params: { tab: 'personnel' } },
            actions: 'clearBlocked',
          },
          {
            actions: [
              { type: 'flagBlocked', params: { tab: 'personnel' } },
              { type: 'notifyBlocked', params: { tab: 'personnel' } },
            ],
          },
        ],
      },
    },
    documents: {
      on: {
        GOTO: [
          { target: 'basic', guard: ({ event }) => event.tab === 'basic' },
          { target: 'schedule', guard: ({ event }) => event.tab === 'schedule' },
          { target: 'progress', guard: ({ event }) => event.tab === 'progress' },
          { target: 'personnel', guard: ({ event }) => event.tab === 'personnel' },
          { target: 'others', guard: ({ event }) => event.tab === 'others' },
        ],
        PREV: { target: 'progress' },
        NEXT: [
          {
            target: 'others',
            guard: { type: 'isTabValid', params: { tab: 'documents' } },
            actions: 'clearBlocked',
          },
          {
            actions: [
              { type: 'flagBlocked', params: { tab: 'documents' } },
              { type: 'notifyBlocked', params: { tab: 'documents' } },
            ],
          },
        ],
      },
    },
    others: {
      on: {
        GOTO: [
          { target: 'basic', guard: ({ event }) => event.tab === 'basic' },
          { target: 'schedule', guard: ({ event }) => event.tab === 'schedule' },
          { target: 'progress', guard: ({ event }) => event.tab === 'progress' },
          { target: 'personnel', guard: ({ event }) => event.tab === 'personnel' },
          { target: 'documents', guard: ({ event }) => event.tab === 'documents' },
        ],
        PREV: { target: 'documents' },
        // Ordered fallthrough: submit if everything is valid, otherwise jump to the
        // FIRST invalid tab (guards evaluate top-down, so tab order is preserved).
        SUBMIT: [
          { target: 'submitting', guard: 'allTabsValid', actions: 'clearBlocked' },
          {
            target: 'basic',
            guard: { type: 'isTabInvalid', params: { tab: 'basic' } },
            actions: [
              { type: 'flagBlocked', params: { tab: 'basic' } },
              { type: 'notifyBlocked', params: { tab: 'basic' } },
            ],
          },
          {
            target: 'schedule',
            guard: { type: 'isTabInvalid', params: { tab: 'schedule' } },
            actions: [
              { type: 'flagBlocked', params: { tab: 'schedule' } },
              { type: 'notifyBlocked', params: { tab: 'schedule' } },
            ],
          },
          {
            target: 'progress',
            guard: { type: 'isTabInvalid', params: { tab: 'progress' } },
            actions: [
              { type: 'flagBlocked', params: { tab: 'progress' } },
              { type: 'notifyBlocked', params: { tab: 'progress' } },
            ],
          },
          {
            target: 'personnel',
            guard: { type: 'isTabInvalid', params: { tab: 'personnel' } },
            actions: [
              { type: 'flagBlocked', params: { tab: 'personnel' } },
              { type: 'notifyBlocked', params: { tab: 'personnel' } },
            ],
          },
          {
            target: 'documents',
            guard: { type: 'isTabInvalid', params: { tab: 'documents' } },
            actions: [
              { type: 'flagBlocked', params: { tab: 'documents' } },
              { type: 'notifyBlocked', params: { tab: 'documents' } },
            ],
          },
        ],
      },
    },
    // Terminal-ish: the page navigates away on success, so `submitted` mainly exists
    // to keep the Create button disabled during the post-success redirect.
    submitting: {
      invoke: {
        src: 'submitProject',
        onDone: {
          target: 'submitted',
          actions: [
            assign({
              result: ({ event }) => event.output,
              submitError: null,
            }),
            emit(({ event }) => ({
              type: 'submitSucceeded' as const,
              result: event.output,
            })),
          ],
        },
        onError: {
          // Return to the last tab so the user keeps their place and can retry.
          target: 'others',
          actions: [
            assign({
              submitError: ({ event }) =>
                (event.error as { message?: string })?.message ??
                'Something went wrong. Please try again or contact support.',
            }),
            emit(({ event }) => ({
              type: 'submitFailed' as const,
              message:
                (event.error as { message?: string })?.message ??
                'Something went wrong. Please try again or contact support.',
            })),
          ],
        },
      },
    },
    submitted: {
      type: 'final',
    },
  },
})

export type ProjectMachine = typeof projectMachine
