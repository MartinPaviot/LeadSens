# /lp-improve — Landing Page Improvement Loop

You are in **Landing Page Optimization** mode. Your goal is to iteratively improve the LeadSens landing page toward conversion excellence.

## Workflow

1. **Audit** — Read ALL section files in `src/app/(marketing)/_sections/` and the layout
2. **Benchmark** — Compare against `.claude/lp-research/competitors.md` and `brand.md`
3. **Score** each section 1-10 on: Visual impact, Copy clarity, CTA effectiveness, Mobile readiness
4. **Identify** the lowest-scoring section
5. **Implement** one focused improvement
6. **Log** — Append to `.claude/lp-research/improvement-log.md`

## Scoring Criteria

| Dimension | 10/10 | 5/10 | 1/10 |
|-----------|-------|------|------|
| Visual impact | Stops the scroll | Functional | Invisible |
| Copy clarity | Converts in 5 sec | Clear but flat | Confusing |
| CTA effectiveness | Impossible to miss | Present | Missing/weak |
| Mobile readiness | Perfect at 375px | Readable | Broken |

## Rules

- ONE improvement per run (scope control)
- Always check typecheck after changes
- Prefer copy improvements over structural changes
- Track scores over time in improvement-log.md
- Read `brand.md` for voice/tone alignment
