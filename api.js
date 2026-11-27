// JSON API for accounts, profiles and leaderboards.
const BANK = require('./bank'), db = require('./db');
const hits = new Map();
const limited = (ip, key, max) => { const k = ip + key, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < 60000); a.push(now); hits.set(k, a); return a.length > max; };
setInterval(() => hits.clear(), 600000).unref();
const out = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 10000) { no(new Error('too big')); req.destroy(); } }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { no(new Error('bad json')); } }); });
const subjects = () => BANK.map(s => ({ subject: s.subject, boards: s.boards.filter(b => b.topics.some(t => t.qs.length)).map(b => ({ board: b.board })) })).filter(s => s.boards.length);
const CURRICULUM = {
  GCSE: ['Maths','English Language','English Literature','Combined Science','Biology','Chemistry','Physics','Geography','History','French','Spanish','Computer Science','Business Studies','PE','RS','Music'],
  'A-level': ['Maths','English Literature','English Language','Chemistry','Biology','Physics','Psychology','History','Geography','Politics','Economics','French','Spanish','Business','Sociology']
};
const EXAM_BOARDS = ['AQA','Pearson Edexcel','OCR','Eduqas','WJEC','CCEA'];
// Only offer subject/qualification board combinations for which specification material
// has been supplied. Other subjects remain selectable while their specification is pending.
const SUBJECT_BOARDS = {
  GCSE: {
    'Maths': ['AQA','Edexcel'], 'Combined Science': ['AQA'],
    'Geography': ['AQA','Edexcel'], 'History': ['Edexcel'],
    'French': ['AQA'], 'Business Studies': ['AQA','Edexcel'], 'RS': ['AQA']
  },
  'A-level': { 'Maths': ['AQA','Edexcel'], 'History': ['Edexcel'] }
};
const boardsFor = (qualification, subject) => (SUBJECT_BOARDS[qualification] || {})[subject] || [];
const cleanYS = b => {
  const year = Number(b.year), qualification = [9,10,11].includes(year) ? 'GCSE' : [12,13].includes(year) ? 'A-level' : null;
  const allowed = qualification ? CURRICULUM[qualification] : [];
  const subs = Array.isArray(b.subjects) ? [...new Set(b.subjects.map(String))].filter(s => allowed.includes(s)) : [];
  const rawBoards = b.subjectBoards && typeof b.subjectBoards === 'object' && !Array.isArray(b.subjectBoards) ? b.subjectBoards : {};
  const subjectBoards = {};
  for (const subject of subs) {
    const available = boardsFor(qualification, subject);
    const saved = rawBoards[subject] === 'Pearson Edexcel' ? 'Edexcel' : rawBoards[subject];
    if (available.includes(saved)) subjectBoards[subject] = saved;
    else if (available.length === 1) subjectBoards[subject] = available[0];
  }
  return { year: qualification ? year : null, qualification, subjects: subs, subjectBoards };
};
const authId = req => db.userFromToken((req.headers.authorization || '').replace(/^Bearer /i, ''));

