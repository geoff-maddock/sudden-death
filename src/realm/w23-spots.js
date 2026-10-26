/* w23: a sport in every city (issue #6, phase 4). Loads after w22-cities.js; changes earlier parts only by
   reassignment (saved originals carry the wW23 prefix).

   Every city has two training spots inside its walls, one for each sport its region plays, and a coach at each:

     Graftonbury  the batting cage in the park (baseball), the hoop on the training ground (basketball)
     Mossgate     the putting green by the shrine (golf), the straw targets in the tilting yard (jousting)
     Saltmere     skittles on the quay (bowling), the stones by the sea wall (curling)
     Cinderhold   the sparring ring by the smithy (boxing), the kick-about pitch on the ash (football)
     Rimewatch    kids' hockey on the pond (hockey), the stone maker's bench (curling)

   Use the spot (tile '!', meta { spot }) or ask the coach to DRILL or for a CHALLENGE:
     Drill       once a week at each spot, free, an hour: a card that suits the sport (sportFits) gains Practice ★
                 (if none of your cards suit it, any card that can take a drill)
     Challenge   once a week at each spot: the coach asks how the sport scores, with three answers. Right pays
                 W_SPOT.prize; wrong, the coach tells you the answer
   The coach also explains the sport's scoring (its keyword).

   WG.spots = { spotId: { drill: week, quiz: week, right } }, plain data.
   W_SPOTS, wOpenSpot(id), wSpotDrill(id, card), wSpotAnswer(id, i)
   Wrapped: wUse (wW23Use: the spot tile), wRunAct (wW23RunAct: 'spot'), wLookText (the spot's own look),
   renderHelp (wW23RenderHelp: #wHelpSpots). */

