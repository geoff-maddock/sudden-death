/* u9: the redeemed captain, a true superstar (issue #111, phase I1). Loads after u8j-feats.js; changes earlier parts
   only by reassignment (saved originals carry the wWU9 prefix).

   Forge the Seal and the Nadir captain you beat most cleanly asks to join (u6). Here they join as a superstar: their
   own name and number, a signature card of their own in the card game, their kind's powers in every engine, and in
   their own sport the ultimate they used against you. One table (W_UMB9), one entry a champion; the star itself is
   made from it and the champion's character (DB.chars), and found by wStar(id) like the six legend superstars, with
   the champion's character id as the star id (p.star = 'nadir_rink'). They are not in W_STARS: the Stars tab's
   unlocks, the one-superstar-a-journey rule (WG.star) and the engines' star kinds are the legends' alone. Each is an
   ordinary league kind (a lich, a wraith), so every engine already has their ratings, powers and drawing.

   Their own ultimate, sport by sport (the engine's own id, the one the champion used as an opponent):
     card game  Morrow Vane: the card game has no ultimates; his signature card is his game
     baseball   Vesper Quill: the Dead Ball, her own pitch, added to her pitches (wNineBdPlayer)
     football   Ossian Pyre: Eclipse, nadirEclipse (wSevenPlayer's ult)
     boxing     Brakka Knell: The Last Bell, in place of the minotaur's ultimate (wBxFighter's pw: the minotaur's two
                specials stay, and the nature stays the minotaur's)
     basketball Vesper Gloam: Lights Out, lightsout (wCourtPlayer's ult)
     hockey     Hollis Grael: The Long Night, longnight (wRinkPlayer's ult)
     golf       Sexton Vale: The Hollow Flag, hollowflag (wLinksPlayer's ult)
     bowling    Ossery Brine: The Drowning Bell, drownbell (wLanesPlayer's ult)
     curling    Grisel Mourne: The Sunken Stone, sunkenstone (wShedPlayer's ult)
     jousting   Isolde Grave: The Pale Charge, palecharge (wListsPlayer's ult, cast when she rides: issue #117, phase 11)
   A redeemed captain signed before this part (a plain player with the champion's name and kind) is made a star when
   the journey is next loaded, and given their card; one still waiting (in the prompt queue or at camp) too.

   W_UMB9, W_UMB9_STARS, wUmbStarOf(p), wUmbRedeemed(), wUmbStarMake(champ, lvl), wUmbStarFix(p)
   Wraps: wStar (wWU9Star: the redeemed by id), wMakePlayer (wWU9MakePlayer: they stay the redeemed), wUmbSeal (wWU9Seal: the recruit is the star), wAddPlayer (wWU9AddPlayer:
   their own card), wShowRecruit (wWU9ShowRecruit: their card on the recruit card; passed over, they wait at camp),
   wCampRow (wWU9CampRow: the Superstar tag), wCampStars (wWU9CampStars: a line on the Stars tab), wSevenPlayer,
   wCourtPlayer, wRinkPlayer, wLinksPlayer, wLanesPlayer, wShedPlayer, wListsPlayer, wBxFighter and wNineBdPlayer (wWU9<Name>: the
   ultimate in their own sport), wRelease (wWU9Release: their card leaves with them), wGridPowNames, wSixRow,
   wBdCard, wLinksPowRow, wLanesRows and wShedRows (wWU9<Name>: the screens name their own ultimate: football's
   lineup, the Rink tab, the baseball stats card, and your Powers row in golf, bowling and curling; the court, the ring
   and hockey's game rows already ask the engine), wStart and wNextPrompt (wWU9Start, wWU9NextPrompt: older saves, with
   the world free), renderHelp (wWU9RenderHelp: the 'When it shuts' line). Also W_FROM.redeemed. */

