# Neon Horde: Survivor Arena — Game Design Document

> Wersja 1.0 · gatunek: hybrid-casual survivor roguelite · platforma: Android (Google Play), HTML5 Canvas w natywnym opakowaniu Kotlin + AdMob

## 1. Pitch

Jednym palcem prowadzisz neonowego bohatera przez hordy „glitchy”. Broń strzela sama, a Ty
wybierasz ulepszenia, łączysz je w potężne ewolucje i przetrwasz 8 minut do walki z bossem.
Między rozgrywkami zbierasz i łączysz ekwipunek, rozwijasz talenty i wysyłasz oddział na patrol,
który zarabia nawet, gdy gra jest wyłączona.

## 2. Nisza i uzasadnienie wyboru

- **Hybrid-casual** to najszybciej rosnący segment mobile w 2026 r. (≈ +23% przychodów r/r w H1 2026):
  prosta mechanika „na jeden palec” + głęboki meta-progres.
- Wzorce rynkowe, które łączymy:
  - **Survivor.io / Vampire Survivors** — auto-atak, hordy, wybór 1 z 3 umiejętności, ewolucje broni.
  - **Archero** — rozdziały, ekwipunek z rzadkościami, energia.
  - **AFK Arena / Egg Inc.** — patrol (idle/offline), mnożniki nagród za reklamy.
  - **Clash Royale** — skrzynie z timerem i darmowa skrzynia co X godzin.
- Survivor to gatunek, w którym reklamy z nagrodą są **naturalną częścią pętli** (wskrzeszenie, podwójne
  nagrody, szybki patrol), więc gracze oglądają je dobrowolnie, wiele razy dziennie.

## 3. Pętle rozgrywki

### Core loop (sekundy)
Ruch → broń sama atakuje → wrogowie wybuchają w cząsteczkach → zbierasz kryształy XP → pasek XP →
**LEVEL UP** (zwolnienie czasu, wybór 1 z 3 kart) → silniejszy build → więcej wrogów.

### Pętla rozgrywki (8–9 min)
Fale według osi czasu rozdziału → elity o 2:00, 4:00 i 6:00 (upuszczają **skrzynię** — tam wypadają
ewolucje) → boss o 8:00 (arena zamyka się pierścieniem) → wynik: monety, złom, ekwipunek, XP konta.

### Meta-pętla (godziny/dni)
Nagrody → ulepszanie i **łączenie ekwipunku** (3 × ten sam przedmiot → wyższa rzadkość) → talenty →
kolejny rozdział (10 rozdziałów, 5 unikalnych bossów + wersje Mk II) → patrol rośnie wraz z postępem.
Codzienne powroty: 7-dniowy kalendarz, zadania dzienne z punktami aktywności, darmowa Złota Skrzynia co 8 h,
licznik reklam dnia, pełny patrol (12 h).

## 4. Zawartość

| System | Zawartość |
|---|---|
| Bronie (8) | Plazmowy blaster, Orbitalne ostrza, Łańcuch piorunów, Bomby zapalające, Drony, Dysk-bumerang, Mroźna nowa, Rakiety |
| Pasywki (8) | Overclock (CD), Ogniwo energii (DMG), Rdzeń magnetyczny (zasięg zbierania), Nanopancerz (DEF), Egzobuty (szybkość), Zbiornik paliwa (obszar/czas), Rdzeń AI (pociski), Bioregeneracja (regen/HP) |
| Ewolucje (8) | Broń na poz. 5 + pasywka w parze → skrzynia elity daje ewolucję (np. Blaster + Overclock = Burza fotonów) |
| Wrogowie (7 + elity) | Glitchling, Rój, Osiłek, Pluwacz, Szarżownik, Rozszczepiacz, Bombowiec |
| Bossowie (5 + Mk II) | Tytan Rdzenia, Matka Roju, Wąż Pustki, Pryzmatyczny Strażnik, Król Glitchy |
| Rozdziały | 10, każdy z własną paletą, miksem wrogów i skalowaniem |
| Ekwipunek | 6 slotów × 6 rzadkości (Zwykły → Mityczny), perki od Rzadkiego wzwyż, łączenie 3→1 |
| Talenty | 6 statystyk rozwijanych za monety (limit zależny od poziomu konta) |

## 5. Monetyzacja (priorytet: zysk z reklam)

### Reklamy z nagrodą (rewarded) — zawsze dobrowolne, zawsze opłacalne

