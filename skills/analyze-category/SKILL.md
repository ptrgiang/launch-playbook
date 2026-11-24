---
name: analyze-category
description: Research top launches in the product's category — extract tagline patterns, gallery conventions, maker comment style, and launch-day behavior — into research/category-analysis.json.
---

# Analyze category

## Steps

1. Read `<launch-folder>/launch.json` → `launch.category`, product positioning.
2. Find recent top launches in the category: browse producthunt.com (topics/leaderboard pages) or use any available search/browse tooling. If `data/` corpus exists in this repo, sample it first and note which entries came from corpus vs. live research.
3. For each of ~10 comparable launches, extract: tagline + its formula, gallery first-card pattern, maker comment shape, topics used, final rank/votes/comments if visible, launch day of week.
4. Write `research/category-analysis.json`:

```json
{
  "category": "",
  "sampled": [{ "name": "", "url": "", "tagline": "", "formula": "", "rank": null, "votes": null, "comments": null, "day": "" }],
  "patterns": { "tagline_formulas": [], "gallery_hooks": [], "maker_comment_shapes": [], "best_days": [] },
  "implications": []
}
```

5. Report the 3 strongest patterns and how this launch's draft assets compare — convergent or differentiated, on purpose?

## Rules

- Patterns must cite evidence ("7/10 use verb-first taglines"), not vibes.
- Note what the category *doesn't* do — whitespace is as useful as convention.
- If live browsing isn't possible, work from `data/` corpus only and mark `source: corpus` on every entry.
