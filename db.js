// Talks to Supabase (accounts + database). Only the server uses the secret key.
const U = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), ANON = process.env.SUPABASE_ANON_KEY || '', SVC = process.env.SUPABASE_SERVICE_KEY || '';
const enabled = () => !!(U && ANON && SVC);
const ukDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const enc = encodeURIComponent;
const hdr = (key, token) => {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token; else if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key;
  return h;
};
async function call(path, { method = 'GET', key = SVC, token, body, prefer } = {}) {
  const h = hdr(key, token); if (prefer) h.Prefer = prefer;
  const r = await fetch(U + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) console.error('Supabase', method, path.split('?')[0], r.status, String(t).slice(0, 200));
  return { ok: r.ok, status: r.status, json: j };
}
const errMsg = (j, status) => (j && (j.msg || j.error_description || j.message || j.error)) || 'Request failed' + (status ? ' (HTTP ' + status + ')' : '');
const sess = j => j && j.access_token ? { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600) } : null;

module.exports = {
  enabled, ukDate,
  async signUp(email, password) {
    const r = await call('/auth/v1/signup', { method: 'POST', key: ANON, body: { email, password } });
    if (!r.ok) return { ok: false, error: errMsg(r.json, r.status) };
    const id = (r.json.user && r.json.user.id) || r.json.id;
    return { ok: !!id, id, session: sess(r.json), error: id ? null : 'Could not create the account.' };
  },
  async signIn(email, password) {
    const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', key: ANON, body: { email, password } });
    return r.ok ? { ok: true, session: sess(r.json) } : { ok: false, error: errMsg(r.json, r.status), code: r.json && r.json.error_code };
  },
  async refresh(refresh_token) {
    const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', key: ANON, body: { refresh_token } });
    return r.ok ? sess(r.json) : null;
  },
  async userFromToken(token) {
    if (!token) return null;
    const r = await call('/auth/v1/user', { key: ANON, token });
    return r.ok && r.json && r.json.id ? r.json.id : null;
  },
  async getProfile(id) { const r = await call(`/rest/v1/profiles?id=eq.${enc(id)}&select=*`); return (r.ok && r.json && r.json[0]) || null; },
  async nameTaken(n) { const r = await call(`/rest/v1/profiles?display_name=ilike.${enc(n)}&select=id&limit=1`); return { error: r.ok ? 0 : r.status, message: r.ok ? '' : String((r.json && (r.json.message || r.json.hint)) || '').slice(0, 140), taken: !!(r.ok && r.json && r.json.length) }; },
  async createProfile(id, name, year, subjects, subject_boards = {}) { return call('/rest/v1/profiles', { method: 'POST', body: { id, display_name: name, year, subjects, subject_boards }, prefer: 'return=minimal' }); },
  async updateProfile(id, year, subjects, subject_boards = {}) { return (await call(`/rest/v1/profiles?id=eq.${enc(id)}`, { method: 'PATCH', body: { year, subjects, subject_boards }, prefer: 'return=minimal' })).ok; },
  async diag() {
    const o = { urlLooksRight: /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(U), publishableKeyLooksRight: /^(eyJ|sb_publishable_)/.test(ANON), secretKeyLooksRight: /^(eyJ|sb_secret_)/.test(SVC), keysAreDifferent: !!ANON && ANON !== SVC };
    try { const r = await call('/auth/v1/settings', { key: ANON }); o.authStatus = r.status; if (r.json) { o.signupsDisabled = !!r.json.disable_signup; o.emailConfirmationOff = !!r.json.mailer_autoconfirm; if (!r.ok) o.authMessage = String(r.json.message || r.json.msg || '').slice(0, 120); } }
    catch (e) { o.authError = String(e.message || e).slice(0, 100); }
    try { const r = await call('/rest/v1/profiles?select=id&limit=1'); o.databaseStatus = r.status; if (!r.ok && r.json) o.databaseMessage = String(r.json.message || r.json.hint || '').slice(0, 140); }
    catch (e) { o.databaseError = String(e.message || e).slice(0, 100); }
    try { const r = await call('/rest/v1/rpc/leaderboard', { method: 'POST', body: { p_period: 'alltime', p_subject: 'x', p_board: 'x', p_date: ukDate(), p_limit: 1 } }); o.functionsStatus = r.status; if (!r.ok && r.json) o.functionsMessage = String(r.json.message || r.json.hint || '').slice(0, 140); }
    catch (e) { o.functionsError = String(e.message || e).slice(0, 100); }
    return o;
  },
  async hasPlayed(id, date, s, b) { const r = await call(`/rest/v1/daily_scores?user_id=eq.${enc(id)}&play_date=eq.${date}&subject=eq.${enc(s)}&board=eq.${enc(b)}&select=score`); return !!(r.ok && r.json && r.json.length); },
  async doneToday(id, date) { const r = await call(`/rest/v1/daily_scores?user_id=eq.${enc(id)}&play_date=eq.${date}&select=subject,board,score`); return (r.ok && r.json) || []; },
  async recordDaily(o) { const r = await call('/rest/v1/rpc/record_daily', { method: 'POST', body: o }); if (!r.ok) throw new Error(errMsg(r.json)); return r.json; },
  async leaderboard(o) { const r = await call('/rest/v1/rpc/leaderboard', { method: 'POST', body: o }); return (r.ok && r.json) || []; },
  async deleteUser(id) { return (await call('/auth/v1/admin/users/' + enc(id), { method: 'DELETE' })).ok; }
};
