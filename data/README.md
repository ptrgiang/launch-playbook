# Corpus

Analyzed launches — the dataset the playbook's claims stand on, and the corpus agents sample in `/analyze-category`.

## Format

Each launch is a JSON file, `launches/<slug>.json`:

```json
{
  "name": "",
  "slug": "",
  "url": "",
  "launch_date": "",
  "day_of_week": "",
  "category": "",
  "topics": [],
  "tagline": "",
  "tagline_formula": "outcome-for-audience | verb-first | contrast | familiar-reframe | number-led | other",
  "maker_comment_shape": "",
  "gallery_first_card": "",
  "rank": null,
  "votes": null,
  "comments": null,
  "featured": null,
  "source": "scraped | postmortem"
}
```

Postmortem contributions append a `postmortem` object with the metrics from `templates/postmortem.md`.

Each record may also carry `maker_history`: each maker's prior launches,
prior featured count, and follower count at pull time (`tools/maker-history.mjs`).

## Control set

`control/` holds the baseline group: all **unfeatured** launches Oct 27 →
Nov 25, 2026 (~2,400 records) — used to test whether featured status actually
decides outcomes. Findings: [../docs/featured-gate.md](../docs/featured-gate.md).

## Contributing

Launched with this playbook? PR your launch JSON (or your `postmortem.md`) here. Every retro makes the corpus smarter for the next launch — that's the flywheel.

## Notes

- Numbers marked `null` were not publicly visible — don't estimate.
- `featured` reflects whether the launch appeared on the PH homepage.
