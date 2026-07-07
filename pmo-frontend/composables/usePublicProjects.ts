import { adaptProjects, type UIProject, type BackendProject } from '~/utils/adapters'

// T-HOME (TH-1): shared published-projects state for the public homepage.
// All homepage sections consume this one useState-backed fetch so the page
// costs exactly one anonymous API call regardless of section count.

interface StatusSlice {
  status: string
  count: number
}

interface CampusSlice {
  campus: string
  count: number
}

export function usePublicProjects() {
  const projects = useState<UIProject[]>('public-projects', () => [])
  const loading = useState<boolean>('public-projects-loading', () => false)
  const loaded = useState<boolean>('public-projects-loaded', () => false)

  async function fetchOnce() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const api = useApi()
      const response = await api.get<{ data: BackendProject[] }>(
        '/api/public/construction-projects?publication_status=PUBLISHED',
      )
      projects.value = adaptProjects(response.data || [])
    } catch {
      // Public data is non-critical; sections render empty states on failure.
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  const total = computed(() => projects.value.length)

  // Status taxonomy is PROPOSAL/ONGOING/COMPLETE (MG/MF); COMPLETED tolerated defensively.
  function countStatus(...statuses: string[]): number {
    return projects.value.filter(p => statuses.includes((p.status || '').toUpperCase())).length
  }
  const ongoing = computed(() => countStatus('ONGOING'))
  const completed = computed(() => countStatus('COMPLETE', 'COMPLETED'))

  const totalContractValue = computed(() =>
    projects.value.reduce((sum, p) => sum + (Number(p.totalContractAmount) || 0), 0),
  )

  const byStatus = computed<StatusSlice[]>(() => {
    const counts: Record<string, number> = {}
    for (const p of projects.value) {
      const key = (p.status || 'UNKNOWN').toUpperCase()
      counts[key] = (counts[key] || 0) + 1
    }
    return Object.entries(counts).map(([status, count]) => ({ status, count }))
  })

  const byCampus = computed<CampusSlice[]>(() => {
    const counts: Record<string, number> = {}
    for (const p of projects.value) {
      const key = (p.campus || 'UNSPECIFIED').toUpperCase()
      counts[key] = (counts[key] || 0) + 1
    }
    return Object.entries(counts)
      .map(([campus, count]) => ({ campus, count }))
      .sort((a, b) => b.count - a.count)
  })

  function latestUpdated(n: number): UIProject[] {
    return [...projects.value]
      .filter(p => p.updatedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, n)
  }

  // Featured = ongoing projects by physical progress, backfilled with the most
  // recently updated remainder so the section stays populated on small datasets.
  function featured(n: number): UIProject[] {
    const isOngoing = (p: UIProject) => (p.status || '').toUpperCase() === 'ONGOING'
    const primary = projects.value
      .filter(isOngoing)
      .sort((a, b) => (b.physicalAccomplishment || 0) - (a.physicalAccomplishment || 0))
    const rest = latestUpdated(projects.value.length).filter(p => !isOngoing(p))
    return [...primary, ...rest].slice(0, n)
  }

  return {
    projects,
    loading,
    loaded,
    fetchOnce,
    total,
    ongoing,
    completed,
    totalContractValue,
    byStatus,
    byCampus,
    latestUpdated,
    featured,
  }
}
