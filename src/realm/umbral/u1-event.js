/* u1: the Umbral's epic event (issue #99, phase 1). Loads after u0-core.js; changes earlier parts only by reassignment
   (saved originals carry the wWU1 prefix).

   The scene (wUmbScene): the first time the world is free after the Umbral opens (after the Crown's ending, or on
   loading a journey that won it before), a staged scene in a window: the crown in your captain's hands, an eclipse
   over the Crown Coliseum at noon, the crowd falling silent, the smooth block beside the statue turning black, a
   sound from the north (the Road to Nowhere) and the ground shaking, and the Pale Herald walking out of the dark to tell you what it means.
   Skip ends it at once; however the first showing is closed, what it said goes in the log. The Journal's Umbral
   chapter plays it again. It is marked
   seen (WG.umbral.seen) as it starts. Never in LAB mode.
   The Pale Herald (DB.chars.uherald) stays by the statue in the Coliseum from then on, and answers about the PORTAL,
   the SEAL, the NADIR, the GATE and the ROAD.
   The Journal gains a chapter, The Umbral Realm, once it is open: what the herald said, the pieces (none yet), and the
   scene to see again.
   The light realm changes a little: an eclipse at midday, once a week to begin with and more often as the weeks go
   by with the portal open (the blight: up to W_UMB1.eclipseMax days a week), said at dawn; townsfolk mutter about
   their dreams of the other side; the innkeepers answer about DREAMS; the Coliseum's statue has its black block.

   W_UMB1, wUmbScene, wUmbEclipse
   Wraps: wNextPrompt (wWU1NextPrompt: the scene, once, after the Crown's ending), wSay (wWU1Say: an innkeeper's hello
   names the DREAMS), wStart (wWU1Start: the herald in or out of the Coliseum),
   wUmbralUnlock (wWU1UmbralUnlock: the herald, the flag topics wait on), wDarkness (wWU1Darkness: the eclipse),
   wNewDay (wWU1NewDay: the eclipse said at dawn), wAudit (wWU1Audit: the herald is placed by the unlock), wAmbient (wWU1Ambient: the dreams), wLookText (wWU1LookText: the
   statue), wOpenJournal (wWU1OpenJournal: the chapter shows once open), wRenderJournal (wWU1RenderJournal: its
   button). */

const W_UMB1 = {
  eclipseMax: 3, eclipseEvery: 4, eclipseDark: .28,   // one more eclipse day a week for every 4 weeks open, up to 3
  herald: [15, 13],                 // where the herald stands in the Coliseum, by the statue (or the nearest free tile)
  speech: [
    'Champions. You won it fair, and that is the trouble.',
    'The Crown was half of a seal. The other half kept a door shut, at the end of a road nobody made.',
    'When you lifted it, the Seal broke into nine pieces, one for every way there is to play. Nine champions on the other side took one each. They call themselves the Nadir.',
    'Go north, to the Road to Nowhere. The door is open now. Win the pieces back, bring them to the portal, forge the Seal, and close it.',
    'The one at the Gate, just through the door, is the gentlest. Start there. I will be here, by the statue, if you need telling twice.',
  ],
  dreams: ['Somebody at the next table says they dreamed of this town last night, only the signs were all wrong.',
    'A child asks why the shadows point north today. Nobody answers.',
    'Two old players argue about whether the moon was dead last night. Neither of them slept.',
    'A dog barks at the north road and will not stop.'],
};

