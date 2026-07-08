<script setup lang="ts">
// T-HOME-CMS (THC-6): Homepage Management — Admin/SuperAdmin only.
// Edits the CMS content behind the public homepage: singleton settings (hero,
// about, footer/contact) + ordered publishable items per section. Reordering
// uses up/down buttons (explicit plan decision: no drag-and-drop dependency).
definePageMeta({
  middleware: ['auth', 'permission'],
})

import { LAYOUT_TEMPLATE_OPTIONS } from '~/utils/homepage-layout'
import { MDI_ICON_LIBRARY } from '~/utils/mdi-icon-library'

const api = useApi()
const toast = useToast()

// ---- Settings (singleton copy) ----

interface HomepageSettingRow {
  id: string
  settingKey: string
  settingValue: string | null
  dataType: string
}

const settingsLoading = ref(true)
const settingsSaving = ref(false)
const settingsForm = reactive<Record<string, string>>({})

const SETTING_FIELDS: Array<{ key: string; label: string; textarea?: boolean; hint?: string }> = [
  { key: 'hero_headline', label: 'Hero Headline' },
  { key: 'hero_subtitle', label: 'Hero Subtitle' },
  { key: 'hero_body', label: 'Hero Description', textarea: true },
  { key: 'about_core_title', label: 'About Section Title' },
  { key: 'about_core_body', label: 'About Section Body', textarea: true },
  // T-HOME-CMS-4 (TH4-4): previously 100% hardcoded, no CMS path at all.
  { key: 'transparency_title', label: 'Why PMO CORE Exists — Title' },
  { key: 'transparency_body', label: 'Why PMO CORE Exists — Body', textarea: true },
  { key: 'footer_mission', label: 'Footer Mission Statement', textarea: true },
  { key: 'contact_address', label: 'Contact Address' },
  { key: 'contact_website', label: 'Contact Website' },
]

// T-HOME-CMS-2 (THM-1): closed set of CSU-approved theme presets — never a
// freeform color picker (directive requirement).
const THEME_OPTIONS = [
  { title: 'Light Emerald (default)', value: 'light_emerald' },
  { title: 'Dark Emerald', value: 'dark_emerald' },
  { title: 'CSU Green', value: 'csu_green' },
  { title: 'White', value: 'white' },
  { title: 'Neutral Gray', value: 'neutral_gray' },
]

// T-HOME-CMS-2 (THM-5): section-level enable/disable + order — one JSON
// settings row, rendered with the same up/down + toggle pattern as items
// (no new UI pattern, no new table).
interface SectionConfigEntry {
  key: string
  visible: boolean
  order: number
  layout?: string
  emptyBehavior?: 'hide' | 'placeholder' | 'reminder'
}

// T-HOME-CMS-3 (TH3-4): layout picker shown only for sections that actually
// render as an item grid — accordions (FAQ) and narrative sections don't
// benefit from a grid template.
const LAYOUT_APPLICABLE_SECTIONS = new Set(['highlights', 'announcements'])
// T-HOME-CMS-8 (TH8-4): sections that can silently disappear with no
// content — the ones the operator's directive names explicitly.
const EMPTY_BEHAVIOR_APPLICABLE_SECTIONS = new Set([
  'highlights', 'announcements', 'featured_projects', 'latest_updates',
])
const EMPTY_BEHAVIOR_OPTIONS = [
  { title: 'Show placeholder message', value: 'placeholder' },
  { title: 'Show reminder (admins only)', value: 'reminder' },
  { title: 'Hide section entirely', value: 'hide' },
]
const SECTION_LABELS: Record<string, { title: string; icon: string }> = {
  about_core: { title: 'About PMO CORE', icon: 'mdi-information-outline' },
  highlights: { title: 'University Highlights', icon: 'mdi-star-outline' },
  // T-HOME-CMS-11 (TH11-2/D2): renamed Featured Projects -> Featured News;
  // section_key stays 'featured_projects' (Section Layout config key).
  featured_projects: { title: 'Featured News', icon: 'mdi-newspaper-variant-outline' },
  announcements: { title: 'Announcements', icon: 'mdi-bullhorn-outline' },
  latest_updates: { title: 'Latest Updates', icon: 'mdi-update' },
  // T-HOME-CMS-5 (TH5-3): wires in the already-built-but-unrendered Quick Links section.
  quick_links: { title: 'Quick Links', icon: 'mdi-link-variant' },
  transparency: { title: 'Why PMO CORE Exists', icon: 'mdi-eye-outline' },
  faq: { title: 'Frequently Asked Questions', icon: 'mdi-help-circle-outline' },
}
const DEFAULT_SECTION_ORDER: SectionConfigEntry[] = [
  { key: 'about_core', visible: true, order: 1 },
  { key: 'highlights', visible: true, order: 2 },
  { key: 'featured_projects', visible: true, order: 3 },
  { key: 'announcements', visible: true, order: 4 },
  { key: 'latest_updates', visible: true, order: 5 },
  { key: 'quick_links', visible: true, order: 6 },
  { key: 'transparency', visible: true, order: 7 },
  { key: 'faq', visible: true, order: 8 },
]