| # | Miejsce | Nagroda | Mechanizm psychologiczny |
|---|---|---|---|
| 1 | Śmierć w rozgrywce | **Wskrzeszenie** z pełnym HP + fala uderzeniowa | awersja do straty (sunk cost całej rundy) |
| 2 | Ekran wyniku | **Nagrody ×2** | efekt zerowej ceny, natychmiastowa gratyfikacja |
| 3 | Porażka | **Ponów rozdział za darmo** (bez energii) | „natychmiastowy restart premium” |
| 4 | Powrót do gry | **Zarobki patrolu offline ×3** | awersja do straty, efekt „prezentu” |
| 5 | Patrol | **Szybki patrol**: 2 h nagród od ręki (3×/dzień) | natychmiastowa gratyfikacja |
| 6 | Sklep | **Darmowa Złota Skrzynia**: skrócenie oczekiwania o **80%** | efekt Zeigarnik (niedokończone odliczanie) |
| 7 | Sklep | **Darmowa Super-Skrzynia** (licznik reklam dnia, próg 15) | goal-gradient |
| 8 | Level-up | **Losuj ponownie** karty / **Weź wszystkie 3** (raz na rundę) | zmienna nagroda |
| 9 | Energia | **+15 energii** (2×/dzień) | usunięcie bariery |
| 10 | Kalendarz | **Nagroda dzienna ×2** | wzmocnienie nawyku |
| 11 | Sklep | **Darmowe klejnoty** (3×/dzień) | zerowa cena |
| 12 | Skrzynia elity | **Podwójna skrzynia** (2 losowania) | zmienna nagroda, szczyt emocji |

**Licznik reklam dnia**: pasek postępu z progami 3 / 6 / 10 / 15 obejrzanych reklam i rosnącymi
nagrodami (klejnoty → Złota Skrzynia → klejnoty i energia → Super-Skrzynia). Postęp jest zawsze widoczny
w lobby (efekt obdarowanego postępu i gradientu celu), co prowadzi do kilkunastu dobrowolnych reklam dziennie.

### Baner
Adaptacyjny, zakotwiczony na dole ekranu, **tylko w menu** (lobby, pauza, wyniki). Interfejs rezerwuje
na niego miejsce, więc nigdy nie zasłania przycisków. Podczas walki baner jest ukryty (czysta arena).

### Reklama pełnoekranowa (interstitial)
Tylko w naturalnej przerwie (powrót z wyniku rundy do lobby), maksymalnie raz na 4 minuty, nigdy
w pierwszych 3 rundach i nigdy w ciągu 2 minut po reklamie z nagrodą.

### Zgodność
Google UMP (zgoda RODO/UE i stany USA), opcje prywatności w ustawieniach, test ID w buildach debug,
blokada wydania z testowymi ID, gra nie jest kierowana do dzieci (Families policy), polityka prywatności.

## 6. Game feel

Hit-flash wrogów, liczby obrażeń (krytyki większe i żółte), odrzut, rozbłyski cząsteczek w kolorze
wroga, trzęsienie kamery przy eksplozjach i bossach, hit-stop przy trafieniu bossa, zwolnienie czasu
i błysk przy level-upie, magnes XP z przyspieszeniem, poświata (blending addytywny), smugi pocisków,
kamera wyprzedzająca ruch, proceduralne SFX (WebAudio), generatywna muzyka synthwave, wibracje (haptyka).

## 7. Onboarding

Pierwsze uruchomienie przenosi od razu do rozdziału 1 (bez kosztu energii) z podpowiedziami:
„Przeciągnij, aby się poruszać”, „Broń strzela sama”, „Zbieraj kryształy”, „Wybierz umiejętność”.
Po pierwszej rundzie wskazówki prowadzą do ekwipunku, patrolu i talentów.

## 8. Technologia

- `game/` — HTML5 Canvas 2D + DOM UI, czysty JavaScript bez silnika (klasyczne skrypty, globalna
  przestrzeń `NH`). Logika symulacji (`game/js/game`) jest oddzielona od renderowania, dzięki czemu
  da się ją uruchomić w Node do symulacji balansu (`tools/simulate.js`).
- `android/` — projekt Android Studio (Kotlin): WebView + `WebViewAssetLoader`, most JS↔natywny,
  AdMob (baner adaptacyjny, rewarded, interstitial), UMP, powiadomienia lokalne, haptyka,
  splash screen, ikona adaptacyjna, tryb pełnoekranowy.
- Wydajność: pule obiektów, siatka przestrzenna do kolizji, wstępnie renderowane sprite'y z poświatą,
  stały krok symulacji 60 Hz, limit DPR, tryb oszczędzania baterii (30 FPS), pauza w tle.
