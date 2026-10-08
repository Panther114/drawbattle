import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, randomGameId, isStale } from './game.js';
import {
  DEFAULT_WORD_LIST_ID,
  getOfficialPack,
  officialMeta,
  getWordListMeta,
  wordListExists,
  addCustomPack,
  reapCustomPacks,
  touchPack,
} from './wordpacks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DIST = path.resolve(__dirname, '../dist');

const games = new Map();

const HEARTBEAT_MS = 30 * 1000;
const REAP_MS = 30 * 1000;

// ---- resource guards (keep the footprint small on a shared host) ----
const MAX_GAMES = Number(process.env.MAX_GAMES || 300);
const MAX_SOCKETS = Number(process.env.MAX_SOCKETS || 1500);
const MAX_SOCKETS_PER_GAME = 40;
const CREATE_LIMIT = 20; // new games per IP per 10 minutes
const createLog = new Map(); // ip -> timestamps
let socketCount = 0;

function allowCreate(ip) {
  const now = Date.now();
  const list = (createLog.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= CREATE_LIMIT) return false;
  list.push(now);
  createLog.set(ip, list);
  return true;
}

function createGame(opts, wantedId) {
  const id = wantedId || randomGameId((x) => games.has(x));
  const game = new Game(id, opts);
  games.set(id, game);
  return game;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));
const smallJson = express.json({ limit: '64kb' });
app.use((req, res, next) => (req.path === '/api/wordpacks' ? next() : smallJson(req, res, next)));

// ---- REST API (mirrors api.drawbattle.io) ----
const api = express.Router();
api.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

api.post('/games', (req, res) => {
  if (games.size >= MAX_GAMES) return res.status(503).type('text/plain').send('server is busy, try again later');
  if (!allowCreate(req.ip)) return res.status(429).type('text/plain').send('too many new games, slow down');
  const body = req.body || {};
  let wordListId = DEFAULT_WORD_LIST_ID;
  if (body.wordListId !== undefined && body.wordListId !== null && body.wordListId !== '') {
    wordListId = parseInt(body.wordListId, 10);
    if (Number.isNaN(wordListId) || !wordListExists(wordListId)) {
      return res.status(400).type('text/plain').send('word list not found');
    }
  }
  let code;
  if (body.code !== undefined && body.code !== null && body.code !== '') {
    code = String(body.code).trim().toLowerCase();
    if (!/^[a-z]{4}$/.test(code)) return res.status(400).type('text/plain').send('the code must be 4 letters (a-z)');
    if (games.has(code)) return res.status(409).type('text/plain').send(`code ${code.toUpperCase()} is already in use`);
  }
  const game = createGame({ wordListId, streamerMode: body.streamerMode === true }, code);
  res.json({ gameId: game.id });
});

// public lobby list (streamer-mode games stay hidden; games nobody is connected to are dead and hidden too)
api.get('/lobbies', (req, res) => {
  const list = [];
  for (const g of games.values()) {
    if (g.settings.streamerMode || g.finished) continue;
    if (g.activeCount === 0) continue;
    list.push(g.lobbyInfo());
  }
  list.sort((a, b) => Number(b.canJoin) - Number(a.canJoin) || b.players.length - a.players.length || a.id.localeCompare(b.id));
  res.json(list);
});

api.get('/games/:id', (req, res) => {
  const game = games.get(String(req.params.id).toLowerCase());
  if (!game) return res.sendStatus(404);
  const include = req.query.include;
  res.json(game.snapshot(include === 'all' ? 'all' : include === 'guesses' ? 'none' : 'none'));
});

api.post('/games/:id/backToLobby', (req, res) => {
  const game = games.get(String(req.params.id).toLowerCase());
  if (!game) return res.sendStatus(404);
  if (!game.nextGameId) {
    const next = createGame({
      wordListId: game.settings.wordListId,
      streamerMode: game.settings.streamerMode,
    });
    next.settings = { ...game.settings };
    game.nextGameId = next.id;
  }
  res.json({ nextGameId: game.nextGameId });
});