// T-HOME-CMS-5 (TH5-11): closed CSU-approved palette for per-highlight accent
// color — never a freeform picker, same precedent as theme presets.
const COLOR_TOKEN_OPTIONS = [
  { title: 'Default (theme accent)', value: '' },
  { title: 'CSU Green', value: 'green' },
  { title: 'CSU Gold', value: 'gold' },
  { title: 'CSU Orange', value: 'orange' },
  { title: 'CSU Emerald', value: 'emerald' },
  { title: 'CSU Gray', value: 'gray' },
]
const sectionsConfig = ref<SectionConfigEntry[]>([...DEFAULT_SECTION_ORDER])
const sectionsSaving = ref(false)

const sortedSectionsConfig = computed(() =>
  [...sectionsConfig.value].sort((a, b) => a.order - b.order),
)

async function saveSectionsConfig() {
  sectionsSaving.value = true
  try {
    await api.patch('/api/homepage/settings/homepage_sections_config', {
      setting_value: JSON.stringify(sectionsConfig.value),
    })
    toast.success('Section layout saved')
  } catch {
    toast.error('Failed to save section layout')
  } finally {
    sectionsSaving.value = false
  }
}

async function toggleSectionVisible(entry: SectionConfigEntry) {
  entry.visible = !entry.visible
  await saveSectionsConfig()
}

async function moveSectionEntry(index: number, direction: -1 | 1) {
  const list = sortedSectionsConfig.value
  const target = index + direction
  if (target < 0 || target >= list.length) return
  const a = list[index]
  const b = list[target]
  const tmp = a.order
  a.order = b.order
  b.order = tmp
  await saveSectionsConfig()
}

async function loadSettings() {
  settingsLoading.value = true
  try {
    const rows = await api.get<HomepageSettingRow[]>('/api/homepage/settings')
    for (const row of rows) {
      settingsForm[row.settingKey] = row.settingValue ?? ''
    }
    const rawConfig = rows.find(r => r.settingKey === 'homepage_sections_config')?.settingValue
    if (rawConfig) {
      try {
        const parsed = JSON.parse(rawConfig)
        if (Array.isArray(parsed) && parsed.length) sectionsConfig.value = parsed
      } catch {
        // Keep the default order if the stored JSON is malformed.
      }
    }
  } catch {
    toast.error('Failed to load homepage settings')
  } finally {
    settingsLoading.value = false
  }
}

async function saveSettings() {
  settingsSaving.value = true
  try {
    for (const field of SETTING_FIELDS) {
      await api.patch(`/api/homepage/settings/${field.key}`, {
        setting_value: settingsForm[field.key] ?? '',
      })
    }
    // homepage_theme is edited via its own v-select, not the generic SETTING_FIELDS loop.
    await api.patch('/api/homepage/settings/homepage_theme', {
      setting_value: settingsForm.homepage_theme || 'light_emerald',
    })
    toast.success('Homepage settings saved')
  } catch {
    toast.error('Failed to save settings')
  } finally {
    settingsSaving.value = false
  }
}

// ---- Items (ordered, publishable content) ----

interface HomepageItemRow {
  id: string
  sectionKey: string
  itemOrder: number
  title: string | null
  body: string | null
  icon: string | null
  linkUrl: string | null
  valueSource: string | null
  manualValue: string | null
  mediaId: string | null
  isPublished: boolean
  isPinned: boolean
  scheduledStart: string | null
  scheduledEnd: string | null
  colorToken: string | null
  linkedProjectId: string | null
  subtitle: string | null
  fullDescription: string | null
  author: string | null
  department: string | null
  publishDate: string | null
  isFeatured: boolean
  statusText: string | null
  campusText: string | null
  budgetText: string | null
  completionText: string | null
}

// T-HOME-CMS-6 (TH6-2): array order mirrors the homepage's visual order —
// Quick Links moved last. NAV_ITEMS derives from this via .map(), so the
// left-rail nav reorders automatically.
// T-HOME-CMS-11 (TH11-3): isFeaturedNews marks Featured News — a fully
// standalone CMS card type, no COI dependency (RH11-3 supersedes T-HOME-CMS-8's
// project-linked design).
const SECTIONS = [
  { key: 'hero_slide', label: 'Carousel Slides', icon: 'mdi-image-multiple-outline', hasImage: true, hasValue: false, hasSchedule: false, isFeaturedNews: false },
  { key: 'highlight', label: 'Highlights', icon: 'mdi-star-outline', hasImage: false, hasValue: true, hasSchedule: false, isFeaturedNews: false },
  { key: 'featured_project', label: 'Featured News', icon: 'mdi-newspaper-variant-outline', hasImage: true, hasValue: false, hasSchedule: false, isFeaturedNews: true },
  { key: 'announcement', label: 'Announcements', icon: 'mdi-bullhorn-outline', hasImage: true, hasValue: false, hasSchedule: true, isFeaturedNews: false },
  { key: 'faq', label: 'FAQ', icon: 'mdi-help-circle-outline', hasImage: false, hasValue: false, hasSchedule: false, isFeaturedNews: false },
  // T-HOME-CMS-4 (TH4-4): previously hardcoded, no CMS path at all.
  // T-HOME-CMS-5 (TH5-4): about_facet gains image support — data model
  // already supported it, this just opens the admin dialog's image field.
  { key: 'about_facet', label: 'About PMO CORE Facets', icon: 'mdi-hub-outline', hasImage: true, hasValue: false, hasSchedule: false, isFeaturedNews: false },
  { key: 'transparency_pillar', label: 'Why PMO CORE Exists — Pillars', icon: 'mdi-eye-outline', hasImage: false, hasValue: false, hasSchedule: false, isFeaturedNews: false },
  { key: 'quick_link', label: 'Quick Links', icon: 'mdi-link-variant', hasImage: false, hasValue: false, hasSchedule: false, isFeaturedNews: false },
] as const

