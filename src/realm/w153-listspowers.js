/* w153: powers at the Tilting Lists (issue #117, phase 6), as w126 is the Shed's. Every match at the Lists has the
   monster powers (the engine's 12-powers.js), except the tilting yard: team mana from lances broken, seats kept and
   clean courses; each rider's lance power and shield power (one of two each, picked on the Lists tab: p.jtPw { lance,
   shield }, 0 or 1); curses that last the heat, which a squire can lift between courses in place of a job; the
   gallery's cheer, which pays for the rider's ultimate, once a match, marking a course; and the situation powers (The
   Last Course, Back in the Saddle, For the Crown). The CPU casts by its skill; the other clubs' riders bring the pair
   their names pick, the same every time, and the herald's card shows it.
   On the Lists, before each of your courses (You ride, and Manage when the calls are yours): a Powers row with the mana
   and the cheer, your rider's lance power (P), shield power (K), the ultimate (U) and a situation power that fits (M),
   any curse on your rider, and your squire's tip. In Manage, Auto powers lets your squire cast for you as the riders
   set off (it stays as you left it for the next match; not saved, but kept in a saved match). Between courses, while
   your rider is cursed, each squire's jobs gain Lift. The course log shows every cast (✦) and every curse lifted.
   wJtSetPw(key, role, v)   a player's pick ('' when done)
   Wraps: wListsGame (wW153ListsGame: powers on, Auto powers as you left it), wListsOpts (wW153ListsOpts: powers on in
   matches from the world and Simulate), wListsPlayer (wW153ListsPlayer: your pick), wListsOpp (wW153ListsOpp: their
   riders' picks by name), wListsRow (wW153ListsRow: the picks), wCampLists (wW153CampLists: a line on powers),
   wRenderCamp (wW153RenderCamp: the picks' changes), wListsRows (wW153ListsRows: the Powers row, Lift),
   wListsCardHTML (wW153ListsCardHTML: their powers and any curse), wListsLogHTML (wW153ListsLogHTML: the casts),
   wListsHowHTML (wW153ListsHow: #wListsHowPow), renderHelp (wW153RenderHelp: #wHelpListsPowers). */

const W_JTPOW = { auto: false, keys: { lance: 'P', shield: 'K', ult: 'U', sit: 'M' } };

/* ---------- powers on ---------- */
const wW153ListsGame = wListsGame;
wListsGame = function (opts) { const r = wW153ListsGame(Object.assign({ powers: true }, opts || {})); if (wJT.G && wJT.G.powers) wJT.autoPow = W_JTPOW.auto; wListsRows(); return r; };
const wW153ListsOpts = wListsOpts;
wListsOpts = function () { return Object.assign(wW153ListsOpts.apply(this, arguments), { powers: true }); };
const wW153ListsPlayer = wListsPlayer;
wListsPlayer = function (p) { const m = wW153ListsPlayer(p), pw = p.jtPw || {}; m.pw = { lance: pw.lance === 1 ? 1 : 0, shield: pw.shield === 1 ? 1 : 0 }; return m; };
const wW153ListsOpp = wListsOpp;
wListsOpp = function () { const T = wW153ListsOpp.apply(this, arguments); T.roster.forEach(m => { m.pw = wJT.pwByName(m.n); }); return T; };

/* ---------- the picks, on the Lists tab ---------- */
function wJtSetPw(k, role, v) {
  const p = wListsWho(k); if (!p || (role !== 'lance' && role !== 'shield')) return '';
  p.jtPw = Object.assign({ lance: 0, shield: 0 }, p.jtPw, { [role]: v === 1 ? 1 : 0 }); wSave(); return '';
}
const wJtCost = P => P.cost || (P.curse ? wJT.manaRules.curse : wJT.manaRules.pow);
const wW153ListsRow = wListsRow;
wListsRow = function (k, C) {
  const html = wW153ListsRow(k, C), p = wListsWho(k); if (!p) return html;
  const sel = ['lance', 'shield'].map(r => { const [a, b] = [0, 1].map(alt => wJT.powOf(p.kind, r, alt)), cur = p.jtPw && p.jtPw[r] === 1 ? 1 : 0;
    return `<label class="wsvl" title="${esc(`${a.n} (${wJtCost(a)} mana): ${a.desc} / ${b.n} (${wJtCost(b)} mana): ${b.desc}`)}">${r === 'lance' ? 'Lance power' : 'Shield power'} <select data-jtpw="${r}" aria-label="${esc(p.n)}'s ${r} power"><option value="0"${cur ? '' : ' selected'}>${esc(a.n)} (${wJtCost(a)})</option><option value="1"${cur ? ' selected' : ''}>${esc(b.n)} (${wJtCost(b)})</option></select></label>`; }).join('');
  return html.replace(/<\/div>\s*<\/li>\s*$/, `${sel}</div>\n  </li>`);
};
const wW153CampLists = wCampLists;
wCampLists = function (C) {
  return wW153CampLists(C).replace('<h4>The four</h4>', `<p class="hint">Each player brings a <b>lance power</b> and a <b>shield power</b> to the Lists, one of two each by their kind, picked here (the number is its cost in mana). The lance power helps their strike or curses the other rider for the rest of the heat; the shield power turns or softens the other lance, or throws its tip about. See Jousting: how it works.</p><h4>The four</h4>`);
};
const wW153RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW153RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'lists') return;
  const keyOf = el => { const k = el.closest('[data-cid]').dataset.cid; return /^\d+$/.test(k) ? +k : k; };
  body.querySelectorAll('[data-jtpw]').forEach(s => s.onchange = () => wCampSay(wJtSetPw(keyOf(s), s.dataset.jtpw, +s.value)));
};

