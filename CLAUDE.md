# CLAUDE.md

## ⚠️ Reguła nr 1 — ZAWSZE sprawdzaj skille i narzędzia

**Za każdym razem**, gdy użytkownik każe coś zrobić (każde polecenie, także drobne poprawki),
zanim zaczniesz pracę:

1. Przejrzyj dostępne skille: projektowe w `.claude/skills/` (spis: `.claude/skills/SOURCES.md`),
   wbudowane i z pluginów, a także narzędzia MCP, pluginy i typy agentów.
2. Każdy skill/narzędzie, które może realnie pomóc, **wczytaj i użyj** (Skill tool / ToolSearch).
3. Jeśli nic nie pasuje, sprawdź `find-skills` i katalog `awesome-claude-skills`.
4. W odpowiedzi krótko napisz, których skilli/narzędzi użyłeś (albo że żaden nie pasował).

Regułę wymusza też hook `UserPromptSubmit` (`.claude/settings.json` →
`.claude/hooks/skill-check-reminder.sh`), który dopisuje to przypomnienie do każdego polecenia.

Najczęściej przydatne w tym repo:
- gra / grafika / UX: `game-development` (+ `game-development/mobile-games`, `game-design`,
  `game-art`, `game-audio`, `2d-games`, `web-games`), `mobile-design`, `frontend-design`,
  `canvas-design`, `algorithmic-art`, `theme-factory`
- Android: `android-dev`, `android_ui_verification`
- testy i jakość: `webapp-testing`, `test-driven-development`, `systematic-debugging`,
  `verification-before-completion`, `requesting-code-review`
- planowanie: `brainstorming`, `writing-plans`, `executing-plans`, `dispatching-parallel-agents`
- sklep Google Play i marketing: `aso`, `launch`, `marketing-psychology`, `ad-creative`,
  `copywriting`, `onboarding`, `analytics`
- generowanie grafik/audio: `polli` (Pollinations)
