# Naukagry

Gry za gwiazdki zdobyte w [Matmie](https://paduszynski.github.io/matma/), [Angielskim](https://paduszynski.github.io/angielski/) i [Polskim](https://paduszynski.github.io/polski/): https://paduszynski.github.io/naukagry/

## Skarbonka

`skarbonka.js` to wspólny portfel. Wszystkie aplikacje są pod `paduszynski.github.io`, więc dzielą `localStorage` (klucz `skarbonka.v1`). Kanoniczna kopia jest tutaj; Matma, Angielski i Polski mają identyczną kopię `skarbonka.js` (po zmianie skopiuj plik do wszystkich trzech repo).

- Dobra odpowiedź za pierwszym razem (`RATES` w `skarbonka.js`): Angielski i Polski 5 ★, seria 3–4: 6 ★, 5–9: 7 ★, 10+: 8 ★; Matma 6 / 8 / 10 / 12 ★. Błąd obniża serię o jeden stopień (np. z 10+ do 5–9), nic nie zabiera. Poprawka po błędzie: 2 ★ (Matma 3 ★). W fiszkach ocenianych samemu „Umiem!” szybciej niż 0,5 s od pojawienia się karty nie daje gwiazdek.
- Koniec zestawu: +1 ★ za każde 2 odpowiedzi, podwójnie bez błędu (10 pytań: +5, bez błędu +10). Pierwszy zestaw dnia: +5 ★, każdy kolejny dzień z rzędu +1, max +10.
- Czysty zestaw 10 pytań od zera: Angielski i Polski 75 ★, Matma 100 ★ (plus bonus dnia).
- Poziom liczy się od sumy zdobytych gwiazdek (wydawanie nie cofa poziomu). Próg z poziomu 1 na 2 to 60 ★, każdy następny ×1,1 (zaokrąglony do 5). Co 5 poziomów prezent +20 ★ (do salda, nie do poziomu).
- Ceny: runda gry 50 ★ (Trójki 40 ★ za poziom), nasiona i rybki od 25 ★.
- Ekonomia v2 (listopad 2026): stan z v1 jest jednorazowo dzielony przez 5 (`rate: 2` w `skarbonka.v1`), więc poziom zostaje.
- Bez dziennych limitów.

API dla aplikacji z nauką:

```js
const S = Skarbonka.session('matma');         // stan serii dla tej strony
Skarbonka.mountBadge(headerEl, { session: S }); // pigułka ★ saldo · poziom · 🔥seria, link do gier
S.correct();  // dobra odpowiedź za pierwszym razem
S.wrong();    // zła odpowiedź za pierwszym razem
S.retry();    // dobra odpowiedź na pytanie, które wcześniej było złe
S.setDone();  // koniec zestawu / rundy
```

## Gry

`index.html` to sklepik (kafelki, saldo, poziom) i host gier. Każda gra to `games/<id>.js`:

```js
NG.register('<id>', {
  mount(el, ctx) {           // el: pusty kontener na cały ekran pod górnym paskiem
    ...
    return { destroy() {}, pause() {}, resume() {} };  // destroy obowiązkowe
  }
});
```

`ctx`:

| | |
|---|---|
| `ctx.spend(n, note)` | pobiera n ★, zwraca `false` gdy za mało |
| `ctx.refund(n, note)` | oddaje ★ do salda (nie liczy się do poziomu) |
| `ctx.balance()`, `ctx.level()` | saldo, numer poziomu |
| `ctx.load(def)`, `ctx.save(obj)` | stan gry w `localStorage['naukagry.<id>']` |
| `ctx.panel({...})` | wspólna karta startu/końca; z `price` przycisk najpierw pobiera ★ |
| `ctx.toast(text)` | krótki komunikat |
| `ctx.exit()` | powrót do sklepiku |

Metadane gier (nazwa, poziom odblokowania, cena, obrazek kafelka) są w `GAMES` w `index.html`. Nowa gra: wpis w `GAMES`, `<script src="games/<id>.js">` i ścieżka w `sw.js`.

Wersja: znaczek w `index.html` (tytuł + `meta version`) i `CACHE` w `sw.js` podbijane przy każdej zmianie.