/* ---------- on the Lists: the Powers row, Auto powers, Lift ---------- */
$('wListsRows').insertAdjacentHTML('afterend', '<div id="wListsPowRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Powers</span><span id="wListsPow"></span></div></div>');
$('wListsPowRow').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.jtpow) { const why = wJT.castMine(b.dataset.jtpow); if (why) $('wListsNote').textContent = why; else wListsBarNote(); wListsRows(); }
  else if (b.dataset.jtauto) { W_JTPOW.auto = !wJT.autoPow; wJT.autoPow = W_JTPOW.auto; wListsRows(); }
});
const wW153ListsRows = wListsRows;
wListsRows = function () {
  wW153ListsRows();
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null, G = wJT.G, row = $('wListsPowRow');
  const on = !!V && !V.yard && !!G.powers && G.powSides[V.you];
  const mine = on && V.ph === 'plan' && !!V.sel && (V.mode === 'play' || (V.mode === 'manage' && !V.mgrAuto)), mgr = on && V.mode === 'manage';
  row.hidden = !(mine || mgr); if (row.hidden) return;
  const s = V.you, M = wJT.manaRules, C = wJT.cheerRules, cu = G.curse[s];
  const btn = (k, label, title) => { const why = wJT.powWhy(s, k); return `<button class="ghost" data-jtpow="${k}" ${why ? 'disabled' : ''} title="${esc(why ? `${title} (${why})` : title)}">${esc(label)}</button>`; };
  let html = `<small class="hint" title="Mana: lances broken, seats kept after a rocking hit, and clean courses (a lance broken, and theirs didn't break on you) fill it. The cheer: the gallery fills it on a lance broken, a helm break, an unhorsing and a rider who stays on after a rocking hit.">Mana <b>${G.mana[s]}</b>/${M.max} · Cheer <b>${G.cheer[s]}</b>/${C.max}</small>`;
  if (mine) {
    const L = wJT.powNow(s, 'lance'), S = wJT.powNow(s, 'shield'), U = wJT.ultOf(s), K = W_JTPOW.keys;
    html += ` ${btn('lance', `${L.n} (${L.cost})`, `${K.lance}: ${L.desc}`)} ${btn('shield', `${S.n} (${S.cost})`, `${K.shield}: ${S.desc}`)} ${btn('ult', `${U.n} (ultimate)`, `${K.ult}: ${U.desc} Takes ${C.ult} cheer, once a match.`)}`
      + Object.keys(wJT.sit).filter(k => wJT.sitFits(s, k)).map(k => ' ' + btn(k, wJT.sit[k].n, `${K.sit}: ${wJT.sit[k].desc} ${wJT.sit[k].cost} mana, once a match.`)).join('');
  }
  if (mgr) html += ` <button class="ghost${wJT.autoPow ? ' on' : ''}" data-jtauto="1" aria-pressed="${wJT.autoPow}" title="Your squire casts your side's powers as the riders set off, as a Knight would">Auto powers</button>`;
  if (cu) html += ` <b class="wbad" title="${esc(`Cast by ${cu.by}. A squire can lift it between courses, in place of a job.`)}">☾ ${esc(cu.n)} on your rider</b>`;
  const tip = mine ? wJT.tip(s) : ''; if (tip) html += ` <small class="hint">${esc(tip)}</small>`;
  $('wListsPow').innerHTML = html;
  // (a squire can lift a curse in place of a job)
  if (cu && V.jobs && !$('wListsRowSq').hidden) document.querySelectorAll('#wListsSq .wjtsq').forEach((el, i) => {
    el.insertAdjacentHTML('beforeend', ` <button class="ghost${V.jobs[i] === 'lift' ? ' on' : ''}" data-jsq="${i}" data-jjob="lift" title="${esc(`Lift the ${cu.n}, in place of a job`)}">Lift</button>`); });
};
// their powers, and any curse, on the herald's card
const wW153ListsCardHTML = wListsCardHTML;
wListsCardHTML = function (s) {
  const html = wW153ListsCardHTML(s), K = wJT.card(s); if (!K || !K.pow || !K.pow.lance) return html;
  const P = K.pow, one = (x, what) => x ? `<span title="${esc(x.desc)}">${what} <b>${esc(x.n)}</b>${x.curse ? ' (a curse)' : ''}</span>` : '';
  const cu = K.curse.theirs ? ` <b class="wbad">☾ ${esc(K.curse.theirs.n)} on them.</b>` : '';
  return html + `<small class="wjtpow">Their powers: ${one(P.lance, 'lance')}, ${one(P.shield, 'shield')}, ${P.ult ? `<span title="${esc(P.ult.desc)}">ultimate <b>${esc(P.ult.n)}</b>${P.ult.used ? ' (used)' : ''}</span>` : ''}; mana ${P.mana}, cheer ${P.cheer}.${cu}</small>`;
};
// every cast, and every curse lifted, in the course log
const wW153ListsLogHTML = wListsLogHTML;
wListsLogHTML = function () {
  const html = wW153ListsLogHTML(), G = wJT.G; if (!G || !G.powers || !G.log.length) return html;
  const items = html.split('</li>').slice(0, G.log.length), n = G.log.length;
  const lifts = [0, 1].flatMap(s => (G.corners[s] || []).filter(c => c.did && c.did.lift).map(c => ({ s, c })));
  return items.map((li, j) => {
    const at = n - 1 - j, E = G.log[at], cast = G.casts.filter(c => c.at === at), lf = lifts.filter(x => x.c.heat === E.heat && x.c.course === E.course && !E.tilt);
    const bits = cast.map(c => `✦ ${esc(G.teams[c.side].short || G.teams[c.side].name)}: ${esc(c.n)}${c.why ? ` <small>(${esc(c.why)})</small>` : ''}`)
      .concat(lf.map(x => `${esc(G.teams[x.s].short || G.teams[x.s].name)}'s squire lifts the ${esc(x.c.did.lift)}`));
    return li + (bits.length ? ` <small class="wjtcast">${bits.join('; ')}.</small>` : '') + '</li>';
  }).join('');
};

