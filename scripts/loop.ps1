# LeadSens Full Autonomous Loop — PowerShell (Windows)
# Usage:  .\scripts\loop.ps1
#         .\scripts\loop.ps1 -MaxIterations 50
#         .\scripts\loop.ps1 -DryRun
#         .\scripts\loop.ps1 -NoResearch

param(
    [int]$MaxIterations = 100,
    [int]$MaxTimeMinutes = 720,
    [int]$MaxConsecutiveFailures = 3,
    [int]$PauseBetween = 45,
    [switch]$DryRun,
    [switch]$NoResearch
)

$ErrorActionPreference = "Continue"
$ProgressFile = ".claude\progress.txt"
$BacklogFile = ".claude\tasks\BACKLOG.md"
$LoopLog = ".claude\loop-log.txt"

# --- Pre-checks ---
if (-not (Test-Path "CLAUDE.md")) { Write-Host "Run from project root." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $BacklogFile)) { Write-Host "BACKLOG.md missing." -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Path ".claude\tasks", ".claude\findings" -Force | Out-Null
if (-not (Test-Path $ProgressFile)) { New-Item $ProgressFile -Force | Out-Null }
if (-not (Test-Path $LoopLog)) { New-Item $LoopLog -Force | Out-Null }

$BranchName = "auto/improve-$(Get-Date -Format 'yyyyMMdd-HHmm')"
git checkout -b $BranchName 2>$null
if ($LASTEXITCODE -ne 0) { git checkout $BranchName 2>$null }

$StartTime = Get-Date
$ConsecutiveFailures = 0
$TasksDone = 0
$ResearchRounds = 0

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " LeadSens Full Autonomous Loop" -ForegroundColor Cyan
Write-Host " Branch: $BranchName"
Write-Host " Max: $MaxIterations iterations, $MaxTimeMinutes min"
Write-Host " Mode: $(if ($DryRun) { 'DRY RUN' } else { 'FULL AUTO' })"
Write-Host "======================================================" -ForegroundColor Cyan

# === PHASE 1 — RESEARCH ===
if (-not $NoResearch) {
    Write-Host "`n[PHASE 1] Deep Research (7 dimensions)" -ForegroundColor Yellow

    $researchPrompt = @"
You are a world-class product researcher analyzing the ENTIRE landscape around LeadSens.
LeadSens is a conversational AI agent for B2B cold email prospecting (BYOT model).
Current score: 4.2/10. Target: 8+/10, 18% reply rate.

Read docs/STRATEGY.md first (especially sections 5, 6, 7, 8).
Then use Playwright MCP to research across these 7 dimensions:

1. CONVERSATIONAL AI UX — search "best conversational AI UX patterns 2026", "generative UI inline components chat agent". How do ChatGPT, Claude, Perplexity handle multi-step workflows? What inline components make a chat feel intelligent?

2. AI AGENT ARCHITECTURE — search "AI agent tool calling architecture 2026", "compound AI system design patterns". How do the best agents handle multi-step pipelines, error recovery, planning vs execution?

3. COLD EMAIL SCIENCE — search "cold email reply rate benchmarks 2026", "signal based personalization trigger events", "email sequence optimal cadence data". What reply rates are achievable? What techniques produce highest lift?

4. LEAD ENRICHMENT — search "b2b lead enrichment multi source 2026", "intent signals hiring funding technographic", "Clay enrichment waterfall". How many sources do top tools use? What data matters most?

5. COMPETITIVE LANDSCAPE — search "instantly ai 2026 features", "AI SDR 11x aisdr artisan review 2026", "cold email tool comparison 2026". What are competitors doing NOW?

6. PRODUCT DESIGN & ONBOARDING — search "best SaaS onboarding 2026 conversational", "AI product chat-based setup". What makes users stick after first session?

7. FEEDBACK LOOPS — search "email campaign optimization feedback loop", "self improving AI agent production". How do the best systems learn from results?

For EACH dimension, create .claude/findings/ files with: sources, top 3 insights, comparison with LeadSens, recommended actions with file paths, impact estimate.
Add NEW tasks to .claude/tasks/BACKLOG.md with PASS IF criteria.
Write research summary to .claude/progress.txt.
Be brutal. Be specific. No generic advice.
"@

    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    Add-Content $LoopLog "=== RESEARCH | $ts ==="
    claude -p $researchPrompt --dangerously-skip-permissions 2>&1 | Tee-Object -Append -FilePath $LoopLog
    $ResearchRounds++
    Write-Host "Research complete" -ForegroundColor Green
    Start-Sleep -Seconds 15
}

# === PHASE 2 — AUDIT ===
Write-Host "`n[PHASE 2] Strategic Audit" -ForegroundColor Yellow

$auditPrompt = "Audit LeadSens codebase against docs/STRATEGY.md AND all .claude/findings/ research. Follow .claude/commands/audit.md then .claude/commands/audit-prompts.md. Compare current code vs STRATEGY targets vs external best practices. If research shows competitors ahead of our targets, flag CRITICAL. Update .claude/tasks/BACKLOG.md. Write audit report to .claude/progress.txt."

$ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
Add-Content $LoopLog "=== AUDIT | $ts ==="
claude -p $auditPrompt --dangerously-skip-permissions 2>&1 | Tee-Object -Append -FilePath $LoopLog
Write-Host "Audit complete" -ForegroundColor Green
Start-Sleep -Seconds 10

if ($DryRun) {
    Write-Host "`nDRY RUN complete. Review .claude/findings/ and BACKLOG.md" -ForegroundColor Green
    exit 0
}

# === PHASE 3 — IMPLEMENTATION LOOP ===
Write-Host "`n[PHASE 3] Implementation Loop" -ForegroundColor Yellow

for ($i = 1; $i -le $MaxIterations; $i++) {
    $elapsed = (Get-Date) - $StartTime
    if ($elapsed.TotalMinutes -ge $MaxTimeMinutes) {
        Write-Host "Time limit reached." -ForegroundColor Yellow; break
    }
    if ($ConsecutiveFailures -ge $MaxConsecutiveFailures) {
        Write-Host "Circuit breaker: $MaxConsecutiveFailures failures." -ForegroundColor Red; break
    }

    $remaining = @(Select-String -Path $BacklogFile -Pattern "^- \[ \]" -AllMatches -ErrorAction SilentlyContinue).Count
    if ($remaining -eq 0) {
        Write-Host "Backlog empty!" -ForegroundColor Green; break
    }

    $remainingMin = [math]::Round($MaxTimeMinutes - $elapsed.TotalMinutes)

    # Research refresh every 7 tasks
    if (($i % 7 -eq 0) -and ($i -gt 0)) {
        Write-Host "`nResearch refresh..." -ForegroundColor Yellow
        claude -p "Quick research refresh. Use Playwright MCP. Search for NEW cold email techniques, Instantly updates, AI agent patterns this week. Read .claude/findings/ to avoid duplicates. Only new insights. Update backlog if needed." --dangerously-skip-permissions 2>&1 | Tee-Object -Append -FilePath $LoopLog
        $ResearchRounds++
        Start-Sleep -Seconds 10
    }

    Write-Host "----------------------------------------------" -ForegroundColor Cyan
    Write-Host "Iteration $i/$MaxIterations | $remaining left | ${remainingMin}min" -ForegroundColor Cyan

    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    Add-Content $LoopLog "=== ITERATION $i | $ts ==="

    $implPrompt = @"
Iteration $i — LeadSens autonomous improvement.

YOU HAVE ACCESS TO:
- .claude/findings/ — research on what the best products do
- .claude/tasks/BACKLOG.md — prioritized tasks
- docs/STRATEGY.md — product vision
- CLAUDE.md — conventions and current state

INSTRUCTIONS:
1. Pick next unchecked task from BACKLOG.md
2. Read related findings in .claude/findings/
3. Read relevant STRATEGY.md section
4. Follow .claude/commands/implement-next.md
5. QUALITY BAR: better than competitors, not just to spec
6. Log to progress.txt, add learnings to CLAUDE.md section 11
7. ONE task, then stop.

MINDSET: You are building the best B2B prospecting agent in the market.
"@

    claude -p $implPrompt --dangerously-skip-permissions 2>&1 | Tee-Object -Append -FilePath $LoopLog
    Add-Content $LoopLog "=== END $i | $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ') ==="

    $lastLines = Get-Content $ProgressFile -Tail 30 -ErrorAction SilentlyContinue
    $statusLine = $lastLines | Where-Object { $_ -match "^STATUS:" } | Select-Object -Last 1
    $status = if ($statusLine) { ($statusLine -split " ")[1] } else { "UNKNOWN" }

    switch ($status) {
        "DONE" {
            $TasksDone++; $ConsecutiveFailures = 0
            Write-Host "Done ($TasksDone total)" -ForegroundColor Green
        }
        { $_ -in "BLOCKED","FAILED" } {
            $ConsecutiveFailures++
            Write-Host "$status ($ConsecutiveFailures consecutive)" -ForegroundColor Yellow
        }
        default {
            $ConsecutiveFailures++
            Write-Host "Unknown: $status ($ConsecutiveFailures)" -ForegroundColor Yellow
        }
    }

    if ($i -lt $MaxIterations) { Start-Sleep -Seconds $PauseBetween }
}

# === PHASE 4 — FINAL SCORE ===
Write-Host "`n[PHASE 4] Final Score" -ForegroundColor Yellow

$scorePrompt = "Final assessment. Read all .claude/findings/, progress.txt, DONE.md, and key source files. Score each component (1-10). Compare with competitors from research. Write .claude/findings/ final-score.md. Is LeadSens above market standard yet? Honest YES/NO."

claude -p $scorePrompt --dangerously-skip-permissions 2>&1 | Tee-Object -Append -FilePath $LoopLog

# === SUMMARY ===
$elapsed = (Get-Date) - $StartTime
$remaining = @(Select-String -Path $BacklogFile -Pattern "^- \[ \]" -AllMatches -ErrorAction SilentlyContinue).Count

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " SESSION COMPLETE" -ForegroundColor Cyan
Write-Host " Duration: $([math]::Round($elapsed.TotalMinutes))min"
Write-Host " Research: $ResearchRounds rounds"
Write-Host " Tasks: $TasksDone done"
Write-Host " Branch: $BranchName"
Write-Host " Remaining: $remaining"
Write-Host ""
Write-Host " git log $BranchName --oneline -20"
Write-Host " git diff main..$BranchName --stat"
Write-Host "======================================================" -ForegroundColor Cyan