const W_UMB9 = {
  // champion: their number, their card (K below), their sport's engine and their own ultimate there ({ id, n, d })
  gate: { num: 0, sig: 'u9_deal', home: 'card', ult: null, flav: 'Dealt every hand ever played on the dark side. Plays from the top now. Mostly.' },
  diamond: { num: 13, sig: 'u9_deadball', home: 'diamond', ult: { id: 'deadball', n: 'The Dead Ball', d: 'Her own pitch: it vanishes after release and comes back fast.' }, flav: 'Pitched every game on the Bone Diamond. Pitches for you now.' },
  gridiron: { num: 1, sig: 'u9_eclipse', home: 'gridiron', ult: { id: 'nadirEclipse', n: 'Eclipse', d: 'The sun goes out over the field: their offense slower, their throws wilder.' }, flav: 'Marshalled the Cinder Pit. Calls your plays now, and keeps the sun in a pocket.' },
  ring: { num: 7, sig: 'u9_knell', home: 'ring', ult: { id: 'lastbell', n: 'The Last Bell', d: 'For six seconds they get no breath back, and punches at them do more.' }, flav: 'The Broken Bell. Rings for your corner now.' },
  court: { num: 0, sig: 'u9_lights', home: 'court', ult: { id: 'lightsout', n: 'Lights Out', d: 'The torches gutter out: their shots go dark and their passes get picked off.' }, flav: 'Warden of the Black Court. Still turns the torches down when it matters.' },
  rink: { num: 9, sig: 'u9_night', home: 'rink', ult: { id: 'longnight', n: 'The Long Night', d: 'The lamps go out: their goalie is set late for everything, and they skate as if through snow.' }, flav: 'Captained the Dead Pond. Skates for you now, and brings the dark with him.' },
  links: { num: 4, sig: 'u9_flag', home: 'links', ult: { id: 'hollowflag', n: 'The Hollow Flag', d: 'The flag goes hollow for them: their reads shorter, their putts shakier.' }, flav: 'The Last Caddie. Carries your bag now, and knows every hole twice.' },
  lanes: { num: 10, sig: 'u9_bell', home: 'lanes', ult: { id: 'drownbell', n: 'The Drowning Bell', d: 'A bell under the floor: their balls skid long on heavy oil, and carry less.' }, flav: 'Set the pins in the Drowned Lanes. Knocks them down for you now.' },
  shed: { num: 8, sig: 'u9_stone', home: 'shed', ult: { id: 'sunkenstone', n: 'The Sunken Stone', d: 'The house goes under for them: their stones drag heavy and hardly curl.' }, flav: 'Skipped the Sunken Shed. Skips for you now.' },
  lists: { num: 6, sig: 'u9_charge', home: 'lists', ult: { id: 'palecharge', n: 'The Pale Charge', d: 'Your lance breaks on any fair touch, and their tip sways a quarter more, for a course.' }, flav: 'Rode the Hollow Lists until there was nobody left to unhorse. Rides for you now.' },
};
// their signature cards: the kind's, but their own (rarity 's', so never offered as a reward)
K('u9_deal', 'Deal from the Bottom', 'lich', 'atk', 1, 's', 'one', [['d', 6], ['draw', 1]], { fl: 'Never once from the top. Not for them.' });
K('u9_deadball', 'Dead Ball', 'witch', 'atk', 1, 's', 'one', [['d', 6], ['s', 'vuln', 2]], { fl: 'It vanishes after release. It comes back fast.', sport: 'baseball' });
K('u9_eclipse', 'Eclipse', 'lich', 'skl', 1, 's', 'all', [['b', 5], ['s', 'weak', 1, 'all']], { fl: 'The sun goes out. Your side knew it would.', sport: 'football' });
K('u9_knell', 'Death Knell', 'minotaur', 'atk', 1, 's', 'one', [['d', 7], ['s', 'weak', 1]], { fl: 'It rings through the guard.', sport: 'boxing' });
K('u9_lights', 'Lights Out', 'vampire', 'atk', 1, 's', 'one', [['drain', 5], ['s', 'weak', 1]], { fl: 'The torches gutter, and the ball is gone.', sport: 'basketball' });
K('u9_night', 'The Long Night', 'wraith', 'skl', 1, 's', 'all', [['s', 'weak', 1, 'all'], ['draw', 1]], { fl: 'The lamps go out over the pond.', sport: 'hockey' });
K('u9_flag', 'The Hollow Flag', 'wraith', 'skl', 1, 's', 'one', [['b', 5], ['s', 'vuln', 2]], { fl: 'The flag is there. The hole is not.', sport: 'golf' });
K('u9_bell', 'The Drowning Bell', 'zombie', 'atk', 1, 's', 'all', [['d', 3], ['s', 'psn', 2, 'all']], { fl: 'A bell rings under the floor.', sport: 'bowling' });
K('u9_stone', 'The Sunken Stone', 'lich', 'atk', 1, 's', 'one', [['d', 5], ['s', 'psn', 3]], { fl: 'It goes under, and takes them with it.', sport: 'curling' });
K('u9_charge', 'The Pale Charge', 'vampire', 'atk', 1, 's', 'one', [['d', 7], ['s', 'vuln', 1]], { fl: 'Death on a pale horse, and the lance breaks on whatever it touches.', sport: 'jousting' });

