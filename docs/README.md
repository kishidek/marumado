# Docs index

Everything about how Marumado is planned, built and tracked. **Start here.**

## Read in this order

1. [tracker.md](tracker.md): where things stand today (Summary table at the top).
2. The **Active** plan below: what's being built next.
3. [bugs.md](bugs.md): what broke, why, and what guards it now.
4. **Done** plans: history and the reasons behind decisions.

## All documents

| Doc | Kind | Status | Created | Updated | What it is |
|---|---|---|---|---|---|
| [tracker.md](tracker.md) | Living | Current | 2026-10-03 | 2026-10-05 | Status of every phase, risk and open item; dated log of changes |
| [bugs.md](bugs.md) | Living | Current | 2026-10-04 | 2026-10-05 | Every bug: severity, symptom, cause, fix, guard, commit (26 fixed, 0 open) |
| [plans/001-mvp-wxt.md](plans/001-mvp-wxt.md) | Plan | **Done** (frozen) | 2026-10-03 | 2026-10-04 | MVP: port to WXT, engine, risks, decisions 1–15. Ends with *Known deviations* |
| [plans/002-garden.md](plans/002-garden.md) | Plan | **Active** | 2026-10-04 | 2026-10-05 | Moving the plant to the garden after 6 months; generations; phases G0–G4 (G4 left) |

Keep this table in sync whenever a doc is added, changes status, or is updated.

## Naming

| Kind | Where / name | Rules |
|---|---|---|
| **Living** | `docs/<name>.md`, fixed lowercase name (`tracker.md`, `bugs.md`) | Always describes *now*. Never numbered, never superseded; old content moves to its log/history section instead of being deleted |
| **Plan** | `docs/plans/NNN-<slug>.md` (`001-mvp-wxt.md`) | `NNN` = creation order, three digits, never reused: **lower number = older**. Short kebab-case slug. A plan is never renamed or renumbered; only its status changes |
| **Index** | `docs/README.md` | This file |

Assets that are not documents (videos, screenshots) don't live in `docs/`.

## Plan status

| Status | Meaning | Edits allowed |
|---|---|---|
| **Draft** | Being written; decisions open | Anything |
| **Active** | Decided and being built | Anything; bump *Updated* |
| **Done** | Built. Frozen record of what was planned and why | Only the header and a **Known deviations** section listing where the build differs |
| **Superseded** | Replaced by a newer plan | Header only: set *Superseded by* |
| **Abandoned** | Dropped | Header only: one line saying why |

**How to tell if something is stale:** the code and the tracker are the source of truth. A **Done** plan is history by design: where it disagrees with the code, the difference must be listed in its *Known deviations*. An **Active** plan older than its last related commit should be checked and its *Updated* date bumped.

## Plan header template

```markdown
# NNN · Title

| | |
|---|---|
| **Status** | Draft / Active / Done / Superseded / Abandoned · one-line state |
| **Created** | YYYY-MM-DD |
| **Updated** | YYYY-MM-DD |
| **Supersedes** | — or [NNN · Title](NNN-slug.md) |
| **Superseded by** | — or [NNN · Title](NNN-slug.md) |
| **Live status** | [tracker.md](../tracker.md) → section |
```

## When to update what

| Change | Update |
|---|---|
| A phase, risk or item moves | `tracker.md` (table + Summary + a Log line) |
| A bug is found | `bugs.md` → **Open** (with evidence) and the tracker |
| A bug is fixed | `bugs.md` → move to **Fixed** with cause, fix, guard and commit |
| A decision is made or changed | The plan that owns it (Decisions section) and the tracker log |
| A plan is finished | Status → **Done**, add *Known deviations*, update this index |
| A new piece of work needs a plan | New `plans/NNN-<slug>.md` from the template, add it to this index and the tracker |
