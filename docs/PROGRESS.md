# Postęp prac — Neon Horde: Survivor Arena

## Zrobione
- Skille w `.claude/skills` (spis: `.claude/skills/SOURCES.md`) + reguła „zawsze sprawdzaj skille” (CLAUDE.md + hook).
- GDD: `docs/GDD.md`.
- Gra HTML5 Canvas w `game/` (otwórz `game/index.html` przez serwer HTTP, np. `python3 -m http.server 8765 -d game`):
  - symulacja rundy (8 broni + 8 ewolucji, 8 pasywek, 7 wrogów + elity, 5 bossów, fale),
  - renderer neon + cząsteczki + dźwięk proceduralny + haptyka,
  - lobby: Walka / Sklep / Ekwipunek / Talenty / Wydarzenia, patrol offline, energia, skrzynie,
    licznik reklam, logowanie 7 dni, zadania, osiągnięcia, ustawienia, EN/PL,
  - warstwa reklam `game/js/core/platform.js` (Android bridge + symulacja w przeglądarce).
- Symulator balansu: `node tools/simulate.js`.
- Test E2E (Playwright, telefon Pixel 7):
  `python3 .claude/skills/webapp-testing/scripts/with_server.py --server "python3 -m http.server 8765 -d game" --port 8765 -- node tests/e2e/smoke.js`
  (wymaga `NODE_PATH=$(npm root -g)`), zrzuty w `docs/screenshots/`.

## Do zrobienia (następna sesja)
1. Projekt Android Studio `android/` (Kotlin WebView + AdMob: baner, rewarded, interstitial + UMP, powiadomienia, splash, ikona).
2. Testy jednostkowe meta/ekonomii (`tests/`), ponowny przebieg E2E po dodaniu dryfu kryształów XP (ekran level-up).
3. Dokumentacja: README, konfiguracja AdMob, karta Google Play (ASO, EN/PL), checklist wydania; uzupełnić `C.DEVELOPER` w `game/js/core/config.js`.
4. Grafiki promocyjne (Pollinations — wymaga odblokowania `gen.pollinations.ai` i klucza `POLLINATIONS_API_KEY`).