DB.chars.uherald = { name: 'The Pale Herald', kind: 'lich', look: { coat: '#d8d4e8', acc: 'hat' },
  greet: 'You came back. Good. Ask me about the PORTAL, the SEAL and its PIECES, the NADIR, the GATE or the ROAD.',
  topics: {
    job: { t: 'I announce. Not games. Endings. Ask me about the SEAL.' },
    portal: { t: 'At the end of the Road to Nowhere, north of the Roost. It goes both ways: rest on this side, play on that one. Time runs on both.' },
    seal: { t: 'The Seal of the Crown. Nine pieces now, one for each way to play. Win all nine, bring them to the portal, and it can be forged whole again. Then the door shuts.' },
    nadir: { t: 'The other league. The same as ours, wrong. Their champions hold the pieces, and their captain is someone you have heard of, who never left the last game she lost.' },
    gate: { t: 'Just through the portal, where the road comes out. The card game, played straight. The gentlest of the nine. Start there.' },
    road: { t: 'The Road to Nowhere. Nobody made it. It is on your map now, north of the Roost. Walk to its end.' },
    pieces: { t: 'Nine. The baseball, the basketball, the golf, the card game, the bowling, the curling, the football, the boxing and the hockey. Each one held by a Nadir champion, each in their own region.' },
  } };
// (the flag topics wait on, set by the unlock: the audit counts it as set)
DB.engineFlags.push('umbral_open');
// the innkeepers have had dreams too, once the door is open
for (const id of ['hq_inn', 'moss_inn', 'salt_inn', 'cind_inn', 'rime_inn']) if (DB.chars[id]) { // (W_UMB1_INNS, below)
  DB.chars[id].topics.dreams = { need: 'umbral_open', needNo: 'Dreams? I sleep like a stone, and so would you after a day of my stairs.',
    t: 'Since the Crown? Everyone has the same one. This place, only darker, and the people in it are us but wrong, and they are waiting for something. Folk come down in the morning and do not want their breakfast.' };
}

// (talk links come from capitals in what they say: once the door is open, an innkeeper's hello mentions the DREAMS)
const W_UMB1_INNS = ['hq_inn', 'moss_inn', 'salt_inn', 'cind_inn', 'rime_inn'];
const wWU1Say = wSay;
wSay = function (id, kw) {
  const r = wWU1Say.apply(this, arguments);
  if (!kw && r && r.text && wFlag('umbral_open') && W_UMB1_INNS.includes(id)) r.text += ' You look tired. Everyone does, since the DREAMS started.';
  return r;
};

/* ---------- the herald in the Coliseum ---------- */
function wUmbHeraldSync() {
  const m = MAPS.coliseum; if (!m) return;
  const i = m.npcs.findIndex(n => n.id === 'uherald');
  if (wUmbOn() && i < 0) {
    const [hx, hy] = W_UMB1.herald, free = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return td && td.walk && !td.enter && !m.npcs.some(n => n.x === x && n.y === y) && !(WG && WG.map === 'coliseum' && WG.x === x && WG.y === y); };
    let at = free(hx, hy) ? [hx, hy] : null;
    for (let r = 1; !at && r < 5; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) if (free(hx + dx, hy + dy)) at = [hx + dx, hy + dy];
    if (at) m.npcs.push({ id: 'uherald', x: at[0], y: at[1], fixed: true });
  } else if (!wUmbOn() && i >= 0) m.npcs.splice(i, 1);
}
// the herald is placed when the Umbral opens, not by the map: the audit asks only that there is room for him by the statue
const wWU1Audit = wAudit;
wAudit = function () {
  const P = wWU1Audit.apply(this, arguments).filter(s => s !== 'character uherald is never placed on a map');
  const m = MAPS.coliseum, [hx, hy] = W_UMB1.herald, ok = !!m && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].some(([dx, dy]) => { const c = m.t[hy + dy] && m.t[hy + dy][hx + dx], td = c && DB.tiles[c]; return td && td.walk && !td.enter; });
  if (!ok) P.push('the Pale Herald has nowhere to stand by the Coliseum statue');
  return P;
};
const wWU1UmbralUnlock = wUmbralUnlock;
wUmbralUnlock = function () { const r = wWU1UmbralUnlock.apply(this, arguments); if (r) { wSetFlag('umbral_open'); wUmbHeraldSync(); } return r; };
const wWU1Start = wStart;
wStart = function () { const r = wWU1Start.apply(this, arguments); if (WG && WG.umbral && !wFlag('umbral_open')) wSetFlag('umbral_open'); wUmbHeraldSync(); return r; };

