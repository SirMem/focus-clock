# Unit Record

## Purpose

A **Unit Record** is the detailed record for one **Unit** inside a persistent **Course**. It holds source attribution, current learning state, teaching notes, compact evidence from learner interaction, and the next teaching move.

## When to create

Create a **Unit Record** lazily when a **Unit** first becomes active in the course workflow.

Typical triggers:
- the **Unit** becomes the active teaching target
- the **Unit** enters a diagnostic check
- the **Unit** needs a durable note because sources or ordering are being revised

## Naming guidance

- Use the **Unit** title as the main heading.
- Make the title specific enough to stay unique inside the course.
- If useful, include a stable ordering prefix in the filename while keeping the heading human-readable.
- Keep the file title aligned with how the **Unit** appears in the **Course Record**.

## Template

```md
# <Unit title>

## Unit Identity

- Course: [[<Course title>]]
- Unit: <canonical Unit name>
- Tier: core / advanced
- Goal: <what the learner should understand after this Unit>
- Depends On: [[<Unit title>]], [[<Unit title>]]

## Source Attribution

| Source | Class | Role in this Unit | Notes |
| --- | --- | --- | --- |
| <source title> | Reference Source / Priority Source / Anchored Source | <what it contributes> | <optional note> |

## Current State

- Progress: Planned | Active | Review | Done
- Mastery: Unassessed | Emerging | Working | Solid

## Teaching Notes

- Key idea:
- Example:
- Common confusion:
- Suggested explanation angle:

## Learning State Summary

- <short summary of what the learner currently understands and where uncertainty remains>

## Structured Checkpoints

| Date | Event | Result | Note |
| --- | --- | --- | --- |
| YYYY-MM-DD | diagnostic / explanation / review | Unassessed / Emerging / Working / Solid | <compact evidence snapshot> |

## Open Questions or Blockers

- <what is still unresolved>

## Next Step

- <the next move for this Unit>
```

## Field rules

- `Progress` tracks workflow state, not understanding.
- `Mastery` tracks understanding, not whether the unit was merely visited.
- Keep `Learning State Summary` short and current. It should reflect the learner's state after explanation plus interaction, not reproduce the whole lesson.
- Keep **Structured Checkpoints** compact. They are evidence snapshots, not raw transcripts.
- Use the same controlled vocabulary across all **Unit Record** files:
  - `Progress`: `Planned`, `Active`, `Review`, `Done`
  - `Mastery`: `Unassessed`, `Emerging`, `Working`, `Solid`

## Update rules

- Create the file the first time the **Unit** meaningfully participates in the course workflow.
- Update **Current State**, **Learning State Summary**, **Structured Checkpoints**, and **Next Step** after each meaningful teaching, diagnostic, or review interaction.
- Update **Source Attribution** when a new **Source** materially affects the **Unit**.
- If the teaching notes become long, keep them organized and focused on the unit's goal instead of turning them into a general topic dump.
