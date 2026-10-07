import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, randomGameId } from './game.js';
import {
  DEFAULT_WORD_LIST_ID,
  communityMeta,
  officialMeta,
  getWordListMeta,
  wordListExists,
} from './wordpacks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DIST = path.resolve(__dirname, '../dist');

const games = new Map();

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

function createGame(opts) {
  const id = randomGameId((x) => games.has(x));
  const game = new Game(id, opts);
  games.set(id, game);
  return game;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));
app.use(express.json({ limit: '64kb' }));

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
  const game = createGame({ wordListId, streamerMode: body.streamerMode === true });
  res.json({ gameId: game.id });
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

api.get('/wordlists', (req, res) => {
  if (req.query.type === 'community') return res.json(communityMeta());
  if (req.query.type === 'official') return res.json(officialMeta());
  res.json([]);
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
  let tokens = 300;
  let refill = Date.now();
  game.connect(ws, { userId, userName, spectate });
  ws.on('message', (data) => {
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

// reap stale games; the interval is unref'd so an idle server has nothing scheduled but this
setInterval(
  () => {
    const now = Date.now();
    for (const [id, g] of games) {
      const idle = now - g.lastActivity;
      const live = g.socketTotal() > 0;
      const stale =
        (!live && g.userCount === 0 && idle > 15 * 60 * 1000) || // created but never used
        (!live && idle > 30 * 60 * 1000) || // everyone left
        (g.finished && idle > 60 * 60 * 1000) || // ended games linger for the recap
        idle > 6 * 60 * 60 * 1000;
      if (stale) {
        g.destroy();
        games.delete(id);
      }
    }
    for (const [ip, list] of createLog) if (!list.some((t) => now - t < 10 * 60 * 1000)) createLog.delete(ip);
  },
  5 * 60 * 1000,
).unref();

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    wss.clients.forEach((c) => c.close(1001));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

server.listen(PORT, '0.0.0.0', () => console.log(`draw battle listening on http://localhost:${PORT}`));