/* ---------- the scene ---------- */
const WUS = { raf: 0, speed: 1 };   // (speed: the checks play it faster)
function wUmbScene(replay) {
  const U = wUmb(); if (!U || LAB) return false;
  if (!replay) { U.seen = WG.dayAbs; wSave(); }
  const team = wPartyTeam(), party = wParty().slice(0, 3);
  const close = modal(`<header><h3>The Crown cracks</h3><button class="ghost" id="wUmbSkip">${replay ? 'Close' : 'Skip'}</button></header>
    <canvas id="wUmbCv" width="640" height="300" class="wumbcv" aria-label="The Crown Coliseum goes dark at noon, and a pale figure walks out onto the sand"></canvas>
    <div id="wUmbLines" class="wumblines" aria-live="polite"></div>
    <div class="row" id="wUmbEnd" hidden><button class="btn" id="wUmbGo">North, then</button></div>`, () => {
      cancelAnimationFrame(WUS.raf); WUS.raf = 0;
      if (!replay) wLog('The crown cracked, the Coliseum went dark at noon, and a pale herald said the Seal of the Crown is broken into nine pieces, held by the Nadir on the other side of a portal at the end of the Road to Nowhere. Win them back and forge the Seal. The herald waits by the Coliseum\'s statue.', 'b');
      WUI.hudKey = ''; wDrain();
    });
  const cv = $('wUmbCv'), c = cv.getContext('2d'), lines = $('wUmbLines'), t0 = performance.now();
  const say = (t, cls) => { lines.insertAdjacentHTML('beforeend', `<p class="${cls || ''}">${esc(t)}</p>`); lines.scrollTop = lines.scrollHeight; };
  const beats = [[1.2, 'Your captain lifts the crown. It cracks, a thin line of dark straight through it.', 'wumbn'], [3.6, 'At noon the sky over the Coliseum goes dark.', 'wumbn'],
    [6.4, 'The crowd falls silent. Beside the statue, the smooth block turns black.', 'wumbn'], [7.6, 'Something answers, far off to the north. The sand shakes.', 'wumbn'],
    [9.2, 'A pale figure walks out of the dark and onto the pitch.', 'wumbn']].concat(W_UMB1.speech.map((s, i) => [12.4 + i * 3.4, s, 'wumbh']));
  let said = 0, shook = false;
  const end = 12.4 + W_UMB1.speech.length * 3.4;
  const snd = (k) => { if (LAB || !SET.sfx) return; try {
    if (k === 'dark') { tone(98, 2.6, 'sine', .06, -30); tone(73, 3, 'triangle', .04, -10, .4); }
    else if (k === 'boom') { noise(.9, .16, 220, 1); tone(55, 1.2, 'sine', .07, -15); }
    else if (k === 'herald') { tone(392, .5, 'triangle', .035, 0); tone(370, .7, 'triangle', .035, 0, .45); tone(262, 1.1, 'triangle', .04, 0, .95); }
  } catch (e) { console.error(e); } };
  const rnd = mulberry(77), crowd = Array.from({ length: 150 }, (_, i) => ({ x: 20 + rnd() * 600, y: 120 + rnd() * 60 + (i % 3) * 6, c: ['#e0457b', '#f2c14e', '#6fd0e0', '#efe3c8'][i % 4], p: rnd() * 6 }));
  const frame = now => {
    if (!cv.isConnected) return;
    const t = (now - t0) / 1000 * WUS.speed, k = Math.max(0, Math.min(1, (t - 3) / 4)), W = 640, H = 300;
    while (said < beats.length && t >= beats[said][0]) {
      const b = beats[said++]; say(b[1], b[2]);
      if (said === 2) snd('dark'); if (said === 4) snd('boom'); if (said === 6) snd('herald');
    }
    if (t >= 7.6 && !shook) { shook = true; cv.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }], { duration: 650 }); }
    if (t >= end) $('wUmbEnd').hidden = false;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    // the sky, noon to eclipse
    const mixc = (a, b) => { const A = rgbOf(a), B2 = rgbOf(b); return `rgb(${A.map((v, i) => Math.round(v + (B2[i] - v) * k)).join(',')})`; };
    const g = c.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, mixc('#7fbfe8', '#120c1c')); g.addColorStop(1, mixc('#f2e2b0', '#3a2440'));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // the sun, and the dead moon sliding over it
    const sx = 500, sy = 62;
    c.save(); c.globalAlpha = 1 - k * .7; c.fillStyle = '#fff4c0'; c.beginPath(); c.arc(sx, sy, 34, 0, Math.PI * 2); c.fill(); c.restore();
    if (k > .9) { c.save(); c.strokeStyle = 'rgba(220,210,255,.7)'; c.lineWidth = 3; c.shadowColor = '#c8b8ff'; c.shadowBlur = 18; c.beginPath(); c.arc(sx, sy, 27, 0, Math.PI * 2); c.stroke(); c.restore(); }
    c.fillStyle = '#100a16'; c.beginPath(); c.arc(sx + 70 * (1 - k), sy - 30 * (1 - k), 26, 0, Math.PI * 2); c.fill();
    // the stands and the crowd (still once it is dark)
    c.fillStyle = mixc('#b89a74', '#2a2030'); c.beginPath(); c.ellipse(320, 250, 360, 140, 0, Math.PI, Math.PI * 2); c.fill();
    for (const p of crowd) { const bob = k < .8 ? Math.abs(Math.sin(t * 6 + p.p)) * 3 * (1 - k) : 0; c.fillStyle = k > .8 ? '#4a3a52' : p.c; c.fillRect(p.x, p.y - bob, 4, 5); }
    c.fillStyle = mixc('#e6d098', '#3c3236'); c.beginPath(); c.ellipse(320, 262, 300, 48, 0, 0, Math.PI * 2); c.fill();
    // the statue, and the block beside it
    c.fillStyle = mixc('#d8d0c0', '#6a6270'); c.fillRect(470, 182, 22, 48); c.beginPath(); c.arc(481, 176, 10, 0, Math.PI * 2); c.fill();
    const bk = Math.max(0, Math.min(1, (t - 6.2) / 1)); c.fillStyle = bk > 0 ? `rgb(${Math.round(200 - 190 * bk)},${Math.round(194 - 186 * bk)},${Math.round(180 - 166 * bk)})` : '#c8c2b4'; c.fillRect(500, 208, 26, 22);
    if (bk >= 1) { c.save(); c.globalAlpha = .4 + Math.sin(t * 3) * .2; c.shadowColor = '#c8b8ff'; c.shadowBlur = 16; c.strokeStyle = '#c8b8ff'; c.strokeRect(500, 208, 26, 22); c.restore(); }
    // your team with the crown, and the herald walking out of the dark
    party.forEach((p, i) => wDrawActor(c, { kind: p.kind, team: { color: team.color, light: team.light, short: team.short }, num: p.num, face: 'r', crown: i === 0, seed: i }, 280 + i * 44, 262, t, { size: 46 }));
    if (t >= 9) { const hk = Math.min(1, (t - 9) / 3.2), hx = -30 + 220 * hk; c.save(); c.globalAlpha = Math.min(1, (t - 9) * 1.5); wDrawActor(c, { kind: 'lich', col: '#d8d4e8', light: '#ffffff', face: 'r', walk: hk < 1 ? t * 10 : 0, seed: 9 }, hx, 262, t, { size: 50 }); c.restore(); }
    // the dark comes down over all of it
    if (k > 0) { c.fillStyle = `rgba(16,8,26,${k * .35})`; c.fillRect(0, 0, W, H); }
    c.restore();
    WUS.raf = requestAnimationFrame(frame);
  };
  WUS.raf = requestAnimationFrame(frame);
  $('wUmbGo').onclick = () => close();
  $('wUmbSkip').onclick = () => close();
  return true;
}
const wWU1NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (wWU1NextPrompt.apply(this, arguments)) return true;
  const U = wUmb();
  // (after the Crown's own ending, and after a card pick or a road event: those come first)
  if (U && !U.seen && !LAB && wActive() && !(typeof W11 !== 'undefined' && W11.ending) && !WG.cardOffer && !WG.event) { wUmbScene(false); return true; }
  return false;
};

