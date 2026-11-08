/* w52: the card at the Anvil Ring (issue #23, phase 3). Three bouts, one fighter a bout, and a fighter boxes once
   (10-card.js). Ask Ma Gristle for a CARD: the Saltmere Boxing Club names its three in order, and you pick who of your
   team faces each (your corner's pairing to start with: wBX.cardAuto). The bouts are boxed one after another in the
   ring, in the mode on the bar; between them the bar has Next bout, and at the end the card is settled (bouts won,
   then knockdowns, then points). Your players box on their kinds' ratings for now; with fewer than three of them,
   call-ups make up the card. This exhibition wins and loses nothing and isn't saved; cards from the world (w53) use the
   same pairing (wRingPairing). Under each bout, the tale of the tape (issue #62: wRingTape): the two fighters side by
   side, their ratings and most stamina with the better of each pair marked, then their nature, natural style, powers
   and record.
   Wraps: wRingBarNote (wW52RingBarNote: the card on the bar), wRunAct (wW52RunAct: 'rcard'),
   renderHelp (wW52RenderHelp: the card in How to play). */

// your side: your team in its order, then call-ups if there are fewer than three
function wRingMine(taken) {
  const t = wPartyTeam(), out = wRoster().map(p => ({ n: p.n, kind: p.kind, num: p.num, lvl: p.lvl, pid: p.id, rec: wRingRec(p.id) }));
  for (const f of out) taken.add(f.n);
  for (let i = 0; out.length < wBX.rules.card; i++) { const p = wMakeCallUp(W_RING.home.kinds[i % W_RING.home.kinds.length], taken); out.push({ n: p.n, kind: p.kind, num: p.num, lvl: p.lvl, callup: true }); }
  return { name: t.name, short: t.short, color: W_RING.home.color, light: W_RING.home.light, fighters: out };
}
// the visitors: three of the Saltmere club's kinds, named, in the order they'll box
function wRingTheirs(taken) {
  const A = W_RING.away, kinds = A.kinds.slice().sort(() => Math.random() - .5).slice(0, wBX.rules.card);
  const fighters = kinds.map(kind => { const L = (FA_NAMES[kind] || []).filter(n => !taken.has(n)), n = L.length ? pick(L) : wKindName(kind); taken.add(n); return { n, kind, num: '' }; });
  return { name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.boxing} Club`, short: A.short, color: A.color, light: A.light, fighters };
}
const W_RING_STAT = { reach: 'Rch', pow: 'Pow', spd: 'Spd', chin: 'Chn', sta: 'Sta', gui: 'Gui' };
/* ---------- the tale of the tape (issue #62) ---------- */
const W_RING_TAPE = { reach: ['Reach', 'How far their punches land from'], pow: ['Power', 'How hard they hit'], spd: ['Speed', 'How fast they move and punch'],
  chin: ['Chin', 'How much they can take'], sta: ['Stamina', 'How long their breath lasts'], gui: ['Guile', 'Reading punches, slipping and timing'] };
// a player of yours's boxing record this journey, a copy (null for anyone else, or before their first bout)
function wRingRec(pid) {
  const L = pid != null && wPlayer(pid) && (WG.bxstats || {})[pid];
  return L && L.bb ? { bb: L.bb, w: L.w, l: L.l, d: L.d, ko: L.ko, kd: L.kd, down: L.down, landed: L.landed, thrown: L.thrown } : null;
}
// what the tape shows of a fighter: ratings, most stamina, nature, natural style, powers, level growth (only for your
// players on their own ratings) and record
function wRingTapeOf(f) {
  const r = Object.assign(wBX.rate(f.kind), f.r || {}), p = f.r && f.pid != null ? wPlayer(f.pid) : null;
  return { f, r, sta: wBX.staMax(r), T: wBX.traits[f.kind] || null, style: wBX.plans[wBX.styleOf(r)], P: wBX.powerBook[f.kind] || null,
    got: p && p.bx && p.bx.got || {}, rec: f.rec || wRingRec(f.pid) };
}
// a, yours (on the left); b, theirs. The better value of each pair is marked (wbest); level values aren't
function wRingTape(a, b) {
  const X = [wRingTapeOf(a), wRingTapeOf(b)], cost = wBX.powerCost, staTop = wBX.staMax({ sta: W_BXG.cap });
  const who = (t, j) => `<div class="wtn w${'ab'[j]}"><b>${esc(t.f.n)}</b><small>${esc(wKindName(t.f.kind))}${t.f.lvl ? `, level ${t.f.lvl}` : ''}${t.f.callup ? ', call-up' : ''}</small></div>`;
  const val = (key, label, tip, get, top, plus) => {
    const v = X.map(get), cell = (t, j) => `<div class="wtv w${'ab'[j]}${v[j] > v[1 - j] ? ' wbest' : ''}" data-tv="${key}"><i style="width:${Math.round(60 * v[j] / top)}%"></i><b>${v[j]}</b>${plus && t.got[key] ? `<small title="From their levels">+${t.got[key]}</small>` : ''}</div>`;
    return cell(X[0], 0) + `<div class="wtl" title="${esc(tip)}">${label}</div>` + cell(X[1], 1);
  };
  const rows = wBX.stats.map(s => val(s, W_RING_TAPE[s][0], W_RING_TAPE[s][1], t => t.r[s], W_BXG.cap, true)).join('')
    + val('stamax', 'Breath', 'The most stamina they have: punches and powers spend it, and it comes back off the gas', t => t.sta, staTop, false);
  const rec = (k, label, fn) => X.map((t, j) => `<div class="wtr w${'ab'[j]}" data-tr="${k}">${t.rec ? fn(t.rec) : '&ndash;'}</div>`).join(`<div class="wtl">${label}</div>`);
  const pct = L => L.thrown ? ` (${Math.round(100 * L.landed / L.thrown)}%)` : '';
  const words = (k, head, fn) => `<div class="wtsec">${head}</div>` + X.map((t, j) => `<div class="wtt w${'ab'[j]}" data-tt="${k}">${fn(t)}</div>`).join('');
  const pow = w => t => t.P ? `<b>${esc(t.P[w].n)}</b>. ${esc(t.P[w].desc)}` : '&ndash;';
  return `<div class="wtape">${who(X[0], 0)}<div></div>${who(X[1], 1)}${rows}
      ${rec('bouts', 'Bouts', L => `${L.bb}: ${L.w}&ndash;${L.l}${L.d ? `&ndash;${L.d}` : ''}`)}${rec('ko', 'KOs', L => L.ko)}${rec('kd', 'Knockdowns', L => `${L.kd} / ${L.down}`)}${rec('landed', 'Landed', L => `${L.landed} of ${L.thrown}${pct(L)}`)}</div>
    <div class="wtape2">${words('nature', 'Nature', t => t.T ? `<b>${esc(t.T.n)}</b>. ${esc(t.T.desc)}` : 'None: their kind boxes on its ratings alone.')}
      ${words('style', 'Natural style', t => `<b>${esc(t.style.n)}</b>. ${esc(t.style.desc)}`)}
      ${words('sp', `Special <small>(${cost.sp} stamina, once a round)</small>`, pow('sp'))}${words('ult', `Ultimate <small>(${cost.ult} stamina, once a bout)</small>`, pow('ult'))}</div>`;
}
/* the pairing: their three in order, and who of yours faces each (your corner's pick to start with). o: { mine,
   theirs, title, intro, go: [[label, value], ...] (the buttons that box it), onGo(picks, value) } */
function wRingPairing(o) {
  const { mine, theirs } = o, auto = wBX.cardAuto(mine.fighters, theirs.fighters);
  const T = k => wBX.traits[k], rate = f => wBX.stats.map(s => `${W_RING_STAT[s]} ${(f.r || wBX.rate(f.kind))[s]}`).join(' · ') + (T(f.kind) ? ` · <span title="${esc(T(f.kind).desc)}">${esc(T(f.kind).n)}</span>` : '');
  const opt = sel => mine.fighters.map((f, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(f.n)}, ${esc(wKindName(f.kind))}${f.lvl ? `, level ${f.lvl}` : ''}${f.callup ? ' (call-up)' : ''}</option>`).join('');
  const close = modal(`<header><h3>${esc(o.title)}</h3><button class="ghost" data-close>Not now</button></header>
    <div class="wmsg"><p class="hint">${o.intro}</p>
    <table class="wrcard wrpair" id="wRingPairT">${theirs.fighters.map((f, i) => `<tr><th>Bout ${i + 1}</th><td><b>${esc(f.n)}</b>, ${esc(wKindName(f.kind))}${f.lvl ? `, level ${f.lvl}` : ''}<br><small>${rate(f)}</small></td>
      <td>against</td><td><select data-rslot="${i}" aria-label="Your fighter for bout ${i + 1}">${opt(auto[i])}</select><br><small data-rrate="${i}"></small></td></tr>
      <tr class="wrtape"><td colspan="4"><details data-tapeat="${i}"${i ? '' : ' open'}><summary>Tale of the tape</summary><div data-tape="${i}"></div></details></td></tr>`).join('')}</table>
    <p class="hint" id="wRingCardWarn"></p></div>
    <div class="row"><button class="ghost" id="wRingCardAuto">Your corner's pick</button>${o.go.map(([l, v], i) => `<button class="${i ? 'ghost' : 'btn'}" data-rgo="${v}"${i ? '' : ' id="wRingCardGo"'}>${esc(l)}</button>`).join('')}</div>`);
  const sel = () => [...$('modalBox').querySelectorAll('[data-rslot]')].map(s => +s.value);
  const sync = () => {
    const p = sel(), dup = new Set(p).size !== p.length;
    for (const s of $('modalBox').querySelectorAll('[data-rslot]')) {
      const i = s.dataset.rslot, f = mine.fighters[+s.value];
      $('modalBox').querySelector(`[data-rrate="${i}"]`).innerHTML = rate(f);
      $('modalBox').querySelector(`[data-tape="${i}"]`).innerHTML = wRingTape(f, theirs.fighters[+i]);
    }
    for (const b of $('modalBox').querySelectorAll('[data-rgo]')) b.disabled = dup;
    $('wRingCardWarn').textContent = dup ? 'A fighter boxes once: pick a different one for each bout.' : '';
  };
  // (on the pairing's own table: a listener on #modalBox would outlive this screen and fire in every later one)
  $('wRingPairT').addEventListener('change', sync); sync();
  $('wRingCardAuto').onclick = () => { $('modalBox').querySelectorAll('[data-rslot]').forEach((s, i) => { s.value = auto[i]; }); sync(); };
  for (const b of $('modalBox').querySelectorAll('[data-rgo]')) b.onclick = () => { const picks = sel(); close(); o.onGo(picks, b.dataset.rgo); };
}
/* the exhibition card: the Saltmere club's three against yours, nothing won or lost */
function wRingCard() {
  const taken = new Set(), mine = wRingMine(taken), theirs = wRingTheirs(taken);
  wRingPairing({ mine, theirs, title: 'A card at the Anvil Ring', go: [['Box the card', 'box']],
    intro: `Three bouts, one fighter each, and each fighter boxes once. The ${esc(theirs.name)} have named their order. Pick who faces each; your corner has picked to start with. Win more bouts than they do to win the card (level on bouts, knockdowns decide it, then points).`,
    onGo: picks => wRingCardBox({ mine, theirs, picks }) });
}
// box it: the card in the ring, in the mode on the bar
function wRingCardBox(o) {
  WBX = { over: null, card: true };
  wBX.cardStart({ sides: [o.mine, o.theirs], picks: o.picks, mode: W_RING_MODE, you: 0, seed: o.seed });
  showView('ring');
  wRingBarNote();
}
function wRingCardNext() { if (!WBX || !WBX.card || !wBX.cardNext()) return; WBX.over = null; wRingBarNote(); }

