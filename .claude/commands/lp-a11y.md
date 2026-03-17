# /lp-a11y — Landing Page Accessibility Audit

You are in **Accessibility** mode. Audit the landing page against WCAG 2.1 AA.

## Audit Checklist

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Focus indicators visible
- [ ] Skip-to-content link present
- [ ] Mobile menu keyboard accessible
- [ ] No keyboard traps

### Screen Reader
- [ ] All images have alt text
- [ ] Heading hierarchy is correct (h1 → h2 → h3)
- [ ] Section landmarks have aria-labels
- [ ] Chat mockup has aria-live or is hidden from AT
- [ ] Logo bar has aria-hidden (decorative)

### Color & Contrast
- [ ] Text meets 4.5:1 contrast ratio (normal text)
- [ ] Large text meets 3:1 ratio
- [ ] Gradient text passes contrast on both light/dark
- [ ] Error/success states not color-only
- [ ] Dark mode maintains all ratios

### Motion
- [ ] `prefers-reduced-motion` respected for scroll reveals
- [ ] Chat mockup pauses with reduced motion
- [ ] Logo scroll pauses with reduced motion
- [ ] Counter animation skips to final value

### Forms
- [ ] Email input has associated label
- [ ] Error messages are announced
- [ ] Submit buttons have descriptive text

## Process

1. Read all section and component files
2. Run automated checks (contrast ratios, heading order)
3. For each failure: file + line + recommended fix
4. Prioritize: Critical (blocks access) > Major (degrades experience) > Minor
