---
name: review-launch-page
description: Audit a drafted launch page against the playbook — tagline, gallery plan, maker comment, topics, links, channel readiness — and report failures before launch day.
---

# Review launch page

Audit the launch folder like a checklist, not a vibe check.

## Steps

1. Read everything in `<launch-folder>/`: `launch.json`, `copy/*`, `checklist.json`, planned `assets/`.
2. Check each audit line against `docs/assets.md`, `docs/product-hunt.md`, `docs/failure-modes.md`:

   - Tagline ≤55 chars, passes stranger test, no banned hype words
   - Gallery plan: first card carries name+pitch+best visual; 3–6 cards; story order
   - Maker comment: anatomy complete, concrete ask, maker voice
   - Topics: accurate, not flattering
   - Links: live, UTM-tagged, mobile-ok; no signup wall before value
   - Cross-posts exist for every enabled channel, correct framing
   - Checklist: no `todo` task past its due date; day-of coverage decided
   - Failure-modes scan: launch-ready product, supporters list non-empty, no vote-ask language anywhere

3. Produce a report: `PASS | FAIL` per line with evidence (quote the offending text), ordered by severity.
4. Offer to fix what's fixable in-file; flag what only the human can fix (e.g., product not usable today).

## Rules

- FAIL means fail — don't soften. A failed audit pre-launch is the point.
- Evidence over opinion: cite the file and the line.
- One overall verdict at the end: `READY` / `READY WITH FIXES` / `NOT READY` + the top 3 blockers.
