# Source Policy

## Purpose

This file defines how the skill should interpret and apply a **Source** when building or updating a persistent **Course**.

## Source classes

- **General Outline**: the baseline structure produced when no user-provided material has overriding authority.
- **Reference Source**: a **Source** available for supplementation and citation, but not structural control unless explicitly upgraded.
- **Priority Source**: a **Source** that should influence content selection and ordering ahead of the **General Outline**, while still allowing local teaching adjustments.
- **Anchored Source**: a **Source** whose structure should strongly shape the ordering and framing of the **Course** unless an explicit reordering is proposed.

## Default classification rules

- If the learner provides no material, start from the **General Outline**.
- If the learner names a material but does not assign structural authority, classify it as a **Reference Source**.
- If the learner indicates that a source should strongly influence ordering or emphasis, classify it as a **Priority Source**.
- If the learner clearly wants a source to serve as the backbone of the course, classify it as an **Anchored Source**.

## Upgrade rules

- Never silently upgrade a **Reference Source** to a **Priority Source** or **Anchored Source**.
- If a source appears to deserve more authority than the learner stated, suggest the upgrade and explain why.
- Only apply the new source class after the learner confirms it.

## Conflict handling

- If the **General Outline** and a **Priority Source** disagree, prefer the **Priority Source** while allowing local teaching adjustments.
- If the **General Outline** and an **Anchored Source** disagree, prefer the **Anchored Source** by default.
- If multiple **Anchored Sources** conflict with one another, ask the learner to resolve the conflict rather than improvising a synthesis.
- If a source order seems pedagogically awkward, the skill may propose a local reordering, but should keep the learner aware of the tradeoff.

## Record-writing rules

- Record course-level source decisions in the **Course Record**.
- Record per-unit attribution in the **Unit Record**.
- Keep source notes concise and specific about authority: supplementation, priority, or backbone.
- Use exact glossary terms from `CONTEXT.md` when naming source classes.
