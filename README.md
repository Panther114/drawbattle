# draw battle clone

A from-scratch clone of [drawbattle.io](https://drawbattle.io): a two-team drawing game with a frantic final round.
The client (Vue 3 + Vite) and the backend (Express + `ws`) were written from observation of the real site: its
network protocol, timings and rules were recorded by playing real games against it with bots and then re-implemented.

## run

```bash
npm install
npm run build     # builds the client into dist/
npm start         # http://localhost:3000   (PORT env var to change)
```

Everything is served by one Node process: the client, the REST API under `/api` and the game socket at `/ws/`.

## how a game works

* **lobby** – players join with a name and are placed on the smaller team (max 8 per team). Anyone can switch team, rename,
  change the settings (rounds, seconds per round, word pack, show word lengths, streamer mode) and press *start game!*
  once both teams have 2+ players. A 5 second countdown (cancellable) starts round 0.
* **a round** – one drawer per team; the *chooser* picks one of two words (15s, otherwise the first is used), then a 3s
  countdown, then both teams draw/guess the same word. The first team to guess wins the round (200 pts, the other team
  gets 100 if it also guesses). The round ends when both guessed or the time runs out, followed by a 5s end screen and
  the score screen. Everyone presses *continue* (or someone forces the next round after 11s).
* **drawers** – the winner stays as drawer; the loser's team rotates. The loser's drawer chooses the next word. A drawer
  who wins 2+ rounds in a row gives the challenger a head start of `3 + (streak-2)` seconds.
* **the final drawdown** – after the last round both teams replay all round words in random order, taking turns drawing.
  Each correct guess is worth 100 points; the first team through all words gets +100 and ends the game.

## layout

```
server/index.js        REST + websocket entry point
server/game.js         game engine (lobby, rounds, scoring rules, final round)
server/wordpacks.js    word packs (+ txt files)
src/                   Vue client (views, components, shared rules in shared.js)
scripts/               asset generators (icons, sounds)
```

## notes / deliberate differences from the original

* Icons, hero art and sounds are original artwork generated for this clone (see `scripts/`).
* Word packs contain original word lists; pack ids, names and descriptions mirror the official packs, but the number of
  words differs (the clone ships a few hundred words in the standard pack).
* Analytics/error reporting of the original is not included.
* Lobby / in-game disconnects are broadcast to the other clients (`UserLobbyDisconnect` / `UserDisconnect`); the original
  server silently drops lobby users and never announces disconnects.
* Only the current drawer may send canvas operations (the original server accepts them from any team member).

## deploy to railway

1. Push this folder to a GitHub repo.
2. On Railway: **New Project → Deploy from GitHub repo** and pick it. `railway.json` + `Dockerfile` are picked up
   automatically; no variables are required (Railway provides `PORT`).
3. In the service's **Settings → Networking** click **Generate Domain** and share the link.

Footprint: ~55 MB RAM idle (node heap capped at 160 MB), no timers beyond a 5 minute cleanup tick, so an idle server uses
~0 CPU. Optional env vars: `MAX_GAMES` (default 300), `MAX_SOCKETS` (default 1500). Games are kept in memory only; stale
or empty games are reaped automatically. Tip: in Settings you can also set a memory limit (e.g. 256 MB) and enable
**Serverless** (app sleeping) if you want it to cost nothing while nobody plays — clients simply reconnect on wake.