// the stars themselves, by id (the champion's character id), made once from the table and the characters (u3, u4*)
const W_UMB9_STARS = {};
for (const k in W_UMB9) {
  const C = W_NADIR[k], ch = C && DB.chars[C.char], X = W_UMB9[k]; if (!ch) continue;
  const [name, title] = ch.name.split(', ');
  W_UMB9_STARS[C.char] = { id: C.char, champ: k, redeemed: 1, kind: ch.kind, name, n: (title || name).replace(/^the /, ''), num: X.num, flav: X.flav, sig: X.sig, home: X.home,
    ult: X.ult, el: C.region, plays: `Redeemed from the Umbral. Plays ${W_UMB_PIECES[C.piece].sport} like nobody else.`,
    pow: X.ult ? X.ult.n : CARDS[X.sig].n, powd: X.ult ? X.ult.d : 'Their signature card is their game.' };
}
W_FROM.redeemed = 'redeemed in the Umbral';

const wUmbStarOf = p => (p && p.star && W_UMB9_STARS[p.star]) || null;
const wWU9Star = wStar;
wStar = function (id) { return wWU9Star.apply(this, arguments) || W_UMB9_STARS[id] || null; };
// the redeemed champion as a player, ready for the prompt queue
function wUmbStarMake(champ, lvl) {
  const s = W_UMB9_STARS[(W_NADIR[champ] || {}).char]; if (!s) return null;
  return wMakePlayer({ kind: s.kind, n: s.name, num: s.num, lvl, flav: s.flav, star: s.id }, 'redeemed');
}
// the redeemed champion's star this journey, if the Seal named one
function wUmbRedeemed() { const U = wUmb(), C = U && U.redeemed && W_NADIR[U.redeemed]; return (C && W_UMB9_STARS[C.char]) || null; }
// a plain player who is the redeemed champion (u6 made them by name and kind)
const wUmbPlainRedeemed = p => { const s = wUmbRedeemed(); return !!(p && s && !p.star && p.kind === s.kind && p.n === s.name); };
// such a player (signed or waiting before this part) made the star: true if changed
function wUmbStarFix(p) {
  if (!wUmbPlainRedeemed(p)) return false;
  const s = wUmbRedeemed(); p.star = s.id; p.num = s.num; p.flav = s.flav; p.from = 'redeemed';
  return true;
}