module.exports = async function api(req, res) {
  const u = new URL(req.url, 'http://x'), p = u.pathname, ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (p === '/api/config') return out(res, 200, { accounts: db.enabled() });
    if (p === '/api/subjects') return out(res, 200, subjects());
    if (p === '/api/curriculum') return out(res, 200, { curriculum: CURRICULUM, examBoards: EXAM_BOARDS, subjectBoards: SUBJECT_BOARDS });
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
      const nt = await db.nameTaken(name);
      if (nt.error) return out(res, 500, { error: `Database problem (HTTP ${nt.error}: ${nt.message}). Run schema.sql in Supabase, then try again.` });
      if (nt.taken) return out(res, 409, { error: 'That display name is taken. Try another.' });
      const r = await db.signUp(email, pw);
      if (!r.ok) return out(res, 400, { error: r.error });
      const cp = await db.createProfile(r.id, name, ys.year, ys.subjects, ys.qualification, ys.subjectBoards);
      if (!cp.ok) return out(res, 200, { session: r.session, needsProfile: true, message: 'Your login was created but your profile still needs finishing. Confirm your email if asked, then sign in.' });
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
      const pr = await db.getProfile(id); if (!pr) return out(res, 404, { error: 'Profile not found.', code: 'no_profile' });
      const today = db.ukDate(), yest = new Date(Date.parse(today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
      const live = pr.last_daily === today || pr.last_daily === yest;
      return out(res, 200, { display_name: pr.display_name, streak: live ? pr.current_streak : 0, year: pr.year, qualification: pr.qualification || ([9,10,11].includes(pr.year) ? 'GCSE' : 'A-level'), subjects: pr.subjects || [], subjectBoards: pr.subject_boards || {}, best: pr.best_streak, total: pr.total_points, games: pr.games_played, doneToday: await db.doneToday(id, today) });
    }
    if (p === '/api/setup' && req.method === 'POST') {
      if (await db.getProfile(id)) return out(res, 409, { error: 'Your profile already exists.' });
      const b = await body(req), name = String(b.displayName || '').trim(), ys = cleanYS(b);
      if (!/^[A-Za-z0-9 -]{3,16}$/.test(name)) return out(res, 400, { error: 'Display name: 3 to 16 letters, numbers, spaces or hyphens.' });
      if (!ys.year) return out(res, 400, { error: 'Choose your year group.' });
      if (!ys.subjects.length) return out(res, 400, { error: 'Choose at least one subject you study.' });
      const nt = await db.nameTaken(name);
      if (nt.error) return out(res, 500, { error: `Database problem (HTTP ${nt.error}: ${nt.message}). Run schema.sql in Supabase, then try again.` });
      if (nt.taken) return out(res, 409, { error: 'That display name is taken. Try another.' });
      const cp = await db.createProfile(id, name, ys.year, ys.subjects, ys.qualification, ys.subjectBoards);
      return cp.ok ? out(res, 200, { ok: true }) : out(res, 500, { error: `Could not save your profile (HTTP ${cp.status}). If you ran schema.sql before the year and subjects update, run update.sql in Supabase.` });
    }
    if (p === '/api/profile' && req.method === 'POST') {
      const ys = cleanYS(await body(req));
      if (!ys.year || !ys.subjects.length) return out(res, 400, { error: 'Choose your year group and at least one subject.' });
      return (await db.updateProfile(id, ys.year, ys.subjects, ys.qualification, ys.subjectBoards)) ? out(res, 200, { ok: true }) : out(res, 500, { error: 'Could not save. Try again.' });
    }
    if (p.startsWith('/api/revision/')) {
      const profile = await db.getProfile(id);
      if (!profile) return out(res, 404, { error: 'Profile not found.' });
      const qualification = profile.qualification || ([9,10,11].includes(profile.year) ? 'GCSE' : 'A-level');
      if (p === '/api/revision/topics' && req.method === 'GET') {
        const subject = String(u.searchParams.get('subject') || '');
        const board = String(u.searchParams.get('board') || (profile.subject_boards || {})[subject] || 'AQA');
        if (!(profile.subjects || []).includes(subject)) return out(res, 403, { error: 'That subject is not on your account.' });
        const topics = await db.listRevisionTopics(qualification, subject, board);
        if (topics === null) return out(res, 500, { error: 'Could not load revision topics. Check that the revision database tables have been added.' });
        const progress = await db.getTopicProgress(id, topics.map(t => t.id));
        if (progress === null) return out(res, 500, { error: 'Could not load your topic progress.' });
        const byTopic = Object.fromEntries(progress.map(x => [x.topic_id, x.confidence]));
        return out(res, 200, { qualification, subject, board, topics: topics.map(t => ({ ...t, confidence: byTopic[t.id] || null })) });
      }
      if (p === '/api/revision/topic' && req.method === 'GET') {
        const topicId = String(u.searchParams.get('id') || '');
        const topic = await db.getRevisionTopic(topicId);
        if (!topic || topic.qualification !== qualification || !(profile.subjects || []).includes(topic.subject)) return out(res, 404, { error: 'Revision topic not found for your subjects.' });
        const [note, questions, progress] = await Promise.all([db.getRevisionNote(topicId), db.getRevisionQuestions(topicId), db.getTopicProgress(id, [topicId])]);
        if (questions === null || progress === null) return out(res, 500, { error: 'Could not load this revision topic.' });
        return out(res, 200, { topic, note, questions, confidence: progress[0] ? progress[0].confidence : null });
      }
      if (p === '/api/revision/confidence' && req.method === 'POST') {
        const b = await body(req), topicId = String(b.topicId || ''), confidence = String(b.confidence || '');
        if (!['confident','somewhat','unsure'].includes(confidence)) return out(res, 400, { error: 'Choose one of the confidence options.' });
        const topic = await db.getRevisionTopic(topicId);
        if (!topic || topic.qualification !== qualification || !(profile.subjects || []).includes(topic.subject)) return out(res, 404, { error: 'Revision topic not found for your subjects.' });
        return (await db.saveTopicConfidence(id, topicId, confidence)) ? out(res, 200, { ok: true }) : out(res, 500, { error: 'Could not save your confidence rating.' });
      }
      if (p === '/api/revision/attempt' && req.method === 'POST') {
        const b = await body(req), questionId = String(b.questionId || ''), awarded = Number(b.marksAwarded);
        const question = await db.getExamQuestion(questionId);
        if (!question || !Number.isInteger(awarded) || awarded < 0 || awarded > question.marks) return out(res, 400, { error: 'Enter a valid mark for this question.' });
        const topic = await db.getRevisionTopic(question.topic_id);
        if (!topic || topic.qualification !== qualification || !(profile.subjects || []).includes(topic.subject)) return out(res, 403, { error: 'That question is not in your subjects.' });
        return (await db.recordExamAttempt(id, questionId, awarded, question.marks)) ? out(res, 200, { ok: true }) : out(res, 500, { error: 'Could not save your exam result.' });
      }
      if (p === '/api/revision/summary' && req.method === 'GET') {
        const subjects = profile.subjects || [], boardMap = profile.subject_boards || {}, all = [];
        for (const subject of subjects) {
          const rows = await db.listRevisionTopics(qualification, subject, boardMap[subject] || 'AQA');
          if (rows) all.push(...rows);
        }
        const summary = await db.getRevisionSummary(id, all.map(t => t.id));
        return out(res, 200, { topics: all.length, progress: summary.progress, attempts: summary.attempts });
      }
    }
    if (p === '/api/delete' && req.method === 'POST') return (await db.deleteUser(id)) ? out(res, 200, { ok: true }) : out(res, 500, { error: 'Could not delete the account. Try again.' });
    return out(res, 404, { error: 'Not found.' });
  } catch (e) { return out(res, 500, { error: 'Something went wrong. Please try again.' }); }
};
