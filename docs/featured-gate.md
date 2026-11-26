# The featured gate — control set & maker history

Every analysis in this repo samples the top-20 by votes. A fair objection: that
shows what winners look like, not whether featured status decides outcomes.
This doc adds the missing baseline.

## Control set: unfeatured launches, same window

Method: `tools/collect-control.mjs` iterated every day Oct 27 → Nov 25, 2026
and collected all posts where `featuredAt == null`. (The API's
`posts(featured:false)` filter is silently ignored — client-side filtering is
required. `order: VOTES` paging is also biased: 800 top posts contained only
1 unfeatured launch.)

| | Featured top-20 | Unfeatured (30 days) |
|---|---|---|
| Sample | 20 | 2,421 (72% of all 3,361 launches) |
| Median votes | ~550 | **2** |
| Top performer | 704 | **78** |
| Weakest in set | 490 | 0 |

- Zero unfeatured launches in 30 days crossed **100 votes**.
- Only 6 of 2,421 crossed 50.
- The best unfeatured launch (78 votes) sits ~6x below the weakest featured
  top-20 launch (~490).

Caveats: launches from the most recent 1–2 days could still be featured late;
two days (Nov 15, Nov 4) failed to scan due to rate limits.

## Who gets featured: two routes in

`tools/maker-history.mjs` pulled `madePosts` for every maker of the top-20.

- **6/20 top launches came from all-first-timer teams**: beacon.sh (solo maker,
  61 followers), Jev (max maker followers: 45), Wanaka (22), Voiskey (27),
  Empacer (38), tiun. (67).
- **Median maker followers across all top-20 makers: 23.**
- The other route is track record: mastra-factory's team had 37 prior launches
  (32 previously featured); GPT-6 Astra's makers had 35 (all featured).

So the gate is not a popularity contest. First-timers with <70 followers get
featured when the product is notable enough. Serial launchers stay featured
because editors already trust their output. If you are neither, you don't
enter the bracket where votes decide anything.

## Ruling out more variables (via the PH MCP)

`tools/enrich-mcp.mjs` enriches each record through Product Hunt's MCP
server, which returns data the GraphQL API hides: real commenter identities
with `maker`/`hunter` badges, official `daily_rank` + `points`, funding
rounds and investors, YC status. Applying it to the top-20 featured and the
top-30 unfeatured launches:

- **Maker comments are universal, not a signal.** 20/20 featured and 30/30
  unfeatured launches have a staff comment — 18 of the featured ones written
  by a maker, and all 30 unfeatured ones. "Leave a maker comment" is table
  stakes; it cannot move you through the gate because everyone does it.
- **Funding is not the gate either.** Only 4/20 top launches show recorded
  funding ($1M–$40M, median $3M); 16/20 have none. Just 1/30 top unfeatured
  launches is funded. Funding correlates weakly with featuring but explains
  little — most featured products are unfunded indies.
- **Points ≈ votes.** PH's score tracks the vote count almost 1:1
  (e.g. 559 points vs 554 votes). The ranking formula isn't hiding a
  secret multiplier.
- **Unfeatured launches rank deep even on good days.** The best unfeatured
  launch of the month (78 votes) reached only daily rank #36.

What survives as the differentiator: editorial selection on the product
itself — newsworthiness and clarity — plus serial-launcher trust for repeat
teams. The launch page (tagline, first card, demo) is the gate's interface.

## Implications for the playbook

1. Treat "will editors feature this?" as the first filter before launch-day
   tactics. Everything else is tuning inside the gate.
2. First-timer evidence says feature-worthiness is about the product's
   notability and clarity, not maker audience — so the launch page itself
   (tagline, first card, demo) does the gate work.
3. Unfeatured launches aren't slightly disadvantaged; at a median of 2 votes
   they effectively don't exist on the leaderboard.
