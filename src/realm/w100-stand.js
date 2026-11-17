/* w100: the Supporters' Stand (issue #79, phase 4). Loads after w99-fanlift.js; changes earlier parts only by
   reassignment (saved originals carry the wW100 prefix).

   Fans can be spent as well as held. At your home ground (a button on its screen), or with Imelda Foss at the League
   office until you have one (ask her about SUPPORTERS), the Supporters' Stand does favours. A favour sends those fans
   home happy: they leave your total, so your following may drop a step, and what that step gave goes with it until
   you win them back. That is the choice: hold a big following for the steady lift, or spend it for something now.

     Open training          practice a card (★), as a drill on the training pitch does
     Whip-round             gold now
     Fan favourite          one player gets a level's worth of XP
     Mascot                 a random uncommon trophy
     The supporters' coach  ride to any city you have visited
     A testimonial          a friendly at your home ground against a rival club of your choice, with a full house:
                            twice your fans' gate at home, as it stood when you called it, win or lose

   Prices are in fans (W_STAND.favours; three times Sudden Death's fan stand, as a journey here wins about three times
   the fans). wStandBuy is the favour itself, with no screen, so the bot can do it too; where you may open the Stand
   is the screens' business (wStandWhere).

   W_STAND, wStandWhere(), wStandProblems(id), wStandChoices(id), wStandBuy(id, arg), wOpenStand(msg),
   W_ON_END.testimonial
   Wrapped: wOpenGround (wW100OpenGround: the Stand's button), wRunAct (wW100RunAct: 'stand'), renderHelp
   (wW100RenderHelp: #wHelpStand). Imelda Foss gains the topic SUPPORTERS. */

const W_STAND = {
  favours: {
    training: { n: 'Open training', cost: 350, d: 'Practice a card in front of the fans: it gains Practice ★.', pick: 'card' },
    whip: { n: 'Whip-round', cost: 150, gold: 50, d: 'The fans pass a hat: 50 gold now.' },
    favourite: { n: 'Fan favourite', cost: 450, d: 'The fans take to one of your players: a level\'s worth of XP.', pick: 'player' },
    mascot: { n: 'Mascot', cost: 900, d: 'A random uncommon trophy.' },
    coach: { n: 'The supporters\' coach', cost: 250, mins: 180, d: 'Ride with the fans to any city you have visited.', pick: 'city' },
    testimonial: { n: 'A testimonial', cost: 600, d: 'A friendly at your home ground against a rival club of your choice, with a full house: twice your fans\' gate, win or lose.', pick: 'club' },
  },
  mult: 2,   // a testimonial's gate, times your fans' gate at home
};
// where the Stand is open to you now: 'ground' at your home ground, 'office' at the League office while you have none, or ''
function wStandWhere() {
  if (!WG) return '';
  if (wHomeGround()) return WG.map === WG.ground.town ? 'ground' : '';
  return 'office';
}
// what you can pick for a favour that needs a choice: [{ id, n }] (cards are the cards themselves)
function wStandChoices(id) {
  const F = W_STAND.favours[id]; if (!F || !F.pick) return [];
  if (F.pick === 'card') return RUN.deck.filter(practicable);
  if (F.pick === 'player') return wRoster().filter(p => p.lvl < W_PARTY.maxLvl).map(p => ({ id: p.id, n: `${p.n}, level ${p.lvl}` }));
  if (F.pick === 'city') return DB.locs.filter(L => L.map && MAPS[L.map] && MAPS[L.map].kind === 'town' && L.map !== WG.map && (WG.flags || {})['seen_' + L.id]).map(L => ({ id: L.map, n: MAPS[L.map].name || L.map }));
  if (F.pick === 'club') return Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i).map(c => ({ id: c, n: CLUBS[c].name }));
  return [];
}
// why you can't have this favour now (a list; empty when you can)
function wStandProblems(id) {
  const F = W_STAND.favours[id], out = []; if (!F) return ['No such favour.'];
  if (wFans() < F.cost) out.push(`It takes ${F.cost} fans, and you have ${wFans()}.`);
  if (id === 'mascot' && !relicPool('u').length) out.push('You have every uncommon trophy.');
  if (id === 'testimonial' && !wHomeGround()) out.push('A testimonial needs a home ground.');
  else if (id === 'testimonial' && WG.map !== WG.ground.town) out.push('A testimonial is played at your home ground.');
  if (F.pick && !wStandChoices(id).length) out.push({ card: 'No card of yours can take Practice.', player: 'Every player is at the top level.', city: 'You have visited no other city.', club: 'No rival club to invite.' }[F.pick]);
  return out;
}
/* the favour itself: the fans leave your total and it is done. arg is the card, the player's id, the city's map or the
   club. Returns '' or why not. */
