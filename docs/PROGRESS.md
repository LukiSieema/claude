# Postęp prac — Neon Horde: Survivor Arena

## Zrobione
- Skille w `.claude/skills` (spis: `.claude/skills/SOURCES.md`) + reguła „zawsze sprawdzaj skille” (CLAUDE.md + hook).
- GDD: `docs/GDD.md`.
- Gra HTML5 Canvas (`game/`): 8 broni + 8 ewolucji, 8 pasywek, 7 wrogów + elity, 5 bossów, 10 rozdziałów,
  lobby z meta-progresją, 13 miejsc reklam z nagrodą, EN/PL, dźwięk proceduralny.
- Projekt Android Studio (`android/`): WebView + WebViewAssetLoader, AdMob (baner adaptacyjny, rewarded,
  interstitial) z UMP, powiadomienia lokalne, haptyka, splash, ikona adaptacyjna, In-App Review,
  blokada wydania z testowymi ID reklam. Kotlin sprawdzony kompilatorem pod kątem składni
  (pełnej kompilacji nie da się zrobić w chmurze — Android SDK jest zablokowany przez politykę sieci).
- Balans: symulator `tools/simulate.js`; pierwszy level-up po ~6–10 s, bramki rozdziałów 3/7/10.
- Testy: 48 jednostkowych (`npm test`), E2E Playwright na emulowanym Pixelu 7 (`npm run e2e`).
- Audyt przed publikacją (09.2026): naprawione m.in. czarny ekran pierwszej rundy w WebView, zamrożone
  reklamy pełnoekranowe, podwójne nagrody przy szybkim klikaniu w trakcie reklamy, gubione skrzynie elit,
  darmowe poziomy przy łączeniu ekwipunku, rakiety gubiące cel, polskie litery w foncie, górny pasek
  na telefonach 360 dp, `singleTask` zamykający reklamy, cisza nocna dla powiadomień, zamulanie samouczka
  przy pierwszym uruchomieniu (SDK reklam startuje dopiero po samouczku; w samouczku brak przycisków reklam).
- Materiały do Google Play: ikona 512, grafika 1024×500, 7 zrzutów 9:16 × EN/PL (`docs/store/`),
  teksty karty (`docs/PLAY_STORE_LISTING.md`), AdMob (`docs/ADMOB_SETUP.md`), checklista (`docs/RELEASE_CHECKLIST.md`).

## Następne kroki (wymagają Ciebie)
1. Otwórz `android/` w Android Studio, uruchom na emulatorze/telefonie (build debug z testowymi reklamami).
2. AdMob: konto, 3 jednostki reklamowe, wiadomości zgody → ID do `android/gradle.properties`.
3. `C.DEVELOPER` w `game/js/core/config.js`, publiczny URL polityki prywatności, klucz podpisu.
4. Play Console wg `docs/RELEASE_CHECKLIST.md` (test zamknięty 12 osób × 14 dni dla nowych kont).
5. Opcjonalnie: grafiki AI przez Pollinations (`tools/generate-art.sh`) po odblokowaniu hosta i klucza.
