---
name: awesome-claude-skills
description: Curated catalog of 50+ verified Claude Agent Skills (karanb192/awesome-claude-skills) grouped by category - documents, testing, debugging, workflow, architecture, security, media, data, writing, meta. Use when looking for an existing skill for a task, comparing skill options, or deciding what to install next; pair with find-skills for live search.
---

# awesome-claude-skills (karanb192)

Offline copy of the curated list from https://github.com/karanb192/awesome-claude-skills
(MIT, see `LICENSE`). The full catalog lives in `CATALOG.md` next to this file.

## How to use

1. `grep -n -i "<keyword>" .claude/skills/awesome-claude-skills/CATALOG.md` to find candidates
   (categories: Document & File Processing, Testing & Quality, Debugging, Collaboration & Workflow,
   Development & Architecture, Security & Performance, Documentation & Automation,
   Media & Content Creation, Data & Analysis, Finance, Writing & Research, Meta Skills).
2. Check whether the skill is already installed: `ls .claude/skills/`.
3. If it is not, install it into the project the same way the other skills were added
   (clone the source repo, copy the skill folder into `.claude/skills/<name>/`, keep its LICENSE)
   and record it in `.claude/skills/SOURCES.md`.
4. For anything not in the catalog, fall back to the `find-skills` skill (`npx skills find <query>`).