function wStandBuy(id, arg) {
  const F = W_STAND.favours[id], probs = wStandProblems(id); if (probs.length) return probs.join(' ');
  let said = '';
  if (F.pick) {
    const ch = wStandChoices(id), ok = F.pick === 'card' ? ch.includes(arg) : ch.some(c => c.id === arg);
    if (!ok) return 'Pick one first.';
  }
  const s0 = wFollowStep(), gate = id === 'testimonial' ? wFanGate({ kind: 'ground', region: wHomeRegion() }) * W_STAND.mult : 0;
  RUN.fans = wFans() - F.cost;
  if (id === 'training') { arg.sk = 1; achAdd('practice', 1); said = `Open training: your team practises ${wCardName(arg.id, arg.up)} in front of the fans (★).`; }
  else if (id === 'whip') said = `A whip-round: the fans pass a hat, and ${gainGold(F.gold)} gold comes back in it.`;
  else if (id === 'favourite') { const p = wRoster().find(x => x.id === arg); said = `${p.n} is the fans' favourite.`; wLog(said, 'g'); said = ''; wGiveXp(p, wXpNeed(p.lvl)); }
  else if (id === 'mascot') { const r = pick(relicPool('u')); gainRelic(r); said = `The fans bring a mascot, and with it a trophy: ${RELICS[r].n}. ${RELICS[r].desc || ''}`.trim(); }
  else if (id === 'coach') { const L = DB.locs.find(l => l.map === arg); wAdvance(F.mins); wEnterMap('world', L.x, L.y + 1); said = `The supporters' coach drops you at the gates of ${MAPS[arg].name || arg}.`; }
  if (said) wLog(said, 'g');
  const s1 = wFollowStep();
  if (s1 < s0) wLog(`Your following is down to ${wFollowName(s1).toLowerCase()} until you win them back.`, 'b');
  wSave();
  if (id === 'testimonial') {
    wLog(`A testimonial against ${CLUBS[arg].name}: the ground is full.`, 'g');
    // (straight to kickoff: the fans are already spent, so there is no "Not yet")
    startMatch({ type: 'rival', tier: wTierHere(), ambush: false, card: false, name: wClubCaptain(arg), world: { kind: 'testimonial', ref: { club: arg, gate }, region: wHomeRegion() } });
  }
  return '';
}
// a testimonial is over: the full house pays, win or lose
W_ON_END.testimonial = function (r, ref, W) {
  const g = ref && ref.gate ? gainGold(ref.gate) : 0;
  wLog(`The testimonial is ${r === 'win' ? 'won' : 'lost'}, and the full house pays ${g} gold.`, r === 'win' ? 'g' : 'd');
};

