/* w132: owning pets (issue #104, phase 2). Pets are small monsters at your side in the card battles (the rules and the
   pets are Sudden Death's: engine/pets.js, data/pets.js); the Realm is where you own them.
   - The kennel at camp holds every pet you own, up to W_PET.kennel. One is at your side (WG.pets.side): it goes into
     every card match (RUN.pet, kept in step by wPetSync), and follows your team on the world map. Change it between
     matches, never during one (wPetBusy).
   - A new pet (wPetAdd: an egg hatched, a pet bought) goes into the kennel. At a full kennel it waits where it came
     from at once (never lost) and you're asked which one to let go, which can be the new one: one question at a time,
     once no window or conversation is open.
   - Letting a pet go (wPetLetGo) sends it back to where it came from (its from: a shop, a keeper or a hatching place),
     where it waits (WG.petAway) and can be had back later (the places add the way, phases 3 and 4: wPetReclaim).
   - Upkeep: every week, as it turns, each pet you own costs W_PET.upkeep[rarity] gold, the newest paid first. One you
     can't pay goes hungry (so the longest at home are the likeliest to): a hungry pet's numbers are halved and its bond doesn't grow until it is
     fed (wPetFeed: its week's upkeep, or a treat, phase 5) or its next week is paid. A pet is never lost to hunger.
   - The Pets tab on the Team screen: the kennel, the one at your side, each pet's trait, powers, trick and bond;
     set the one at your side, rename one, feed one, let one go; the week's upkeep and when it is due.
   WG.pets = { owned: [{ id, kind, name, bond, xp, got, from, hungry }], side: id or null, seq }, WG.petAway: [{ kind,
   name, bond, xp, from }], WG.petWeek (the week last paid).
   wPetAdd(kind, from, o?), wPetSide(id), wPetLetGo(id), wPetRename(id, name), wPetFeed(id), wPetReclaim(i),
   wPetUpkeep(), wPetSync(), wPetOf(id), wPetSideOf()
   Wraps: wStart (wW132Start: older saves, and the pet in step), wNewDay (wW132NewDay: the week's upkeep), wOpenCamp and
   wRenderCamp (wW132OpenCamp, wW132RenderCamp: the Pets tab), renderHelp (wW132RenderHelp: #wHelpPets). The pet on the
   map is one of w7's actors (W_ACTORS). */

