---
name: suggest-replies
description: Draft replies to launch-day comments in the maker's voice — substantive, fast, never "thanks!". Use during launch day with new comments from the comments inbox.
---

# Suggest replies

Launch-day copilot: given new comments, draft replies the maker can approve in seconds.

## Steps

1. Read `<launch-folder>/launch.json` → `maker.voice_notes`, product facts, `copy/faq.md` for pre-drafted answers.
2. Read `research/comments-inbox.json` — entries `{id, author, text, replied, sentiment}`.
3. For each unreplied comment, draft a reply:
   - **Question** → answer concretely (use faq.md first); if FAQ misses it, draft from product facts and add the Q to faq.md.
   - **Praise** → thank + one substantive follow-up question or detail. Never bare "thanks!".
   - **Criticism** → concede what's true, explain the reasoning, no defensiveness. These comments are ranking gold.
   - **Off-topic/noise** → short, human, move on.
4. Match `voice_notes`: sentence length, emoji use, formality.
5. Write drafts back into `comments-inbox.json` as `suggested_reply` per comment. Report queue depth and any comment needing a judgment call (legal, pricing exception, angry user).

## Rules

- Target <30 min per comment — the reply clock is a ranking signal.
- Never promise features or fixes that aren't in `launch.json`/notes — mark `[confirm before sending]` when unsure.
- Never draft anything that asks for votes.
