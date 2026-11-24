# Contributing

## Contribute a postmortem (the highest-value PR)

Launched something with this playbook? Add `data/launches/<slug>.json` using the schema in `data/README.md` — or drop in your `postmortem.md` and we'll shape it.

Real numbers only. `null` beats an estimate.

## Fix a rule

PH mechanics and channel rules drift. If a doc contradicts what you observed, PR the correction with evidence (link, screenshot, date). Say when you observed it — rules have a shelf life.

## Add a channel / template / skill

- New channel doc → `docs/channels.md` + template in `templates/crossposts/`
- New template → `templates/` with placeholders, not filler
- New skill → `skills/<name>/SKILL.md` with frontmatter `name` + `description`, imperative instructions, explicit output file paths, and a "Rules" section listing what the agent must never do (invent metrics, ask for votes, soften audit verdicts)

## Style

- Docs: imperative, evidence-cited, blunt. No hype.
- Templates: placeholders like `<this>` — never lorem.
- Skills: the agent should be able to run the file end-to-end without asking.