const W_SPOT = { prize: { gold: 20, fans: 5 }, minutes: 60 };
const W_SPOTS = [
  { id: 'sp_cage', city: 'graftonbury', sport: 'baseball', name: 'The batting cage', at: [44, 14],
    look: 'A batting cage of rope net in the park, and a pitching mound with a bucket of balls.',
    coach: { id: 'tc_cage', at: [42, 13], name: 'Hattie Swing', kind: 'troll', look: { coat: '#c94a3a', acc: 'cap', hair: '#5e4026' },
      greet: 'Eye on the ball. No, the other eye.', job: 'I run the cage. A team can DRILL a swing here once a week, and if you think you know how BASEBALL scores, take my CHALLENGE.' } },
  { id: 'sp_hoop', city: 'graftonbury', sport: 'basketball', name: 'The hoop', at: [6, 32],
    look: 'A hoop on a post at the end of the training ground, the net long gone.',
    coach: { id: 'tc_hoop', at: [4, 30], name: 'Lanky Prue', kind: 'elf', look: { coat: '#e0742a', acc: 'scarf', hair: '#d8c890' },
      greet: 'Bend the knees. Everything is in the knees.', job: 'I coach the hoop. DRILL a shot with me once a week, or try my CHALLENGE about how BASKETBALL scores.' } },
  { id: 'sp_green', city: 'mossgate', sport: 'golf', name: 'The putting green', at: [7, 13],
    look: 'A putting green by the shrine garden, the moss cut short and a flag in the cup.',
    coach: { id: 'tc_green', at: [8, 12], name: 'Old Mulch', kind: 'gorgon', look: { coat: '#3d6a3a', acc: 'hat', hair: '#4b8c3f' },
      greet: 'Do not look at the hole. The hole looks at you.', job: 'I keep the green. DRILL a putt once a week, or take my CHALLENGE on how GOLF scores.' } },
  { id: 'sp_tilt', city: 'mossgate', sport: 'jousting', name: 'The tilting yard', at: [25, 4],
    look: 'A tilting yard of raked sand, and straw targets on posts, well stabbed.',
    coach: { id: 'tc_tilt', at: [25, 6], name: 'Dame Ferrow', kind: 'werewolf', look: { coat: '#3a5a9a', acc: 'helmet', hair: '#5e4026' },
      greet: 'Lance up. Higher. That is a lance, not a broom.', job: 'Master of the tilting yard. DRILL a pass at the targets once a week, or take my CHALLENGE on how JOUSTING scores.' } },
  { id: 'sp_skittle', city: 'saltmere', sport: 'bowling', name: 'The skittle alley', at: [15, 27],
    look: 'Nine skittles on the quay, and a wooden ball that has been in the sea at least once.',
    coach: { id: 'tc_skittle', at: [17, 27], name: 'Nan Tarry', kind: 'zombie', look: { coat: '#9b3a7a', acc: 'apron', hair: '#8a857e' },
      greet: 'Roll it. Do not throw it. The last one went in the harbour.', job: 'I set the skittles on the quay. DRILL a roll once a week, or take my CHALLENGE on how BOWLING scores.' } },
  { id: 'sp_stones', city: 'saltmere', sport: 'curling', name: 'The stone stack', at: [24, 28],
    look: 'Curling stones stacked by the sea wall, and a sheet chalked on the flags for practice.',
    coach: { id: 'tc_stones', at: [22, 27], name: 'Skip Brindle', kind: 'wraith', look: { coat: '#b83a3a', acc: 'robe', hair: '#cfe8f0' },
      greet: 'Sweep! No, stop sweeping. Now sweep!', job: 'I keep the stones dry, which is hard here. DRILL a delivery once a week, or take my CHALLENGE on how CURLING scores.' } },
  { id: 'sp_spar', city: 'cinderhold', sport: 'boxing', name: 'The sparring ring', at: [34, 26],
    look: 'A sparring ring roped off behind the smithy, a heavy bag hung from a forge chain.',
    coach: { id: 'tc_spar', at: [33, 26], name: 'Knuckles Brandt', kind: 'golem', look: { coat: '#8a1a1a', acc: 'apron', hair: '#6c625c' },
      greet: 'Hands up. Chin down. Do not hit the bag with your face.', job: 'The smith is my brother. I run the sparring ring. DRILL a combination once a week, or take my CHALLENGE on how BOXING scores.' } },
  { id: 'sp_kick', city: 'cinderhold', sport: 'football', name: 'The kick-about pitch', at: [26, 30],
    look: 'A pitch marked out in the ash between two crooked goals, and a ball patched with leather.',
    coach: { id: 'tc_kick', at: [26, 29], name: 'Cinders Malloy', kind: 'minotaur', look: { coat: '#3f7a3a', acc: 'goggles', hair: '#43332e' },
      greet: 'Pass it. Pass it! Somebody pass it to me.', job: 'I run the kick-about on the ash. DRILL a play once a week, or take my CHALLENGE on how FOOTBALL scores.' } },
  { id: 'sp_pond', city: 'rimewatch', sport: 'hockey', name: 'Pond hockey', at: [26, 22],
    look: 'Two little nets on the frozen pond, and a puck the children have lost under the snow.',
    coach: { id: 'tc_pond', at: [26, 23], name: 'Sister Puck', kind: 'witch', look: { coat: '#3a6ab8', acc: 'scarf', hair: '#eef2ef' },
      greet: 'Heads up on the ice! That was a very small child, and she is fine.', job: 'I mind the children on the pond, and the children mind the puck. DRILL a shot once a week, or take my CHALLENGE on how HOCKEY scores.' } },
  { id: 'sp_maker', city: 'rimewatch', sport: 'curling', name: 'The stone maker\'s bench', at: [31, 12],
    look: 'A stone maker\'s bench: granite rounds half shaped, handles in a box, and a polishing wheel.',
    coach: { id: 'tc_maker', at: [31, 11], name: 'Granite Hob', kind: 'dwarf', look: { coat: '#b83a3a', acc: 'apron', hair: '#a0a0a0' },
      greet: 'Every stone in the realm started on this bench. Some of them came back broken.', job: 'I make the stones for both sheets. DRILL a delivery with one of mine once a week, or take my CHALLENGE on how CURLING scores.' } },
];
// the spots in the cities' ambient lines
const W_SPOT_AMBIENT = {
  graftonbury: ['A ball cracks off a bat in the park cage, and somebody shouts "Mine!"', 'Somebody misses the hoop on the training ground, then misses it again.'],
  mossgate: ['A putt rolls round the cup by the shrine and stays out.', 'A lance thumps into a straw target in the tilting yard.'],
  saltmere: ['The skittles on the quay go down with a clatter, and a gull takes off.', 'A curling stone scrapes along the chalked flags by the sea wall.'],
  cinderhold: ['Gloves smack the heavy bag behind the smithy, steady as a hammer.', 'The kick-about on the ash stops for an argument, then starts again.'],
  rimewatch: ['Children on the pond shriek over a goal that may not have been a goal.', 'The stone maker\'s wheel whines, polishing a curling stone.'],
};
for (const c in W_SPOT_AMBIENT) W_CITIES[c].ambient.push(...W_SPOT_AMBIENT[c]);
function wSpot(id) { return W_SPOTS.find(s => s.id === id) || null; }

