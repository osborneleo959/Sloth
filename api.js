// JSON API for accounts, profiles and leaderboards.
const BANK = require('./bank'), db = require('./db');
const hits = new Map();
const limited = (ip, key, max) => { const k = ip + key, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < 60000); a.push(now); hits.set(k, a); return a.length > max; };
setInterval(() => hits.clear(), 600000).unref();
const out = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 10000) { no(new Error('too big')); req.destroy(); } }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { no(new Error('bad json')); } }); });
const subjects = () => BANK.map(s => ({ subject: s.subject, boards: s.boards.filter(b => b.topics.some(t => t.qs.length)).map(b => ({ board: b.board })) })).filter(s => s.boards.length);
const SUBJECTS = BANK.map(s => s.subject);
const cleanYS = b => { const year = Number(b.year), subs = Array.isArray(b.subjects) ? [...new Set(b.subjects.map(String))].filter(s => SUBJECTS.includes(s)) : []; return { year: [9, 10, 11, 12, 13].includes(year) ? year : null, subjects: subs }; };
const authId = req => db.userFromToken((req.headers.authorization || '').replace(/^Bearer /i, ''));

module.exports = async function api(req, res) {
  const u = new URL(req.url, 'http://x'), p = u.pathname, ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (p === '/api/config') return out(res, 200, { accounts: db.enabled() });
    if (p === '/api/subjects') return out(res, 200, subjects());
    if (p === '/api/diag') { if (limited(ip, 'diag', 20)) return out(res, 429, { error: 'Slow down.' }); return out(res, 200, { accounts: db.enabled(), ...(await db.diag()) }); }
    if (!db.enabled()) return out(res, 503, { error: 'Accounts are not set up on this server yet.' });

    if (p === '/api/signup' && req.method === 'POST') {
      if (limited(ip, 'signup', 5)) return out(res, 429, { error: 'Too many attempts. Try again in a minute.' });
      const b = await body(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || ''), name = String(b.displayName || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out(res, 400, { error: 'Enter a valid email address.' });
      if (pw.length < 8) return out(res, 400, { error: 'Password must be at least 8 characters.' });
      if (!/^[A-Za-z0-9 -]{3,16}$/.test(name)) return out(res, 400, { error: 'Display name: 3 to 16 letters, numbers, spaces or hyphens.' });
      const ys = cleanYS(b);
      if (!ys.year) return out(res, 400, { error: 'Choose your year group.' });
      if (!ys.subjects.length) return out(res, 400, { error: 'Choose at least one subject you study.' });
      if (await db.nameTaken(name)) return out(res, 409, { error: 'That display name is taken. Try another.' });
      const r = await db.signUp(email, pw);
      if (!r.ok) return out(res, 400, { error: r.error });
      if (!(await db.createProfile(r.id, name, ys.year, ys.subjects))) return out(res, 400, { error: 'Could not create the account. If you already have one, sign in instead.' });
      return out(res, 200, { session: r.session, message: 'Account created. Check your email to confirm it, then sign in.' });
    }
    if (p === '/api/login' && req.method === 'POST') {
      if (limited(ip, 'login', 10)) return out(res, 429, { error: 'Too many attempts. Try again in a minute.' });
      const b = await body(req), r = await db.signIn(String(b.email || '').trim().toLowerCase(), String(b.password || ''));
      if (!r.ok) return out(res, 401, { error: r.code === 'email_not_confirmed' ? 'Please confirm your email first, then sign in.' : 'Wrong email or password.' });
      return out(res, 200, { session: r.session });
    }
    if (p === '/api/refresh' && req.method === 'POST') {
      const b = await body(req), s = await db.refresh(String(b.refresh_token || ''));
      return s ? out(res, 200, { session: s }) : out(res, 401, { error: 'Please sign in again.' });
    }
    if (p === '/api/leaderboard') {
      const period = u.searchParams.get('period'), subject = u.searchParams.get('subject') || '', board = u.searchParams.get('board') || '';
      if (!['daily', 'weekly', 'alltime', 'streak'].includes(period)) return out(res, 400, { error: 'Bad request.' });
      if (period !== 'streak' && !subjects().some(s => s.subject === subject && s.boards.some(b => b.board === board))) return out(res, 400, { error: 'Bad request.' });
      const rows = await db.leaderboard({ p_period: period, p_subject: subject, p_board: board, p_date: db.ukDate(), p_limit: 20 });
      return out(res, 200, { rows: rows.map(r => ({ name: r.display_name, score: Number(r.score) })) });
    }
    const id = await authId(req);
    if (!id) return out(res, 401, { error: 'Please sign in again.' });
    if (p === '/api/me') {
      const pr = await db.getProfile(id); if (!pr) return out(res, 404, { error: 'Profile not found.' });
      const today = db.ukDate(), yest = new Date(Date.parse(today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
      const live = pr.last_daily === today || pr.last_daily === yest;
      return out(res, 200, { display_name: pr.display_name, streak: live ? pr.current_streak : 0, year: pr.year, subjects: pr.subjects || [], best: pr.best_streak, total: pr.total_points, games: pr.games_played, doneToday: await db.doneToday(id, today) });
    }
    if (p === '/api/profile' && req.method === 'POST') {
      const ys = cleanYS(await body(req));
      if (!ys.year || !ys.subjects.length) return out(res, 400, { error: 'Choose your year group and at least one subject.' });
      return (await db.updateProfile(id, ys.year, ys.subjects)) ? out(res, 200, { ok: true }) : out(res, 500, { error: 'Could not save. Try again.' });
    }
    if (p === '/api/delete' && req.method === 'POST') return (await db.deleteUser(id)) ? out(res, 200, { ok: true }) : out(res, 500, { error: 'Could not delete the account. Try again.' });
    return out(res, 404, { error: 'Not found.' });
  } catch (e) { return out(res, 500, { error: 'Something went wrong. Please try again.' }); }
};
