# Zainstalowane skille — źródła i licencje

Wszystkie skille leżą w `.claude/skills/<nazwa>/SKILL.md` i ładują się automatycznie
w Claude Code dla tego projektu. Licencje kolekcji: `_licenses/`, a skille Anthropic mają
własny `LICENSE.txt` w katalogu.

| Kolekcja | Źródło (commit) | Licencja | Skille |
|---|---|---|---|
| **Context Engineering** | [muratcankoylan/Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) (`6dbe1a1`) | MIT | context-engineering-collection, context-fundamentals, context-degradation, context-compression, context-optimization, filesystem-context, memory-systems, multi-agent-patterns, tool-design, evaluation, advanced-evaluation, harness-engineering, hosted-agents, latent-briefing, long-horizon-prompting, self-improvement-loops, bdi-mental-states, project-development |
| **Marketing Skills (Corey Haines)** | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (`5b2c000`) | MIT | aso, ads, ad-creative, ab-testing, analytics, attribution, churn-prevention, co-marketing, cold-email, community-marketing, competitor-profiling, competitors, content-strategy, copy-editing, copywriting, cro, customer-research, directory-submissions, emails, events, free-tools, image, influencer-marketing, launch, lead-magnets, marketing-council, marketing-ideas, marketing-loops, marketing-plan, marketing-psychology, offers, onboarding, paywalls, popups, pricing, product-marketing, programmatic-seo, prospecting, public-relations, referrals, revops, sales-enablement, schema, seo-audit, ai-seo, signup, site-architecture, sms, social, video |
| **Find Skills** | [vercel-labs/skills](https://github.com/vercel-labs/skills) (`7407f38`) | MIT | find-skills |
| **Superpowers** | [obra/superpowers](https://github.com/obra/superpowers) (`5bf4e78`) | MIT | using-superpowers, brainstorming, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review, using-git-worktrees, finishing-a-development-branch, writing-skills, diagnosing-superpowers |
| **Awesome Claude Skills (karanb192)** | [karanb192/awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills) (`6372d18`) | MIT | awesome-claude-skills (katalog `CATALOG.md`) + polecane z niego skille Anthropic poniżej |
| **Pollinations** | [pollinations/pollinations](https://github.com/pollinations/pollinations) `packages/polli-cli/SKILL.md` (`f66a15f`) | MIT | polli |
| **Anthropic (polecane w awesome-claude-skills)** | [anthropics/skills](https://github.com/anthropics/skills) (`34040c9`) | Apache-2.0 | frontend-design, canvas-design, algorithmic-art, webapp-testing, theme-factory, web-artifacts-builder, mcp-builder |
| **Game-dev / mobile (dodatkowe)** | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) (`4b57740`) | MIT | game-development (+ podskille: mobile-games, game-design, game-art, game-audio, 2d-games, web-games, engine-selection, …), mobile-design, android-dev, android_ui_verification |

Skille pdf/docx/xlsx/pptx/skill-creator/claude-api nie są kopiowane, bo w tej sesji są już
dostępne jako wbudowane (`anthropic-skills:*`).

## Aktualizacja

Aby odświeżyć skille, sklonuj ponownie repozytorium źródłowe i nadpisz odpowiednie
katalogi w `.claude/skills/`, a potem zaktualizuj hash commita w tej tabeli.
