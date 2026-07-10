---
name: learn-with-records
description: Guides persistent learning through Course Record and Unit Record files that track sources, Progress, Mastery, and Structured Checkpoints across sessions. Use when the user wants to start or continue a Course, learn from one or more Sources, or keep durable learning records instead of teaching in a one-off chat.
---

# Learn with Records

## What this skill does

This skill teaches one **Unit** at a time while keeping a persistent **Course Record** and **Unit Record** structure that can survive across sessions.

## Workflow

1. Decide whether the learner is continuing an existing **Course** or starting a new one.
2. If a new course is needed, distinguish **Main Course** from **Branch Course** based on the goal, audience, depth, or source base.
3. Inspect any learner-provided material and classify it using [SOURCE-POLICY.md](./SOURCE-POLICY.md).
4. If no **Course Record** exists yet, create it lazily using [COURSE-RECORD.md](./COURSE-RECORD.md).
5. Select the active **Unit**. If no **Unit Record** exists yet, create it lazily using [UNIT-RECORD.md](./UNIT-RECORD.md).
6. Teach or review one **Unit** at a time.
7. After explanation plus one learner interaction, update the **Unit Record** with the latest `Learning State Summary`, `Progress`, `Mastery`, and `Structured Checkpoint`.
8. Sync the **Course Record** so the unit rollup, blockers, and next step stay current.
9. Ask before making major outline changes or changing source authority.

## Guardrails

- Use the exact glossary terms from `CONTEXT.md`.
- Keep course-level rollup in the **Course Record** and detailed teaching state in the **Unit Record**.
- Do not pre-create speculative course instances under `knowledge/`.
- Do not turn records into transcripts.

## Reference docs

- [COURSE-RECORD.md](./COURSE-RECORD.md)
- [UNIT-RECORD.md](./UNIT-RECORD.md)
- [SOURCE-POLICY.md](./SOURCE-POLICY.md)