Object.assign(DB.tiles, { '!': { name: 'training spot', walk: 0, use: 'spot', look: 'A training spot.' } });

/* ---------- the spots and coaches go into the cities' layouts (built at boot by buildAllMaps) ---------- */
for (const s of W_SPOTS) {
  const def = W_CITIES[s.city], C = s.coach, sp = s.sport, kw = sp;
  def.decor.push(['!', s.at[0], s.at[1], { spot: s.id }]);
  def.npcs.push([C.id, C.at[0], C.at[1], 1]);
  DB.chars[C.id] = { name: C.name, kind: C.kind, look: C.look, greet: C.greet, topics: {
    job: { t: C.job },
    [kw]: { t: `${SPORTS[sp].desc} ${SPORT_BRIEF[sp] || ''}`.trim(), xp: 5 },
    drill: { t: 'Pick a card and we will work on it. An hour, and it is free.', act: 'spot' },
    challenge: { t: 'One question, once a week. Get it right and the purse is yours.', act: 'spot' },
  } };
}

/* ---------- the model ---------- */
function wSpotState(id) { const S = WG.spots = WG.spots || {}; return (S[id] = S[id] || { drill: -1, quiz: -1, right: 0 }); }
function wSpotCards(sp) {
  const ok = RUN.deck.filter(practicable), fit = ok.filter(c => sportFits(def(c)).includes(sp));
  return fit.length ? fit : ok;
}
function wSpotDrill(id, card) {
  const s = wSpot(id), st = s && wSpotState(id); if (!s) return 'There is no spot like that.';
  if (st.drill === wWeek()) return 'You have drilled here this week. Come back next week.';
  if (!card || !RUN.deck.includes(card) || !practicable(card)) return 'That card cannot take a drill.';
  card.sk = 1; st.drill = wWeek();
  achAdd('practice', 1);
  wAdvance(W_SPOT.minutes);
  wLog(`${s.coach.name} drills your team on ${wCardName(card.id, card.up)} at ${s.name.replace(/^The /, 'the ')} (★).`, 'm');
  wSave();
  return '';
}
// the question: how the sport scores, with two other sports' answers
function wSpotQuiz(id) {
  const s = wSpot(id), others = shuffle(Object.keys(SPORT_BRIEF).filter(k => k !== s.sport)).slice(0, 2);
  const opts = shuffle([s.sport].concat(others));
  return { q: `In a ${SPORT_NAME[s.sport].toLowerCase()} match, how do you score?`, opts, right: opts.indexOf(s.sport) };
}
function wSpotAnswer(id, sport) {
  const s = wSpot(id), st = wSpotState(id);
  if (st.quiz === wWeek()) return { ok: false, msg: 'You have had your question this week.' };
  st.quiz = wWeek();
  const ok = sport === s.sport;
  if (ok) {
    st.right++; RUN.gold += W_SPOT.prize.gold; RUN.fans = (RUN.fans || 0) + W_SPOT.prize.fans;
    wLog(`${s.coach.name}: "Right!" You win ${W_SPOT.prize.gold} gold and ${W_SPOT.prize.fans} fans.`, 'g');
  } else wLog(`${s.coach.name}: "Not quite. ${SPORT_BRIEF[s.sport]}" Try again next week.`, 'd');
  wSave();
  return { ok, msg: ok ? `Right! ${W_SPOT.prize.gold} gold and ${W_SPOT.prize.fans} fans.` : `Not quite: ${SPORT_BRIEF[s.sport]} Next week, then.` };
}

