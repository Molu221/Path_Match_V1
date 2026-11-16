The agent read the phrases many postings ask for that `skills.json` does not know, judged which are
real skills, and added the ones that clear the evidence bar. **Merging this is the approval.**

**What it added by itself.** Only proposals asked for by **25 or more postings**, across **8 or more
different kinds of job**, with **more than one way of writing them**. The bar is evidence, not the
model's own confidence, which it has no way to calibrate. The diff on `docs/skills.json` is the whole
of what changed in the matching — read that and you have read the change.

**What it held back for you.** Anything short of the bar is left untouched with the reason written
beside it in `tools/skill_proposals.json`, under `held_for_a_person`. To take one of those, write
`"approved": true` beside it and run **Apply approved skills** from the Actions tab.

**What it refuses outright, whoever ticks it.** A phrase it called not-a-skill. A name with no usable
alias. A two-letter alias that would fire on half the CVs in the country. And any word another skill
already answers to — two skills claiming one word makes the match ambiguous. That last guard is not
theoretical: on the first live run it caught *menu planning*, which the dictionary already held as
*Menu planning and food costing*.

**The full test suite ran before this was opened.** If the additions had broken anything, there would
be no pull request to read.

Each row in `tools/skill_proposals.md` carries its evidence: how many postings asked, how many kinds
of job, and one real posting. The phrases it called *not* a skill are listed at the bottom of the same
file — if any of those is wrong, the prompt needs work, which is worth knowing.

Only public posting vocabulary is sent to the model. No CV text, ever.
