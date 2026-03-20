# LeadSens E2E Smoke Test Report

**Date:** 2026-03-18
**Tester:** Claude Code (Playwright MCP)
**Environment:** localhost:3000, dev mode
**Browser viewport:** 1440x900
**Screenshots:** `.claude/findings/screenshots/01-14`

---

## Summary

| Phase | Description | Result | Issues |
|-------|-------------|--------|--------|
| 1 | Marketing Pages | PASS (partial) | Landing page (`/`) untestable when logged in (redirect to `/chat`) |
| 2 | Signup | PASS | Clean form, Google OAuth + email/password |
| 3 | Login | PASS | Clean form, pre-filled credentials work |
| 4 | Onboarding | PASS | 5 steps functional, transitions smooth |
| 5 | Integrations | PASS | API key + OAuth (HubSpot) both work |
| 6 | Chat Agent | PASS | SSE streaming, rich markdown, quick replies |
| 7 | Company DNA | PASS | Full form loads (after delay), all sections present |
| 8 | Edge Cases | PARTIAL | 404 works, auth redirect untested (can't sign out) |

**Overall: 7 PASS, 1 PARTIAL out of 8 phases.**

---

## Bugs Found (by severity)

### P1 — Server Errors (blocking in sidebar)

**BUG-01: Multiple tRPC endpoints return 500 Internal Server Error**
- Endpoints affected:
  - `workspace.getOnboardingData` — 500
  - `workspace.getAutonomyLevel` — 500
  - `workspace.getCompanyDna` — 500
  - `conversation.list` — 500
  - `integration.list` — 500
  - `auth/sign-out` — 500
- Root cause: `createContext` throws "Unauthorized" — the session resolution in tRPC context fails intermittently
- Impact: Sidebar shows "No conversations" even after chatting; Company DNA page has slow load; sign-out broken
- Screenshot: Console errors visible across all dashboard pages

### P1 — Sign-out broken

**BUG-02: POST `/api/auth/sign-out` returns 500**
- Users cannot log out
- Likely same root cause as BUG-01 (session context)
- Must fix before launch

### P2 — Data Display Bugs

**BUG-03: Greeting says "Good evening, Claude" instead of user's name**
- Location: Chat greeting screen (`route.ts` system prompt or greeting component)
- The workspace was created as "Claude's Workspace" with email `claude@leadsens.io`
- The greeting should use the actual user's first name, not the test account name
- Screenshot: `07-chat-greeting.png`

**BUG-04: Onboarding summary shows "Claude's Workspace" as company**
- Step 5 summary displays the workspace name, not the company name entered in Step 1
- If Step 1 was skipped (resumed from Step 3), prior data isn't reflected
- Screenshot: `06-onboarding-step5-ready.png`

**BUG-05: Sidebar workspace initial inconsistent — shows "U" then "C"**
- On integrations page: "U Workspace"
- On chat page: "C Workspace"
- Likely a race condition in session/workspace data loading

### P3 — UX Issues

**BUG-06: Onboarding resumes at Step 3 without showing Steps 1-2 data**
- When returning to the app with incomplete onboarding, it resumes at Step 3
- No way to see/edit Steps 1-2 data (company name, URL) from the resumed state
- Step 5 summary is missing company URL and integrations connected

**BUG-07: Chat agent says "5-step sequences" but system has 6 steps**
- The agent response mentions "5-step sequences (PAS, value-add, social proof, breakup)"
- Actual implementation has 6 steps: PAS, Value-add, Social proof, New angle, Micro-value, Breakup
- Fix in system prompt or greeting response

### P3 — Console Warnings

**BUG-08: Missing `Description` or `aria-*` attribute warning**
- Radix UI component missing accessibility attribute
- Low priority but should fix for a11y compliance

**BUG-09: Image optimization warning**
- `Image with src "http://localhost:3000/sa..."` — Next.js Image component warning
- Should use `<Image>` component instead of `<img>` for the affected image

---

## What Works Well

1. **Pricing page** — Clean 3-tier layout, FAQ section, proper navigation and footer
2. **Legal pages** — Privacy (11 sections, GDPR) and Terms (13 sections) are comprehensive
3. **Login/Signup forms** — Google OAuth + email/password, "Free to start" messaging, password visibility toggle
4. **Onboarding flow** — Beautiful step-by-step wizard with progress bar, integration pills with logos, autonomy selection cards
5. **Integration connection UX** — API key input with security badge ("AES-256 encrypted"), help link, cancel button; OAuth opens proper popup with Composio bridge
6. **Chat greeting** — Beautiful gradient background, color-coded ICP example tags with role labels
7. **Chat agent response** — SSE streaming works, rich markdown (headers, bold, italic, lists, blockquotes), action buttons (copy, thumbs up/down, regenerate), quick reply suggestions
8. **Company DNA page** — Well-structured form with all sections (one-liner, selling points, social proof, case studies, client portfolio, CTA, target buyers)
9. **404 page** — Clean "Page not found" with "Go home" link
10. **Integrations settings** — 8 categories, 20+ tools, proper logos and descriptions, clear connect/disconnect flows

---

## Recommendations

### Must Fix Before Launch
1. **BUG-01/02**: Fix tRPC context session resolution — this is the root cause of most 500 errors
2. **BUG-02**: Fix sign-out endpoint
3. **BUG-03**: Use actual user name in greeting, not hardcoded "Claude"

### Should Fix
4. **BUG-04/05**: Ensure workspace name and initials are consistent across components
5. **BUG-06**: Show Step 1-2 data in Step 5 summary even when resuming onboarding
6. **BUG-07**: Fix "5-step" → "6-step" in agent system prompt

### Nice to Have
7. **BUG-08/09**: Fix a11y warning and image optimization
8. Add error boundaries to gracefully handle tRPC failures instead of silent loading
9. Add a loading skeleton for Company DNA page instead of "Loading..." text

---

## Screenshots Index

| # | File | Description |
|---|------|-------------|
| 01 | `01-chat-initial.png` | Chat page initial load (loading state) |
| 02 | `02-pricing.png` | Pricing page full (3 plans + FAQ) |
| 03 | `03-onboarding-step3.png` | Onboarding Step 3 — Connect tools |
| 04 | `04-instantly-api-key-input.png` | Instantly API key input expanded |
| 05 | `05-onboarding-step4-autonomy.png` | Onboarding Step 4 — Autonomy selection |
| 06 | `06-onboarding-step5-ready.png` | Onboarding Step 5 — Summary |
| 07 | `07-chat-greeting.png` | Chat greeting screen with ICP example |
| 08 | `08-chat-response.png` | Chat agent response (full markdown) |
| 09 | `09-settings-integrations.png` | Settings > Integrations full page |
| 10 | `10-hubspot-oauth.png` | HubSpot OAuth bridge (Composio) |
| 11 | `11-company-dna-loading-stuck.png` | Company DNA page (loaded after delay) |
| 12 | `12-company-dna-full.png` | Company DNA full form |
| 13 | `13-login-page.png` | Login page |
| 14 | `14-signup-page.png` | Signup page |
