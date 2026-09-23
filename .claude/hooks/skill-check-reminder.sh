#!/usr/bin/env bash
# UserPromptSubmit hook: przy KAŻDYM poleceniu użytkownika przypomina Claude,
# żeby przed rozpoczęciem pracy sprawdził, czy jakiś skill / plugin / MCP / agent
# może pomóc w zadaniu — i jeśli tak, żeby go użył.
cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "OBOWIĄZKOWE (reguła projektu z CLAUDE.md): zanim zaczniesz wykonywać to polecenie, przejrzyj listę dostępnych skilli (.claude/skills/ + skille wbudowane i z pluginów), narzędzi MCP, pluginów i typów agentów. Dla każdego, który może realnie pomóc w tym zadaniu, wczytaj go (Skill tool / ToolSearch) i użyj. Gdy nic nie pasuje, rozważ skill `find-skills`. W odpowiedzi krótko wymień, których skilli/narzędzi użyłeś (albo że żaden nie pasował)."
  }
}
JSON
