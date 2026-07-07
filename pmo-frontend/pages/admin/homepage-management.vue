<script setup lang="ts">
// T-HOME-CMS (THC-6): Homepage Management — Admin/SuperAdmin only.
// Edits the CMS content behind the public homepage: singleton settings (hero,
// about, footer/contact) + ordered publishable items per section. Reordering
// uses up/down buttons (explicit plan decision: no drag-and-drop dependency).
definePageMeta({
  middleware: ['auth', 'permission'],
})

import { LAYOUT_TEMPLATE_OPTIONS } from '~/utils/homepage-layout'

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
}

// T-HOME-CMS-3 (TH3-4): layout picker shown only for sections that actually
// render as an item grid — accordions (FAQ) and narrative sections don't
// benefit from a grid template.
const LAYOUT_APPLICABLE_SECTIONS = new Set(['highlights', 'announcements'])
const SECTION_LABELS: Record<string, { title: string; icon: string }> = {
  about_core: { title: 'About PMO CORE', icon: 'mdi-information-outline' },
  highlights: { title: 'University Highlights', icon: 'mdi-star-outline' },
  featured_projects: { title: 'Featured Projects', icon: 'mdi-office-building-outline' },
  announcements: { title: 'Announcements', icon: 'mdi-bullhorn-outline' },
  latest_updates: { title: 'Latest Updates', icon: 'mdi-update' },
  transparency: { title: 'Why PMO CORE Exists', icon: 'mdi-eye-outline' },
  faq: { title: 'Frequently Asked Questions', icon: 'mdi-help-circle-outline' },
}
const DEFAULT_SECTION_ORDER: SectionConfigEntry[] = [
  { key: 'about_core', visible: true, order: 1 },
  { key: 'highlights', visible: true, order: 2 },
  { key: 'featured_projects', visible: true, order: 3 },
  { key: 'announcements', visible: true, order: 4 },
  { key: 'latest_updates', visible: true, order: 5 },
  { key: 'transparency', visible: true, order: 6 },
  { key: 'faq', visible: true, order: 7 },
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
}

const SECTIONS = [
  { key: 'hero_slide', label: 'Carousel Slides', icon: 'mdi-image-multiple-outline', hasImage: true, hasValue: false, hasSchedule: false },
  { key: 'highlight', label: 'Highlights', icon: 'mdi-star-outline', hasImage: false, hasValue: true, hasSchedule: false },
  { key: 'announcement', label: 'Announcements', icon: 'mdi-bullhorn-outline', hasImage: true, hasValue: false, hasSchedule: true },
  { key: 'quick_link', label: 'Quick Links', icon: 'mdi-link-variant', hasImage: false, hasValue: false, hasSchedule: false },
  { key: 'faq', label: 'FAQ', icon: 'mdi-help-circle-outline', hasImage: false, hasValue: false, hasSchedule: false },
  // T-HOME-CMS-4 (TH4-4): previously hardcoded, no CMS path at all.
  { key: 'about_facet', label: 'About PMO CORE Facets', icon: 'mdi-hub-outline', hasImage: false, hasValue: false, hasSchedule: false },
  { key: 'transparency_pillar', label: 'Why PMO CORE Exists — Pillars', icon: 'mdi-eye-outline', hasImage: false, hasValue: false, hasSchedule: false },
] as const

const VALUE_SOURCE_OPTIONS = [
  { title: 'Manual text (or none)', value: 'manual' },
  { title: 'Auto — Published project count', value: 'auto:published_count' },
  { title: 'Auto — Ongoing project count', value: 'auto:ongoing_count' },
  { title: 'Auto — Completed project count', value: 'auto:completed_count' },
]

const activeTab = ref('settings')
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
})
// T-HOME-CMS-2 (THM-3): array so a single v-file-input serves both the
// "one image" (edit/replace) and "multiple images" (batch create) flows.
const imageFiles = ref<File[]>([])

const editingSectionMeta = computed(() =>
  SECTIONS.find(s => s.key === editingSection.value) ?? SECTIONS[0],
)

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
  imageFiles.value = []
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
  imageFiles.value = []
  dialogOpen.value = true
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
      <v-tabs v-model="activeTab" color="primary" show-arrows>
        <v-tab value="settings" prepend-icon="mdi-text-box-outline">Page Content</v-tab>
        <v-tab value="sections" prepend-icon="mdi-view-sequential-outline">Section Layout</v-tab>
        <v-tab
          v-for="section in SECTIONS"
          :key="section.key"
          :value="section.key"
          :prepend-icon="section.icon"
        >
          {{ section.label }}
        </v-tab>
      </v-tabs>
      <v-divider />

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
    </v-card>

    <!-- Item editor dialog -->
    <v-dialog v-model="dialogOpen" max-width="640" persistent>
      <v-card rounded="lg">
        <v-card-title class="d-flex align-center ga-2">
          <v-icon :icon="editingSectionMeta.icon" size="20" />
          {{ editingId ? 'Edit' : 'Add' }} {{ editingSectionMeta.label.replace(/s$/, '') }}
        </v-card-title>
        <v-card-text>
          <v-text-field v-model="form.title" label="Title" class="mb-2" />
          <v-textarea v-model="form.body" label="Description / Body" rows="3" auto-grow class="mb-2" />
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.icon"
                label="Icon (mdi-*)"
                placeholder="mdi-star-outline"
                :prepend-inner-icon="form.icon || 'mdi-emoticon-outline'"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.link_url"
                label="Link URL (optional)"
                placeholder="/coi/public"
              />
            </v-col>
          </v-row>
          <template v-if="editingSectionMeta.hasValue">
            <v-select
              v-model="form.value_source"
              :items="VALUE_SOURCE_OPTIONS"
              label="Displayed value"
              class="mb-2"
            />
            <v-text-field
              v-if="form.value_source === 'manual'"
              v-model="form.manual_value"
              label="Manual value (optional, e.g. '2 Campuses')"
            />
          </template>
          <template v-if="editingSectionMeta.hasImage">
            <v-file-input
              v-model="imageFiles"
              :multiple="allowMultipleUpload"
              :label="editingId
                ? 'Replace image (optional — leave blank to keep current)'
                : allowMultipleUpload
                  ? 'Slide image(s) — select multiple to create one item per image'
                  : 'Slide image (PNG/JPG/WebP)'"
              :hint="editingId ? 'Only one file is used when editing an existing item.' : ''"
              persistent-hint
              accept="image/*"
              prepend-icon="mdi-image-outline"
              show-size
              class="mb-2"
            />
            <v-text-field
              v-model="form.alt_text"
              label="Alt text (accessibility — describes the image for screen readers)"
              placeholder="e.g. Students at the CSU main campus quadrangle"
              :disabled="!imageFiles.length"
              :hint="!imageFiles.length ? 'Select an image above to set its alt text.' : ''"
              persistent-hint
            />
          </template>

          <template v-if="editingSectionMeta.hasSchedule">
            <v-divider class="my-3" />
            <v-switch
              v-model="form.is_pinned"
              label="Pin to top"
              color="primary"
              density="compact"
              hide-details
              class="mb-2"
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
