/* w58: meeting and signing a superstar (issue #24, phase 2). A superstar that is built (W_STARS entry with a kind,
   added by its own part: w59 for the Phoenix) is met through someone who knows where it is: ask them about it by
   name (its meet.topic) and the superstar comes to you. Locked, they tell you the story and the feat. Unlocked, it
   names its price: gold, or something it wants (meet.price: { gold, items: { id: n } }), and you pick which to pay.
   It joins at your team's average level (rounded), with its signature card. One superstar a journey: WG.star holds
   the one you signed (kept even if they leave later). A full roster asks who to release before you pay.

   WG.star = superstar id, or absent. Players: p.star = superstar id (plain JSON).
   wStarLvl(), wStarCanSign(id) ('' or why not), wOpenStar(id), wSignStar(id, how)
   Wraps: wMakePlayer (wW58MakePlayer: keeps p.star), wRunAct (wW58RunAct: 'star:<id>'). W_FROM.star. */

W_FROM.star = 'a superstar';
function wStarLvl() { const R = wRoster(); return R.length ? clamp(Math.round(R.reduce((n, p) => n + p.lvl, 0) / R.length), 1, W_PARTY.maxLvl) : 1; }
function wStarBuilt(s) { return !!(s && s.kind && s.meet && KIND_NAME[s.kind]); }
function wStarCanSign(id) {
  const s = wStar(id);
  if (!wStarBuilt(s)) return 'Nobody has seen one yet.';
  if (!wStarOn(id)) return `Locked. ${s.feat}`;
  if (WG.star) { const w = wStar(WG.star); return WG.star === id ? `${s.name} is already with you this journey.` : `One superstar a journey, and the ${w ? w.n : 'other one'} is yours.`; }
  return '';
}
function wStarPrice(s, how) {
  const P = s.meet.price || {};
  if (how === 'gold') return RUN.gold >= (P.gold || 0) ? '' : `You need ${P.gold} gold.`;
  if (how === 'items') return Object.entries(P.items || {}).every(([k, n]) => wHas(k, n)) ? '' : `You need ${wStarItems(P)}.`;
  return 'There is no price like that.';
}
function wStarItems(P) { return Object.entries(P.items || {}).map(([k, n]) => `${n} ${DB.items[k] ? DB.items[k].name : k}${n === 1 ? '' : 's'}`).join(' and '); }
// sign: why not, or '' once they have joined (done(true)) or asked who to release first
function wSignStar(id, how, done) {
  const s = wStar(id), why = wStarCanSign(id) || wStarPrice(s, how);
  if (why) { if (done) done(false); return why; }
  const spec = { kind: s.kind, n: s.name, lvl: wStarLvl(), num: s.num != null ? s.num : 1, star: id, flav: s.flav };
  wRecruit(spec, 'star', ok => {
    if (ok) {
      const P = s.meet.price || {};
      if (how === 'gold') RUN.gold -= P.gold || 0; else for (const [k, n] of Object.entries(P.items || {})) wAddItem(k, -n);
      WG.star = id;
      wLog(`${s.name} the ${s.n} joins your team at level ${spec.lvl}. There is nobody else like them.`, 'g');
      if (typeof wSave === 'function') wSave();
    }
    if (done) done(!!ok);
  });
  return '';
}
const wW58MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW58MakePlayer.apply(this, arguments); if (spec && spec.star) p.star = spec.star; return p; };

/* ---------- the meeting ---------- */
function wOpenStar(id) {
  const s = wStar(id); if (!s || !wStarBuilt(s) || LAB) return;
  const why = wStarCanSign(id), P = s.meet.price || {}, port = portraitURL(s.kind, wPartyTeam(), s.num != null ? s.num : 1, 128);
  const locked = !wStarOn(id);
  const body = locked
    ? `<p class="hint">${esc(s.meet.rumour)}</p><p class="hint">To unlock: <b>${esc(s.feat)}</b> An unlock is kept on your profile for every later journey.</p>`
    : why ? `<p class="hint">${esc(s.meet.hello)}</p><p class="hint wball">${esc(why)}</p>`
    : `<p class="hint">${esc(s.meet.hello)}</p><p class="hint">${esc(s.meet.ask)} ${esc(s.name)} joins at level ${wStarLvl()}, your team's average, with their own card.</p>
       <div class="row wstbuy"><button class="btn" id="wStarGold" ${wStarPrice(s, 'gold') ? 'disabled' : ''}>Pay ${P.gold} gold</button>${P.items ? `<button class="btn" id="wStarItems" ${wStarPrice(s, 'items') ? 'disabled' : ''}>Give ${esc(wStarItems(P))}</button>` : ''}</div>
       <p class="hint">You have ${RUN.gold} gold${P.items ? ` and ${esc(Object.keys(P.items).map(k => `${WG.items[k] || 0} ${DB.items[k].name}${(WG.items[k] || 0) === 1 ? '' : 's'}`).join(', '))}` : ''}.</p>`;
  const close = modal(`<header><h3>${locked ? 'A story about a superstar' : `${esc(s.name)} the ${esc(s.n)}`}</h3><button class="ghost" data-close>${locked || why ? 'Done' : 'Not now'}</button></header>
    <div class="wstmeet">${locked ? wStarSil(s, false) : `<img src="${port}" alt="">`}<div>${body}${locked ? '' : `<p class="hint">Power: <b>${esc(s.pow)}</b>. ${esc(s.powd)}</p>`}</div></div>`);
  const go = how => { close(); wSignStar(id, how); if (typeof wDrain === 'function') wDrain(); };
  const g = $('wStarGold'); if (g) g.onclick = () => go('gold');
  const it = $('wStarItems'); if (it) it.onclick = () => go('items');
}
const wW58RunAct = wRunAct;
wRunAct = function (act, id) {
  if (typeof act === 'string' && act.startsWith('star:')) { wOpenStar(act.slice(5)); return; }
  return wW58RunAct(act, id);
};
