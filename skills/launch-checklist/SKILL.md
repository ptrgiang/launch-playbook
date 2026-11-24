---
name: launch-checklist
description: Generate a personalized T-14 to T+7 launch checklist from launch.json, accounting for the target date and channels. Use when starting a launch or re-planning after a date change.
---

# Launch checklist

Generate `checklist.json` in the launch folder, personalized from `launch.json`.

## Steps

1. Read `<launch-folder>/launch.json`. If fields are missing (name, url, one_liner, target_date), ask for them or infer sensibly and note assumptions.
2. Read `docs/timeline.md` and `docs/product-hunt.md` for the canonical task set and timing rules.
3. Compute real dates from `target_date`: every task gets an absolute `due` date (T-14 → T+7). Flag conflicts if the target date lands on a weekend, holiday, or known mega-launch day — and say so plainly.
4. Prune tasks for channels not enabled in `launch.json.channels`; add per-subreddit tasks for each entry in `channels.reddit`.
5. Write `checklist.json` matching `templates/checklist.json` schema: `phases.prep|day|post`, each task `{id, task, due, status}`.
6. Report: total tasks, the 3 highest-risk items, and anything in launch.json that blocks planning (missing URL, no pricing, etc.).

## Rules

- Every task gets an absolute date, not just T-offsets.
- If target_date is <14 days away, compress prep phases and say which tasks are being squeezed — never silently drop them.
- Keep task wording imperative and checkable ("Verify X", not "Think about X").