/* ---------- joining ---------- */
// (signed from camp, wRecruit names them a quest companion: they stay the redeemed)
const wWU9MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wWU9MakePlayer.apply(this, arguments); if (wUmbStarOf(p)) p.from = 'redeemed'; return p; };
const wWU9Seal = wUmbSeal;
wUmbSeal = function () {
  const r = wWU9Seal.apply(this, arguments), U = wUmb();
  // (u6 queued the champion as a plain player: they come as the star instead)
  if (U && U.redeemed) for (const P of WG.wprompts || []) if (P.t === 'recruit' && wUmbPlainRedeemed(P.p)) P.p = wUmbStarMake(U.redeemed, P.p.lvl);
  return r;
};
const wWU9AddPlayer = wAddPlayer;
wAddPlayer = function (p) {
  const r = wWU9AddPlayer.apply(this, arguments), s = wUmbStarOf(p);
  if (s && !wAllCards().some(c => c.id === s.sig && c.wp === p.id)) wGainCard({ id: s.sig, pid: p.id }, `${p.n}'s own card`);
  return r;
};
const wWU9ShowRecruit = wShowRecruit;
wShowRecruit = function (p, how, done) {
  const s = wUmbStarOf(p);
  // (passed over, the redeemed wait at camp, as a quest companion does)
  const r = wWU9ShowRecruit.call(this, p, s ? 'quest' : how, done);
  const box = $('modalBox'); if (!s || !box) return r;
  const who = box.querySelector('.wrecwho'), sig = box.querySelector('.wrecsig');
  if (who) who.innerHTML = `${esc(s.name)}, once the ${esc(s.n)} of the Nadir, wants to play for you. <b>A superstar</b>: their own card, their kind's powers in every game, and in ${esc(W_UMB_PIECES[W_NADIR[s.champ].piece].sport)} ${s.ult ? `their own ultimate, ${esc(s.ult.n)}` : 'the hand they dealt you'}.`;
  if (sig) sig.innerHTML = cardHTML({ uid: 'wsigu9', id: s.sig }, { flav: false });
  return r;
};

const wWU9Release = wRelease;
wRelease = function (pid) {
  const s = wUmbStarOf(wPlayer(pid)), why = wWU9Release.apply(this, arguments);
  if (s && !why) {
    const keep = c => c.id !== s.sig || wUmbStarOf(wPlayer(c.wp)) === s;
    RUN.deck = RUN.deck.filter(keep); RUN.wbench = (RUN.wbench || []).filter(keep); wSyncParty(); wTagCards(); wSave();
  }
  return why;
};

/* ---------- the Team screen ---------- */
const wWU9CampRow = wCampRow;
wCampRow = function (p, i) {
  const h = wWU9CampRow.apply(this, arguments), s = wUmbStarOf(p); if (!s) return h;
  return h.replace(/(<span class="k">)/, `<span class="wtag wu9star" title="${esc(`${s.pow}: ${s.powd}`)}">Superstar</span>$1`);
};
const wWU9CampStars = wCampStars;
wCampStars = function () {
  const h = wWU9CampStars.apply(this, arguments), p = wRoster().find(q => wUmbStarOf(q)), s = wUmbStarOf(p);
  return !s ? h : h + `<p class="hint" data-u9star><b>${esc(p.n)}</b>, redeemed from the Umbral, plays for you as a superstar too: ${esc(wKindName(p.kind))}, #${p.num}, with ${esc(CARDS[s.sig].n)}${s.ult ? ` and, in ${esc(W_UMB_PIECES[W_NADIR[s.champ].piece].sport)}, ${esc(s.ult.n)}` : ''}. They do not count as this journey's superstar.</p>`;
};