const VALUE_SOURCE_OPTIONS = [
  { title: 'Manual text (or none)', value: 'manual' },
  { title: 'Auto — Published project count', value: 'auto:published_count' },
  { title: 'Auto — Ongoing project count', value: 'auto:ongoing_count' },
  { title: 'Auto — Completed project count', value: 'auto:completed_count' },
]

// T-HOME-CMS-5 (TH5-7): tabs -> sidebar subsection navigation. `activeTab`
// keeps driving the same v-window it always did — only the outer nav chrome
// changed (v-tabs -> a persistent left v-list), so every dialog/API call
// below is untouched. Persisted like the sidebar's own group-open state.
const activeTab = ref('settings')
onMounted(() => {
  if (import.meta.client) {
    const saved = localStorage.getItem('homepage_admin_section')
    if (saved) activeTab.value = saved
  }
})
watch(activeTab, (val) => {
  if (import.meta.client) localStorage.setItem('homepage_admin_section', val)
})

const NAV_ITEMS = computed(() => [
  { value: 'settings', label: 'Page Content', icon: 'mdi-text-box-outline' },
  { value: 'sections', label: 'Section Layout', icon: 'mdi-view-sequential-outline' },
  ...SECTIONS.map(s => ({ value: s.key, label: s.label, icon: s.icon })),
])

const items = ref<HomepageItemRow[]>([])
const itemsLoading = ref(true)

function itemsFor(sectionKey: string): HomepageItemRow[] {
  return items.value
    .filter(i => i.sectionKey === sectionKey)
    .sort((a, b) => a.itemOrder - b.itemOrder)
}

async function loadItems() {
  itemsLoading.value = true
  try {
    items.value = await api.get<HomepageItemRow[]>('/api/homepage/items')
  } catch {
    toast.error('Failed to load homepage items')
  } finally {
    itemsLoading.value = false
  }
}

// ---- Item editor dialog ----

const dialogOpen = ref(false)
const dialogSaving = ref(false)
const editingId = ref<string | null>(null)
const editingSection = ref('hero_slide')
const form = reactive({
  title: '',
  body: '',
  icon: '',
  link_url: '',
  value_source: 'manual',
  manual_value: '',
  alt_text: '',
  is_pinned: false,
  scheduled_start: '',
  scheduled_end: '',
  color_token: '',
  // T-HOME-CMS-11 (TH11-3): Featured News fields — standalone, no COI link.
  subtitle: '',
  full_description: '',
  author: '',
  department: '',
  publish_date: '',
  is_featured: false,
  status_text: '',
  campus_text: '',
  budget_text: '',
  completion_text: '',
})
// T-HOME-CMS-2 (THM-3): array so a single v-file-input serves both the
// "one image" (edit/replace) and "multiple images" (batch create) flows.
const imageFiles = ref<File[]>([])
// T-HOME-CMS-5 (TH5-6): custom SVG/PNG icon upload — only offered for
// sections that don't already use `media_id` as a full photo (hasImage),
// since the entity has a single media slot per item.
const iconFiles = ref<File[]>([])

const editingSectionMeta = computed(() =>
  SECTIONS.find(s => s.key === editingSection.value) ?? SECTIONS[0],
)
const allowIconUpload = computed(() => !editingSectionMeta.value.hasImage)

// T-HOME-CMS-2 (THM-4): batch upload only makes sense when creating fresh
// items (each file becomes its own item) — an existing single item can only
// ever have one image, so editing always replaces rather than adds.
const allowMultipleUpload = computed(
  () => editingSectionMeta.value.hasImage && !editingId.value,
)

// T-HOME-CMS-3 (TH3-5): datetime-local inputs need "YYYY-MM-DDTHH:mm" — ISO
// strings from the API carry seconds/timezone, so trim to what the input accepts.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openCreate(sectionKey: string) {
  editingId.value = null
  editingSection.value = sectionKey
  form.title = ''
  form.body = ''
  form.icon = ''
  form.link_url = ''
  form.value_source = 'manual'
  form.manual_value = ''
  form.alt_text = ''
  form.is_pinned = false
  form.scheduled_start = ''
  form.scheduled_end = ''
  form.color_token = ''
  form.subtitle = ''
  form.full_description = ''
  // T-HOME-CMS-12 (TH12-5/D6): sensible default so a card is never
  // accidentally uncredited — admin can still override it.
  form.author = sectionKey === 'featured_project' ? 'PMO CORE' : ''
  form.department = ''
  form.publish_date = ''
  form.is_featured = false
  form.status_text = ''
  form.campus_text = ''
  form.budget_text = ''
  form.completion_text = ''
  imageFiles.value = []
  iconFiles.value = []
  dialogOpen.value = true
}

