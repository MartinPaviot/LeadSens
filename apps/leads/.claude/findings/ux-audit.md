# UX/UI Design Audit — LeadSens (2026-03-19)

## Per-page scores (1-10 on each criterion)

| Criterion | Home | Market | Replies | Campaigns | Agent Panel | Avg |
|-----------|------|--------|---------|-----------|-------------|-----|
| 1. Visual Hierarchy | 5 | 6 | 6 | 6 | 5 | 5.6 |
| 2. Information Density | 3 | 7 | 4 | 6 | 4 | 4.8 |
| 3. Typography | 6 | 6 | 6 | 6 | 6 | 6.0 |
| 4. Color System | 6 | 7 | 5 | 6 | 6 | 6.0 |
| 5. Spacing & Rhythm | 5 | 6 | 5 | 6 | 5 | 5.4 |
| 6. Component Consistency | 6 | 7 | 6 | 6 | 5 | 6.0 |
| 7. Interactive States | 4 | 5 | 4 | 5 | 5 | 4.6 |
| 8. Micro-interactions | 3 | 3 | 3 | 3 | 4 | 3.2 |
| 9. Icons | 6 | 5 | 6 | 6 | 6 | 5.8 |
| 10. Data Visualization | 3 | 5 | 3 | 5 | 3 | 3.8 |
| 11. Responsive | 7 | 7 | 7 | 6 | 7 | 6.8 |
| 12. Dark/Light Mode | 6 | 6 | 6 | 6 | 6 | 6.0 |
| **Page Average** | **5.0** | **5.8** | **5.1** | **5.6** | **5.2** | **5.3** |

## Top issues to fix (by impact)

### CRITICAL (affects every page)

1. **Home feels like a SaaS dashboard 101** — 4 big KPI cards with 0s on top, then empty state. Monaco uses prose + priorities. Needs complete redesign.
2. **Signal columns use em-dashes not Yes/No** — Market table shows "—" everywhere. Should show "No" in grey, "Yes" in green (Monaco style).
3. **Agent panel greeting is a full dashboard** — Templates, stats, legend. Should be minimal: "How can I help?" + 3 quick chips.
4. **No hover states on table rows** — Market table rows have no visible hover effect.
5. **KPI cards are oversized** — Home cards take 1/3 of the screen for 4 zeroes. Should be a compact stat line.
6. **Replies empty state shows header + empty page** — Too much dead space. The filter pills appear briefly then vanish.
7. **Table signal columns use ✓/✗ icons not text** — Less professional than Monaco's "Yes"/"No" text approach.
8. **No loading skeletons** — Pages flash blank then render. Should show skeletons.

### HIGH (specific pages)

9. **Market: no favicon from Google API** — Letter avatars only. Should try real favicons first.
10. **Campaigns: status badges inconsistent** — "Sourcing" badge has an icon inside, different from market/replies badges.
11. **Nav bar: agent button doesn't stand out** — Same ghost button as settings/search. Should be visually distinct.
12. **Replies: emoji-based category indicators** — 🟢🟡🔴⚪ in filter pills. Should use colored dots, not emojis.

### MEDIUM (polish)

13. **Home subtitle "Here's your outreach overview."** — Generic. Should be data-driven or removed.
14. **Numbers not formatted** — "93" not "93" (ok for small), but "14247" would need commas.
15. **Table row height ~46px** — Acceptable, could be tighter.
16. **Market filter pills** — Adequate but could be smaller/more compact.
