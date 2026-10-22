/* p4d: player stats. Every card belongs to one player in the line: their own kind's cards are theirs,
   and league cards are handed out to whoever has the fewest. Damage, Block, kills and points a card makes
   are credited to its owner; everything else (Plague, Burn, trophies, the field) goes to the line. */
const STAT_KEYS = { c: 'Cards played', d: 'Damage', b: 'Block', k: 'Kills', p: 'Points' };
function assignOwners() {
  if (!RUN) return;
  const kinds = RUN.party.map(p => p.kind), count = {}; kinds.forEach(k => count[k] = 0);
  for (const c of RUN.deck) if (c.own && count[c.own] != null) count[c.own]++;
  for (const c of RUN.deck) {
    if (c.own) continue;
    const k = CARDS[c.id].kind;
    if (kinds.includes(k) || (RUN.extra || []).includes(k)) { c.own = k; if (count[k] != null) count[k]++; continue; }
    if (k !== 'any') continue;
    const low = kinds.slice().sort((a, b) => count[a] - count[b] || (R() - .5))[0];
    c.own = low; count[low]++;
  }
}
function ownerOf(card) {
  if (card.own) return card.own;
  const k = def(card).kind;
  if (RUN && (RUN.party.some(p => p.kind === k) || (RUN.extra || []).includes(k))) return k;
  return 'line';
}
function credit(stat, n) {
  if (!B || !B.ps || !n) return;
  const who = B.who || 'line';
  const o = B.ps[who] = B.ps[who] || { c: 0, d: 0, b: 0, k: 0, p: 0 };
  o[stat] += n;
}
function memberName(kind) { const m = RUN && RUN.party.find(p => p.kind === kind); return m ? m.n : kind === 'line' ? 'The line' : KIND_NAME[kind] || kind; }
// player of the game: most damage, then points, then Block
function mvpOf(ps) {
  let best = null, bv = -1;
  for (const [k, o] of Object.entries(ps || {})) { if (k === 'line') continue; const v = o.d + o.p * 6 + o.b * .4 + o.k * 5; if (v > bv) { bv = v; best = k; } }
  return bv > 0 ? best : null;
}
// totals across a run's games, per player and for the whole line
function seasonTotals(games) {
  const T = { line: { c: 0, d: 0, b: 0, k: 0, p: 0, mvp: 0, best: 0 } };
  for (const g of games || []) for (const [k, o] of Object.entries(g.ps || {})) {
    const t = T[k] = T[k] || { c: 0, d: 0, b: 0, k: 0, p: 0, mvp: 0, best: 0 };
    for (const s of Object.keys(STAT_KEYS)) t[s] += o[s] || 0;
    if (k !== 'line') t.best = Math.max(t.best, o.d || 0);
    if (g.mvp === k) t.mvp++;
  }
  return T;
}
// careers: each named player across every run they have been drafted into
function loadCareers() { try { return JSON.parse(localStorage.getItem(pkey('sd-players')) || 'null') || {}; } catch (e) { return {}; } }
function updateCareers(result) {
  const C = loadCareers(), T = seasonTotals(RUN.games);
  for (const p of RUN.party) {
    const key = `${RUN.club}:${p.n}`, t = T[p.kind] || { c: 0, d: 0, b: 0, k: 0, p: 0, mvp: 0, best: 0 };
    const c = C[key] = C[key] || { n: p.n, kind: p.kind, club: RUN.club, num: p.num, runs: 0, cups: 0, games: 0, c: 0, d: 0, b: 0, k: 0, p: 0, mvp: 0, best: 0, hist: [] };
    c.runs++; if (result === 'win') c.cups++;
    c.games += (RUN.games || []).length;
    for (const s of Object.keys(STAT_KEYS)) c[s] += t[s] || 0;
    c.mvp += t.mvp || 0; c.best = Math.max(c.best, t.best || 0);
    c.hist.push({ when: Date.now(), g: (RUN.games || []).length, d: t.d || 0, b: t.b || 0, p: t.p || 0, k: t.k || 0, c: t.c || 0, cup: result === 'win' ? 1 : 0 });
    c.hist = c.hist.slice(-30);
  }
  try { localStorage.setItem(pkey('sd-players'), JSON.stringify(C)); } catch (e) { }
}
