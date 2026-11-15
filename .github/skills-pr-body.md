The agent read the phrases many postings ask for that `skills.json` does not know, and drafted the
ones it thinks are real skills.

**Nothing in this PR changes the matching.** It adds proposals only. Read `tools/skill_proposals.md`,
tick the ones to add, and they go into the dictionary in a separate change.

Each row carries its evidence: how many postings asked, how many kinds of job, and one real posting,
so no proposal has to be taken on trust. The list of phrases it called *not* a skill is at the bottom
of the same file — if any of those is wrong, the prompt needs work, which is worth knowing.
