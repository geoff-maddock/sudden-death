/* The Anvil Ring: situation powers and curses (issue #115, phase 3). Nothing here acts unless a bout is started with
   opts.bxpow ({ on: [bool, bool] (which sides have them; both when left out), sit, curse (each on unless false) }; the
   Realm sends it, a card passes it to every bout): with G.bxp
   unset every hook passes straight through and nothing draws from the seeded stream, so a bout plays exactly as before.
   G.bxp = { on, sit, curse, used: [{ k: true }, …], casts: [{ side, k, id, round, t, why }], wash: [n, n] }, plain data.
   - Situation powers (BX_SIT), the corner's, once a bout each, paid with spirit (and a little stamina, as boxing's powers
     are), in a round when the moment fits (bxSitMoment): Off the Canvas (just up from a knockdown), the Last Round
     (behind or level on the cards) and Saved by the Bell (hurt, with the bell close). Each leaves a status on the
     fighter (f.fx, as a special does; the bell clears it). The CPU casts them by its skill (bxSitCpu, from bxCpuCast),
     and so does your fighter in You corner (a Knight's); in You box you press them (bxSitYou). Every cast goes in the
     log with its reason (✦).
   - Curses (BX_CURSE by kind; a superstar's in ring/r0-stars.js; a fighter bringing its own powers, f.pw, curses with
     f.pw.cu or not at all): a third power beside the special and the ultimate, once a bout, for BX_SPIRIT.cu spirit and
     no stamina, cast on the other fighter (not one already cursed). It stays on them (f.curse, plain JSON, so it is
     saved with the bout) for the rest of the round and all of the next, unless their cut-man washes it off at the break
     in place of a patch (the cut-man's one job that break: bxWash, bxWashCpu). It ends at the bell of its last round
     (bxCurseBell); one cast in the last round lasts the bout. Four kinds (k), by what they do (fx, read by bxFx with the
     statuses): slow (their punches and slips slower: spd), leaky (their guard lets twice as much through: leaky), tired
     (their breath comes back slower: regK, 05-ring.js) and dear (their next special or ultimate costs more spirit:
     spDear, bxSpCost in 11-powers.js; paid off, it is gone). The CPU casts by its skill (bxCurseCpu: early in a round,
     never on a fighter already cursed) and washes by it; your corner says when to wash (G.wait.wash).
   A curse shows on the fighter (a violet ☾ and its name over them) and on the bar with their statuses. */
const BX_SIT = {
  canvas: { n: 'Off the Canvas', cost: { spirit: 10, sta: 0 }, desc: 'Just up from a knockdown, with the crowd behind them: 20 stamina back, and for 5 seconds their punches do 20% more.', mySta: 20, fx: { t: 5, dmgOut: 1.2 } },
  last: { n: 'The Last Round', cost: { spirit: 20, sta: 6 }, desc: 'The last round, behind or level on the cards: everything left, 15% quicker to punch and 10% quicker on their feet for 8 seconds.', fx: { t: 8, spd: 1.15, move: 1.1 } },
  bell: { n: 'Saved by the Bell', cost: { spirit: 10, sta: 0 }, desc: 'Hurt (under a third of their health) with under 10 seconds left in the round: hands high and hold on, punches do 35% less to them till the bell.', fx: { t: 0, dmgIn: .65 } },
};
const BX_SIT_WIN = { canvas: 6, bell: 10, hurt: .34 };
// what each kind of curse does (a curse's own fx may say otherwise)
const BX_CURSE_K = { slow: 'their punches slower', leaky: 'their guard leakier', tired: 'their breath slower to come back', dear: 'their next special or ultimate dearer' };
const BX_CURSE = {
  witch:   { id: 'evileye', n: 'Evil Eye', k: 'dear', desc: 'The evil eye: their next special or ultimate costs 15 more spirit.', fx: { spDear: 15 } },
  lich:    { id: 'withering', n: 'Withering Curse', k: 'tired', desc: 'Their breath comes back 35% slower.', fx: { regK: .65 } },
  wraith:  { id: 'gravecurse', n: 'Grave Curse', k: 'slow', desc: 'A chill in their arms: their punches and slips 12% slower.', fx: { spd: .88 } },
  vampire: { id: 'thrallmark', n: 'Thrall\'s Mark', k: 'leaky', desc: 'Half in thrall: their guard lets twice as much through.', fx: { leaky: 1 } },
  gorgon:  { id: 'stonecurse', n: 'Stone Curse', k: 'slow', desc: 'Their arms half to stone: their punches and slips 12% slower.', fx: { spd: .88 } },
  zombie:  { id: 'rotcurse', n: 'Rot Curse', k: 'tired', desc: 'The rot gets in: their breath comes back 35% slower.', fx: { regK: .65 } },
  goblin:  { id: 'jinx', n: 'Jinx', k: 'leaky', desc: 'A goblin jinx: their guard lets twice as much through.', fx: { leaky: 1 } },
};
// the chance, by CPU skill, each time a fighter thinks while a situation power fits (a short window wants it soon), and a curse's
const BX_POWK = { sit: [.02, .05, .1, .15], curse: [.02, .04, .07, .1] };
const bxSkill = f => G.skill ? G.skill[f.side] : 1;