/* ---------- the light realm: the eclipse, the dreams, the statue ---------- */
// today has an eclipse at midday: once a week to begin with, more often the longer the portal stands open
function wUmbEclipse() {
  const U = wUmb(); if (!U || U.sealed || !WG) return false;
  const since = Math.max(0, WG.dayAbs - U.at), n = Math.min(W_UMB1.eclipseMax, 1 + Math.floor(since / 7 / W_UMB1.eclipseEvery));
  return since > 0 && [0, 3, 5].slice(0, n).includes(since % 7);
}
const wWU1Darkness = wDarkness;
wDarkness = function () {
  const d = wWU1Darkness.apply(this, arguments);
  if (!WG || wUmbDark() || !wUmbEclipse()) return d;
  const h = wHour(); if (h < 11 || h >= 14) return d;
  // (a dark sky, kept under wIsNight's .3: the eclipse doesn't make midday count as night for anything else)
  return Math.max(d, W_UMB1.eclipseDark * Math.sin((h - 11) / 3 * Math.PI));
};
const wWU1NewDay = wNewDay;
wNewDay = function () { wWU1NewDay.apply(this, arguments); if (!LAB && wUmbEclipse()) wLog('An eclipse today: the sun goes out at midday for an hour or two. Nobody in the league will say what it means.', 'b'); };
const wWU1Ambient = wAmbient;
wAmbient = function (m, preReg) {
  wWU1Ambient.apply(this, arguments);
  if (!LAB && wUmbOn() && m && m.kind === 'town' && !m.umbral && WG.step % 13 === 0 && Math.random() < .3) wLog(pick(W_UMB1.dreams), 'd');
};
const wWU1LookText = wLookText;
wLookText = function (x, y) {
  const m = wCurMap();
  if (wUmbOn() && m && m.id === 'coliseum' && wTileAt(m, x, y) === 'G') return 'A statue of Aurelia Vance. The smooth block beside it, waiting for the next champion\'s name, has turned black, and it is cold to the touch.';
  return wWU1LookText.apply(this, arguments);
};

