/* Cinder Gridiron: one drive (issue #9, phase 1). The first side has the ball on its own 25 and drives until it
   scores, kicks, punts or gives the ball up. Each down goes call → pre (both calls shown) → live (the play) → post
   (the result) → the next call. On fourth down the coach decides (07-cpu.js), and a kick is its own beat.
   mode 'watch': the coaches call both sides. mode 'call': you call the offense (gfCall), and the defense is the CPU's;
   mode 'play' is 'call', and then you play your offense by hand (11-play.js);
   on any down your call may be a punt or, in range (GF_FG_MAX), a field goal, and fourth down waits for you too.
   In a full game (10-game.js) you call the defense too when the other side has the ball.
   Each result says what happened and why (GD.why: the matchup and the play's story), and goes in the drive's log.
   With the calls, each side may cast a power (14-powers.js): yours is GD.pow (your pick) or Auto powers' (GD.auto);
   GD.cast is what both sides cast for the play on show, and GD.stc the stances both sides play it in (16-stance.js). opts.skill: the CPU's skill by side ([0..2, 0..2]).
   Swaps, potions and powers that give stamina back (15-bench.js) wait in GD.notes, and go in the next play's log line.
   GD is the drive on show (not saved: G is the game, plain JSON, with G.drive = { side, from, plays, end, yards }: side has the ball).
   The headless drive (gfSim) runs this same flow with big steps, so the view and the bot can't drift apart. */
const GF_PACE = { call: .4, pre: 1.3, post: 1.8, postCall: 2.8, kick: 1.6, half: 2.6 };
const GF_HOOK = { onOver: null, onPhase: null, onSnap: null, wantSnap: null };  // wantSnap: false skips the snapshot
let GD = null;