function bxpNew(P) {
  if (!P) return null;
  return { on: Array.isArray(P.on) ? [!!P.on[0], !!P.on[1]] : [true, true], sit: P.sit !== false, curse: P.curse !== false, used: [{}, {}], casts: [], wash: [0, 0] };
}
const bxMoreStart0 = bxStart;
bxStart = function (opts) {
  const g = bxMoreStart0.apply(this, arguments), P = bxpNew(opts && opts.bxpow);
  if (P) G.bxp = P;
  return g;
};
// (the lab and the Realm read what was cast from the summary)
const bxMoreSummary0 = bxSummary;
bxSummary = function () { const s = bxMoreSummary0.apply(this, arguments); if (G.bxp) s.bxp = JSON.parse(JSON.stringify(G.bxp)); return s; };
function bxMoreLog(f, k, id, n, why) {
  G.bxp.casts.push({ side: f.side, k, id, round: G.round, t: Math.round((BX_RULES.secs - G.clock) * 10) / 10, why: why || '' });
  f.rs.pw++;
  bxEv('cast', f.side, { id, n, ult: false, k });
  bxLog(`✦ ${f.n}: ${n}${why ? ` (${why})` : ''}.`, true);
  if (!BD.headless && BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
}
// side s's lead on the judges' cards: + ahead, − behind, 0 level (by judges)
const bxLead = s => bxTotals().reduce((n, t) => n + Math.sign(s ? t[1] - t[0] : t[0] - t[1]), 0);

/* ---------- situation powers ---------- */
// '' when the moment fits fighter f for power k (spirit and once a bout aside), or why not
function bxSitMoment(f, k) {
  if (k === 'canvas') return f.rose != null && G.secs - f.rose <= BX_SIT_WIN.canvas ? '' : 'only just up from a knockdown';
  if (k === 'last') return G.round === G.rounds && bxLead(f.side) <= 0 ? '' : 'only in the last round, behind or level on the cards';
  if (k === 'bell') return G.clock <= BX_SIT_WIN.bell && f.hp < f.hpMax * BX_SIT_WIN.hurt ? '' : 'only hurt, with the bell close';
  return 'no such power';
}
function bxSitWhy(f, k) {
  const B = G && G.bxp, S = BX_SIT[k]; if (!S) return 'no such power';
  if (!B || !B.sit || !B.on[f.side] || !bxPowOn()) return 'situation powers are off';
  if (B.used[f.side][k]) return 'once a bout';
  if (!BD || BD.ph !== 'round') return 'only in a round';
  if (f.a.k === 'down' || G.down != null) return 'not while down';
  const m = bxSitMoment(f, k); if (m) return m;
  if (bxSpirit(f) < S.cost.spirit) return 'needs spirit';
  if (f.sta < S.cost.sta) return 'no breath';
  return '';
}
// the moment, in words, for the log
function bxSitNow(f, k) {
  if (k === 'canvas') return `up from knockdown ${G.kd[f.side]}`;
  if (k === 'last') { const l = bxLead(f.side); return l < 0 ? 'behind on the cards' : 'level on the cards'; }
  if (k === 'bell') { const t = Math.ceil(G.clock); return `${Math.round(f.hp)} health, ${t} second${t === 1 ? '' : 's'} left`; }
  return '';
}
function bxSitCast(f, k, why) {
  const S = BX_SIT[k];
  f.spirit = bxSpirit(f) - S.cost.spirit; f.sta = Math.max(0, f.sta - S.cost.sta); G.bxp.used[f.side][k] = true;
  if (S.mySta) f.sta = Math.min(f.staMax, f.sta + S.mySta);
  // (Saved by the Bell lasts till the bell)
  const fx = Object.assign({ id: 'sit:' + k, n: S.n, from: f.side }, S.fx, k === 'bell' ? { t: G.clock + .1 } : {});
  f.fx = (f.fx || []).filter(x => x.id !== fx.id).concat([fx]);
  bxMoreLog(f, 'sit', k, S.n, why);
  return true;
}
// the CPU's, and your fighter's in You corner (as a Knight would): when one fits, now or soon
function bxSitCpu(f) {
  const want = BX_POWK.sit[Math.min(3, bxSkill(f))];
  for (const k of Object.keys(BX_SIT)) if (!bxSitWhy(f, k) && R() < want) return bxSitCast(f, k, bxSitNow(f, k));
  return false;
}
// yours, pressed in You box: '' when it went, or why not
function bxSitYou(k) {
  if (!G || !G.F || !BD) return 'no bout on';
  const f = G.F[BD.you], why = bxSitWhy(f, k); if (why) return why;
  bxSitCast(f, k, bxSitNow(f, k)); return '';
}
// up from a knockdown: when, for Off the Canvas
const bxMoreRise0 = bxRise;
bxRise = function () { const s = G.down, r = bxMoreRise0.apply(this, arguments); if (G.bxp && s != null) G.F[s].rose = G.secs; return r; };

/* ---------- curses ---------- */
function bxCurseOf(f) {
  if (!G || !G.bxp || !G.bxp.curse || !G.bxp.on[f.side] || !bxPowOn()) return null;
  return f.pw ? f.pw.cu || null : BX_CURSE[f.kind] || null;
}
function bxCanCurse(f) {
  const P = bxCurseOf(f), o = G.F[1 - f.side];
  if (!P) return { ok: false, why: 'no curse' };
  if (f.cuUsed) return { ok: false, why: 'used this bout' };
  if (BD.ph !== 'round') return { ok: false, why: 'only in a round' };
  if (['down', 'stun', 'clinch', 'grab'].includes(f.a.k) || bxPunching(f)) return { ok: false, why: 'busy' };
  if (o.a.k === 'down') return { ok: false, why: 'they are down' };
  if (o.curse) return { ok: false, why: 'they are cursed already' };
  if (bxSpirit(f) < BX_SPIRIT.cu) return { ok: false, why: 'needs spirit' };
  return { ok: true, why: '' };
}
function bxCurse(f, why) {
  if (!bxCanCurse(f).ok) return false;
  const P = bxCurseOf(f), o = G.F[1 - f.side];
  f.spirit = bxSpirit(f) - BX_SPIRIT.cu; f.cuUsed = true;
  f.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid };
  o.curse = { id: P.id, n: P.n, k: P.k, from: f.side, until: Math.min(G.round + 1, G.rounds), fx: Object.assign({ id: P.id, n: P.n }, P.fx) };
  bxMoreLog(f, 'curse', P.id, `the ${P.n} on ${o.n}`, why);
  return true;
}
function bxCurseCpu(f, o) {
  if (!bxCanCurse(f).ok) return false;
  const skill = bxSkill(f);
  // (a Knight or better curses early in a round, when it has the longest to bite, and keeps the spirit for its ultimate in the last round)
  if (skill > 0 && G.clock < 12) return false;
  if (skill > 0 && !f.ultUsed && G.round === G.rounds && bxSpirit(f) - BX_SPIRIT.cu < BX_SPIRIT.ult) return false;
  return R() < BX_POWK.curse[Math.min(3, skill)] ? bxCurse(f, G.round < G.rounds ? `round ${G.round}: it lasts into the next` : 'the last round') : false;
}
// the bell at the end of a round (from bxCorner, with the round moved on): a curse whose last round it was is gone
function bxCurseBell() {
  for (const f of G.F) if (f.curse && f.curse.until < G.round) { bxLog(`The ${f.curse.n} wears off ${f.n}.`); delete f.curse; }
}
// the cut-man washes the curse off f, in place of a patch this break
function bxWashNow(f, why) {
  const n = f.curse.n; delete f.curse; f.patched = G.round; G.bxp.wash[f.side]++;
  bxLog(`The cut-man washes the ${n} off ${f.n}${why ? `: ${why}` : ''}.`);
}
// would the corner wash rather than patch? (your corner's advice is the Knight's, with no dice in it)
function bxWashSays(f, c, skill) {
  if (!f.curse || f.patched === G.round) return false;
  const need = c.patch && f.patches > 0 && f.hp < f.hpMax * (skill >= 2 ? .4 : .5);
  return !need;
}
function bxWashCpu(f, c) {
  if (!f.curse || f.patched === G.round) return false;
  const skill = bxSkill(f);
  const go = skill === 0 ? R() < .5 : bxWashSays(f, c, skill);
  if (go) bxWashNow(f, c.patch ? 'the curse before the cut' : 'nothing to patch');
  return go;
}
// your cut-man: between rounds, once a break, instead of a patch
function bxWash() {
  const f = G && G.wait && BD.ph === 'corner' ? G.F[BD.you] : null;
  if (!f || !f.curse || f.patched === G.round) return false;
  bxWashNow(f, ''); G.wait.wash = false; G.wait.patch = false;
  if (BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
  return true;
}
const bxMoreAsk0 = bxAsk;
bxAsk = function () {
  bxMoreAsk0.apply(this, arguments);
  const f = G.F[BD.you];
  if (G.bxp && G.wait && BD.ph === 'corner' && f.curse && f.patched !== G.round) {
    const c = bxCornerCpu(f), w = bxWashSays(f, c, 1);
    G.wait.wash = w; if (w) G.wait.patch = false;
    if (BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
  }
};
// (switching to Corners mid-break takes your corner's advice: the wash too)
const bxMoreSetMode0 = bxSetMode;
bxSetMode = function (m) { if (m === 'watch' && G && G.wait && G.wait.wash) bxWash(); return bxMoreSetMode0.apply(this, arguments); };

/* ---------- the CPU, and your fighter in You corner ---------- */
const bxMoreCpu0 = bxCpuCast;
bxCpuCast = function (f, o) {
  if (G.bxp && BD.ph === 'round' && (bxSitCpu(f) || bxCurseCpu(f, o))) return true;
  return bxMoreCpu0.apply(this, arguments);
};

/* ---------- what the page shows ---------- */
// a fighter's curse and situation powers now: { cu: { id, n, desc, ok, why, used } | null, on: their curse or null, sit: [{ k, n, desc, ok, why, fits }] }
function bxMoreState(f) {
  const P = bxCurseOf(f), c = P ? bxCanCurse(f) : null, B = G.bxp;
  return { cu: P ? { id: P.id, n: P.n, k: P.k, desc: P.desc, ok: c.ok, why: c.why, used: !!f.cuUsed } : null,
    on: f.curse ? { id: f.curse.id, n: f.curse.n, k: f.curse.k, until: f.curse.until } : null,
    sit: B && B.sit && B.on[f.side] ? Object.keys(BX_SIT).map(k => { const why = bxSitWhy(f, k); return { k, n: BX_SIT[k].n, desc: BX_SIT[k].desc, ok: !why, why, fits: !bxSitMoment(f, k) && !B.used[f.side][k] }; }) : [] };
}
// the curse over the cursed fighter: a violet ☾ and its name
const bxMoreFighter0 = bxDrawFighter;
bxDrawFighter = function (c, f, o) {
  bxMoreFighter0.apply(this, arguments);
  if (!f.curse || f.a.k === 'down') return;
  const p = bxProj(f.x, f.y), y = p.y - (bxYourCorner() && f.side === BD.you ? 128 : 106) * p.k;
  c.save(); c.globalAlpha = .82 + .18 * Math.sin(BXT.t * 3);
  c.font = `800 ${Math.round(15 * p.k)}px "Alegreya Sans", sans-serif`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = 'rgba(24,10,40,.9)';
  c.strokeText(`☾ ${f.curse.n}`, p.x, y); c.fillStyle = '#d4b8ff'; c.fillText(`☾ ${f.curse.n}`, p.x, y);
  c.restore();
};