function openEdit(item: HomepageItemRow) {
  editingId.value = item.id
  editingSection.value = item.sectionKey
  form.title = item.title ?? ''
  form.body = item.body ?? ''
  form.icon = item.icon ?? ''
  form.link_url = item.linkUrl ?? ''
  form.value_source = item.valueSource || 'manual'
  form.manual_value = item.manualValue ?? ''
  form.alt_text = ''
  form.is_pinned = item.isPinned
  form.scheduled_start = toDatetimeLocal(item.scheduledStart)
  form.scheduled_end = toDatetimeLocal(item.scheduledEnd)
  form.color_token = item.colorToken ?? ''
  form.subtitle = item.subtitle ?? ''
  form.full_description = item.fullDescription ?? ''
  form.author = item.author ?? ''
  form.department = item.department ?? ''
  form.publish_date = item.publishDate ? item.publishDate.slice(0, 10) : ''
  form.is_featured = item.isFeatured
  form.status_text = item.statusText ?? ''
  form.campus_text = item.campusText ?? ''
  form.budget_text = item.budgetText ?? ''
  form.completion_text = item.completionText ?? ''
  imageFiles.value = []
  iconFiles.value = []
  dialogOpen.value = true
}

// T-HOME-CMS-12 (TH12-2): clipboard-paste image upload — reads the raw
// image bytes browsers put on the clipboard for a "Copy Image" action (no
// server-side URL fetch involved, D3). Feeds the same imageFiles ref the
// file picker already populates, so saveItem()/uploadImageToItem() are
// untouched.
function handleDialogPaste(event: ClipboardEvent) {
  if (!editingSectionMeta.value.hasImage) return
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (!file) continue
      event.preventDefault()
      const renamed = new File([file], `pasted-image.${file.type.split('/')[1] || 'png'}`, { type: file.type })
      imageFiles.value = allowMultipleUpload.value ? [...imageFiles.value, renamed] : [renamed]
      toast.success('Image pasted')
      break
    }
  }
}

async function uploadImageToItem(itemId: string, file: File, title: string, altText: string): Promise<void> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('media_type', 'IMAGE')
  fd.append('title', title || 'Homepage image')
  if (altText) fd.append('alt_text', altText)
  const media = await api.upload<{ id: string }>(
    `/api/media/homepage_carousel/${itemId}`,
    fd,
  )
  await api.patch(`/api/homepage/items/${itemId}`, { media_id: media.id })
}

// T-HOME-CMS-5 (TH5-6): custom SVG/PNG icon upload — reuses the generic Media
// pipeline under a dedicated `homepage_icon` entity type, same call shape as
// uploadImageToItem but distinct from a section's own photo (hasImage).
async function uploadIconToItem(itemId: string, file: File, title: string): Promise<void> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('media_type', 'IMAGE')
  fd.append('title', title || 'Homepage icon')
  const media = await api.upload<{ id: string }>(
    `/api/media/homepage_icon/${itemId}`,
    fd,
  )
  await api.patch(`/api/homepage/items/${itemId}`, { media_id: media.id })
}

async function saveItem() {
  dialogSaving.value = true
  try {
    const payload: Record<string, unknown> = {
      title: form.title,
      body: form.body,
      icon: form.icon,
      link_url: form.link_url,
    }
    if (editingSectionMeta.value.hasValue) {
      payload.value_source = form.value_source
      payload.manual_value = form.manual_value
      payload.color_token = form.color_token
    }
    if (editingSectionMeta.value.isFeaturedNews) {
      // T-HOME-CMS-11 (TH11-3): Category reuses manual_value (no dedicated
      // column, same precedent as before) — fully standalone, no COI link.
      payload.manual_value = form.manual_value
      payload.subtitle = form.subtitle
      payload.full_description = form.full_description
      payload.author = form.author
      payload.department = form.department
      payload.publish_date = form.publish_date
      payload.is_featured = form.is_featured
      payload.status_text = form.status_text
      payload.campus_text = form.campus_text
      payload.budget_text = form.budget_text
      payload.completion_text = form.completion_text
    }
    if (editingSectionMeta.value.hasSchedule) {
      payload.is_pinned = form.is_pinned
      payload.scheduled_start = form.scheduled_start
        ? new Date(form.scheduled_start).toISOString()
        : ''
      payload.scheduled_end = form.scheduled_end
        ? new Date(form.scheduled_end).toISOString()
        : ''
    }

    if (!editingId.value && imageFiles.value.length > 1) {
      // Batch create: one homepage item per selected image (THM-3).
      for (const file of imageFiles.value) {
        const created = await api.post<{ id: string }>('/api/homepage/items', {
          section_key: editingSection.value,
          ...payload,
          title: form.title || file.name.replace(/\.[^.]+$/, ''),
        })
        await uploadImageToItem(created.id, file, form.title || file.name, form.alt_text)
      }
      toast.success(`${imageFiles.value.length} items created`)
      dialogOpen.value = false
      await loadItems()
      return
    }

    let itemId = editingId.value
    if (itemId) {
      await api.patch(`/api/homepage/items/${itemId}`, payload)
    } else {
      const created = await api.post<{ id: string }>('/api/homepage/items', {
        section_key: editingSection.value,
        ...payload,
      })
      itemId = created.id
    }

    if (imageFiles.value.length === 1 && itemId) {
      await uploadImageToItem(itemId, imageFiles.value[0], form.title, form.alt_text)
    }
    if (allowIconUpload.value && iconFiles.value.length === 1 && itemId) {
      await uploadIconToItem(itemId, iconFiles.value[0], form.title)
    }

    toast.success(editingId.value ? 'Item updated' : 'Item created')
    dialogOpen.value = false
    await loadItems()
  } catch (err: unknown) {
    const e = err as { message?: string }
    toast.error(e.message || 'Failed to save item')
  } finally {
    dialogSaving.value = false
  }
}

