# Konfiguracja Google AdMob i zgody UMP

Buildy **debug** zawsze używają oficjalnych testowych reklam Google, więc możesz je bezpiecznie
klikać. Do buildu **release** musisz wpisać własne identyfikatory. Bez nich kompilacja wydania się
zatrzyma, żeby przez pomyłkę nie opublikować gry z testowymi reklamami (które nie zarabiają).

## 1. Aplikacja i jednostki reklamowe
1. Załóż konto na <https://admob.google.com> i uzupełnij dane płatności.
2. **Aplikacje → Dodaj aplikację → Android**. Na pytanie „Czy aplikacja jest w sklepie?” odpowiedz
   *Nie* (połączysz ją z Google Play po publikacji).
3. Skopiuj **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).
4. Utwórz 3 jednostki reklamowe i skopiuj ich ID (`ca-app-pub-…/…`):
   | Jednostka | Format | Gdzie w grze |
   |---|---|---|
   | `NH_Banner` | Baner (adaptacyjny) | lobby i ekran wyników (nigdy w trakcie walki) |
   | `NH_Rewarded` | Z nagrodą | wszystkie 13 miejsc „▶” (wskrzeszenie, ×2, ×3 offline, −80% czasu itd.) |
   | `NH_Interstitial` | Pełnoekranowa | powrót z wyniku do lobby, maks. raz na 4 min, nie w pierwszych 3 rundach |

   Dla reklam z nagrodą ustaw w AdMob nagrodę np. `1 reward` — gra sama decyduje, co przyznać.

## 2. Wpisz identyfikatory
W `android/gradle.properties`:
```properties
ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/1111111111
ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXXXXXXXXXX/2222222222
ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/3333333333
```
Te wartości trafiają do `BuildConfig` i manifestu tylko w buildzie release (`android/app/build.gradle.kts`).

## 3. Zgoda RODO / UE i stany USA (UMP) — obowiązkowe
Gra używa Google User Messaging Platform (`AdsManager.kt`): prosi o zgodę **przed** pierwszym
żądaniem reklamy i pokazuje przycisk *Ustawienia → Opcje prywatności i reklam*, gdy jest wymagany.
Przy pierwszym uruchomieniu cały stos reklamowy (formularz zgody, SDK, pomiar aplikacji —
`DELAY_APP_MEASUREMENT_INIT`) rusza dopiero po samouczku, więc formularz pojawia się na ekranie jego
wyników; w samouczku nie ma przycisków reklam. Przy kolejnych uruchomieniach zgoda i SDK startują od razu.
1. AdMob → **Prywatność i wiadomości** → **RODO** → *Utwórz wiadomość* → wybierz aplikację,
   języki (co najmniej EN i PL), dodaj link do polityki prywatności → **Opublikuj**.
2. Tamże: **Przepisy stanowe USA** → utwórz i opublikuj wiadomość.
3. Test w UE bez podróży: uruchom build debug, w logcat znajdź linię z `addTestDeviceHashedId`
   i wpisz ten hash w `UMP_TEST_DEVICE_ID` w `android/gradle.properties`. Build debug pokaże wtedy
   formularz jak w UE.

## 4. app-ads.txt (ważne dla przychodu)
Opublikuj plik `https://twoja-domena/app-ads.txt` z linią z AdMob (*Aplikacje → app-ads.txt*), np.:
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```
Domena musi być tą samą, którą podasz jako *Witryna* w karcie Google Play. Bez app-ads.txt część
reklamodawców nie kupuje wyświetleń i eCPM spada.

## 5. Po publikacji
- AdMob → aplikacja → **Połącz ze sklepem** (Google Play).
- Rozważ **mediację** (AdMob → Mediacja) z np. AppLovin, Unity Ads, Meta Audience Network — zwykle
  podnosi eCPM reklam z nagrodą o 20–40%. Wymaga dodania adapterów do `app/build.gradle.kts`.
- Obserwuj w raportach: *wyświetlenia reklam z nagrodą / DAU* (cel ≥ 8), eCPM, fill rate.
  Najmocniejsze miejsca w grze to wskrzeszenie, nagrody ×2 i zarobki offline ×3.

## Jak to działa w kodzie
| Warstwa | Plik |
|---|---|
| Wywołania z gry (JS) | `game/js/core/platform.js` → `window.NeonHordeNative.*` |
| Most JS ↔ Kotlin | `android/app/src/main/java/com/neonhorde/survivor/GameBridge.kt` |
| AdMob + UMP | `…/AdsManager.kt` (wstępne ładowanie, ponawianie z backoffem, baner adaptacyjny) |
| Limity reklam pełnoekranowych | `Meta.interstitialAllowed` w `game/js/meta/meta.js`, stałe `C.ADS` w `game/js/core/config.js` |
