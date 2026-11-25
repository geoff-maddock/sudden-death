/* w152: Fenna Moss at the Tilting Lists (issue #117, phase 5's fan), as w131 is the Shed's Tilda Spindle. Fenna is the
   Lists' fan, an elf: "I come for the lances breaking. The sound. Nobody else understands." She stands at the rail for
   every match at the Lists (the exhibition, the practice match and the matches from the world; not the tilting yard)
   and cheers from it: a line under the lists after a course with a lance broken, a helm break or an unhorsing
   (W_FENNA_RAIL, the biggest moment of the course; nothing for a glance or a miss). Ask her about the SOUND, or where
   she stands at the RAIL.
   Ask her to PLAY: until your four has won a jousting match from the world she doesn't believe you have a side. Once
   you have, she joins your team, once a journey: an elf at the team's level (wStarLvl), the steadiest lance there is
   (her jousting lance at the cap). A full roster asks who goes, as any recruit does; turned down, she waits at camp
   (sign her there). After that she greets you as one of your own; let go, she goes back to the rail. Her greeting
   names her topics.
   WG.flags: fenna_joined (she has joined: once a journey)
   WJT.rail   her lines this match (for the page and the checks)
   wFennaReady(), wFennaState() ('team', 'camp', 'gone', 'ready' or 'no'), wFennaJoin() (the PLAY topic's act,
   'fennaplay'), wFennaRail(last) (her line for a course, or '')
   Wraps: wJT.onPhase (wW152OnPhase: her line after a course), wListsGame (wW152ListsGame: the rail cleared), wSay
   (wW152Say: her greeting and the PLAY answer, which change), wRunAct (wW152RunAct: 'fennaplay'), wAddPlayer
   (wW152AddPlayer: her lance), wListsHowHTML (wW152ListsHow), renderHelp (wW152RenderHelp: a line in #wHelpListsGame). */

const W_FENNA = { n: 'Fenna Moss', kind: 'elf', flav: 'The Lists\' loudest fan, at last on the sand herself. She came for the sound.' };
const W_FENNA_RAIL = {
  unhorse: ['Down! Right down in the sand! Did you hear that? Did you HEAR that?', 'Unhorsed! Oh, the crash of it. I felt that in my teeth.', 'Out of the saddle! That is the best sound in the world, and it is mine.'],
  helm: ['On the helm! That ringing. Oh, that ringing.', 'A helm break! It sang. Did anybody else hear it sing?', 'Right on the helm! I will be humming that all week.'],
  both: ['Both lances at once! Two cracks, one sound. I will dream about that.', 'Two at once! Nobody else understands. Nobody.'],
  brk: ['Crack! That is the sound. That is the one.', 'There it is! Ash wood, all over the sand.', 'Snap! Lovely. Again, again!', 'A clean break! You could hear it in Graftonbury.'],
};
// her line for a course (wJT.last), the biggest moment of it; '' for a course of glances and misses
function wFennaRail(L) {
  if (!L || !L.broke) return '';
  const k = L.unhorsed && L.unhorsed.length ? 'unhorse' : L.broke.some((b, s) => b && L.zone[s] === 'helm') ? 'helm' : L.broke[0] && L.broke[1] ? 'both' : L.broke.some(Boolean) ? 'brk' : '';
  return k ? pick(W_FENNA_RAIL[k]) : '';
}
$('wListsBoard').previousElementSibling.insertAdjacentHTML('beforebegin', '<p id="wListsRail" class="hint wjtrail" hidden></p>');
const wW152OnPhase = wJT.onPhase;
wJT.onPhase = ph => {
  wW152OnPhase(ph);
  if (ph !== 'after' || !WJT || WJT.yard) return;
  const said = wFennaRail(wJT.last); if (!said) return;
  WJT.rail = (WJT.rail || []).concat(said);
  const el = $('wListsRail'); el.innerHTML = `<b>${esc(W_FENNA.n)}</b>, at the rail: "${esc(said)}"`; el.hidden = false;
};
const wW152ListsGame = wListsGame;
wListsGame = function (opts) { const r = wW152ListsGame(opts); $('wListsRail').hidden = true; $('wListsRail').textContent = ''; if (WJT) WJT.rail = []; return r; };