// ---- Publish toggle / reorder / delete ----

async function togglePublished(item: HomepageItemRow) {
  try {
    await api.patch(`/api/homepage/items/${item.id}`, { is_published: !item.isPublished })
    item.isPublished = !item.isPublished
    toast.success(item.isPublished ? 'Item published' : 'Item hidden')
  } catch {
    toast.error('Failed to update visibility')
  }
}

async function moveItem(sectionKey: string, index: number, direction: -1 | 1) {
  const list = itemsFor(sectionKey)
  const target = index + direction
  if (target < 0 || target >= list.length) return
  const reordered = [...list]
  ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
  try {
    await api.patch('/api/homepage/items/reorder', {
      items: reordered.map((item, i) => ({ id: item.id, item_order: i + 1 })),
    })
    reordered.forEach((item, i) => { item.itemOrder = i + 1 })
  } catch {
    toast.error('Failed to reorder items')
  }
}

const deleteTarget = ref<HomepageItemRow | null>(null)
const deleteDialogOpen = ref(false)

function confirmDelete(item: HomepageItemRow) {
  deleteTarget.value = item
  deleteDialogOpen.value = true
}

async function deleteItem() {
  if (!deleteTarget.value) return
  try {
    await api.del(`/api/homepage/items/${deleteTarget.value.id}`)
    toast.success('Item deleted')
    deleteDialogOpen.value = false
    await loadItems()
  } catch {
    toast.error('Failed to delete item')
  }
}

onMounted(() => {
  loadSettings()
  loadItems()
})
</script>

