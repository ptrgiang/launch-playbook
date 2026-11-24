---
name: postmortem
description: Compile launch metrics and lessons into postmortem.md using the standard template, ready to PR back into the corpus.
---

# Postmortem

## Steps

1. Gather metrics: `research/comments-inbox.json` (comment count, reply times), rank/votes from the launch page or user's report, analytics numbers the user provides (sessions, signups, revenue), followers gained.
2. Read `docs/postmortem.md` for the metric table and the questions that matter.
3. Fill `templates/postmortem.md` → `postmortem.md` in the launch folder:
   - Scoreboard table — mark `n/a` where data is genuinely unavailable, never invent numbers
   - Velocity shape (rank/comments at key hours) if observable
   - What worked / what failed / misunderstandings / best channel / checklist diff
4. Write the honest part: the 3 next-launch changes must be specific and falsifiable, not "promote more".
5. Remind the user to PR this file into the repo's `data/` corpus.

## Rules

- Missing metrics are `n/a`, never estimates dressed as data.
- The "what commenters misunderstood" section is required — it's the positioning lesson.
- Keep it short enough to actually re-read before the next launch.