(() => {
  const F = DB.chars.gf_lists; if (!F) return;
  F.topics.sound = { t: 'A lance breaking on a shield. Ash wood, a crack, then the splinters all coming down at once. A helm break rings, too, like a bell somebody dropped. I have heard them all. I keep count.' };
  F.topics.rail = { t: 'Front of the gallery, at the rail by the tilt, every match. You will hear me. Everyone hears me. Sir Ruddock asked me to stand further back once. I did not.' };
  F.topics.play = { t: 'You want me to PLAY? To ride, for your side?', act: 'fennaplay' };
  F.topics.job = { t: 'I watch. I listen, mostly. Ask me about the SOUND, or where I stand at the RAIL. Or ask me to PLAY. Nobody ever has.' };
})();
const wFennaReady = () => !!(WG && WG.jtg && WG.jtg.w > 0);
const wFennaIs = p => p && p.n === W_FENNA.n && p.kind === W_FENNA.kind;
function wFennaState() {
  if (wRoster().some(wFennaIs)) return 'team';
  if ((WG.wwait || []).some(wFennaIs)) return 'camp';
  if (wFlag('fenna_joined')) return 'gone';
  return wFennaReady() ? 'ready' : 'no';
}
const W_FENNA_SAY = {
  no: 'Ride for you? Win a jousting match here first, a real one against a club, and I will believe you have a side.',
  ready: 'You mean it? I have been practising on the straw targets for years. Nobody watches the straw targets. I will be at the Lists before you are.',
  full: 'You mean it? Your team is full, though. Make room for me and I am yours.',
  camp: 'I am waiting at your camp with my lance. Sign me there when you have room.',
  team: 'I am on your team already. Put me on a horse.',
  gone: 'You let me go. I am back at the rail. It is still the best seat in the house.',
};
function wFennaPlaySay() { const st = wFennaState(); return st === 'ready' && wRoster().length >= W_PARTY.max ? W_FENNA_SAY.full : W_FENNA_SAY[st]; }
function wFennaJoin() {
  if (!WG) return '';
  if (wFennaState() !== 'ready') return wFennaPlaySay();
  // (the flag is set when she really joins, in wAddPlayer: a full roster you won't make room on sends her to camp)
  wRecruitTopic({ kind: W_FENNA.kind, n: W_FENNA.n, lvl: wStarLvl(), flav: W_FENNA.flav });
  return '';
}
const wW152RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'fennaplay') { wFennaJoin(); return; } return wW152RunAct.apply(this, arguments); };
const wW152Say = wSay;
wSay = function (id, kw) {
  const r = wW152Say(id, kw);
  if (id !== 'gf_lists' || !WG || !r) return r;
  if (!(kw || '').trim()) { const st = wFennaState();
    return Object.assign({}, r, { text: st === 'team' ? 'Back at the Lists? I still come early, for the sound. Then I get to make it.'
      : st === 'camp' ? 'My lance is packed and waiting at your camp. Ask me about the SOUND, while you are here.'
      : st === 'gone' ? 'Back at the rail, me. Ask me about the SOUND, if you joust today.'
      : `${r.text} Ask me about the SOUND, or where I stand at the RAIL. Or ask me to PLAY.` }); }
  if (r.key === 'play') return Object.assign({}, r, { text: wFennaPlaySay() });
  return r;
};
const wW152AddPlayer = wAddPlayer;
wAddPlayer = function (p) {
  const q = wW152AddPlayer(p);
  // (she joins once: the flag, her lance at the cap, off the camp list if she was on it, and saved with all of it)
  if (wFennaIs(q) && !wFlag('fenna_joined')) { wSetFlag('fenna_joined'); WG.wwait = (WG.wwait || []).filter(x => !wFennaIs(x)); const b = wJtOf(q); if (b) b.lance = Math.max(b.lance, wJtCap()); wSave(); }
  return q;
};
const wW152ListsHow = wListsHowHTML;
wListsHowHTML = function () { return wW152ListsHow() + `<p class="hint" id="wListsHowFenna"><b>Fenna Moss</b>, the Lists' fan, cheers from the rail after a lance broken, a helm break or an unhorsing. Win a jousting match from the world and she will PLAY for you.</p>`; };
const wW152RenderHelp = renderHelp;
renderHelp = function () {
  wW152RenderHelp();
  const g = $('wHelpListsGame'); if (!g || g.querySelector('.wfenna')) return;
  g.insertAdjacentHTML('beforeend', ` <span class="wfenna">Fenna Moss, the Lists' fan, cheers the breaks from the rail; win a match there and she will PLAY for you.</span>`);
};