function gfStart(opts) {
  const o = opts || {}, T = o.teams || [];
  gfSeed(o.seed);
  gfNewGame({ poss: 0 });
  G.teams = [gfTeam(T[0] || GF_CLUBS.home), gfTeam(T[1] || GF_CLUBS.away)];
  G.skill = Array.isArray(o.skill) ? o.skill.map(n => clamp(n | 0, 0, 2)) : [1, 1];
  gfPlaybookStart(); gfBoxStart();
  // (opts.powers false: a game without them, for the balance bot)
  if (o.powers !== false) gfPowersStart();
  gfStanceStart(o.stance);
  G.drive = { side: G.poss, from: G.ball, plays: [], end: null, yards: 0 };
  L = null;
  GD = { ph: 'call', t: 0, mode: ['call', 'play'].includes(o.mode) ? o.mode : 'watch', pick: null, oc: null, dc: null, msg: '', why: '', kick: null, acc: 0, cam: G.ball + 6, you: 0, game: false, kickoff: null, next: null, auto: o.mode === 'call', pow: null, cast: null, notes: [], item: false, stc: null, wary: '' };
  return G;
}
// your call for the next down (mode 'call'); returns false when it isn't your call to make
// (a play, 'punt', or 'fg' when it is in range)
// (a play, 'punt', or 'fg' when it is in range; a defense when the other side has the ball)
function gfCall(oc) {
  if (!GD || GD.ph !== 'call' || GD.mode === 'watch' || !gfCanCall(oc)) return false;
  GD.pick = oc; return true;
}
const gfYours = () => GD.mode !== 'watch' && G.poss === GD.you;
function gfCanCall(oc) {
  if (GD.mode !== 'watch' && G.poss !== GD.you) return !!GF_DEFS[oc];
  return !!GF_PLAYS[oc] || oc === 'punt' || (oc === 'fg' && gfKickDist() <= GF_FG_MAX);
}
function gfGo(ph) {
  GD.ph = ph; GD.t = 0;
  // a new call: the coaches make their swaps first (before the save point and the page hear of it), for the CPU's
  // side, and for yours when they call it (15-bench.js); a play, a kick or a new drive: a potion may be given again
  if (ph === 'call') for (const s of [0, 1]) if (GD.mode === 'watch' || s !== GD.you) gfCpuSwaps(s, (G.skill || [1, 1])[s]);
  if (['pre', 'kick', 'kickoff', 'half'].includes(ph)) GD.item = false;
  // (a kick isn't played in a stance)
  if (['kick', 'kickoff', 'half'].includes(ph)) GD.stc = null;
  // each call is a point to save the game at (13-box.js)
  if (ph === 'call' && GF_HOOK.onSnap && (!GF_HOOK.wantSnap || GF_HOOK.wantSnap())) try { GF_HOOK.onSnap(gfSnapshot()); } catch (e) { console.error(e); }
  if (GF_HOOK.onPhase) try { GF_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}

function gfTick(dt) {
  if (!GD || GD.ph === 'over') return;
  GD.t += dt;
  if (GD.ph === 'call') {
    const mine = gfYours();
    if (!mine && G.down === GF_RULES.downs && !GD.kick) { GD.kick = gfFourth(); GD.wary = GD.kick === 'punt' && G.togo <= 2 && G.ball >= 40 ? gfFourthWary(G.poss) : ''; if (GD.kick !== 'go') return gfGo('kick'); }
    if (GD.t < GF_PACE.call || (GD.mode !== 'watch' && !GD.pick)) return;
    if (mine && (GD.pick === 'punt' || GD.pick === 'fg')) { GD.kick = GD.pick; GD.pick = null; GD.pow = null; if (gfHands()) gfMeterStart(); return gfGo('kick'); }
    GD.oc = mine ? GD.pick : gfCpuOffense(); GD.dc = GD.mode !== 'watch' && !mine ? GD.pick : gfCpuDefense(); GD.pick = null;
    GD.cast = gfCastPowers(GD.oc, GD.dc); GD.stc = Object.assign(gfPickStances(), { side: G.poss });
    GD.stale = Object.assign(gfCallsMade(GD.oc, GD.dc, GD.cast), { pw: GD.cast, stc: GD.stc });
    return gfGo('pre');
  }
  if (GD.ph === 'pre') { if (GD.t >= GF_PACE.pre) { gfSnap(GD.oc, GD.dc, GD.stale); GD.acc = 0; gfGo('live'); } return; }
  if (GD.ph === 'live') {
    GD.acc += dt;
    while (GD.acc >= GF_DT && !L.done) { GD.acc -= GF_DT; gfStep(GF_DT); }
    if (L.done) { gfResult(L.done); gfGo('post'); }
    return;
  }
  // your kick (Play mode) waits for both taps of the meter
  if (GD.ph === 'kick') { if (GD.meter ? GD.meter.st >= 2 : GD.t >= GF_PACE.kick) { gfKick(); GD.meter = null; gfGo('post'); } return; }
  if (GD.ph === 'kickoff') { if (GD.t >= GF_PACE.kick) { gfKickoff(); gfGo('post'); } return; }
  if (GD.ph === 'half') { if (GD.t >= GF_PACE.half) gfKickoffTo(GD.next); return; }
  if (GD.ph === 'post' && GD.t >= (GD.mode !== 'watch' ? GF_PACE.postCall : GF_PACE.post)) {
    // in a game the clock running out ends the drive on the field, and the game goes on to the next beat
    if (GD.game && G.clock <= 0 && !G.drive.end && G.drive.plays.length) G.drive.end = 'clock';
    if (G.drive.end && GD.game && gfGameNext()) return;
    if (G.drive.end) { gfGo('over'); if (GF_HOOK.onOver) try { GF_HOOK.onOver(GD.game ? gfGameSummary() : gfSummary()); } catch (e) { console.error(e); } }
    else { GD.kick = null; gfGo('call'); }
  }
}
const GF_ORD = ['', '1st', '2nd', '3rd', '4th'];
const gfName = (side) => G.teams[side].name;
function gfResult(r) {
  const off = G.poss, before = { down: G.down, togo: G.togo, ball: G.ball };
  const e = { oc: GD.oc, dc: GD.dc, what: r.what, gain: r.gain, by: r.by, who: r.who, ...before };
  const pw = [GD.cast && GD.cast.off, GD.cast && GD.cast.def].filter(Boolean).map(c => ({ side: c.side, n: c.n, name: c.name, ult: c.ult }));
  if (pw.length) e.pw = pw;
  if (GD.stc) e.st = [GD.stc.off, GD.stc.def];
  gfZoneRest(); gfTakeNotes(e);
  gfBoxPlay(off, r);
  G.drive.plays.push(e);
  GD.why = gfWhy(r);
  // what it came to, for the banner on the field (09-draw.js)
  GD.big = r.what === 'int' ? { k: 'int', sub: 'by ' + r.by } : null;
  // a fumble the defense comes up with: the ball changes hands where it came out, and the return may score
  if (r.what === 'fum' && r.lost) {
    G.drive.yards += r.gain; G.plays++;
    G.ball = clamp(G.ball + r.gain, 1, 99); gfTurnover();
    const ret = Math.min(r.ret || 0, GF_RULES.field - G.ball), back = ret ? ` and runs it back ${ret} yard${ret === 1 ? '' : 's'}` : '';
    G.ball += ret;
    if (G.ball >= GF_RULES.field) {
      G.score[G.poss] += GF_RULES.td; G.drive.end = 'fumtd'; gfBoxAdd(G.poss, L && L.pl[r.reci] ? L.pl[r.reci].ri : -1, 'td');
      GD.msg = `Fumble! ${r.rec} picks it up${back} for a touchdown.` + gfExtraPoint(G.poss); gfScoredOn(off);
      GD.big = { k: 'fumtd', sub: `${r.rec}, ${ret} yards` };
    } else {
      gfFirstDown(); G.drive.end = 'fum';
      GD.msg = `Fumble! ${r.who} loses it, and ${r.rec} recovers${back}.`;
      GD.big = { k: 'fum', sub: `${r.rec} recovers` };
    }
    e.msg = GD.msg; e.why = GD.why; gfRunClock(r.what, L ? L.t : 5); gfPowersAfter(); return;
  }
  if (r.what === 'int') {
    G.ball = clamp(G.ball + r.x, 1, 99); gfTurnover(); G.drive.end = 'int';
    GD.msg = `Intercepted by ${r.by}.`; e.msg = GD.msg; e.why = GD.why; gfRunClock(r.what, L ? L.t : 5); gfPowersAfter(); return;
  }
  G.drive.yards += r.gain;
  const s = gfSpot(r.gain), yd = n => `${Math.abs(n)} yard${Math.abs(n) === 1 ? '' : 's'}`;
  GD.msg = r.what === 'td' ? `Touchdown, ${gfName(off)}! ${r.who}, ${yd(r.gain)}.`
    : r.what === 'sack' ? `Sacked by ${r.by}: ${r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}.`
    : r.what === 'inc' ? `Incomplete: ${r.by}.`
    : r.what === 'fum' ? `${r.who} fumbles, and ${r.rec} falls on it: ${r.gain > 0 ? yd(r.gain) : r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}.`
    : `${r.who}, ${r.gain > 0 ? yd(r.gain) : r.gain < 0 ? 'a loss of ' + yd(r.gain) : 'no gain'}${r.what === 'out' ? ', out of bounds' : r.by ? ', brought down by ' + r.by : ''}.`;
  if (s === 'first') GD.msg += ' First down.';
  if (s === 'safety') { GD.msg = `Safety: ${r.who} is tackled in the end zone.`; G.drive.end = 'safety'; gfScoredOn(off); }
  if (s === 'turnover') { GD.msg += ' Turnover on downs.'; G.drive.end = 'downs'; }
  if (s === 'td') { G.drive.end = 'td'; GD.msg += gfExtraPoint(); gfScoredOn(1 - off); }
  const big = s === 'td' ? 'td' : s === 'safety' ? 'safety' : s === 'turnover' ? 'downs' : r.what === 'fum' ? 'fum' : r.what === 'sack' ? 'sack' : s === 'first' ? 'first' : r.gain >= 15 ? 'long' : null;
  GD.big = big && { k: big, gain: r.gain, sub: big === 'td' ? `${r.who}, ${yd(r.gain)}` : big === 'sack' ? 'by ' + r.by : big === 'fum' ? `${r.rec} falls on it` : big === 'first' && r.gain >= 10 ? `${r.who}, +${r.gain}` : '' };
  e.msg = GD.msg; e.why = GD.why;
  gfRunClock(r.what, L ? L.t : 5);
  gfPowersAfter();
}
// why it went that way: the play's story from its events, then how the calls matched up
function gfWhy(r) {
  const P = GF_PLAYS[GD.oc], ev = L ? L.ev : [], th = ev.find(x => x.k === 'throw'), out = [];
  if (r.what === 'sack') out.push('The rush got to the quarterback before the throw.');
  else if (r.by === 'thrown away') out.push('The rush got there, and the quarterback threw it away.');
  else if (th) out.push(`${th.s === 'hurried' ? 'Under pressure, the' : 'The'} quarterback threw to ${th.o}.`);
  else if (P.kind === 'run') out.push(`The handoff went to ${r.who || 'the back'}.`);
  const br = L ? L.broken : 0;
  if (br) out.push(`${br} broken tackle${br > 1 ? 's' : ''}.`);
  const pw = gfPowWhy(GD.cast); if (pw) out.push(pw);
  const sw = gfStanceWhy(r, GD.stc); if (sw) out.push(sw);
  const [g, why] = gfEdge(GD.oc, GD.dc);
  const dn = GF_DEFS[GD.dc].n, st = GD.stale || {};
  if (st.read > .45) out.push(`They saw the ${P.n.toLowerCase()} coming: it's been called a lot.`);
  if (st.tell > .45) out.push(`The ${dn.toLowerCase()} was easy to read: it's been called a lot.`);
  out.push(g > 0 ? `${P.n} beats ${dn}: ${why}` : g < 0 ? `${dn} beats ${P.n}: ${why}` : `${P.n} against ${dn} is an even matchup.`);
  return out.join(' ');
}
function gfKick() {
  const off = G.poss, k = G.teams[off].roster[G.teams[off].kicker], dist = gfKickDist(), down = G.down, ball = G.ball, ch = gfKickChance(k);
  if (GD.kick === 'fg') {
    // (a Tempest on the field pushes even a well-struck kick)
    const M = GD.meter, gust = M && gfZoneSum('kick') < 0 && R() < -gfZoneSum('kick'), r = gfFieldGoal(M ? gfMeterFg(k) && !gust : gfKickGood(k));
    if (r === 'fg') gfScoredOn(1 - off);
    gfBoxAdd(off, G.teams[off].kicker, 'fga'); if (r === 'fg') gfBoxAdd(off, G.teams[off].kicker, 'fgm');
    G.drive.end = r; GD.big = { k: r === 'fg' ? 'fg' : 'miss', sub: `${dist} yards` }; GD.msg = r === 'fg' ? `${k.n} kicks it from ${dist} yards. Good: 3 points.` : `${k.n} misses from ${dist} yards.`;
    GD.why = M ? `Power ${Math.round(M.pw * 100)}% (${dist} yards needs ${Math.ceil(dist / gfFgReach(k) * 100)}%), and the aim ${Math.abs(M.aim) <= gfFgWindow(k) ? 'true' : (M.aim < 0 ? 'wide left' : 'wide right')}.`
      : `A ${dist}-yard try with a kicking rating of ${k.r.kck} is good about ${Math.round(ch * 100)}% of the time.`;
    if (gfZoneSum('kick') < 0) GD.why += ` The ${gfZoneName('kick')} pushes the ball${gust ? ' wide' : ''}.`;
  } else {
    const y = Math.max(10, (GD.meter ? gfMeterPunt(k) : gfPuntYards(k)) + Math.round(gfZoneSum('punt'))); G.plays++;
    if (G.ball + y >= GF_RULES.field) { G.poss = 1 - G.poss; G.ball = 20; } else { G.ball += y; gfTurnover(); }
    G.drive.end = 'punt'; GD.big = null; GD.msg = `${k.n} punts, ${y} yards.`;
    const wary = GD.wary ? `The coach punts on fourth and short rather than risk a fumble: ${GD.wary}. ` : ''; GD.wary = '';
    GD.why = GD.meter ? `Power ${Math.round(GD.meter.pw * 100)}%${Math.abs(GD.meter.aim) > .3 ? ', and a wild aim cost some distance' : ''}. The punt gives the ball away, but a long way from your goal line.` : `${wary}The punt gives the ball away, but a long way from your goal line.`;
  }
  if (GD.kick !== 'fg' && gfZoneSum('punt') < 0) GD.why += ` The ${gfZoneName('punt')} cuts it short.`;
  gfZoneRest();
  G.drive.plays.push(gfTakeNotes({ oc: GD.kick, dc: '', what: G.drive.end, gain: 0, by: k.n, who: k.n, down, togo: 0, ball, msg: GD.msg, why: GD.why }));
  gfRunClock(G.drive.end, 5);
  gfPowersAfter();
}
function gfSummary() { return { end: G.drive.end, plays: G.drive.plays.length, yards: G.drive.yards, score: G.score.slice(), teams: G.teams.map(t => t.name) }; }
// a whole drive at once, CPU against CPU, through the same flow
function gfSim(opts) {
  const hooks = Object.assign({}, GF_HOOK); GF_HOOK.onOver = GF_HOOK.onPhase = GF_HOOK.onSnap = null;
  try { gfStart(Object.assign({}, opts, { mode: 'watch' })); for (let i = 0; i < 50000 && GD.ph !== 'over'; i++) gfTick(GF_DT * 10); }
  finally { Object.assign(GF_HOOK, hooks); }
  return Object.assign(gfSummary(), { log: G.drive.plays });
}
