# Checklista wydania na Google Play

## A. Przed pierwszym buildem wydania
- [ ] `game/js/core/config.js` → `C.DEVELOPER = { name, email, website }` (pojawia się w polityce prywatności w grze).
- [ ] Opublikuj politykę prywatności pod publicznym adresem (np. Google Sites — wklej angielski tekst
      z `game/privacy.html` z tymi samymi danymi kontaktowymi co w `C.DEVELOPER`). Ten URL podajesz
      w Play Console i w wiadomości UMP w AdMob; strona musi być publiczna (sprawdź w oknie incognito).
- [ ] Identyfikatory AdMob w `android/gradle.properties` (patrz `docs/ADMOB_SETUP.md`).
      Wersje do testów zamkniętych/wewnętrznych mogą mieć `allowTestAds=true` (reklamy testowe Google);
      **przed wersją produkcyjną** wpisz 4 ID i ustaw `allowTestAds=false`.
- [ ] Wiadomości zgody RODO + stany USA opublikowane w AdMob.
- [ ] `app-ads.txt` na Twojej domenie.
- [ ] Klucz przesyłania (upload key):
      `keytool -genkeypair -v -keystore neonhorde-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`
      i `android/keystore.properties` wg `keystore.properties.example`. **Nie commituj** klucza ani haseł
      (są w `.gitignore`); zrób kopię zapasową w bezpiecznym miejscu.
- [ ] Wersja: `versionCode` +1 i `versionName` w `android/app/build.gradle.kts`, `C.VERSION` w config.js.

## B. Build i testy
- [ ] `npm test` (testy jednostkowe) i `npm run e2e` (test na emulowanym telefonie) przechodzą.
- [ ] `node tools/simulate.js` — balans bez niespodzianek po zmianach w `config.js`.
- [ ] Android Studio → uruchom build **debug** na emulatorze (np. Pixel 8, API 35/36) i na fizycznym telefonie:
      samouczek, level-up, skrzynia, boss, reklama z nagrodą i pełnoekranowa (testowe — zamykają się przyciskiem ✕),
      baner w lobby, powiadomienie po wyjściu z gry,
      przycisk wstecz (zamyka okno → pauza → pytanie o wyjście).
- [ ] `cd android && ./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.

## C. Play Console
- [ ] Utwórz aplikację: nazwa *Neon Horde: Survivor Arena*, gra, bezpłatna.
- [ ] **Karta sklepu**: teksty i grafiki z `docs/PLAY_STORE_LISTING.md` i `docs/store/` (EN domyślnie + PL).
- [ ] **Polityka prywatności**: URL z punktu A.
- [ ] **Reklamy**: „Tak, aplikacja zawiera reklamy”.
- [ ] **Dostęp do aplikacji**: wszystkie funkcje dostępne bez logowania.
- [ ] **Grupa docelowa**: 13+ (gra NIE jest skierowana do dzieci — reklamy nie są w programie Families).
- [ ] **Klasyfikacja treści (IARC)**: przemoc kreskówkowa/fantastyczna wobec nie-ludzkich postaci, brak krwi,
      brak czatu i treści użytkowników, brak hazardu za prawdziwe pieniądze (skrzynie są tylko za walutę z gry).
- [ ] **Bezpieczeństwo danych** (dane zbierane przez Google AdMob SDK — sprawdź aktualne wytyczne Google dla AdMob):
      | Typ danych | Zbierane | Udostępniane | Cel |
      |---|---|---|---|
      | Identyfikatory urządzenia (ID reklamowe) | Tak | Tak | Reklamy, analityka, zapobieganie oszustwom |
      | Przybliżona lokalizacja (z adresu IP) | Tak | Tak | Reklamy, zapobieganie oszustwom |
      | Aktywność w aplikacji (interakcje z reklamami) | Tak | Tak | Reklamy, analityka |
      | Informacje o aplikacji i wydajności (diagnostyka, awarie) | Tak | Tak | Analityka, zapobieganie oszustwom |
      Dane szyfrowane w przesyłaniu: **Tak**. Możliwość usunięcia danych: postęp gry jest tylko na urządzeniu
      (reset w ustawieniach gry); ID reklamowe użytkownik resetuje w ustawieniach Androida.
- [ ] **Uprawnienia**: `POST_NOTIFICATIONS` (przypomnienia), `RECEIVE_BOOT_COMPLETED` (przywrócenie przypomnień
      po restarcie), `AD_ID` (reklamy) — wszystkie uzasadnione powyżej.

## D. Testy i publikacja
- [ ] **Testy wewnętrzne** → wgraj `.aab`, zainstaluj z Play na swoim telefonie.
- [ ] **Testy zamknięte**: nowe konta deweloperów indywidualnych muszą przeprowadzić test zamknięty
      z co najmniej **12 testerami przez 14 dni** przed dostępem do produkcji.
- [ ] **Produkcja**: wdrażanie etapowe 5% → 20% → 50% → 100%, obserwując Android Vitals
      (crash < 1,09%, ANR < 0,47%) i opinie.
- [ ] Po publikacji: połącz aplikację w AdMob ze sklepem, rozważ mediację (patrz `docs/ADMOB_SETUP.md`).
