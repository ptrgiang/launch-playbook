---
name: draft-crossposts
description: Write per-channel launch posts (X thread, LinkedIn, Show HN, Reddit) from finalized launch copy, respecting each channel's rules. Use after tagline/description/maker comment are settled.
---

# Draft cross-posts

## Steps

1. Read `<launch-folder>/launch.json` → `channels` map; read final `copy/taglines.md` (winner), `copy/description.md`, `copy/maker-comment.md`.
2. Read `docs/channels.md` — channel rituals are non-negotiable.
3. For each enabled channel, fill its template into `copy/crossposts/`:
   - `x-thread.md` — hook → story → demo → proof → close+link; "check it out" framing, never a vote ask; milestone QTs drafted ahead.
   - `linkedin.md` — story-led post, link in first comment.
   - `show-hn.md` — `Show HN: name – concrete description` title, technical angle, comment plan.
   - `reddit/<sub>.md` — one file per sub in `channels.reddit`; state each sub's self-promo status and rule notes; title without marketing-speak.
4. Report which files were written and any channel skipped (and why).

## Rules

- Rewrite per channel — never forward the same text. HN gets technical, Reddit gets honest "I built this", X gets the story arc.
- Flag any subreddit whose rules you can't verify; never claim a sub allows self-promo without noting how confident you are.
- Every channel file must include its optimal posting window from `channels.md`.