<template>
  <div class="pa-4">
    <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold">Homepage Management</h1>
        <p class="text-subtitle-1 text-grey-darken-1 mb-0">
          Manage the content of the public PMO CORE landing page.
        </p>
      </div>
      <!-- T-HOME-CMS-10 (TH10-2): device-frame preview removed per operator
           product decision (RH10-4). Plain link works now that TH10-1 stopped
           redirecting authenticated users away from the public homepage. -->
      <v-btn
        href="/"
        target="_blank"
        variant="outlined"
        color="primary"
        prepend-icon="mdi-open-in-new"
      >
        Preview Homepage
      </v-btn>
    </div>

    <v-card elevation="1" rounded="lg">
      <v-row no-gutters>
        <!-- T-HOME-CMS-5 (TH5-7): persistent left-rail section nav, replacing
             v-tabs — reduces scrolling fatigue as the section count grows;
             new sections just become new list entries, same as before. -->
        <v-col cols="12" md="3" lg="3" class="admin-nav-col">
          <v-list nav density="comfortable" class="py-2">
            <v-list-subheader>HOMEPAGE SECTIONS</v-list-subheader>
            <v-list-item
              v-for="nav in NAV_ITEMS"
              :key="nav.value"
              :active="activeTab === nav.value"
              :prepend-icon="nav.icon"
              :title="nav.label"
              color="primary"
              rounded="lg"
              class="mb-1"
              @click="activeTab = nav.value"
            />
          </v-list>
        </v-col>

        <v-col cols="12" md="9" lg="9" class="admin-content-col">
      <v-window v-model="activeTab">
        <!-- Singleton settings -->
        <v-window-item value="settings">
          <v-card-text>
            <v-skeleton-loader v-if="settingsLoading" type="article, article" />
            <template v-else>
              <v-select
                v-model="settingsForm.homepage_theme"
                :items="THEME_OPTIONS"
                label="Homepage Theme"
                hint="Applies to the public homepage only — does not affect the staff dashboard."
                persistent-hint
                class="mb-4"
              />
              <v-row dense>
                <v-col
                  v-for="field in SETTING_FIELDS"
                  :key="field.key"
                  cols="12"
                  :md="field.textarea ? 12 : 6"
                >
                  <v-textarea
                    v-if="field.textarea"
                    v-model="settingsForm[field.key]"
                    :label="field.label"
                    rows="3"
                    auto-grow
                  />
                  <v-text-field
                    v-else
                    v-model="settingsForm[field.key]"
                    :label="field.label"
                  />
                </v-col>
              </v-row>
              <div class="d-flex justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-content-save-outline"
                  :loading="settingsSaving"
                  @click="saveSettings"
                >
                  Save Settings
                </v-btn>
              </div>
            </template>
          </v-card-text>
        </v-window-item>

        <!-- T-HOME-CMS-2 (THM-5): section-level enable/disable + order -->
        <v-window-item value="sections">
          <v-card-text>
            <p class="text-body-2 text-grey-darken-1 mb-4">
              Control which content sections appear on the homepage and in what order. The Hero
              and Carousel always appear first and are not listed here.
            </p>
            <v-list lines="one">
              <v-list-item
                v-for="(entry, index) in sortedSectionsConfig"
                :key="entry.key"
                rounded="lg"
                class="mb-1 border"
              >
                <template #prepend>
                  <div class="d-flex flex-column mr-1">
                    <v-btn
                      icon="mdi-chevron-up"
                      size="x-small"
                      variant="text"
                      :disabled="index === 0 || sectionsSaving"
                      aria-label="Move up"
                      @click="moveSectionEntry(index, -1)"
                    />
                    <v-btn
                      icon="mdi-chevron-down"
                      size="x-small"
                      variant="text"
                      :disabled="index === sortedSectionsConfig.length - 1 || sectionsSaving"
                      aria-label="Move down"
                      @click="moveSectionEntry(index, 1)"
                    />
                  </div>
                  <v-avatar color="primary" variant="tonal" size="36">
                    <v-icon :icon="SECTION_LABELS[entry.key]?.icon || 'mdi-view-sequential-outline'" size="18" />
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium">
                  {{ SECTION_LABELS[entry.key]?.title || entry.key }}
                </v-list-item-title>

                <template #append>
                  <!-- T-HOME-CMS-8 (TH8-4): per-section empty-state behavior. -->
                  <v-select
                    v-if="EMPTY_BEHAVIOR_APPLICABLE_SECTIONS.has(entry.key)"
                    :model-value="entry.emptyBehavior || 'placeholder'"
                    :items="EMPTY_BEHAVIOR_OPTIONS"
                    label="If empty"
                    density="compact"
                    hide-details
                    variant="outlined"
                    style="width: 200px;"
                    class="mr-3"
                    :disabled="sectionsSaving"
                    @update:model-value="(v: string) => { entry.emptyBehavior = v as any; saveSectionsConfig() }"
                  />
                  <v-select
                    v-if="LAYOUT_APPLICABLE_SECTIONS.has(entry.key)"
                    :model-value="entry.layout || 'four_card'"
                    :items="LAYOUT_TEMPLATE_OPTIONS"
                    density="compact"
                    hide-details
                    variant="outlined"
                    style="width: 200px;"
                    class="mr-3"
                    :disabled="sectionsSaving"
                    @update:model-value="(v: string) => { entry.layout = v as any; saveSectionsConfig() }"
                  />
                  <v-switch
                    :model-value="entry.visible"
                    color="success"
                    density="compact"
                    hide-details
                    :disabled="sectionsSaving"
                    :aria-label="entry.visible ? 'Visible — click to hide' : 'Hidden — click to show'"
                    @update:model-value="toggleSectionVisible(entry)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-window-item>

        <!-- Ordered item sections -->
        <v-window-item
          v-for="section in SECTIONS"
          :key="section.key"
          :value="section.key"
        >
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-4">
              <span class="text-subtitle-1 font-weight-medium">
                {{ section.label }}
                <v-chip size="x-small" variant="tonal" class="ml-1">
                  {{ itemsFor(section.key).length }}
                </v-chip>
              </span>
              <v-btn
                color="primary"
                size="small"
                prepend-icon="mdi-plus"
                @click="openCreate(section.key)"
              >
                Add {{ section.label.replace(/s$/, '') }}
              </v-btn>
            </div>

            <v-skeleton-loader v-if="itemsLoading" type="list-item-two-line@3" />
            <div
              v-else-if="!itemsFor(section.key).length"
              class="text-center py-8 text-grey"
            >
              <v-icon size="40" color="grey-lighten-1">{{ section.icon }}</v-icon>
              <p class="text-body-2 mt-2 mb-0">No items yet. Add one to display it on the homepage.</p>
            </div>

            <v-list v-else lines="two">
              <v-list-item
                v-for="(item, index) in itemsFor(section.key)"
                :key="item.id"
                rounded="lg"
                class="mb-1 border"
              >
                <template #prepend>
                  <div class="d-flex flex-column mr-1">
                    <v-btn
                      icon="mdi-chevron-up"
                      size="x-small"
                      variant="text"
                      :disabled="index === 0"
                      aria-label="Move up"
                      @click="moveItem(section.key, index, -1)"
                    />
                    <v-btn
                      icon="mdi-chevron-down"
                      size="x-small"
                      variant="text"
                      :disabled="index === itemsFor(section.key).length - 1"
                      aria-label="Move down"
                      @click="moveItem(section.key, index, 1)"
                    />
                  </div>
                  <v-avatar color="primary" variant="tonal" size="36">
                    <v-icon :icon="item.icon || section.icon" size="18" />
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium">
                  {{ item.title || '(untitled)' }}
                  <v-chip
                    v-if="section.hasImage && item.mediaId"
                    size="x-small"
                    variant="tonal"
                    color="info"
                    prepend-icon="mdi-image-outline"
                    class="ml-1"
                  >
                    image
                  </v-chip>
                  <v-chip
                    v-if="item.isPinned"
                    size="x-small"
                    variant="tonal"
                    color="warning"
                    prepend-icon="mdi-pin"
                    class="ml-1"
                  >
                    pinned
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>{{ item.body }}</v-list-item-subtitle>

                <template #append>
                  <v-switch
                    :model-value="item.isPublished"
                    color="success"
                    density="compact"
                    hide-details
                    class="mr-2"
                    :aria-label="item.isPublished ? 'Published — click to hide' : 'Hidden — click to publish'"
                    @update:model-value="togglePublished(item)"
                  />
                  <v-btn
                    icon="mdi-pencil-outline"
                    size="small"
                    variant="text"
                    aria-label="Edit item"
                    @click="openEdit(item)"
                  />
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    aria-label="Delete item"
                    @click="confirmDelete(item)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-window-item>
      </v-window>
        </v-col>
      </v-row>
    </v-card>

    <!-- Item editor dialog -->
    <!-- T-HOME-CMS-12 (TH12-2): paste-to-upload — listens anywhere in the
         dialog, not just while a specific field is focused. -->
    <v-dialog v-model="dialogOpen" max-width="640" persistent @paste="handleDialogPaste">
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2">
          <v-icon :icon="editingSectionMeta.icon" size="20" />
          {{ editingId ? 'Edit' : 'Add' }} {{ editingSectionMeta.label.replace(/s$/, '') }}
        </v-card-title>
        <!-- T-HOME-CMS-6 (TH6-3): fields grouped under labeled sections with
             helper text — CMS-style authoring, not a flat database form.
             Same fields, same payloads; template restructuring only. -->
        <v-card-text class="pt-4">
          <!-- ── Content ── -->
          <div class="dialog-group-label">Content</div>
          <p class="dialog-group-hint">What this item says, and where it links.</p>
          <!-- T-HOME-CMS-11 (TH11-3): Featured News is fully standalone —
               no COI project selection, manually curated (RH11-3). -->
          <v-text-field
            v-model="form.title"
            label="Title"
            class="mb-4"
          />
          <template v-if="editingSectionMeta.isFeaturedNews">
            <v-text-field
              v-model="form.subtitle"
              label="Subtitle (optional)"
              class="mb-4"
            />
            <v-text-field
              v-model="form.manual_value"
              label="Category"
              placeholder="e.g. Research, Awards, Events"
              class="mb-4"
            />
          </template>
          <v-textarea
            v-model="form.body"
            :label="editingSectionMeta.isFeaturedNews ? 'Short Description' : 'Description / Body'"
            :hint="editingSectionMeta.isFeaturedNews ? 'Shown on the card face' : undefined"
            :persistent-hint="editingSectionMeta.isFeaturedNews"
            rows="3"
            auto-grow
            class="mb-4"
          />
          <v-textarea
            v-if="editingSectionMeta.isFeaturedNews"
            v-model="form.full_description"
            label="Full Description (optional)"
            hint="Longer copy for an expanded/detail view"
            persistent-hint
            rows="4"
            auto-grow
            class="mb-4"
          />
          <template v-if="editingSectionMeta.isFeaturedNews">
            <v-row dense class="mb-1">
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.author" label="Author (optional)" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.department" label="Department (optional)" />
              </v-col>
            </v-row>
            <v-row dense class="mb-1">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.status_text"
                  label="Status badge (optional)"
                  placeholder="e.g. Ongoing, Completed"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.campus_text"
                  label="Campus badge (optional)"
                  placeholder="e.g. Ampayon Campus"
                />
              </v-col>
            </v-row>
            <v-row dense class="mb-1">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.budget_text"
                  label="Budget (optional)"
                  placeholder="e.g. ₱45,000,000 or Grant-funded"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.completion_text"
                  label="Completion (optional)"
                  placeholder="e.g. 80% or In Progress"
                />
              </v-col>
            </v-row>
          </template>
          <v-text-field
            v-model="form.link_url"
            :label="editingSectionMeta.isFeaturedNews ? 'Button URL (internal path or full https://)' : 'Link URL (optional)'"
            placeholder="/coi/public"
            hint="Internal path (/coi/public) or full https:// address"
            persistent-hint
            class="mb-4"
          />
          <template v-if="editingSectionMeta.isFeaturedNews">
            <v-row dense class="mb-1">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.publish_date"
                  type="date"
                  label="Publish Date (optional)"
                />
              </v-col>
              <v-col cols="12" sm="6" class="d-flex align-center">
                <v-switch
                  v-model="form.is_featured"
                  label="Featured (larger billing)"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </v-col>
            </v-row>
          </template>
          <template v-if="editingSectionMeta.hasValue">
            <v-row dense class="mb-1">
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.value_source"
                  :items="VALUE_SOURCE_OPTIONS"
                  label="Displayed value"
                  hint="Auto values update live from published projects"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-if="form.value_source === 'manual'"
                  v-model="form.manual_value"
                  label="Manual value (optional)"
                  placeholder="e.g. 2 Campuses"
                  hint="Shown as the big number/figure on the card"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </template>

          <!-- ── Appearance ── -->
          <v-divider class="my-4" />
          <div class="dialog-group-label">Appearance</div>
          <p class="dialog-group-hint">Icon, color, and imagery for this item's card.</p>
          <v-row dense class="mb-1">
            <v-col cols="12" :sm="editingSectionMeta.hasValue ? 6 : 12">
              <!-- T-HOME-CMS-5 (TH5-5): searchable icon library with live preview;
                   free-text mdi-* entry stays available for icons outside the
                   curated set (enhance only — nothing removed). -->
              <v-combobox
                v-model="form.icon"
                :items="MDI_ICON_LIBRARY"
                item-title="label"
                item-value="icon"
                label="Icon"
                placeholder="mdi-star-outline"
                :prepend-inner-icon="form.icon || 'mdi-emoticon-outline'"
                hint="Pick from the library or type any mdi-* name directly"
                persistent-hint
              >
                <template #item="{ props: itemProps, item: opt }">
                  <v-list-item
                    v-bind="itemProps"
                    :prepend-icon="opt.raw.icon"
                    :title="opt.raw.label"
                    :subtitle="opt.raw.icon"
                  />
                </template>
              </v-combobox>
            </v-col>
            <v-col v-if="editingSectionMeta.hasValue" cols="12" sm="6">
              <!-- T-HOME-CMS-5 (TH5-11): closed CSU palette, never a freeform picker. -->
              <v-select
                v-model="form.color_token"
                :items="COLOR_TOKEN_OPTIONS"
                label="Accent color"
                hint="Applies to this card's icon/accent only"
                persistent-hint
              />
            </v-col>
          </v-row>
          <!-- T-HOME-CMS-5 (TH5-6): custom SVG/PNG icon upload — offered only
               where media_id isn't already the section's own photo. Rendering
               components display the uploaded image instead of the mdi-* icon
               when one is present; auto-sized/clamped in CSS (TH5-6). -->
          <v-file-input
            v-if="allowIconUpload"
            v-model="iconFiles"
            label="Or upload a custom icon (SVG/PNG, optional)"
            hint="Overrides the icon picked above; sized automatically"
            persistent-hint
            accept="image/svg+xml,image/png"
            prepend-icon="mdi-upload-outline"
            show-size
            density="compact"
            class="mb-4"
          />
          <template v-if="editingSectionMeta.hasImage">
            <v-file-input
              v-model="imageFiles"
              :multiple="allowMultipleUpload"
              :label="editingId
                ? 'Replace image (optional — leave blank to keep current)'
                : allowMultipleUpload
                  ? 'Image(s) — select multiple to create one item per image'
                  : 'Image (PNG/JPG/WebP)'"
              :hint="editingId ? 'Only one file is used when editing an existing item.' : 'Displayed on the card; cropped to fit automatically.'"
              persistent-hint
              accept="image/*"
              prepend-icon="mdi-image-outline"
              show-size
              class="mb-1"
            />
            <!-- T-HOME-CMS-12 (TH12-2): paste a copied image (Ctrl+V) directly
                 into the dialog — reuses the same imageFiles ref the file
                 picker above populates, so save logic is untouched. -->
            <p class="text-caption text-grey-darken-1 mb-4">
              <v-icon size="14" class="mr-1">mdi-content-paste</v-icon>
              You can also paste a copied image with Ctrl+V while this dialog is open.
            </p>
            <v-text-field
              v-model="form.alt_text"
              label="Alt text (accessibility)"
              placeholder="e.g. Students at the CSU main campus quadrangle"
              :disabled="!imageFiles.length"
              :hint="imageFiles.length ? 'Describes the image for screen readers.' : 'Select an image above to set its alt text.'"
              persistent-hint
              class="mb-4"
            />
          </template>

          <!-- ── Visibility & Scheduling ── -->
          <template v-if="editingSectionMeta.hasSchedule">
            <v-divider class="my-4" />
            <div class="dialog-group-label">Visibility &amp; Scheduling</div>
            <p class="dialog-group-hint">Control when this announcement appears and how prominently.</p>
            <v-switch
              v-model="form.is_pinned"
              label="Pin to top (featured, full-width card)"
              color="primary"
              density="compact"
              hide-details
              class="mb-4"
            />
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.scheduled_start"
                  type="datetime-local"
                  label="Visible from (optional)"
                  hint="Leave blank to show immediately"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.scheduled_end"
                  type="datetime-local"
                  label="Visible until (optional)"
                  hint="Leave blank to never expire"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="dialogSaving" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="dialogSaving" @click="saveItem">
            {{ editingId ? 'Save Changes' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog v-model="deleteDialogOpen" max-width="420">
      <v-card rounded="lg">
        <v-card-title>Delete item?</v-card-title>
        <v-card-text>
          "{{ deleteTarget?.title || '(untitled)' }}" will be removed from the homepage.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteItem">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* T-HOME-CMS-5 (TH5-7): two-pane admin layout — left rail section nav,
   right pane content, replacing the prior v-tabs strip. */
.admin-nav-col {
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  min-height: 480px;
}
@media (max-width: 959px) {
  .admin-nav-col {
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    min-height: auto;
  }
}
.admin-content-col {
  min-width: 0;
}

/* T-HOME-CMS-6 (TH6-3): CMS-style grouped dialog — section labels + helper
   text above each field group. */
.dialog-group-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 2px;
}
.dialog-group-hint {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 14px;
}
</style>
