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
</script>

<template>
  <div class="faq-band py-12">
    <v-container>
      <div class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold text-figma-primary mb-2">Frequently Asked Questions</h2>
        <p class="text-subtitle-1 text-figma-muted mb-0">
          Common questions about PMO CORE and the information it publishes.
        </p>
      </div>
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
    </v-container>
  </div>
</template>

<style scoped>
.faq-band {
  background-color: var(--csu-band-bg, #f8fafc);
  border-top: 1px solid var(--csu-band-border, #e2e8f0);
}
</style>