// create (or reuse) a custom word pack
const packJson = express.json({ limit: '256kb' });
const packLog = new Map();
api.post('/wordpacks', packJson, (req, res) => {
  const now = Date.now();
  const recent = (packLog.get(req.ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 40) return res.status(429).type('text/plain').send('too many word packs, slow down');
  recent.push(now);
  packLog.set(req.ip, recent);
  const out = addCustomPack(req.body || {});
  if (out.error) return res.status(400).type('text/plain').send(out.error);
  res.json(out.meta);
});

api.get('/wordlists', (req, res) => {
  if (req.query.type === 'official') return res.json(officialMeta());
  res.json([]);
});

// full word list of an official pack (used to clone it in the word pack editor)
api.get('/wordlists/:id/words', (req, res) => {
  const pack = getOfficialPack(parseInt(req.params.id, 10));
  if (!pack) return res.sendStatus(404);
  res.json(pack);
});

api.get('/wordlists/:id', (req, res) => {
  const meta = getWordListMeta(parseInt(req.params.id, 10));
  if (!meta) return res.sendStatus(404);
  res.json(meta);
});

app.use('/api', api);

// ---- static client ----
if (fs.existsSync(DIST)) {
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.use((req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.use((req, res) => res.status(503).send('client not built; run npm run build'));
}

const server = http.createServer(app);

// ---- WebSocket ----
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws/' && url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, url));
});

wss.on('connection', (ws, url) => {
  if (socketCount >= MAX_SOCKETS) {
    ws.close(1013, 'busy');
    return;
  }
  const gameId = (url.searchParams.get('gameId') || '').toLowerCase();
  const userId = url.searchParams.get('userId') || '';
  const userName = url.searchParams.has('userName') ? url.searchParams.get('userName') : undefined;
  const spectate = url.searchParams.get('spectate') === 'true';
  const rating = url.searchParams.has('rating') ? url.searchParams.get('rating') : undefined;
  const game = games.get(gameId);
  if (!game) {
    ws.send(JSON.stringify([300, { type: 'GameNotFound', gameId }]));
    ws.close(1000);
    return;
  }
  if (game.socketTotal() >= MAX_SOCKETS_PER_GAME) {
    ws.close(1013, 'game full');
    return;
  }
  socketCount += 1;
  // liveness: a device that vanished (battery died, wifi lost) never closes its socket, so it is pinged and dropped
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  let tokens = 300;
  let refill = Date.now();
  game.connect(ws, { userId, userName, spectate, rating });
  ws.on('message', (data) => {
    ws.isAlive = true;
    const raw = data.toString();
    if (raw === '_') return;
    // token bucket: ~150 msgs/s sustained, bursts of 300
    const now = Date.now();
    tokens = Math.min(300, tokens + ((now - refill) / 1000) * 150);
    refill = now;
    if (tokens < 1) return;
    tokens -= 1;
    game.handleMessage(ws, raw);
  });
  ws.on('close', () => {
    socketCount -= 1;
    game.disconnect(ws);
  });
  ws.on('error', () => {});
});

// drop sockets that stopped answering (ping every 30 s; a silent socket is terminated on the next round)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      // the socket is already closing
    }
  }
}, HEARTBEAT_MS).unref();

// reap dead games; the interval is unref'd so an idle server has nothing scheduled but this
setInterval(
  () => {
    const now = Date.now();
    for (const [id, g] of games) {
      if (isStale(g, now)) {
        g.destroy();
        games.delete(id);
      }
    }
    reapCustomPacks(new Set([...games.values()].map((g) => g.settings && g.settings.wordListId)));
    for (const [ip, list] of packLog) if (!list.some((t) => now - t < 10 * 60 * 1000)) packLog.delete(ip);
    for (const [ip, list] of createLog) if (!list.some((t) => now - t < 10 * 60 * 1000)) createLog.delete(ip);
  },
  REAP_MS,
).unref();

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    wss.clients.forEach((c) => c.close(1001));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

server.listen(PORT, '0.0.0.0', () => console.log(`draw battle listening on http://localhost:${PORT}`));