/* ---------- the Journal's chapter ---------- */
function wUmbJournal() {
  const U = wUmb(); if (!U) return [0, ''];
  const got = U.pieces.length;
  return [`${got}/9`, `<div class="wumbj"><p>The Crown cracked in your hands, and the Coliseum went dark at noon. The Pale Herald says the Seal of the Crown is broken into nine pieces, one for every way to play, and the Nadir hold them on the far side of a portal at the end of the Road to Nowhere, north of the Roost. Win them back, bring them to the portal, forge the Seal, and close the door. The herald waits by the statue in the Coliseum.</p>
    <p class="hint">Pieces won: ${got} of 9.${U.crossed ? ` You have crossed ${U.crossed} time${U.crossed === 1 ? '' : 's'}.` : ' You have not crossed yet.'}</p>
    <button class="ghost" data-umbscene="1">See it again</button></div>`];
}
const wWU1OpenJournal = wOpenJournal;
wOpenJournal = function () {
  const i = W_JTABS.findIndex(t => t[0] === 'umbral');
  if (wUmbOn() && i < 0) W_JTABS.push(['umbral', 'The Umbral Realm']);
  else if (!wUmbOn() && i >= 0) { W_JTABS.splice(i, 1); if (WJ.tab === 'umbral') WJ.tab = 'people'; }
  return wWU1OpenJournal.apply(this, arguments);
};
W_JTAB_FN.umbral = () => wUmbJournal();
const wWU1RenderJournal = wRenderJournal;
wRenderJournal = function () {
  const r = wWU1RenderJournal.apply(this, arguments);
  const b = document.querySelector('#wJBody [data-umbscene]'); if (b) b.onclick = () => { if (WJ.close) WJ.close(); wUmbScene(true); };
  return r;
};