// the bar: the card's bout and score, Next bout between bouts, Another card at the end
$('wRingAgain').insertAdjacentHTML('beforebegin', '<button class="btn" id="wRingNext" hidden>Next bout</button>');
$('wRingNext').addEventListener('click', wRingCardNext);
const wW52RingBarNote = wRingBarNote;
wRingBarNote = function () {
  wW52RingBarNote();
  const C = WBX && WBX.card ? wBX.card : null, done = C && !!C.result, between = C && WBX.over && !done;
  $('wRingNext').hidden = !between;
  $('wRingAgain').textContent = C ? 'Another card' : 'Another bout';
  $('wRingAgain').hidden = !!C && !done;
  if (!C) { $('wRingTitle').textContent = 'A bout at the Anvil Ring'; return; }
  const sc = wBX.cardScore();
  $('wRingTitle').textContent = `A card at the Anvil Ring: bout ${C.i + 1} of ${C.pairs.length}`;
  if (WBX.over) $('wRingNote').textContent = `${WBX.over.verdict} ${done ? wRingCardWords(C) : `The card: ${C.sides[0].name} ${sc.won[0]}, ${C.sides[1].name} ${sc.won[1]}.`}`;
  if (between) $('wRingNext').focus();
};
function wRingCardWords(C) {
  const R = C.result; if (R.win == null) return 'The card is a draw.';
  const w = C.sides[R.win].name, a = R.won[R.win], b = R.won[1 - R.win];
  return R.by === 'bouts' ? `The card goes to ${w}, ${a} bouts to ${b}.` : `The card goes to ${w} on ${R.by}, level at ${a} bouts each.`;
}
// Another card, from the bar at the end of one
$('wRingBar').addEventListener('click', e => { if (e.target.id === 'wRingAgain' && WBX && WBX.card) { e.stopImmediatePropagation(); wRingCard(); } }, true);

