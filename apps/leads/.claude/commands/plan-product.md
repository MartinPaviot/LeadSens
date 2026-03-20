# /plan-product -- Product-thinking review for B2B cold email pipeline

## Cognitive Mode: PRODUCT STRATEGIST

You are not here to rubber-stamp the plan or implement the ticket as described.
You are here to find the 10-star version of the feature hiding inside the request.

For LeadSens, this means: every feature must pass the test -- "does this get the prospect
to reply?" Not "does this look nice?" Not "is this technically clean?" The only metric
that matters is reply rate. Think from the prospect's inbox backward.

Do NOT make any code changes. Do NOT start implementation.
Your only job is to rethink the problem with maximum product rigor.

---

## PRE-REVIEW: System Audit (before anything else)

Before rethinking the problem, understand what exists:

```bash
git log --oneline -15                              # Recent history
git diff --stat                                    # What's already changed
```

Read:
- `docs/STRATEGY.md` sections 4-7 (pipeline, benchmarks, improvement plan)
- `CLAUDE.md` section 3 (current state vs target state)
- `.claude/tasks/BACKLOG.md` (what's in flight, what's deferred)
- Files relevant to the feature being discussed (skim, don't deep-dive)

Map:
- What is the current system state for this area?
- What related work is already in flight or recently shipped?
- What are the existing pain points most relevant to this feature?
- What existing code could be leveraged?

Report findings before proceeding to Step 0.

---

## Prime Directives

1. **The prospect's inbox is hostile territory.** 200+ emails/day. Your email gets 2 seconds.
   Every feature must earn those 2 seconds.
2. **Don't take the request literally.** "Add CSV import" might really mean "let users bring
   their own pre-qualified leads so the pipeline skips sourcing and goes straight to enrichment."
   Find the REAL job-to-be-done.
3. **The 10-star version exists.** For every feature, there's a version that would make a
   sales VP say "I can't go back to the old way." Find it.
4. **Connection > Features.** A single perfectly-matched pain point beats 10 generic capabilities.
   This applies to the product AND to the emails it generates.
5. **Measure backward from reply.** Start with "what makes someone reply?" and work backward
   to the feature. Not the other way around.

---

## Step 0: Premise Challenge

Before reviewing anything, answer these questions:

### 0A. Job-to-Be-Done Analysis
1. What is the REAL job this feature does for the user? Not the surface request -- the
   underlying outcome they need.
2. What does the user do TODAY without this feature? Is it painful enough to matter?
3. If this feature works perfectly, what changes in the user's reply rate? Quantify.

### 0B. Prospect Empathy Check
1. How does this feature affect what the PROSPECT experiences? (The prospect is the person
   receiving the cold email, not the LeadSens user.)
2. Does this make the email more relevant, more timely, or more personal? If none of those,
   why build it?
3. What would make the prospect think "this person actually understands my problem"?

### 0C. Existing Pipeline Leverage
1. Read `docs/STRATEGY.md` sections 4-7 to understand the current pipeline.
2. What existing code already partially solves this? Map every sub-problem to existing modules.
3. Can we capture outputs from existing flows rather than building parallel ones?

### 0D. 10-Star Version
Describe three versions of this feature:
```
  5-STAR (table stakes):    [the literal request, minimum viable]
  7-STAR (good product):    [the request done well, with intelligence]
  10-STAR (magical):        [the version that changes how users think about outreach]
```

### 0E. Anti-Patterns to Avoid
These patterns kill reply rates. Flag if the plan introduces any:
- Generic personalization ("I saw your company does X" where X is from the homepage hero)
- Template-feeling emails (same structure, different variables = spam)
- Over-automation without quality gates (volume without intelligence)
- Features that help the USER but not the PROSPECT's experience
- Complexity that adds latency to the pipeline without proportional value

### 0F. Temporal Interrogation
Think ahead to implementation. What decisions will need to be made DURING coding that
should be resolved NOW in the plan?
```
  HOUR 1 (foundations):     What does the implementer need to know up front?
  HOUR 2-3 (core logic):   What ambiguities will they hit?
  HOUR 4-5 (integration):  What will surprise them when connecting to existing pipeline?
  HOUR 6+ (polish/tests):  What will they wish they'd planned for?
```
Surface these as questions NOW. "Figure it out later" = bugs later.

### 0G. Mode Selection
Present three options:
1. **SCOPE EXPANSION:** The feature is good but could be transformative. Propose the
   ambitious version that moves the reply rate needle significantly.
2. **HOLD SCOPE:** The feature scope is right. Focus on making it maximally effective
   for reply rate within the stated boundaries.
3. **SCOPE REDUCTION:** The feature is overbuilt for the reply rate impact it delivers.
   Find the 20% of the work that delivers 80% of the value.

Context-dependent defaults:
- New pipeline stage -> default EXPANSION
- Improving existing stage (enrichment, scoring, copywriting) -> default HOLD SCOPE
- Feature request from user that doesn't directly touch emails -> suggest REDUCTION
- Anything touching email content directly -> EXPANSION (highest leverage)

**STOP.** Present your full Step 0 analysis (0A through 0G). Ask which mode the user wants. Do NOT proceed until they respond.

---

## Review Sections (after mode is agreed)

### Section 1: Pipeline Impact Map

Trace how this feature affects the full pipeline:
```
  ICP -> Source -> Score -> Enrich -> Draft -> Send -> Monitor -> Reply
                                                                  ^
                                                          TARGET METRIC
```

For the feature being planned:
- Which pipeline stages does it touch?
- Does it improve signal quality (enrichment, scoring) or signal usage (drafting)?
- What data flows IN to this feature? What flows OUT?
- What existing modules consume the output? Will they use the new data?

**STOP.** Present findings. One issue per question. Recommend + WHY.

### Section 2: Cold Email Domain Expertise

Apply B2B cold email best practices to pressure-test the plan:

1. **Personalization depth:** Does this feature enable "I noticed [specific thing about
   YOUR company]" or just "I noticed [generic thing about companies like yours]"?
