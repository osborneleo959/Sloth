// Name It! multiplayer server. Run: npm install && npm start
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const BANK = require('./bank');

const page = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(page);
});
const wss = new WebSocketServer({ server });
const rooms = new Map();
const TURN = 20000, ROUND = 60000, MAXP = 8;

// ---- answer matching (server-side so answers are never sent to players) ----
const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(cells?|the|a|an|of)\b/g, ' ')
  .split(/\s+/).filter(Boolean).map(w => w.length > 3 ? w.replace(/s$/, '') : w).join(' ');
function lev(a, b) {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let p = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; }
  }
  return d[b.length];
}
const build = q => [...q.h.map(x => ({ tier: 50, al: x.split('|') })), ...q.s.map(x => ({ tier: 10, al: x.split('|') }))];
function match(entries, input) {
  const n = norm(input); if (!n) return -1;
  for (let i = 0; i < entries.length; i++) for (const al of entries[i].al) {
    const a = norm(al);
    if (n === a || (a.length >= 4 && (' ' + n + ' ').includes(' ' + a + ' ')) ||
        (n.length >= 5 && a.length >= 5 && lev(n, a) <= (n.length > 8 ? 2 : 1))) return i;
  }
  return -1;
}

// ---- rooms ----
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
function newCode() {
  let c; do c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); while (rooms.has(c));
  return c;
}
const alive = r => r.players.filter(p => p.lives > 0);
const toast = (r, text, kind) => r.players.forEach(p => send(p.ws, { t: 'toast', text, kind }));
function broadcast(r) {
  for (const p of r.players) send(p.ws, {
    t: 'state', you: p.id, solo: r.solo, serverNow: Date.now(), phase: r.phase, code: r.code, host: r.hostId,
    players: r.players.map(q => ({ id: q.id, name: q.name, pts: q.pts, lives: q.lives, on: q.ws.readyState === 1 })),
    subjects: BANK.map(b => b.topic), topic: r.topic, q: r.q && r.q.q, ri: r.ri, n: r.rounds.length,
    turn: r.phase === 'play' ? r.players[r.turn].id : null, turnEnd: r.turnEnd, roundEnd: r.roundEnd,
    log: r.log, missed: r.missed, rpts: r.rpts, last: r.last
  });
}
function skipDead(r) { let k = 0; while (r.players[r.turn].lives <= 0 && k++ < r.players.length) r.turn = (r.turn + 1) % r.players.length; }
function newTurn(r) { r.turnEnd = Date.now() + TURN; broadcast(r); }
function nextTurn(r) { r.turn = (r.turn + 1) % r.players.length; skipDead(r); newTurn(r); }
function beginRound(r) {
  const spec = r.rounds[r.ri];
  Object.assign(r, { topic: spec.topic, q: spec.q, entries: build(spec.q), used: new Set(), log: [], missed: [], rpts: {},
    roundEnd: Date.now() + ROUND, turn: r.startAt % r.players.length, phase: 'play' });
  skipDead(r); newTurn(r);
}
function endRound(r, early) {
  r.phase = 'between';
  r.last = early || r.ri >= r.rounds.length - 1;
  r.startAt = r.turn + 1;
  r.missed = r.entries.map((e, i) => r.used.has(i) ? null : { text: e.al[0], tier: e.tier }).filter(Boolean);
  broadcast(r);
}
function startGame(r, subjects) {
  const picked = BANK.filter(b => (subjects || []).includes(b.topic));
  if (!picked.length) return;
  r.rounds = shuffle(picked).map(b => ({ topic: b.topic, q: b.qs[Math.random() * b.qs.length | 0] }));
  r.players.forEach(p => { p.pts = 0; p.lives = 3; });
  r.ri = 0; r.startAt = 0; beginRound(r);
}
function answer(r, p, text) {
  if (r.phase !== 'play' || r.players[r.turn] !== p) return;
  const i = match(r.entries, text);
  if (i < 0) return send(p.ws, { t: 'toast', text: 'Not accepted. Try a different answer.', kind: 'bad' });
  if (r.used.has(i)) return send(p.ws, { t: 'toast', text: 'Already said this round. Try another.', kind: 'bad' });
  const e = r.entries[i]; r.used.add(i); p.pts += e.tier; r.rpts[p.name] = (r.rpts[p.name] || 0) + e.tier;
  r.log.unshift({ by: p.name, text: e.al[0], tier: e.tier });
  toast(r, e.tier === 50 ? `${p.name}: +50 Grade 7–9!` : `${p.name}: +10`, e.tier === 50 ? 'hi' : 'ok');
  nextTurn(r);
}
function tick(r) {
  const now = Date.now();
  if (now >= r.roundEnd) return endRound(r, false);
  if (now < r.turnEnd) return;
  const p = r.players[r.turn]; p.lives--;
  toast(r, p.lives > 0 ? `${p.name} ran out of time and lost a life` : `${p.name} is out!`, 'bad');
  if (!alive(r).length || (r.players.length > 1 && alive(r).length <= 1)) return endRound(r, true);
  nextTurn(r);
}
setInterval(() => rooms.forEach(r => r.phase === 'play' && tick(r)), 250);

wss.on('connection', ws => {
  let room = null, me = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'create' || m.t === 'join') {
      if (room) return;
      const name = String(m.name || '').trim().slice(0, 16) || 'Player';
      let r = m.t === 'create' ? null : rooms.get(String(m.code || '').toUpperCase().trim());
      if (m.t === 'join' && !r) return send(ws, { t: 'err', text: 'Room not found.' });
      if (r && r.solo) return send(ws, { t: 'err', text: 'Room not found.' });
      if (r && r.phase !== 'lobby') return send(ws, { t: 'err', text: 'That game has already started.' });
      if (r && r.players.length >= MAXP) return send(ws, { t: 'err', text: 'Room is full.' });
      if (!r) { r = { code: newCode(), solo: !!m.solo, hostId: null, players: [], phase: 'lobby', rounds: [], ri: 0, startAt: 0, turn: 0, log: [], missed: [], rpts: {} }; rooms.set(r.code, r); }
      me = { id: Math.random().toString(36).slice(2, 8), name, pts: 0, lives: 3, ws };
      r.players.push(me); if (!r.hostId) r.hostId = me.id; room = r; return broadcast(r);
    }
    if (!room) return;
    const host = me.id === room.hostId;
    if (m.t === 'start' && host && room.phase === 'lobby') startGame(room, m.subjects);
    else if (m.t === 'answer') answer(room, me, String(m.text || ''));
    else if (m.t === 'next' && host && room.phase === 'between') {
      if (room.last) { room.phase = 'end'; broadcast(room); } else { room.ri++; beginRound(room); }
    } else if (m.t === 'again' && host && room.phase === 'end') {
      room.players = room.players.filter(p => p.ws.readyState === 1); room.phase = 'lobby'; broadcast(room);
    }
  });
  ws.on('close', () => {
    if (!room) return;
    if (room.phase === 'lobby') room.players = room.players.filter(p => p !== me);
    if (!room.players.some(p => p.ws.readyState === 1)) return rooms.delete(room.code);
    if (room.hostId === me.id) room.hostId = room.players.find(p => p.ws.readyState === 1).id;
    broadcast(room);
  });
});
server.listen(process.env.PORT || 3000, () => console.log('Name It! running on port ' + (process.env.PORT || 3000)));