/* ---------- the spot's card ---------- */
function wOpenSpot(id, msg) {
  const s = wSpot(id); if (!s) return;
  const st = wSpotState(id), wk = wWeek(), drilled = st.drill === wk, asked = st.quiz === wk, S = SPORTS[s.sport];
  const close = modal(`<header><h3>${esc(s.name)}</h3><button class="ghost" data-close>Done</button></header>
    ${msg ? `<p class="${msg.ok ? 'wgood' : 'wbad'}" role="status">${esc(msg.t)}</p>` : ''}
    <p class="wpgsport">${sportSVG(s.sport, 26)}<span><b>${esc(SPORT_NAME[s.sport])}</b>: ${esc(S.rule)}.</span></p>
    <p class="hint">${esc(s.coach.name)} coaches here. Each week you can drill one card and take one challenge.</p>
    <ul class="wbclubs">
      <li class="wbcl"><span class="wbsw" style="background:${W_GRD_COL[s.sport]}"></span><div><b>Drill</b><small>A card that suits ${esc(SPORT_NAME[s.sport].toLowerCase())} gains Practice ★. Free, an hour.${drilled ? ' <b>Done this week.</b>' : ''}</small></div>
        <div class="row"><button class="btn" id="wSpotDrill" ${drilled ? 'disabled' : ''}>Drill a card</button></div></li>
      <li class="wbcl"><span class="wbsw" style="background:${W_GRD_COL[s.sport]}"></span><div><b>Challenge</b><small>One question on how ${esc(SPORT_NAME[s.sport].toLowerCase())} scores. Right: ${W_SPOT.prize.gold} gold and ${W_SPOT.prize.fans} fans.${asked ? ' <b>Done this week.</b>' : ''}${st.right ? ` Right ${st.right} time${st.right === 1 ? '' : 's'} here.` : ''}</small></div>
        <div class="row"><button class="ghost" id="wSpotQuiz" ${asked ? 'disabled' : ''}>Take the challenge</button></div></li>
    </ul>`);
  $('wSpotDrill').onclick = () => {
    close();
    wPickCard(wSpotCards(s.sport), 'Drill a card', `Cards that suit ${SPORT_NAME[s.sport].toLowerCase()} come first. The card gains Practice ★.`, card => {
      if (!card) return wOpenSpot(id);
      const r = wSpotDrill(id, card); wDrain();
      wOpenSpot(id, { ok: !r, t: r || `${wCardName(card.id, card.up)} gains Practice ★.` });
    });
  };
  $('wSpotQuiz').onclick = () => { close(); wSpotAsk(id); };
}
function wSpotAsk(id) {
  const s = wSpot(id), Q = wSpotQuiz(id);
  const close = modal(`<header><h3>${esc(s.coach.name)}'s challenge</h3><button class="ghost" data-close>Not now</button></header>
    <p class="wmsg">${esc(Q.q)}</p>
    <div class="wquiz">${Q.opts.map(k => `<button class="ghost" data-quiz="${k}">${esc(SPORT_BRIEF[k])}</button>`).join('')}</div>`, () => wDrain());
  $('modalBox').querySelectorAll('[data-quiz]').forEach(b => b.onclick = () => {
    const r = wSpotAnswer(id, b.dataset.quiz); close(); wDrain();
    wOpenSpot(id, { ok: r.ok, t: r.msg });
  });
}