/* ---------- the screen ---------- */
function wOpenStand(msg) {
  if (LAB || !WG) return;
  const where = wStandWhere(), s = wFollowStep(), next = W_FOLLOW.at[s];
  const rows = Object.keys(W_STAND.favours).map(id => {
    const F = W_STAND.favours[id], probs = wStandProblems(id), drop = !probs.length && W_FOLLOW.at.filter(a => wFans() - F.cost >= a).length < s;
    return `<tr><td><b>${esc(F.n)}</b><small>${esc(F.d)}${probs.length ? ` <span class="wbad">${probs.map(esc).join(' ')}</span>` : drop ? ` <span class="wbad">Takes you below ${esc(wFollowName(s).toLowerCase())}.</span>` : ''}</small></td><td class="wnum">${F.cost} fans</td><td><button class="ghost" data-favour="${id}" ${probs.length ? 'disabled' : ''}>Ask</button></td></tr>`;
  }).join('');
  const body = !where ? `<p>The Supporters' Stand is at your home ground, in ${esc(wTownName(WG.ground.town))}.</p>`
    : `<p class="hint" id="wStandNow"><b>${esc(wFollowName(s))}</b>: ${wFans()} fans${next != null ? `, ${next - wFans()} more for ${esc(W_FOLLOW.names[s + 1].toLowerCase())}` : ''}. A favour sends those fans home happy: they leave your total, and a step you drop below stops giving what it gave until you win them back.</p>
      <table class="wshop"><tbody>${rows}</tbody></table>`;
  const close = modal(`<header><h3>The Supporters' Stand</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad" role="alert">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const done = r => { wDrain(); if (UI.view !== 'world') return; wOpenStand(r); };
  $('modalBox').querySelectorAll('[data-favour]').forEach(b => b.onclick = () => {
    const id = b.dataset.favour, F = W_STAND.favours[id];
    close();
    if (!F.pick) return done(wStandBuy(id));
    if (F.pick === 'card') return wPickCard(wStandChoices(id), F.n, `${F.d} ${F.cost} fans.`, card => done(card ? wStandBuy(id, card) : ''));
    const ch = wStandChoices(id);
    const c2 = modal(`<header><h3>${esc(F.n)}</h3><button class="ghost" data-close>Back</button></header><p class="hint">${esc(F.d)} ${F.cost} fans.</p><div class="row wstandpick">${ch.map(c => `<button class="ghost" data-pick="${esc(String(c.id))}">${esc(c.n)}</button>`).join('')}</div>`, () => { if ($('modal').hidden) done(''); });
    $('modalBox').querySelectorAll('[data-pick]').forEach(x => x.onclick = () => { const v = x.dataset.pick, arg = F.pick === 'player' ? ch.find(c => String(c.id) === v).id : v; c2(); const r = wStandBuy(id, arg); if (id === 'coach' && !r) { wDrain(); return; } if (id === 'testimonial' && !r) return; done(r); });
  });
}

/* ---------- where it opens ---------- */
const wW100OpenGround = wOpenGround;
wOpenGround = function (town, msg) {
  wW100OpenGround(town, msg);
  const row = $('wGroundSleep') && $('wGroundSleep').parentNode; if (!row || $('wGroundStand') || W_FOLLOW.off) return;
  row.insertAdjacentHTML('beforeend', `<button class="ghost" id="wGroundStand">The Supporters' Stand (${wFans()} fans)</button>`);
  $('wGroundStand').onclick = () => { const x = document.querySelector('#modalBox [data-close]'); if (x) x.click(); wOpenStand(); };
};
if (DB.chars.clerk) {
  DB.chars.clerk.topics.supporters = { t: 'The Supporters\' Stand. Until a team has a ground of its own, its fans leave their favours with me. Once you have one, they will be there.', act: 'stand' };
  DB.chars.clerk.greet += ' Your SUPPORTERS leave word here.';
}
const wW100RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'stand') return wStandWhere() === 'office' ? wOpenStand() : wLog(`"Your fans have a stand of their own now, at your ground in ${wTownName(WG.ground.town)}."`, 'd');
  return wW100RunAct.apply(this, arguments);
};

/* ---------- How to play ---------- */
const wW100RenderHelp = renderHelp;
renderHelp = function () {
  wW100RenderHelp();
  const h = $('wHelpFollow'); if (!h || $('wHelpStand')) return;
  const F = W_STAND.favours;
  h.insertAdjacentHTML('beforeend', ` <span id="wHelpStand"><b>The Supporters' Stand</b> spends fans: at your home ground, or with Imelda Foss at the League office until you have one (ask about SUPPORTERS). ${Object.keys(F).map(k => `${F[k].n} (${F[k].cost})`).join(', ')}. The fans you spend leave your total, so a favour can drop your following a step, and what that step gave stops until you win them back.</span>`);
};