/* ---------- How to play ---------- */
const wW153ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  const M = wJT.manaRules, C = wJT.cheerRules, K = W_JTPOW.keys;
  return wW153ListsHow() + `<div id="wListsHowPow"><p class="hint"><b>Powers.</b> Every kind has its own magic at the Lists: a <b>lance power</b> and a <b>shield power</b>, and a second of each to pick on the Lists tab. Before a course your side casts one of its rider's for team <b>mana</b> (${K.lance} the lance power, ${K.shield} the shield power), and it works on that course; one a course. Lances broken, seats kept after a rocking hit and clean courses (a lance broken, and theirs didn't break on you) fill the mana, up to ${M.max}. Most powers make a lance break more, a tip steadier or a seat firmer; some only jousting could have: a golem can't be unhorsed, a harpy's gust throws the other tip about, a wraith's lance passes through an angled shield, a minotaur's charge costs the mount no wind. A power costs ${M.pow} mana, a curse ${M.curse} (a golem's Unmoved costs 3).</p>
  <p class="hint"><b>Curses.</b> Some lance powers lay a curse on the other rider for the rest of the heat: a gorgon's stare makes their couch come late, a witch's evil eye tires their mount, a kobold's smoke makes their tip sway, an ogre's bellow worsens their seat. Not on a rider already cursed. Between courses one of your squires can <b>lift</b> a curse in place of a job; the other side's corner lifts by its skill.</p>
  <p class="hint"><b>The gallery's cheer</b> fills on a lance broken, more on the helm, most on an unhorsing, and for a rider who stays on after a rocking hit. At ${C.ult} it pays for the rider's <b>ultimate</b> (${K.ult}), once a match: it marks a course, for your rider or against theirs (an ogre's Splintering Lance breaks on any touch; a lich's Grave Charge can't be unhorsed, and a helm break unhorses). <b>Situation powers</b> (${K.sit}), once a match each, for mana, when the moment fits: The Last Course (behind, a heat's last course), Back in the Saddle (the course after keeping your seat from a rocking hit) and For the Crown (the tilt for the crown).</p>
  <p class="hint">Their riders cast by their skill (a Squire on a whim, a Knight when the course matters, an Archmage when it counts most), as the riders set off; the herald's card shows the powers their rider brings. In Manage, <b>Auto powers</b> lets your squire cast for you.</p></div>`;
};
const wW153RenderHelp = renderHelp;
renderHelp = function () {
  wW153RenderHelp();
  const after = $('wHelpListsGame') || $('wHelpListsCall') || $('wHelpLists'); if (!after || $('wHelpListsPowers')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsPowers"><b>Powers at the Lists.</b> Every rider brings a lance power and a shield power (pick them on the Lists tab), cast before a course for team mana; some lay a curse for the rest of the heat, which a squire can lift. The gallery's cheer pays for one ultimate a match, which marks a course; The Last Course, Back in the Saddle and For the Crown fit their moments. See Jousting: how it works.</p>`);
};