// Ma Gristle puts on a card too (not GAME: that's the card-game match)
(() => {
  const K = DB.chars.gk_ring; if (!K) return;
  K.topics.job.t += ' Or bring three of yours for a CARD.';
  K.topics.card = { t: 'Three bouts, three of yours against three of theirs, one at a time. They name their order; you pick who faces whom.', act: 'rcard' };
})();
const wW52RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'rcard') return wRingCard(); return wW52RunAct.apply(this, arguments); };

const wW52RenderHelp = renderHelp;
renderHelp = function () {
  wW52RenderHelp();
  const r = $('wHelpRing'), h = $('wRingHow');
  if (r && !/a CARD/.test(r.innerHTML)) r.insertAdjacentHTML('beforeend', ' Or ask for a CARD: three bouts, three of your team against three of theirs.');
  if (h && !$('wRingHowTape')) h.insertAdjacentHTML('beforeend', `<p class="hint" id="wRingHowTape"><b>The tale of the tape.</b> Before a card, each bout has its tale of the tape: your fighter on the left, theirs on the right. It has their six ratings and their breath (the most stamina they have, which comes from their stamina rating), with the better of each pair marked, and a + for the points their levels have added. Under that are their records (bouts won and lost, knockouts, knockdowns scored and taken, punches landed), their natures, the style they box to when nobody tells them otherwise, and their two powers with what they cost. Everyone starts a bout on 100 health. The ring shows a short version as the fighters touch gloves.</p>`);
  if (h && !$('wRingHowLive')) h.insertAdjacentHTML('beforeend', `<p class="hint" id="wRingHowLive"><b>During the bout.</b> A card in each top corner of the ring shows that fighter's six ratings (the better of each pair lit in their corner's colour) and their work so far: punches landed of thrown, power punches, punches slipped and blocked, and knockdowns scored. At the top in the middle are the three judges' running totals. During a round they count the round as it stands, and the small line under each says how that judge scores it so far. The judges' own eye can still split a close round at the bell.</p>`);
  if (h && !$('wRingHowCard')) h.insertAdjacentHTML('beforeend', `<p class="hint" id="wRingHowCard"><b>The card.</b> A card is ${wBX.rules.card} bouts, one fighter a bout, and each fighter boxes once. The other club names its order first, and you pick who faces each of theirs; your corner suggests a pairing, sending reach against shorter arms and a good chin against a big hitter. The side that wins more bouts wins the card. Level on bouts, the side that scored more knockdowns wins it, then the side with more points on the judges' cards.</p>`);
};
