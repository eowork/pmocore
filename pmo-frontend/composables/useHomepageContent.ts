// T-HOME-CMS (THC-5): shared CMS homepage content — one anonymous call for all
// admin-managed sections, useState-backed so every section consumes the same fetch.

export interface HomepageItemUI {
  id: string
  item_order: number
  title: string
  body: string
  icon: string
  link_url: string
  value_source: string
  manual_value: string
  image_url: string
  alt_text: string
  is_pinned: boolean
  color_token: string
  created_at: string
  // T-HOME-CMS-11 (TH11-2): Featured News fields — standalone, no COI link.
  subtitle: string
  full_description: string
  author: string
  department: string
  publish_date: string
  is_featured: boolean
  status_text: string
  campus_text: string
  budget_text: string
  completion_text: string
}

// T-HOME-CMS-2 (THM-5): section-level enable/disable + order, stored as one
// JSON settings row (`homepage_sections_config`) rather than a new table.
// T-HOME-CMS-3 (TH3-4): `layout` is a closed enum an admin picks from — not a
// freeform composition system (that was explicitly deferred as out of scope).
export type HomepageLayoutTemplate =
  | 'full_width'
  | 'two_col'
  | 'three_col'
  | 'four_card'
  | 'two_one_split'
  | 'sidebar'
  | 'stacked'
  | 'masonry'

// T-HOME-CMS-8 (TH8-4): admin-configurable behavior when a section has no
// published content — 'hide' (today's old default), 'placeholder' (friendly
// message, visible to everyone, new default), 'reminder' (message visible
// only to homepage administrators, hidden from the public).
export type HomepageEmptyBehavior = 'hide' | 'placeholder' | 'reminder'

export interface HomepageSectionConfig {
  key: string
  visible: boolean
  order: number
  layout?: HomepageLayoutTemplate
  emptyBehavior?: HomepageEmptyBehavior
}

const DEFAULT_SECTIONS_CONFIG: HomepageSectionConfig[] = [
  { key: 'about_core', visible: true, order: 1 },
  { key: 'highlights', visible: true, order: 2, layout: 'four_card' },
  { key: 'featured_projects', visible: true, order: 3 },
  { key: 'announcements', visible: true, order: 4, layout: 'stacked' },
  { key: 'latest_updates', visible: true, order: 5 },
  // T-HOME-CMS-5 (TH5-3): PublicQuickLinks.vue was fully built and CMS-wired
  // but never added to this config — wiring in an already-complete feature.
  { key: 'quick_links', visible: true, order: 6 },
  { key: 'transparency', visible: true, order: 7 },
  { key: 'faq', visible: true, order: 8 },
]

interface PublicHomepageResponse {
  settings: Record<string, string>
  items: Record<string, HomepageItemUI[]>
}

export function useHomepageContent() {
  const settings = useState<Record<string, string>>('homepage-settings', () => ({}))
  const items = useState<Record<string, HomepageItemUI[]>>('homepage-items', () => ({}))
  const loading = useState<boolean>('homepage-content-loading', () => false)
  const loaded = useState<boolean>('homepage-content-loaded', () => false)

  async function fetchOnce() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const api = useApi()
      const config = useRuntimeConfig()
      const response = await api.get<PublicHomepageResponse>('/api/public/homepage')
      settings.value = response.settings || {}
      // Qualify /uploads image paths for Docker deployments (same rule as adapters.ts).
      const apiBase = config.public.apiBase
      const grouped = response.items || {}
      if (apiBase) {
        for (const key of Object.keys(grouped)) {
          for (const item of grouped[key]) {
            if (item.image_url && item.image_url.startsWith('/')) {
              item.image_url = `${apiBase}${item.image_url}`
            }
          }
        }
      }
      items.value = grouped
    } catch {
      // CMS content is non-critical; sections fall back to seeded/static copy.
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  function setting(key: string, fallback = ''): string {
    return settings.value[key] || fallback
  }

  function itemsFor(sectionKey: string): HomepageItemUI[] {
    return items.value[sectionKey] || []
  }

  const theme = computed(() => setting('homepage_theme', 'light_emerald'))

  const sectionsConfig = computed<HomepageSectionConfig[]>(() => {
    const raw = settings.value['homepage_sections_config']
    if (!raw) return DEFAULT_SECTIONS_CONFIG
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SECTIONS_CONFIG
    } catch {
      return DEFAULT_SECTIONS_CONFIG
    }
  })

  return { settings, items, loading, loaded, fetchOnce, setting, itemsFor, theme, sectionsConfig }
}
