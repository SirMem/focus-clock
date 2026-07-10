# Course Record

## Purpose

A **Course Record** is the course-level control plane for a persistent **Course**. It tracks the outline, source authority, unit rollup, blockers, and next steps without turning into lecture notes or a transcript.

## When to create

Create a **Course Record** lazily when the learner starts a new **Course** or when an existing **Course** needs a durable home for continuation across sessions.

- Create a **Main Course** record when the subject has no existing durable course.
- Create a **Branch Course** record when the goal, audience, depth, or source base changes enough that continuing the existing course would blur intent.

## Naming guidance

- Use a stable course slug for the directory name.
- Use a human-readable title in the file heading.
- If the file represents a **Branch Course**, make the distinguishing goal or audience explicit in the title.
- Prefer clear names like `# Probability Main Course` over vague names like `# Probability v2`.

## Template

```md
# <Course title>

## Course Identity

- Course: <subject or track name>
- Course Type: Main Course | Branch Course
- Goal: <what this Course is trying to achieve>
- Audience: <who this Course is for>
- Parent Course: <link or blank>
- Branch Reason: <why this became a Branch Course>
- Inherits From: <sources or unit definitions reused from parent>

## Source Strategy

- General Outline Status: Planned | Active | Revised

| Source | Type | Class | Role in Course | Notes |
| --- | --- | --- | --- | --- |
| <source title> | book/article/video/code/notes | Reference Source / Priority Source / Anchored Source | <how it shapes the Course> | <optional note> |

## Course Outline

| Unit | Tier | Origin | Goal |
| --- | --- | --- | --- |
| [[<Unit title>]] | core / advanced | General Outline / Source / Hybrid | <one-line goal> |

## Unit Index

| Unit | Progress | Mastery | Unit Record | Latest Structured Checkpoint |
| --- | --- | --- | --- | --- |
| [[<Unit title>]] | Planned / Active / Review / Done | Unassessed / Emerging / Working / Solid | [[<Unit Record title>]] | <short checkpoint note> |

## Current Focus

- Active Unit: [[<Unit title>]]
- Why now: <why this Unit is currently active>

## Blockers

- <current confusion, missing source, or dependency>

## Next Steps

- <what the next session should do>
```

## Field rules

- Keep the **Course Identity** stable once a **Course** exists. If the goal shifts materially, consider a **Branch Course** instead of rewriting history.
- Use `core` and `advanced` tiers to separate the main learning path from optional deepening.
- Use `General Outline`, `Source`, or `Hybrid` consistently in the outline to show where each **Unit** comes from.
- Keep the **Unit Index** compact. It should summarize each **Unit**, not duplicate the full **Unit Record**.
- Use exact glossary terms from `CONTEXT.md`: **Course**, **Main Course**, **Branch Course**, **Unit**, **Progress**, **Mastery**, and **Structured Checkpoint**.

## Update rules

- Update the **Course Outline** only when the course structure changes.
- Update the **Unit Index** whenever a **Unit Record** changes `Progress`, `Mastery`, or its latest **Structured Checkpoint**.
- Update **Current Focus**, **Blockers**, and **Next Steps** at the end of each meaningful teaching or review turn.
- Do not copy teaching notes, long explanations, or raw learner dialogue into the **Course Record**. Those belong in the **Unit Record**.