/* ---------- the tile, the acts, the look ---------- */
const wW23Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), mt = m.meta[x + ',' + y];
  if (wTileAt(m, x, y) === '!' && mt && wSpot(mt.spot)) return LAB ? null : wOpenSpot(mt.spot);
  return wW23Use(x, y);
};
const wW23RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'spot') { const s = W_SPOTS.find(s => s.coach.id === id); return s && !LAB ? void wOpenSpot(s.id) : null; }
  return wW23RunAct(act, id);
};
const wW23LookText = wLookText;
wLookText = function (x, y) {
  const m = wCurMap(), mt = m.meta && m.meta[x + ',' + y];
  if (wTileAt(m, x, y) === '!' && mt && wSpot(mt.spot)) return wSpot(mt.spot).look;
  return wW23LookText(x, y);
};

/* ---------- How to play ---------- */
const wW23RenderHelp = renderHelp;
renderHelp = function () {
  wW23RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpSpots')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpSpots"><b>Training spots.</b> Every city has two, one for each sport its region plays, with a coach: a batting cage and a hoop at Graftonbury, a putting green and a tilting yard at Mossgate, skittles and curling stones at Saltmere, a sparring ring and a kick-about pitch at Cinderhold, pond hockey and the stone maker at Rimewatch. Once a week at each, drill a card that suits the sport (it gains Practice ★, free, an hour), and take the coach's challenge: say how the sport scores, and win ${W_SPOT.prize.gold} gold and ${W_SPOT.prize.fans} fans.</p>`);
};

/* ---------- drawing: one painter, a different thing per sport ---------- */
WOBJ['!'] = (c, P, r, e) => {
  const mt = wMeta(e.m, e.x, e.y) || {}, s = wSpot(mt.spot), sp = s ? s.sport : 'baseball', col = W_GRD_COL[sp];
  const disc = (x, y, rad, f, lw) => { const p = pEl(x, y, rad, rad); wFlat(c, p, f, lw || .8); };
  wShadow(c, 16, 29, 14, 3, .26);
  switch (sp) {
    case 'baseball': { // a net cage and a ball bucket
      c.save(); c.globalAlpha = .7; for (let x = 3; x <= 29; x += 3.25) wLine(c, [[x, 4], [x, 28]], .6, '#f4efe0'); for (let y = 6; y <= 27; y += 3.5) wLine(c, [[3, y], [29, y]], .6, '#f4efe0'); c.restore();
      for (const x of [3, 29]) wCel(c, pRR(x - 1.2, 2, 2.4, 27, .6), '#5a3d22', .5, 1);
      wCel(c, pRR(2, 1.5, 28, 2.4, .6), '#5a3d22', .5, 1);
      wCel(c, pRR(18, 20, 8, 8, 1.5), '#8a8f9a', .6, 1.1); for (const [x, y] of [[20, 20], [23, 19.5], [21.5, 18.5]]) disc(x, y, 1.6, '#f4efe0', .6);
      break;
    }
    case 'basketball': { // a hoop on a post
      wCel(c, pRR(14.8, 8, 2.6, 21, .6), '#3a3e4e', .5, 1.1);
      wCel(c, pRR(8, 2, 16, 10, 1), '#f4efe0', .6, 1.2); c.lineWidth = 1; c.strokeStyle = '#c83a3a'; c.strokeRect(12.5, 5, 7, 5);
      c.beginPath(); c.ellipse(16, 12.5, 4.2, 1.4, 0, 0, 7); c.lineWidth = 1.6; c.strokeStyle = '#e0742a'; c.stroke();
      disc(22, 26, 3, '#e0742a', .8);
      break;
    }
    case 'golf': { // a little green, a cup and a flag
      const g = pEl(16, 22, 14, 7); wCel(c, g, '#86c466', .8, 1.1);
      disc(19, 22, 1.6, '#111', .4); wLine(c, [[19, 22], [19, 4]], 1.2, '#efe4cc'); wFlat(c, pPoly([[19.5, 4], [28, 7], [19.5, 10]]), col === '#3d6a3a' ? '#e0533a' : col, .8);
      disc(10, 23, 1.4, '#f4efe0', .5);
      break;
    }
    case 'jousting': { // a straw target on a post
      wCel(c, pRR(14.8, 14, 2.6, 15, .6), '#5e4026', .5, 1.1);
      const t = pEl(16, 11, 9, 9); wCel(c, t, '#d8b25a', .8, 1.2);
      c.save(); c.clip(t); for (let i = -10; i < 10; i += 2.5) wLine(c, [[7 + i, 2], [17 + i, 20]], .6, 'rgba(110,80,30,.5)'); c.restore();
      for (const [rad, f] of [[6, '#c83a3a'], [3.6, '#f4efe0'], [1.6, '#c83a3a']]) disc(16, 11, rad, f, .6);
      break;
    }
    case 'bowling': { // nine skittles in a diamond
      const pts = [[16, 8], [12.5, 12], [19.5, 12], [9, 16], [16, 16], [23, 16], [12.5, 20], [19.5, 20], [16, 24]];
      for (const [x, y] of pts) { const p = new Path2D(); p.ellipse(x, y + 1.5, 2, 3, 0, 0, 7); wFlat(c, p, '#f4efe0', .7); disc(x, y - 2, 1.3, '#f4efe0', .6); wLine(c, [[x - 1.6, y], [x + 1.6, y]], .7, col); }
      disc(26, 27, 3.2, '#5a3d22', .8);
      break;
    }
    case 'curling': { // a stack of stones
      const stone = (x, y, f) => { wCel(c, pEl(x, y, 6, 3.4), '#8a8f9a', .6, 1.1); wFlat(c, pRR(x - 2.5, y - 3.6, 5, 1.8, .8), f, .6); };
      stone(10, 26, '#c83a3a'); stone(22, 26, '#3a6ab8'); stone(16, 21, '#c83a3a'); stone(16, 14, '#3a6ab8');
      if (s && s.id === 'sp_maker') { wCel(c, pRR(2, 5, 7, 6, 1), '#7a5a32', .5, 1); disc(27, 8, 4, '#a0a6b0', .8); }
      break;
    }
    case 'boxing': { // ring posts, ropes and a heavy bag
      for (const [x, y] of [[3, 10], [29, 10], [3, 28], [29, 28]]) wCel(c, pRR(x - 1.2, y - 8, 2.4, 9, .6), '#c83a3a', .5, 1);
      for (const y of [4, 8]) { wLine(c, [[3, y], [29, y]], 1, '#f4efe0'); wLine(c, [[3, y + 18], [29, y + 18]], 1, '#f4efe0'); }
      wLine(c, [[16, 2], [16, 8]], .9, '#3a2c22'); wCel(c, pRR(12.5, 8, 7, 13, 3), '#8a1a1a', .8, 1.2);
      break;
    }
    case 'football': { // a ball on a chalk spot, a cone
      disc(16, 22, 6, 'rgba(250,246,232,.65)', .4);
      const b = new Path2D(); b.ellipse(16, 17, 6, 4, -.3, 0, 7); wCel(c, b, '#8a4a2a', .8, 1.2); wLine(c, [[13, 17.5], [19, 16]], .8, '#f4efe0');
      wFlat(c, pPoly([[26, 27], [28, 18], [30, 27]]), '#e0743a', .8);
      break;
    }
    case 'hockey': { // a small net and a puck
      c.save(); c.globalAlpha = .6; for (let x = 7; x <= 25; x += 3) wLine(c, [[x, 8], [x + 1, 20]], .6, '#f4efe0'); c.restore();
      wLine(c, [[6, 20], [6, 8], [26, 8], [26, 20]], 2, '#c83a3a');
      c.beginPath(); c.ellipse(16, 26, 3, 1.4, 0, 0, 7); c.fillStyle = '#111'; c.fill();
      wLine(c, [[22, 28], [27, 18]], 1.6, '#8a5a32');
      break;
    }
  }
};
