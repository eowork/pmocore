<script setup lang="ts">
// T-HOME-CMS-8 (TH8-1/D1/D2): shared section-band wrapper.
//
// Root cause fixed here (RH8-1/RH8-2): every homepage section used to pick its
// own background color independently, with no awareness of its neighbor —
// which silently produced adjacent same-color collisions (About Core/
// Highlights, Latest Updates/Quick Links, Transparency/FAQ) as sections were
// added and reordered over several tracks. This component owns ONLY the band
// chrome (background variant + soft shadow boundary); `pages/index.vue`
// computes which variant each section gets, by position, so alternation is
// guaranteed correct regardless of admin-driven reordering (TH8-2).
//
// Also owns empty-state rendering (RH8-3): a section with no content no
// longer vanishes outright unless explicitly configured to (`emptyBehavior:
// 'hide'`) — default is a friendly placeholder so the homepage never
// silently collapses into "just two sections" when content is thin.
export type BandVariant = 'neutral' | 'white'
export type EmptyBehavior = 'hide' | 'placeholder' | 'reminder'

const props = withDefaults(
  defineProps<{
    variant?: BandVariant
    isEmpty?: boolean
    emptyBehavior?: EmptyBehavior
    emptyMessage?: string
    emptyIcon?: string
    containerId?: string
  }>(),
  {
    variant: 'white',
    isEmpty: false,
    emptyBehavior: 'placeholder',
    emptyMessage: 'Content will appear here once published.',
    emptyIcon: 'mdi-tray-outline',
    containerId: undefined,
  },
)

// 'reminder' is admin-only visibility — a public visitor sees nothing (same
// as 'hide'), while a homepage administrator (including in ?preview=true)
// sees a nudge to go curate the section. 'placeholder' is visible to everyone.
const { canAccessModule } = usePermissions()

const showBand = computed(() => {
  if (!props.isEmpty) return true
  if (props.emptyBehavior === 'hide') return false
  if (props.emptyBehavior === 'reminder') return canAccessModule('homepage')
  return true // 'placeholder'
})

const showAdminNote = computed(() => props.isEmpty && props.emptyBehavior === 'reminder')
</script>

<template>
  <div
    v-if="showBand"
    class="section-band"
    :class="variant === 'neutral' ? 'section-band--neutral' : 'section-band--white'"
  >
    <v-container :id="containerId" class="py-12">
      <!-- Heading always renders (when provided) — a section keeps its own
           identity even while its content is still being populated. -->
      <slot name="heading" />
      <div v-if="isEmpty" class="text-center py-8">
        <v-icon :icon="emptyIcon" size="40" color="grey-lighten-1" />
        <p class="text-body-1 text-figma-muted mt-3 mb-0">{{ emptyMessage }}</p>
        <p v-if="showAdminNote" class="text-caption text-figma-muted mt-1 mb-0">
          Visible to you as a reminder — manage this section in Homepage Management.
        </p>
      </div>
      <slot v-else />
    </v-container>
  </div>
</template>

<style scoped>
/* T-HOME-CMS-7 (TH7-2) treatment, generalized: soft inset shadow carries the
   boundary — no hard borders, no divider lines.
   T-HOME-CMS-10 (TH10-3): the white variant is transparent so the layout
   root's subtle dot-grid texture shows through, giving the page layered
   depth; neutral bands stay opaque, alternating texture with flat tint. */
.section-band--neutral {
  background-color: var(--csu-band-bg, #f8fafc);
}
.section-band--white {
  background-color: transparent;
}
.section-band--neutral,
.section-band--white {
  box-shadow:
    inset 0 1px 0 var(--csu-band-shadow, rgba(15, 23, 42, 0.05)),
    inset 0 -1px 0 var(--csu-band-shadow, rgba(15, 23, 42, 0.05));
}
</style>
