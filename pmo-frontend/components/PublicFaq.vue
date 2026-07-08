<script setup lang="ts">
// T-HOME-CMS (THC-10): FAQ — CMS-managed (section_key='faq') with the original
// static entries as fallback so the section never renders empty.
const { fetchOnce, itemsFor } = useHomepageContent()

onMounted(fetchOnce)

const fallbackFaqs = [
  {
    q: 'What is PMO CORE?',
    a: 'PMO CORE (Centralized Operations and Reporting Engine) is the public transparency portal of the Project Management Office of Caraga State University. It publishes information on infrastructure projects, repairs, and university operations across CSU campuses.',
  },
  {
    q: 'Who maintains the data?',
    a: 'Records are entered and maintained by authorized PMO personnel. Each record passes through a review-and-approval workflow before it is published.',
  },
  {
    q: 'How often is the information updated?',
    a: 'Reporting follows a quarterly cycle aligned with university and national budget-reporting standards. Individual project records may be updated more frequently as progress reports are filed.',
  },
  {
    q: 'Why are some projects not shown here?',
    a: 'Only records approved for public viewing appear on this site. Drafts, records under review, and internal working documents are not published.',
  },
  {
    q: 'Who can edit the data?',
    a: 'Only authenticated PMO staff with the appropriate role can create or modify records. Public visitors have read-only access to published information.',
  },
]

const faqs = computed(() => {
  const cmsItems = itemsFor('faq')
  if (cmsItems.length) {
    return cmsItems.map(item => ({ q: item.title, a: item.body }))
  }
  return fallbackFaqs
})

// T-HOME-CMS-8 (TH8-2/TH8-3): variant from pages/index.vue. FAQ always has
// fallback content (never empty), so no empty-state props needed.
defineProps<{ variant?: 'neutral' | 'white' }>()
</script>

<template>
  <PublicSectionBand :variant="variant">
    <template #heading>
      <div class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">Frequently Asked Questions</h2>
        <p class="text-subtitle-1 text-figma-muted mb-0">
          Common questions about PMO CORE and the information it publishes.
        </p>
      </div>
    </template>
      <v-row justify="center">
        <v-col cols="12" md="9">
          <v-expansion-panels variant="accordion" rounded="lg">
            <v-expansion-panel
              v-for="faq in faqs"
              :key="faq.q"
              :title="faq.q"
              :text="faq.a"
            />
          </v-expansion-panels>
        </v-col>
      </v-row>
  </PublicSectionBand>
</template>