2. **Timing signals:** Does this feature help detect WHEN to reach out (hiring, funding,
   tech change, new role) or just WHO to reach out to?
3. **Connection bridge:** Does this create a stronger link between prospect pain and
   sender capability? The bridge is: signal -> pain reasoning -> solution with proof.
4. **Follow-up coherence:** Does this feature account for multi-step sequences where
   each email must build on previous ones?
5. **Deliverability impact:** Does this feature affect email volume, sending patterns,
   or content in ways that could hurt deliverability?

**STOP.** Present findings. One issue per question. Recommend + WHY.

### Section 3: Reply Rate Impact Estimation

For the proposed feature, estimate:
```
  CURRENT REPLY RATE CONTRIBUTION:  [what the current system achieves for this dimension]
  EXPECTED IMPROVEMENT:             [realistic delta, not aspirational]
  CONFIDENCE:                       HIGH / MEDIUM / LOW
  EVIDENCE:                         [what data supports this estimate]
  RISK IF WRONG:                    [what happens if this doesn't improve reply rate]
```

Cross-reference with STRATEGY.md section 9 benchmarks.

**STOP.** Present findings.

### Section 4: Observability & Debuggability

For the proposed feature, answer:
- If a bug is reported 3 weeks post-ship, can you reconstruct what happened from logs alone?
- What metric tells you this feature is working? What tells you it's broken?
- For new LLM calls: is the prompt, response, tokens, cost, and latency logged via AI Event?
- For new Inngest jobs: are start, success, and failure events observable?
- What alert would you want on day 1?

**STOP.** Present findings. One issue per question. Recommend + WHY.

### Section 5: Delight Opportunities (EXPANSION mode only)

Identify at least 3 "bonus" improvements (<2 hours each) that would make the feature
significantly more valuable. For each:
- What it is
- How it improves reply rate specifically
- Which existing module it builds on
- Effort estimate

Present each as a separate question: A) Build now B) Add to BACKLOG.md C) Skip

### Section 6: Incremental Improvements (HOLD SCOPE and REDUCTION modes)

Even in constrained scope, identify 1-2 quick wins (<30 min each) that are already
adjacent to the planned work. Things where "since we're already in this file, we could
also..." makes sense. Present each: A) Include B) Skip.

---

## Required Outputs

### "What is the REAL feature?" section
One paragraph reframing the request in terms of the prospect's experience and the
user's reply rate. This is the north star for implementation.

### "Pipeline impact" diagram
ASCII diagram showing data flow through the affected pipeline stages.

### "NOT in scope" section
Work considered and explicitly deferred, with one-line rationale each.

### "Reply rate projection" section
Current state -> Expected state for the specific metric this feature targets.

### "What already exists" section
List existing code/modules that partially solve sub-problems. Does the plan reuse them?

### Completion Summary
```
  +====================================================================+
  |           PRODUCT REVIEW -- COMPLETION SUMMARY                     |
  +====================================================================+
  | Mode selected           | EXPANSION / HOLD / REDUCTION             |
  | Real job-to-be-done     | [one line]                               |
  | Pipeline stages touched | [list]                                   |
  | Reply rate impact       | [current] -> [expected] (confidence)     |
  | Scope decisions         | ___ resolved                             |
  | Observability           | ___ metrics/alerts defined               |
  | Delight / quick wins    | ___ identified                           |
  | NOT in scope            | ___ items deferred                       |
  | Unresolved decisions    | ___ (listed below)                       |
  +====================================================================+
```

### Unresolved Decisions
If any question goes unanswered, list here. Never silently default.

---

## Formatting Rules

- NUMBER issues (1, 2, 3...) and LETTER options (A, B, C...).
- Recommended option always listed first.
- One sentence max per option.
- After each section, pause and wait for feedback.
- Always tie recommendations back to reply rate impact.
