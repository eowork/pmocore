import type { HomepageLayoutTemplate } from '~/composables/useHomepageContent'

// T-HOME-CMS-3 (TH3-4): closed-set grid templates for repeatable-item homepage
// sections (Highlights, Announcements, FAQ). Each maps to a fixed v-col
// breakpoint combination the codebase already renders correctly elsewhere —
// no new layout engine, no admin-authored arbitrary containers.
//
// `two_one_split` and `sidebar` are simplified approximations: with a uniform
// list of same-shaped items (not a fixed "main content + aside" pair), a true
// 2:1 or sidebar composition would need per-item special-casing. Here they
// render as wider (2:1) or narrower (sidebar-rail) uniform cards instead —
// visually distinct from the other templates, but not a literal two-region
// layout. Documented rather than silently dropped from the 8-template set.

export interface LayoutColProps {
  cols: number
  sm?: number
  md?: number
  lg?: number
}

const LAYOUT_COLS: Record<HomepageLayoutTemplate, LayoutColProps> = {
  full_width: { cols: 12 },
  two_col: { cols: 12, sm: 6 },
  three_col: { cols: 12, sm: 6, md: 4 },
  four_card: { cols: 12, sm: 6, md: 3 },
  two_one_split: { cols: 12, sm: 6, md: 8 },
  sidebar: { cols: 12, sm: 6, md: 4, lg: 3 },
  stacked: { cols: 12 },
  masonry: { cols: 12 }, // masonry uses CSS columns on the wrapper, not v-col sizing
}

export function colPropsForLayout(layout: HomepageLayoutTemplate | undefined): LayoutColProps {
  return LAYOUT_COLS[layout || 'four_card'] || LAYOUT_COLS.four_card
}

export function isMasonryLayout(layout: HomepageLayoutTemplate | undefined): boolean {
  return layout === 'masonry'
}

export const LAYOUT_TEMPLATE_OPTIONS: Array<{ title: string; value: HomepageLayoutTemplate }> = [
  { title: 'Full width (1 per row)', value: 'full_width' },
  { title: 'Two columns', value: 'two_col' },
  { title: 'Three columns', value: 'three_col' },
  { title: 'Four-card grid', value: 'four_card' },
  { title: '2:1 split (wider cards)', value: 'two_one_split' },
  { title: 'Sidebar (narrow cards)', value: 'sidebar' },
  { title: 'Stacked list', value: 'stacked' },
  { title: 'Masonry (uneven heights)', value: 'masonry' },
]
