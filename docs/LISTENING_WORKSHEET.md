# Listening worksheet

**Human ratings: unmeasured.** This blank worksheet is an optional small beta evaluation, not a completed study. Engineering tests establish valid data and behavior; they do not answer either listening question below.

## Session record

- Date / listener alias: ____________________
- Live source SHA from `build-info.json`: ____________________
- Catalog version: ____________________
- Headphones/speakers and listening context: ____________________
- Intended mood/activity, in the listener's words: ____________________
- Seed IDs and titles; positive/negative feedback IDs, if any: ____________________
- Listening source and excerpt/time interval: ____________________

Song Neighbors does not play audio. Use recordings you are permitted to access, matching the indexed recording and excerpt where possible. If an exact recording is unavailable, mark it **not heard**; do not infer a rating from the title, artist, genre or numerical rank. Note any full-song/excerpt mismatch.

## Two independent questions

1. **Sounds similar:** “How similar does this recording sound to the selected seed song(s)?” Rate **1 = not similar, 2 = slightly, 3 = moderately, 4 = very, 5 = extremely**, or **not heard**. Consider the sound you actually heard; note whether it resembles only one seed or the combination.
2. **Want to hear it now:** “How much do I want to hear this recording right now, for my stated mood/activity?” Rate **1 = not at all, 2 = a little, 3 = neutral, 4 = yes, 5 = strongly**, or **not heard**. A familiar or appealing song may score high here while sounding dissimilar.

Keep the scores separate. A “More like this” click is session input, not a measured answer to either question.

## Small comparison

Try three conditions, recording the exact returned IDs before listening: the single-seed product ranking; that seed plus one contrasting seed; then the same two seeds with one positive and one negative preference. The product applies a modest diversity adjustment even with one seed. The separate pure-cosine baseline is exposed by the engine and compared in the Phase 4 evaluator; this worksheet’s UI comparison does not disable that adjustment. Rate the first three results in each condition. Copy the table for another seed family if useful. Changing seeds clears refinement; reset before collecting a seed-only condition.

| Condition | Rank / recording ID / title | Sounds similar (1–5 or not heard) | Want to hear it now (1–5 or not heard) | What was heard / notes |
| --- | --- | --- | --- | --- |
| One seed | 1 / | | | |
| One seed | 2 / | | | |
| One seed | 3 / | | | |
| Two seeds | 1 / | | | |
| Two seeds | 2 / | | | |
| Two seeds | 3 / | | | |
| Two seeds, refined | 1 / | | | |
| Two seeds, refined | 2 / | | | |
| Two seeds, refined | 3 / | | | |

If comparing multiple conditions, vary their listening order and record it to reduce simple order effects. Repeated recordings may be rated once per context, but record that reuse. Do not fill missing observations with zero or an estimated score.

## Reporting

Report listener count, actually heard recordings, missing recordings, conditions and context. Summarize each question separately and preserve disagreements. A few self-selected ratings are descriptive feedback for this beta; they do not establish population preference, optimal weights, or that multiple seeds outperform the single-seed condition. Leave status **unmeasured** until a human supplies real observations. Do not commit personal listening notes without the listener's permission.
