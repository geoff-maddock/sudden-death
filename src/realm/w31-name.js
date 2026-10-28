/* w31: regional fans (epic 2, phase 8). Loads after w30-weather.js; changes earlier parts only by reassignment (saved
   originals carry the wW31 prefix).

   Your name is made region by region. Every match you win in a region adds to it, a cup won there adds a lot, a
   contract from its board adds some, and a match you lose there takes a little away. Three steps (W_REP.at):

     Known   rooms at the region's inn cost a quarter less
     Liked   rooms half price, and the tavern's free agents are a level higher at the same fee
     Loved   all that, and a home crowd at every match in the region: Block at kickoff, as at your own ground
             (not twice: a match at home already has its crowd)

   WG.rep = { region: points }, plain data. W_REP, wRep(region), wRepStep(region) (0..3), wRepName(region), wInnPrice(price, region)
   Wrapped: wDispatchEnd (wins and losses), wCupWon (a cup), wNoticePayOut (a contract), wOpenInn (the price, and a
   line), wTavern (better agents), wPreGame (the crowd line), wCampTeam (your name on the Team screen), renderHelp
   (#wHelpName). A fightStart hook brings the crowd. */

const W_REP = {
  at: [10, 25, 50], names: ['Unknown', 'Known', 'Liked', 'Loved'],
  win: 1, cup: 10, notice: 3, lose: 1,
  inn: [1, .75, .5, .5], block: 4, off: false,
};
function wRep(region) { return (WG && WG.rep && WG.rep[region]) || 0; }
function wRepStep(region) { if (W_REP.off) return 0; const n = wRep(region); return W_REP.at.filter(a => n >= a).length; }
function wRepName(region) { return W_REP.names[wRepStep(region)]; }
function wRepAdd(region, n, why) {
  if (!WG || !region || !DB.regions[region] || !n) return;
  const R = WG.rep = WG.rep || {}, s0 = wRepStep(region);
  R[region] = Math.max(0, (R[region] || 0) + n);
  const s1 = wRepStep(region);
  if (s1 > s0) wLog(`Your name in ${wRegThe(region)}: ${W_REP.names[s1]}. ${wRepDoes(s1)}`, 'g');
}
function wRepDoes(step) {
  return ['', 'Rooms at its inn cost a quarter less.', 'Rooms are half price, and its free agents are a level higher at the same fee.',
    `A home crowd at every match there: ${W_REP.block} Block at kickoff.`][step] || '';
}
function wInnPrice(price, region) { return Math.round(price * W_REP.inn[wRepStep(region)]); }
function wCityRegion(map) { return W_GRD_REG[map] || null; }

/* ---------- earning it ---------- */
const wW31DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  wW31DispatchEnd(W, r);
  if (!W || !WG || !W.region) return;
  if (r === 'win') wRepAdd(W.region, W_REP.win);
  else wRepAdd(W.region, -W_REP.lose);
};
const wW31CupWon = wCupWon;
wCupWon = function (id) {
  const r = wW31CupWon(id), C = DB.cups[id];
  if (C && id !== 'crown' && DB.regions[C.elem]) wRepAdd(C.elem, W_REP.cup);
  return r;
};
const wW31NoticePayOut = wNoticePayOut;
wNoticePayOut = function (c) { wW31NoticePayOut(c); wRepAdd(c.region, W_REP.notice); };

/* ---------- what it buys ---------- */
const wW31OpenInn = wOpenInn;
wOpenInn = function (price, who) {
  const region = wCityRegion(WG.map), p = region ? wInnPrice(price, region) : price;
  wW31OpenInn(p, who);
  if (!region || p === price) return;
  const row = $('wSleep') && $('wSleep').parentNode; if (!row) return;
  row.insertAdjacentHTML('beforebegin', `<p class="hint wrep">You are ${esc(wRepName(region))} in ${esc(wRegThe(region))}: the room is ${p} gold, not ${price}.</p>`);
};
const wW31Tavern = wTavern;
wTavern = function (town) {
  town = town || WG.map;
  const T = wW31Tavern(town), region = wCityRegion(town);
  if (T.wrep || !region || wRepStep(region) < 2) return T;
  T.wrep = 1;
  for (const a of T.list) a.lvl = clamp(a.lvl + 1, 1, W_PARTY.maxLvl);
  return T;
};
/* Loved: a home crowd, unless the match is already at home */
function wRepCrowd(W) { return !!W && !!W.region && wRepStep(W.region) >= 3 && !(typeof wIsHome === 'function' && wIsHome(W)) && !(W.kind === 'cup' && W.ref && W.ref.cup === 'crown'); }
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!WG || !B || !wRepCrowd(W)) return;
  B.P.block += W_REP.block; B.wRep = 1;
  log(`The ${wRegThe(W.region).slice(4)} crowd is with you: ${W_REP.block} Block.`, 'good');
});
const wW31PreGame = wPreGame;
wPreGame = function (enc) {
  wW31PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'); if (!box || !wRepCrowd(enc.world)) return;
  box.insertAdjacentHTML('beforeend', `<p class="hint wrep">You are Loved in ${esc(wRegThe(enc.world.region))}: the crowd is yours, ${W_REP.block} Block at kickoff.</p>`);
};

/* ---------- the Team screen: your name, region by region ---------- */
function wRepHtml() {
  const rows = Object.keys(DB.regions).map(r => {
    const n = wRep(r), s = wRepStep(r), next = W_REP.at[s];
    return `<li><b>${esc(DB.regions[r].name.replace(/^The /, ''))}</b> <span class="wtag wrep-${s}">${W_REP.names[s]}</span> <small>${n}${next != null ? ` of ${next} for ${W_REP.names[s + 1]}` : ''}${s ? `. ${esc(wRepDoes(s))}` : ''}</small></li>`;
  }).join('');
  return `<h4>Your name</h4><p class="hint">Wins in a region make your name there, cups and contracts most of all; losses there cost a little.</p><ul class="wreplist">${rows}</ul>`;
}
const wW31CampTeam = wCampTeam;
wCampTeam = function () { return wW31CampTeam() + (W_REP.off ? '' : wRepHtml()); };

/* ---------- How to play ---------- */
const wW31RenderHelp = renderHelp;
renderHelp = function () {
  wW31RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpName')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpName"><b>Your name in the regions.</b> Each match you win in a region adds ${W_REP.win} to your name there, a cup ${W_REP.cup} and a contract from its board ${W_REP.notice}; a match you lose there takes ${W_REP.lose} away. At ${W_REP.at[0]} you are Known: rooms at its inn cost a quarter less. At ${W_REP.at[1]}, Liked: rooms half price, and its free agents a level higher at the same fee. At ${W_REP.at[2]}, Loved: a home crowd at every match in the region, ${W_REP.block} Block at kickoff. The Team screen shows where you stand.</p>`);
};
