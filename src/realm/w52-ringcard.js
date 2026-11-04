/* w52: the card at the Anvil Ring (issue #23, phase 3). Three bouts, one fighter a bout, and a fighter boxes once
   (10-card.js). Ask Ma Gristle for a CARD: the Saltmere Boxing Club names its three in order, and you pick who of your
   team faces each (your corner's pairing to start with: wBX.cardAuto). The bouts are boxed one after another in the
   ring, in the mode on the bar; between them the bar has Next bout, and at the end the card is settled (bouts won,
   then knockdowns, then points). Your players box on their kinds' ratings for now; with fewer than three of them,
   call-ups make up the card. Nothing is won or lost yet, and nothing is saved: games from the world come in phase 5.
   Wraps: wRingBarNote (wW52RingBarNote: the card on the bar), wRunAct (wW52RunAct: 'rcard'),
   renderHelp (wW52RenderHelp: the card in How to play). */

// your side: your team in its order, then call-ups if there are fewer than three
function wRingMine(taken) {
  const t = wPartyTeam(), out = wRoster().map(p => ({ n: p.n, kind: p.kind, num: p.num, lvl: p.lvl }));
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
function wRingRatings(kind) { const r = wBX.rate(kind); return wBX.stats.map(s => `${W_RING_STAT[s]} ${r[s]}`).join(' · '); }
/* the card: their three in order, and who of yours faces each */
function wRingCard() {
  const taken = new Set(), mine = wRingMine(taken), theirs = wRingTheirs(taken), auto = wBX.cardAuto(mine.fighters, theirs.fighters);
  const opt = (sel) => mine.fighters.map((f, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(f.n)}, ${esc(wKindName(f.kind))}${f.callup ? ' (call-up)' : ''}</option>`).join('');
  const close = modal(`<header><h3>A card at the Anvil Ring</h3><button class="ghost" data-close>Not now</button></header>
    <div class="wmsg"><p class="hint">Three bouts, one fighter each, and each fighter boxes once. The ${esc(theirs.name)} have named their order. Pick who faces each; your corner has picked to start with. Win more bouts than they do to win the card (level on bouts, knockdowns decide it, then points).</p>
    <table class="wrcard">${theirs.fighters.map((f, i) => `<tr><th>Bout ${i + 1}</th><td><b>${esc(f.n)}</b>, ${esc(wKindName(f.kind))}<br><small>${wRingRatings(f.kind)}</small></td>
      <td>against</td><td><select data-rslot="${i}" aria-label="Your fighter for bout ${i + 1}">${opt(auto[i])}</select><br><small data-rrate="${i}"></small></td></tr>`).join('')}</table>
    <p class="hint" id="wRingCardWarn"></p></div>
    <div class="row"><button class="ghost" id="wRingCardAuto">Your corner's pick</button><button class="btn" id="wRingCardGo">Box the card</button></div>`);
  const sel = () => [...$('modalBox').querySelectorAll('[data-rslot]')].map(s => +s.value);
  const sync = () => {
    const p = sel(), dup = new Set(p).size !== p.length;
    for (const s of $('modalBox').querySelectorAll('[data-rslot]')) $('modalBox').querySelector(`[data-rrate="${s.dataset.rslot}"]`).textContent = wRingRatings(mine.fighters[+s.value].kind);
    $('wRingCardGo').disabled = dup; $('wRingCardWarn').textContent = dup ? 'A fighter boxes once: pick a different one for each bout.' : '';
  };
  $('modalBox').addEventListener('change', sync); sync();
  $('wRingCardAuto').onclick = () => { $('modalBox').querySelectorAll('[data-rslot]').forEach((s, i) => { s.value = auto[i]; }); sync(); };
  $('wRingCardGo').onclick = () => { const picks = sel(); close(); wRingCardBox({ mine, theirs, picks }); };
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
  return R.by === 'bouts' ? `${w} wins the card, ${a} bouts to ${b}.` : `${w} wins the card on ${R.by}, level at ${a} bouts each.`;
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
  if (h && !$('wRingHowCard')) h.insertAdjacentHTML('beforeend', `<p class="hint" id="wRingHowCard"><b>The card.</b> A card is ${wBX.rules.card} bouts, one fighter a bout, and each fighter boxes once. The other club names its order first, and you pick who faces each of theirs; your corner suggests a pairing, sending reach against shorter arms and a good chin against a big hitter. The side that wins more bouts wins the card. Level on bouts, the side that scored more knockdowns wins it, then the side with more points on the judges' cards.</p>`);
};