/* ---------- in the engines: their kind's powers everywhere, their own ultimate at home ---------- */
const wUmbHomeUlt = (p, home) => { const s = wUmbStarOf(p); return s && s.home === home && s.ult ? s.ult.id : null; };
const wWU9SevenPlayer = wSevenPlayer;
wSevenPlayer = function (p) { const m = wWU9SevenPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'gridiron'); if (u) m.ult = u; return m; };
const wWU9CourtPlayer = wCourtPlayer;
wCourtPlayer = function (p) { const m = wWU9CourtPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'court'); if (u) m.ult = u; return m; };
const wWU9RinkPlayer = wRinkPlayer;
wRinkPlayer = function (p) { const m = wWU9RinkPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'rink'); if (u) m.ult = u; return m; };
const wWU9LinksPlayer = wLinksPlayer;
wLinksPlayer = function (p) { const m = wWU9LinksPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'links'); if (u) m.ult = u; return m; };
const wWU9LanesPlayer = wLanesPlayer;
wLanesPlayer = function (p) { const m = wWU9LanesPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'lanes'); if (u) m.ult = u; return m; };
const wWU9ShedPlayer = wShedPlayer;
wShedPlayer = function (p) { const m = wWU9ShedPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'shed'); if (u) m.ult = u; return m; };
// (jousting, issue #117 phase 11: the engine casts a rider's own ultimate when they ride, wJT.ultOf; the Powers row asks it)
const wWU9ListsPlayer = wListsPlayer;
wListsPlayer = function (p) { const m = wWU9ListsPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'lists'); if (u) m.ult = u; return m; };
// boxing: the fighter's own powers (the engine's f.pw) are the minotaur's two specials and Brakka's ultimate (sp is the
// special picked on the Ring tab, f.sp, so the tale of the tape, which reads f.pw.sp, names the one they bring)
const wWU9BxFighter = wBxFighter;
wBxFighter = function (p) {
  const f = wWU9BxFighter.apply(this, arguments), u = wUmbHomeUlt(p, 'ring'), P = u && wBX.powerData[p.kind];
  if (P) f.pw = JSON.parse(JSON.stringify(Object.assign({}, P, { sp: f.sp === 'sp2' && P.sp2 ? P.sp2 : P.sp, ult: W_UMB4C.champ.pw.ult })));
  return f;
};
// baseball: the Dead Ball joins her pitches
const wWU9NineBdPlayer = wNineBdPlayer;
wNineBdPlayer = function (p) {
  const g = wWU9NineBdPlayer.apply(this, arguments), u = wUmbHomeUlt(p, 'diamond');
  if (u && g.pitches && !g.pitches.includes(u)) g.pitches = g.pitches.concat(u);
  return g;
};

