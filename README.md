# Naukagry

Gry za gwiazdki zdobyte w [Matmie](https://paduszynski.github.io/matma/), [Angielskim](https://paduszynski.github.io/angielski/) i [Polskim](https://paduszynski.github.io/polski/): https://paduszynski.github.io/naukagry/

## Skarbonka

`skarbonka.js` to wspólny portfel. Wszystkie aplikacje są pod `paduszynski.github.io`, więc dzielą `localStorage` (klucz `skarbonka.v1`). Kanoniczna kopia jest tutaj; Matma, Angielski i Polski mają identyczną kopię `skarbonka.js` (po zmianie skopiuj plik do wszystkich trzech repo).

- Dobra odpowiedź za pierwszym razem: 10 ★, seria 3–4: 15 ★, 5–9: 20 ★, 10+: 30 ★. Błąd zeruje serię, nic nie zabiera. Poprawka po błędzie: 3 ★.
- Koniec zestawu: +20 ★, bez błędu +50 ★. Pierwszy zestaw dnia: +20 ★, każdy kolejny dzień z rzędu +10, max +50.
- Poziom liczy się od sumy zdobytych gwiazdek (wydawanie nie cofa poziomu). Próg z poziomu 1 na 2 to 300 ★, każdy następny ×1,1 (zaokrąglony do 10). Co 5 poziomów prezent +100 ★ (do salda, nie do poziomu).
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
