// T-HOME-CMS-5 (TH5-5): curated MDI icon library for the Homepage Management
// icon picker. `@mdi/font` is already an installed dependency (Vuetify's icon
// set) — this is a static, hand-picked subset useful for homepage content, not
// a live font-file scan. Free-text `mdi-*` entry remains available alongside
// this picker for icons outside the curated set (enhance only, nothing removed).

export interface IconLibraryEntry {
  icon: string
  label: string
  group: string
}

export const MDI_ICON_LIBRARY: IconLibraryEntry[] = [
  // Buildings / education
  { icon: 'mdi-school', label: 'School', group: 'Education' },
  { icon: 'mdi-office-building', label: 'Office Building', group: 'Education' },
  { icon: 'mdi-office-building-outline', label: 'Office Building (outline)', group: 'Education' },
  { icon: 'mdi-domain', label: 'Domain', group: 'Education' },
  { icon: 'mdi-town-hall', label: 'Town Hall', group: 'Education' },
  { icon: 'mdi-book-open-variant', label: 'Book', group: 'Education' },
  { icon: 'mdi-account-group', label: 'Community', group: 'Education' },
  { icon: 'mdi-map-marker-radius-outline', label: 'Reach / Radius', group: 'Education' },

  // Charts / data
  { icon: 'mdi-chart-bar', label: 'Bar Chart', group: 'Charts & Data' },
  { icon: 'mdi-chart-line', label: 'Line Chart', group: 'Charts & Data' },
  { icon: 'mdi-chart-timeline-variant', label: 'Timeline', group: 'Charts & Data' },
  { icon: 'mdi-database-outline', label: 'Database', group: 'Charts & Data' },
  { icon: 'mdi-file-chart-outline', label: 'Report', group: 'Charts & Data' },
  { icon: 'mdi-clipboard-check-outline', label: 'Checklist', group: 'Charts & Data' },
  { icon: 'mdi-scale-balance', label: 'Balance / Accountability', group: 'Charts & Data' },
  { icon: 'mdi-hub-outline', label: 'Hub', group: 'Charts & Data' },
  { icon: 'mdi-cog-outline', label: 'Operations', group: 'Charts & Data' },
  { icon: 'mdi-engine-outline', label: 'Engine', group: 'Charts & Data' },

  // Communication
  { icon: 'mdi-bullhorn-outline', label: 'Announcement', group: 'Communication' },
  { icon: 'mdi-email-outline', label: 'Email', group: 'Communication' },
  { icon: 'mdi-phone-outline', label: 'Phone', group: 'Communication' },
  { icon: 'mdi-link-variant', label: 'Link', group: 'Communication' },
  { icon: 'mdi-web', label: 'Website', group: 'Communication' },
  { icon: 'mdi-share-variant-outline', label: 'Share', group: 'Communication' },
  { icon: 'mdi-help-circle-outline', label: 'Help / FAQ', group: 'Communication' },
  { icon: 'mdi-login', label: 'Sign In', group: 'Communication' },

  // Status / alerts
  { icon: 'mdi-star-outline', label: 'Star / Highlight', group: 'Status & Alerts' },
  { icon: 'mdi-check-circle-outline', label: 'Check', group: 'Status & Alerts' },
  { icon: 'mdi-alert-circle-outline', label: 'Alert', group: 'Status & Alerts' },
  { icon: 'mdi-pin', label: 'Pinned', group: 'Status & Alerts' },
  { icon: 'mdi-calendar-check-outline', label: 'Calendar / Schedule', group: 'Status & Alerts' },
  { icon: 'mdi-eye-outline', label: 'Transparency', group: 'Status & Alerts' },
  { icon: 'mdi-shield-check-outline', label: 'Governance', group: 'Status & Alerts' },
  { icon: 'mdi-update', label: 'Update', group: 'Status & Alerts' },

  // Media / misc
  { icon: 'mdi-image-multiple-outline', label: 'Gallery', group: 'Media' },
  { icon: 'mdi-image-outline', label: 'Image', group: 'Media' },
  { icon: 'mdi-file-document-outline', label: 'Document', group: 'Media' },
  { icon: 'mdi-tools', label: 'Tools / Repairs', group: 'Media' },
  { icon: 'mdi-cash-multiple', label: 'Funding', group: 'Media' },
  { icon: 'mdi-account-hard-hat', label: 'Contractor', group: 'Media' },
  { icon: 'mdi-emoticon-outline', label: 'Default / Neutral', group: 'Media' },
]
