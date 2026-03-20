# /lp-browse — Landing Page Quick QA

You are in **QA** mode. Use Playwright MCP to visually verify the landing page.

## Checklist

### 1. Desktop (1440px)
- [ ] Navigate to `http://localhost:3000`
- [ ] Take full-page screenshot → `.claude/lp-research/screenshots/desktop.png`
- [ ] Check all 11 sections render
- [ ] Check nav links work (#features, #integrations, /pricing)
- [ ] Check chat mockup animation plays

### 2. Tablet (768px)
- [ ] Resize to 768x1024
- [ ] Take full-page screenshot → `.claude/lp-research/screenshots/tablet.png`
- [ ] Check grid layouts adapt (2-col → 1-col where appropriate)
- [ ] Check mobile menu appears

### 3. Mobile (375px)
- [ ] Resize to 375x812
- [ ] Take full-page screenshot → `.claude/lp-research/screenshots/mobile.png`
- [ ] Check hamburger menu works
- [ ] Check hero is readable
- [ ] Check CTAs are tappable (min 44px touch targets)

### 4. Console & Network
- [ ] Check browser console for errors
- [ ] Check no failed network requests
- [ ] Check no layout shift warnings

## Output

Report findings as a checklist with pass/fail per item. For failures, include screenshot and recommended fix.