/* ---------- the screens name it: the team tabs and the in-game power rows ---------- */
// football: the lineup's powers (an engine player brings ult; a roster player is the redeemed)
const wWU9GridPowNames = wGridPowNames;
wGridPowNames = function (p) {
  const B = wWU9GridPowNames.apply(this, arguments), id = (p && p.ult) || wUmbHomeUlt(p, 'gridiron'), U = id && wGF.ult(id);
  return U ? Object.assign({}, B, { ult: U }) : B;
};
// hockey: the Rink tab's row
const wWU9SixRow = wSixRow;
wSixRow = function (k, C) {
  const h = wWU9SixRow.apply(this, arguments), p = wSixWho(k), s = wUmbStarOf(p);
  if (!s || s.home !== 'rink') return h;
  return h.replace(/<small class="whult"[^>]*>Ultimate: <b>[^<]*<\/b><\/small>/, `<small class="whult" title="${esc(s.ult.d)}">Ultimate: <b>${esc(s.ult.n)}</b> (their own)</small>`);
};
// baseball: the Dead Ball among her pitches on the stats card
const wWU9BdCard = wBdCard;
wBdCard = function (p) {
  const h = wWU9BdCard.apply(this, arguments), s = wUmbStarOf(p);
  if (!s || s.home !== 'diamond') return h;
  return h.replace(/(<p class="wbdpit">Pitches: [\s\S]*?)(<\/p>)/, `$1, <b title="${esc(s.ult.d)}">${esc(s.ult.n.replace(/^The /, ''))}</b> (her own)$2`);
};
// golf, bowling and curling: the ultimate button in your game's Powers row names what the engine casts
function wUmbUltBtn(btn, kindU, U) {
  if (!btn || !U || !kindU || U.id === kindU.id) return;
  btn.textContent = `${U.n} (ultimate)`; btn.title = btn.title.replace(`U: ${kindU.desc}`, `U: ${U.desc}`);
}
const wWU9LinksPowRow = wLinksPowRow;
wLinksPowRow = function (V, show) {
  const r = wWU9LinksPowRow.apply(this, arguments), G = wGL.G, row = $('wLinksRowPow');
  if (!row || row.hidden || !G || !G.teams || !V) return r;
  const m = G.teams[V.you].roster[V.sel ? V.sel.ri : 0] || {};
  wUmbUltBtn(row.querySelector('[data-lpow="ult"]'), wGL.ult[m.kind] || wGL.ult.goblin, m.ult && wGL.ultOwn[m.ult]);
  return r;
};
const wWU9LanesRows = wLanesRows;
wLanesRows = function () {
  const r = wWU9LanesRows.apply(this, arguments), V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null, row = $('wLanesRowPow');
  if (!V || !row || row.hidden) return r;
  const G = wBL.G, s = V.you, ri = V.bowler != null && V.up === s ? V.bowler : G.order[s][0], m = G.teams[s].roster[ri] || {};
  wUmbUltBtn(row.querySelector('[data-npow="ult"]'), wBL.ult[m.kind] || wBL.ult.goblin, wBL.ultOf(s, ri));
  return r;
};
const wWU9ShedRows = wShedRows;
wShedRows = function () {
  const r = wWU9ShedRows.apply(this, arguments), V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null, row = $('wShedPowRow');
  if (!V || !row || row.hidden) return r;
  const G = wCR.G, s = V.you, mine = V.mode === 'play' && V.ph === 'aim' && V.up === V.you, ri = mine ? null : V.up === s ? V.thrower : G.order[s][0], m = G.teams[s].roster[ri == null ? V.thrower : ri] || {};
  wUmbUltBtn(row.querySelector('[data-crpow="ult"]'), wCR.ult[m.kind] || wCR.ult.goblin, wCR.ultOf(s, ri));
  return r;
};

/* ---------- older saves: a redeemed captain signed before this part ---------- */
// (only with the world free: a save taken mid-match is fixed up at the next free moment, wNextPrompt, after it)
function wUmbStarsFixAll() {
  if (!WG || !RUN || RUN.battle || RUN.pending || !wUmbRedeemed()) return 0;
  let n = 0;
  for (const p of wRoster()) if (wUmbStarFix(p)) { n++; const s = wUmbStarOf(p); if (!wAllCards().some(c => c.id === s.sig && c.wp === p.id)) wGainCard({ id: s.sig, pid: p.id }, `${p.n}'s own card`); }
  for (const p of WG.wwait || []) if (wUmbStarFix(p)) n++;
  for (const P of WG.wprompts || []) if (P.t === 'recruit' && wUmbStarFix(P.p)) n++;
  if (n) { wLog('The captain you redeemed in the Umbral is a superstar now: their own card, and their own ultimate in their own game.', 'g'); wSave(); }
  return n;
}
const wWU9Start = wStart;
wStart = function (save) {
  const r = wWU9Start.apply(this, arguments);
  if (save) wUmbStarsFixAll();
  return r;
};
const wWU9NextPrompt = wNextPrompt;
wNextPrompt = function () { if (WG && !LAB) wUmbStarsFixAll(); return wWU9NextPrompt.apply(this, arguments); };

/* ---------- How to play ---------- */
const wWU9RenderHelp = renderHelp;
renderHelp = function () {
  wWU9RenderHelp.apply(this, arguments);
  const p = [...document.querySelectorAll('#wHelpUmbral p')].find(e => /When it shuts/.test(e.textContent));
  if (!p || p.dataset.u9) return;
  p.dataset.u9 = 1;
  p.innerHTML = p.innerHTML.replace('The Nadir captain you beat most cleanly asks to join you.', 'The Nadir captain you beat most cleanly asks to join you, as a superstar: their own number and signature card, their kind\'s powers in every game, and in their own game the ultimate they used against you. Turn them down and they wait at camp.');
};
