// Answer matching: lenient on wording, order, extra words and small typos.
const STOP = new Set('a an the of to and or in on for by with is are it its their there this that these those use used using can could be as at from some any very really just also lot lots many much make makes making it s'.split(' '));
const SYN = { cut: 'reduce', lower: 'reduce', decrease: 'reduce', limit: 'reduce', fewer: 'reduce', less: 'reduce', co2: 'carbon dioxide', neuron: 'neurone', meter: 'metre', colour: 'color', sulphur: 'sulfur', aluminum: 'aluminium', defence: 'defense' };

function lev(a, b) {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let p = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; }
  }
  return d[b.length];
}
function stem(w) {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}
function toks(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w))
    .map(w => SYN[w] || w).join(' ').split(' ').filter(Boolean).map(stem);
}
function same(a, b) {
  if (a === b) return true;
  const n = Math.max(a.length, b.length);
  return a.length >= 5 && b.length >= 5 && lev(a, b) <= (n >= 9 ? 2 : 1);
}
const build = q => [...q.h.map(x => ({ tier: 50, al: x.split('|') })), ...q.s.map(x => ({ tier: 10, al: x.split('|') }))];
function match(entries, input) {
  const at = toks(input); if (!at.length) return -1;
  for (let i = 0; i < entries.length; i++) for (const al of entries[i].al) {
    const bt = toks(al); if (!bt.length) continue;
    // every key word of the accepted answer appears somewhere in the player's answer
    if (bt.every(b => at.some(a => same(a, b)))) return i;
    // the player gave a clear part of a longer accepted answer
    if (at.length < bt.length && (at.length >= 2 || at[0].length >= 7) && at.every(a => bt.some(b => same(a, b)))) return i;
  }
  return -1;
}
module.exports = { build, match };