const W_PET = { kennel: 6, upkeep: { c: 6, u: 10, r: 16 }, nameMax: 18 };
function wPets() {
  const P = WG.pets = WG.pets || { owned: [], side: null, seq: 1 };
  P.owned = P.owned || []; if (!P.seq) P.seq = 1 + P.owned.reduce((m, x) => Math.max(m, x.id || 0), 0);
  WG.petAway = WG.petAway || [];
  if (WG.petWeek == null) WG.petWeek = wWeek();
  return P;
}
const wPetOf = id => wPets().owned.find(x => x.id === id) || null;
const wPetSideOf = () => { const P = wPets(); return P.side != null ? wPetOf(P.side) : null; };
// a card match is on: the pet at your side stays put till it's over
const wPetBusy = () => !!(B && !B.over && UI.view === 'fight');
// RUN.pet, what the card battle reads: the one at your side, as plain data
function wPetSync() { if (!RUN || !WG) return; const p = wPetSideOf(); RUN.pet = p ? { kind: p.kind, name: p.name, bond: p.bond || 1, hungry: !!p.hungry } : null; }
// a new pet into the kennel (kind, where it came from). Returns the pet if it came in, else null: an unknown kind, or a
// full kennel, where the pet waits where it came from at once (WG.petAway, so it is never lost, a reload or a closed
// question and all) and you're asked which one goes (wPetFull, one question at a time; never in LAB)
const W_PET_ASK = [];
function wPetAdd(kind, from, o) {
  if (!PETS[kind]) return null;
  const P = wPets(), q = Object.assign({ kind, name: (o && o.name) || PETS[kind].n, bond: 1, xp: 0, got: WG.dayAbs, from: from || '', hungry: false }, o || {});
  q.id = P.seq++;
  if (P.owned.length >= W_PET.kennel) {
    const a = wPetAway(q); wLog(`${q.name} the ${PETS[kind].from} wants in, but your kennel is full: it waits where it came from.`, 'd'); wSave();
    if (!LAB) { W_PET_ASK.push({ q, a }); wPetAskSoon(); }
    return null;
  }
  P.owned.push(q);
  if (P.side == null) P.side = q.id;
  wPetSync();
  wLog(`${q.name} the ${PETS[kind].from} joins your kennel${P.side === q.id ? ', and goes at your side' : ''}.`, 'g');
  wSave();
  return q;
}
// the next full-kennel question, on a later tick (a window closing often opens another straight after), once no window
// or conversation is open and you're on the map; till then it looks again now and then
function wPetAskSoon() { if (W_PET_ASK.length && !W_PET_ASK.t) W_PET_ASK.t = setTimeout(() => { W_PET_ASK.t = 0; wPetAskNext(); }, 250); }
function wPetAskNext() {
  if (!W_PET_ASK.length || !WG) return;
  if (!$('modal').hidden || UI.view !== 'world' || WUI.talk) return wPetAskSoon();
  const { q, a } = W_PET_ASK.shift();
  // (still waiting, and the kennel still full: ask; else it stays where it waits, to be reclaimed)
  if (!WG.petAway.includes(a) || wPets().owned.length < W_PET.kennel) return wPetAskNext();
  wPetFull(q, a);
}
const wW132Drain = wDrain;
wDrain = function () { wW132Drain.apply(this, arguments); if (W_PET_ASK.length) wPetAskSoon(); };
// a full kennel: which one goes (the new one too: it already waits where it came from, a)
function wPetFull(q, a) {
  const P = wPets(), all = P.owned.concat([q]);
  const close = modal(`<header><h3>The kennel is full</h3></header><div class="wmsg"><p>${esc(q.name)} the ${esc(PETS[q.kind].from)} wants in, but your kennel holds ${W_PET.kennel}. Choose one to let go: it goes back to where it came from, and you can come back for it.</p></div>
    <p class="wbad" id="wPetFullWhy" hidden></p>
    <ul class="wpetlist">${all.map(x => `<li><button class="ghost" data-petgo="${x.id}">${esc(x.name)}${x === q ? ' (the new one)' : ''}</button> <small>${esc(PETS[x.kind].from)}, bond ${x.bond}</small></li>`).join('')}</ul>`,
    // (closed without a choice: the new one stays where it waits)
    () => wDrain());
  $('modalBox').querySelectorAll('[data-petgo]').forEach(b => b.onclick = () => {
    const id = +b.dataset.petgo;
    if (id !== q.id) {
      // (one that can't go now, the one at your side in a match, says so and the choice stays open)
      const why = wPetLetGo(id); if (why) { const w = $('wPetFullWhy'); w.textContent = why; w.hidden = false; return; }
      const k = WG.petAway.indexOf(a); if (k >= 0) WG.petAway.splice(k, 1);
      P.owned.push(q); if (P.side == null) P.side = q.id; wPetSync(); wLog(`${q.name} the ${PETS[q.kind].from} joins your kennel.`, 'g');
    }
    wSave(); close();
  });
}
// (as it was: its name, bond, hunger and the day it came, all back when reclaimed)
function wPetAway(q) { wPets(); const a = { kind: q.kind, name: q.name, bond: q.bond || 1, xp: q.xp || 0, from: q.from || '', hungry: !!q.hungry, got: q.got != null ? q.got : null }; WG.petAway.push(a); return a; }
// let one go: it goes back where it came from, and waits there
function wPetLetGo(id) {
  const P = wPets(), q = wPetOf(id); if (!q) return 'No such pet.';
  if (P.side === id && wPetBusy()) return 'Not during a match.';
  P.owned = P.owned.filter(x => x.id !== id); wPetAway(q);
  if (P.side === id) P.side = P.owned.length ? P.owned[0].id : null;
  wPetSync(); wSave();
  wLog(`${q.name} goes back to where it came from. You can come back for it.`, 'd');
  return '';
}
// one let go, had back (the place it waits at pays the way: phases 3 and 4)
function wPetReclaim(i) {
  const A = wPets() && WG.petAway, a = A[i]; if (!a) return 'Nobody waits there.';
  if (wPets().owned.length >= W_PET.kennel) return `Your kennel is full (${W_PET.kennel}).`;
  // (taken off the waiting list only once it is really back)
  const q = wPetAdd(a.kind, a.from, { name: a.name, bond: a.bond, xp: a.xp, hungry: !!a.hungry, got: a.got != null ? a.got : WG.dayAbs }); if (!q || !wPetOf(q.id)) return 'It couldn\'t come.';
  const k = WG.petAway.indexOf(a); if (k >= 0) WG.petAway.splice(k, 1); wSave();
  return '';
}
function wPetSide(id) {
  const P = wPets(), q = wPetOf(id); if (!q) return 'No such pet.';
  if (wPetBusy()) return 'Not during a match.';
  P.side = id; wPetSync(); wSave();
  return '';
}
function wPetRename(id, name) {
  const q = wPetOf(id); if (!q) return 'No such pet.';
  const n = String(name || '').replace(/[<>]/g, '').trim().slice(0, W_PET.nameMax);
  if (!n) return 'A name, please.';
  q.name = n; wPetSync(); wSave(); return '';
}
const wPetCost = q => W_PET.upkeep[(PETS[q.kind] || {}).rar] || W_PET.upkeep.c;
// feed a hungry pet: its week's upkeep, now
function wPetFeed(id) {
  const q = wPetOf(id); if (!q) return 'No such pet.';
  if (!q.hungry) return `${q.name} isn't hungry.`;
  const c = wPetCost(q); if (RUN.gold < c) return `It costs ${c} gold.`;
  RUN.gold -= c; q.hungry = false; wPetSync(); wSave();
  wLog(`${q.name} eats, and is itself again.`, 'g'); return '';
}
// the week's upkeep, as the week turns: the newest are paid first, then each one you can still afford; one you can't
// goes hungry (so the longest at home are the likeliest to)
function wPetUpkeep() {
  const P = wPets(); if (!P.owned.length) return;
  let paid = 0, hungry = [];
  for (const q of P.owned.slice().sort((a, b) => (b.got || 0) - (a.got || 0))) {
    const c = wPetCost(q);
    // (a pet paid for eats, hungry or not)
    if (RUN.gold >= c) { RUN.gold -= c; paid += c; q.hungry = false; } else { q.hungry = true; hungry.push(q.name); }
  }
  wPetSync();
  wLog(`The week turns: your pets' upkeep is ${paid} gold.${hungry.length ? ` You couldn't feed ${hungry.join(', ')}: hungry, their powers are halved until you feed them (the Pets tab).` : ''}`, hungry.length ? 'b' : 'd');
}
const wW132NewDay = wNewDay;
wNewDay = function () {
  wW132NewDay.apply(this, arguments);
  if (!WG || !RUN) return;
  const P = wPets(), wk = wWeek();
  if (wk !== WG.petWeek) { WG.petWeek = wk; if (P.owned.length) wPetUpkeep(); }
};
const wW132Start = wStart;
wStart = function (save, opts) { const r = wW132Start(save, opts); if (WG) { wPets(); wPetSync(); } return r; };

/* ---------- the Pets tab on the Team screen ---------- */
function wPetCard(q, side) {
  const T = petText(q.kind, q.bond || 1, q.hungry), D = PETS[q.kind], col = PET_EL_COL[D.el] || '#e9dcc0';
  return `<li class="wpr wpetc" data-petid="${q.id}" style="border-left:4px solid ${col}">
    <div class="wpi"><div class="wpn"><b>${esc(q.name)}</b><span class="k">${esc(T.n)}, ${petA(T.from)} ${esc(T.from)} (${esc(T.el)})</span>${side ? '<span class="wtag wb">At your side</span>' : ''}${q.hungry ? '<span class="wtag">Hungry</span>' : ''}</div>
      <small class="wnst">Bond ${q.bond || 1} of 3 · upkeep ${wPetCost(q)} gold a week</small>
      <small class="hint"><b>Always:</b> ${esc(T.trait)} ${T.powers.map(w => `<span${w.open ? '' : ' class="dim"'}>${w.open ? '' : `(bond ${w.at}) `}${esc(w.d)}</span>`).join(' ')} <b>Trick:</b> ${esc(T.trick.n)}: ${esc(T.trick.d)}</small></div>
    <div class="wpa row">${side ? '' : `<button class="ghost" data-petside="${q.id}">At my side</button>`}<button class="ghost" data-petname="${q.id}">Rename</button>${q.hungry ? `<button class="ghost" data-petfeed="${q.id}">Feed (${wPetCost(q)} gold)</button>` : ''}<button class="ghost" data-petletgo="${q.id}">Let go</button></div>
  </li>`;
}
function wCampPets() {
  const P = wPets(), busy = wPetBusy(), week = P.owned.reduce((n, q) => n + wPetCost(q), 0), left = 7 - ((WG.dayAbs - 1) % 7);
  return `<p class="hint">Your kennel: up to ${W_PET.kennel} pets. One goes at your side into every card match, and follows your team on the map; change it between matches. Each pet costs its upkeep every week, as the week turns: ${week} gold a week now, due in ${left} day${left === 1 ? '' : 's'}. What you can't pay leaves pets hungry (their powers halved) until you feed them.${busy ? ' <b>A match is on: the pet at your side stays put till it\'s over.</b>' : ''}</p>
    ${P.owned.length ? `<ol class="wroster wpets">${P.owned.map(q => wPetCard(q, q.id === P.side)).join('')}</ol>` : '<p class="hint">No pets yet. Pet eggs turn up in dungeons, and the realm\'s pet shops and keepers sell them.</p>'}
    ${WG.petAway.length ? `<p class="hint">Waiting where they came from: ${WG.petAway.map(a => `${esc(a.name)} (${esc(PETS[a.kind] ? PETS[a.kind].from : a.kind)})`).join(', ')}.</p>` : ''}`;
}
const wW132OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW132OpenCamp(want === 'pets' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="pets"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="pets">Pets</button>');
  tabs.querySelector('[data-ctab="pets"]').onclick = () => { WCAMP.tab = 'pets'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'pets') { WCAMP.tab = 'pets'; wRenderCamp(); }
};
const wW132RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'pets') return wW132RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="pets"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'pets'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  const P = wPets();
  body.innerHTML = `<div class="wcsum"><span>Pets <b>${P.owned.length}/${W_PET.kennel}</b></span><span>Gold <b>${RUN.gold}</b></span></div>${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampPets();
  body.querySelectorAll('[data-petside]').forEach(b => b.onclick = () => wCampSay(wPetSide(+b.dataset.petside)));
  body.querySelectorAll('[data-petfeed]').forEach(b => b.onclick = () => wCampSay(wPetFeed(+b.dataset.petfeed)));
  // (asked in place, in its own row: the Team screen stays open)
  body.querySelectorAll('[data-petletgo]').forEach(b => b.onclick = () => {
    const q = wPetOf(+b.dataset.petletgo), li = b.closest('li');
    li.querySelector('.wpa').innerHTML = `<small>Let ${esc(q.name)} go? It waits where it came from, to be had back.</small><button class="ghost" data-petgoyes="1">Let go</button><button class="ghost" data-petgono="1">Keep</button>`;
    li.querySelector('[data-petgoyes]').onclick = () => wCampSay(wPetLetGo(q.id));
    const no = li.querySelector('[data-petgono]'); no.onclick = () => wRenderCamp(); no.focus();
  });
  body.querySelectorAll('[data-petname]').forEach(b => b.onclick = () => {
    const q = wPetOf(+b.dataset.petname), li = b.closest('li');
    li.querySelector('.wpa').innerHTML = `<input type="text" maxlength="${W_PET.nameMax}" value="${esc(q.name)}" aria-label="${esc(q.name)}'s new name" data-petin="1"><button class="ghost" data-petok="1">Done</button>`;
    const inp = li.querySelector('[data-petin]'); inp.focus(); inp.select();
    const go = () => wCampSay(wPetRename(q.id, inp.value));
    li.querySelector('[data-petok]').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  });
};

/* ---------- the pet at your side on the map: behind the team ---------- */
W_ACTORS.push((acts, now, t) => {
  const p = WG && WG.map && wPetSideOf(); if (!p || !WUI.party || !WUI.party.length) return;
  const last = WUI.party[WUI.party.length - 1], pos = wLerpPos(last, now);
  // (behind the last of the team, the way it came; standing still, behind the way the team faces)
  let dx = (last.fx - last.tx) * .45, dy = (last.fy - last.ty) * .45;
  if (!dx && !dy) dx = WUI.face === 'l' ? .45 : -.45;
  const D = PETS[p.kind], col = PET_EL_COL[D.el] || '#e9dcc0';
  acts.push({ y: pos[1] + dy - .01, x: pos[0] + dx, draw: (c, x, y) => {
    const bob = Math.sin(t * 6) * (pos[2] ? 2 : .6);
    c.save(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y, 7, 2.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.strokeStyle = '#17100e'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y - 7 + bob, 7, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#17100e'; c.beginPath(); c.arc(x - 2.5, y - 8 + bob, 1.2, 0, Math.PI * 2); c.arc(x + 2.5, y - 8 + bob, 1.2, 0, Math.PI * 2); c.fill();
    c.restore(); } });
});

const wW132RenderHelp = renderHelp;
renderHelp = function () {
  wW132RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpPets')) return;
  const after = $('wHelpHatch') || $('wHelpEggs') || h.lastElementChild; if (!after) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPets"><b>Pets.</b> Small monsters that fight beside your team in the card battles. Your kennel at camp holds up to ${W_PET.kennel}; one goes at your side into every card match and follows you on the map (set it on the Team screen's Pets tab, between matches). A pet has a trait that is always on, powers that fire on their own when their moment comes, and a trick you use once a match (T, or its button). A hit of ${PET.spook} or more spooks it, and it holds back its next power. Bond (1 to 3) makes it stronger. Each pet costs its upkeep every week (${W_PET.upkeep.c} to ${W_PET.upkeep.r} gold); a pet you can't feed goes hungry, and its powers are halved until you do. Let a pet go and it waits where it came from.</p>`);
};
