# PMO CORE — Homepage Management Guide

> **Audience:** Content administrators — the people who curate what the public sees at the
> PMO CORE homepage.
> **Not this:** deployment or server operations (see `DEPLOYMENT.md` / `RUNBOOK.md`), or
> day-to-day data entry in COI/UO modules (see `USER_GUIDE.md`).
> **Last verified:** 2026-07-08

The public homepage (`/`) is fully content-managed: every headline, card, image, FAQ entry,
and announcement is editable from inside the app — no code changes, no deployments. Changes
appear on the public site as soon as they're saved (refresh the page to see them).

---

## 1. Access

**Who can open Homepage Management:**

- **SuperAdmin** — always.
- **Admin** — only with an explicit `homepage` module grant. An Admin role by itself is
  *not* enough (this was tightened deliberately — public-website content is a narrower
  responsibility than general administration). Grants are issued through the same
  access-request / module-override flow used for other module permissions.

**Where it lives:** Sidebar → **Operations & Monitoring** → **Public Website** → **Homepage**
(route: `/admin/homepage-management`).

The page has a left rail listing every editable area; click a section name to open its editor
in the main panel. Your last-selected section is remembered between visits.

---

## 2. Page Content tab

Single-value text that appears once on the page:

| Setting | Where it appears |
|---|---|
| Hero Headline / Subtitle / Description | The large opening banner |
| About Section Title / Body | "About PMO CORE" |
| Why PMO CORE Exists — Title / Body | The transparency statement |
| Footer Mission Statement | Footer, left column |
| Contact Address / Contact Website | Footer, contact column |

**Homepage Theme** — a dropdown of 5 preset color schemes (Light Emerald default, Dark
Emerald, CSU Green, White, Neutral Gray). Presets change accent colors, card borders, and
background tints across the whole public page. There is deliberately no free color picker —
all presets stay within official CSU brand colors.

Click **Save Settings** after editing. Fields save together.

---

## 3. Section Layout tab

Controls which sections appear on the homepage and in what order:

- **Show/hide** — the toggle on each row. The Hero always shows and isn't listed.
- **Reorder** — up/down arrows on each row.
- **Layout template** (Highlights and Announcements only) — how that section's cards
  arrange themselves: full-width, two/three/four columns, stacked, masonry, and more.
- **"If empty" behavior** (Highlights, Announcements, Featured News, Latest Updates) —
  what happens when a section has no published content:
  - **Show placeholder message** (default) — a friendly "content coming soon" note, visible
    to everyone. The section keeps its place on the page.
  - **Show reminder (admins only)** — invisible to the public; logged-in homepage admins see
    a nudge to fill the section in.
  - **Hide section entirely** — the section vanishes until content exists.

Every change on this tab saves immediately.

---

## 4. Content sections

Each remaining left-rail entry manages one homepage section. They all share the same
mechanics (see §5); what differs is the fields.

### Carousel Slides
Images rotating in the hero banner. Upload one or several at once (multi-select creates one
slide per image). Optional caption and link per slide. If no slides exist, a default CSU
building photo shows — the hero never renders empty.

### Highlights
The "University Highlights" stat/feature cards. Per card:
- Title, description, icon.
- **Displayed value** — either manual text (e.g. "2 Campuses") or a live auto-count
  (published / ongoing / completed project counts, always current, never goes stale).
- **Accent color** — a closed set of CSU swatches (Green, Gold, Orange, Emerald, Gray).

### Featured News
The University's flexible public showcase — awards, research, events, milestones,
partnerships, advisories. **Not limited to infrastructure projects**; cards are fully manual.

Per card:

| Field | Notes |
|---|---|
| Title / Subtitle | Subtitle optional |
| Category | Free text shown as the gold-bar tag (e.g. "Research", "Awards") |
| Short Description | Shown on the card face (3-line preview) |
| Full Description | Shown in the pop-up detail view when a visitor clicks the card |
| Author / Department | The byline ("by: PMO CORE · date"). Author pre-fills "PMO CORE" — override freely |
| Publish Date | The date displayed on the card (defaults to creation date if blank) |
| Status / Campus / Budget / Completion | All optional badge texts — fill only what fits the story (a research award has no "budget"; leave it blank and no badge shows) |
| Button URL | Internal path (`/coi/public`) or full external `https://` link |
| Featured toggle | Featured cards sort first and get a highlighted border + star badge |

Display behavior: **4 or fewer cards** show as a centered row; **5 or more** switch to a
swipeable carousel with arrow navigation — add as many as you want, the layout never breaks.

### Announcements
Time-sensitive notices. Beyond the standard fields:
- **Pin to top** — one pinned announcement renders as a large featured card above the rest.
- **Visible from / until** — an optional schedule window. Outside the window the
  announcement hides itself automatically (this is how you set an expiration).

### FAQ
Question (title) and answer (body) pairs, shown as an accordion. Ships with 5 seeded
questions you can edit or replace.

### About PMO CORE Facets · Why PMO CORE Exists — Pillars
The four small cards inside each of those two narrative sections. Title, body, icon; facets
can also carry an image.

### Quick Links
The "Explore PMO CORE" link cards. Title, short description, icon, and a URL (internal
or external).

---

## 5. Shared mechanics (every section)

- **Publish toggle** — the switch on each item row. Off = hidden from the public
  immediately, without deleting anything.
- **Reorder** — up/down arrows on each row.
- **Edit / Delete** — pencil and trash icons. Delete asks for confirmation; deleted items
  are soft-removed (recoverable by a developer, but treat delete as final).
- **Images** — upload via the file picker, **or copy an image anywhere (e.g. from a web
  page) and press Ctrl+V while the edit dialog is open**. JPG, PNG, GIF, and WebP all work.
  Always fill in the **alt text** field — it's what screen readers announce.
- **Icons** — pick from the built-in searchable library (with live preview), type any
  `mdi-*` icon name directly, or upload a custom SVG/PNG icon (sized automatically).
- **Preview Homepage** — the button at the top opens the live public page in a new tab,
  exactly as a visitor sees it. You stay logged in; no logout needed.

---

## 6. Quick recipes

| I want to… | Do this |
|---|---|
| Post a news item about an award | Featured News → Add → Category "Awards", fill title/descriptions, upload a photo, Save |
| Announce scheduled maintenance that auto-expires | Announcements → Add → set "Visible until" to the end time |
| Temporarily hide the FAQ section | Section Layout → FAQ row → toggle off |
| Change the site's color scheme | Page Content → Homepage Theme dropdown → Save Settings |
| Reorder homepage sections | Section Layout → up/down arrows |
| Feature one news item above the rest | Edit it → turn on the Featured toggle |

---

*Companion documents: `USER_GUIDE.md` (end users) · `README.md` (index of this folder)*
