# Postmortem

Capture within 48 hours while numbers are fresh. `/postmortem` compiles this into `postmortem.md` from your metrics + inbox data.

## Metrics to capture

| Metric | Where | Why |
|---|---|---|
| Final rank & featured status | PH page | The headline number |
| Upvotes / comments | PH page | Velocity shape matters more than the total |
| Comment reply time | Your inbox log | Correlates with rank — measure yours |
| Referral sessions | Your analytics (`utm_source=producthunt`) | Real traffic, not board vanity |
| Signups / trials | Your product | The conversion that counts |
| Revenue attributed | Your billing + PH coupon | The number everyone asks about |
| Followers / subscribers gained | X, newsletter | Audience assets that persist |
| Top comment themes | Comments inbox | What the market actually heard |

## The questions that matter

1. What hour did the day's trajectory lock in — and what were you doing then?
2. Which asset got quoted/shared most? (tagline, a gallery card, the demo?)
3. Which channel sent the most *engaged* visitors (comments, signups) — not the most clicks?
4. What would you cut from the checklist, and what was missing from it?
5. What did commenters misunderstand? That's your positioning bug, not their reading bug.

## Output format

Use `templates/postmortem.md`. Then PR it into `data/` of this repo — every retro makes the corpus smarter for the next launch.
