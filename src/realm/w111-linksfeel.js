/* w111: the feel of golf (issue #92, phase 11), as w96 is for hockey. Sound on the course, tips and medals.

   Sound. Sudden Death's own effects (sfx), following your Sound effects setting, from the Links' shots (wGL.onShot) and
   the end (wGL.onOver): a strike for every full shot and a tap for a putt; the ball in the cup and the gallery for
   yours (a roar for a long putt or a chip that drops), a click for theirs; a splash for the water; a chime for a power,
   a potion or an enchantment (a bigger one for an ultimate, or the wyvern); and the horn and the gallery when you win.
   In a round you only watch, the first side (the home one) is yours for the gallery. Only while the course is on
   screen. The realm's music plays on, as it does at any ground (the Links' own track, The Long Fairway, is w26's).
   Tips. TIPS.w_links once your team can play golf (W_LKG.minOwn players), TIPS.w_divot once you have won a golf match.
   Achievements, on SD's ACH: golf matches won (realmLinksWins), Divot Cups (realmDivots), a hole in one by your side in
   a match from the world (realmAces), an eagle (realmEagles) and a win by 5 and 4 or more (realmRouts).

   Wraps: wGL.onShot (wW111OnShot: the sounds), wGL.onOver (wW111OnOver: the end), wLinksSettle (wW111LinksSettle),
   wDivotWon (wW111DivotWon), renderHelp (wW111RenderHelp: #wHelpLinksFeel after #wHelpLinksCup). */

const wLinksSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'links' && !!wGL.G && !!wGL.G.teams;
const WLKS = { casts: 0, pots: 0 };
function wLinksShotSound(e) {
  if (!wLinksSoundOn() || !e) return;
  const mine = e.side === wGL.you;
  // the casts and potions since the last shot: a chime (a bigger one for an ultimate)
  const C = wGL.casts, P = wGL.pots;
  if (C.length > WLKS.casts) { if (C.slice(WLKS.casts).some(c => c.k === 'ult')) sfx.crit(); else sfx.magic(); }
  if (P.length > WLKS.pots) sfx.magic();
  WLKS.casts = C.length; WLKS.pots = P.length;
  if (e.k === 'given') { sfx.card(); return; }
  if (e.k !== 'shot') return;
  if (e.club === 'pt') sfx.card(); else sfx.hit(0.45);
  if (e.holed) { if (mine) { sfx.coin(); sfx.crowd(e.club !== 'pt' || e.d0 >= 5 ? 1.8 : 0.7); } else sfx.card(); }
  else if (e.water) sfx.block();
  else if (e.club !== 'pt' && e.lie === 'G' && e.d1 <= 3 && mine) sfx.crowd(0.6);
  if (e.ench === 'wyvern') sfx.crit(); else if (e.ench === 'mimic' || e.ench === 'troll') sfx.crunch(); else if (e.ench) sfx.magic();
  if (e.bees) sfx.hurt();
}
function wLinksEndSound(s) {
  if (!wLinksSoundOn() || !s) return;
  // (a round you only watch ends with the horn and the gallery)
  if (wGL.mode === 'watch' && !(WGL && WGL.world)) { sfx.horn(); sfx.crowd(1.4); return; }
  if (s.win === wGL.you) { sfx.horn(); sfx.crowd(2); } else sfx.bad();
}
const wW111OnShot = wGL.onShot;
wGL.onShot = e => { if (wW111OnShot) wW111OnShot(e); try { wLinksShotSound(e); } catch (er) { console.error(er); } };
const wW111OnOver = wGL.onOver;
wGL.onOver = s => { if (wW111OnOver) wW111OnOver(s); try { wLinksEndSound(s); } catch (er) { console.error(er); } };

Object.assign(TIPS, {
  w_links: ['Golf', 'Your team is big enough for golf. Open the Team screen (C), then the Links tab: set your four and a role for each, then Play a match against the local side or a rival club. Agatha Divot at Mossgate Links books matches too: ask for a MATCH.'],
  w_divot: ['The Divot Cup', 'Golf has its own cup, every week. Ask Agatha Divot at Mossgate Links about the CUP, or use the Divot Cup button on the Links tab. Win it and your four keep her Divot Cup for the week.'],
});
function wLinksTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_LKG.minOwn) tip('w_links');
  if (WG.lkg && WG.lkg.w > 0) tip('w_divot');
}
setInterval(wLinksTips, 700);

ACH.push(
  { id: 'w_links', n: 'Fairway Finders', d: 'Win golf matches at Mossgate Links', stat: 'realmLinksWins', at: [1, 10, 30] },
  { id: 'w_divot', n: 'Divot Keepers', d: 'Win the Divot Cup', stat: 'realmDivots', at: [1, 3, 8] },
  { id: 'w_ace', n: 'In One', d: 'Your side holes a tee shot in a golf match', stat: 'realmAces', at: [1, 3, 10] },
  { id: 'w_eagle', n: 'Eagle Eyed', d: 'Your side makes an eagle (two under par) in a golf match', stat: 'realmEagles', at: [1, 5, 20] },
  { id: 'w_rout', n: 'Five and Four', d: 'Win a golf match by 5 and 4 or more', stat: 'realmRouts', at: [1, 3, 10] },
);
// how big a win is: "5 and 4" is 5 up with 4 to play; the up is what counts
const wLinksMargin = text => { const m = /^(\d+) and (\d+)$/.exec(text || ''); return m ? +m[1] : 0; };
const wW111LinksSettle = wLinksSettle;
wLinksSettle = function (sum) {
  const S = sum || {}, m = wW111LinksSettle.apply(this, arguments);
  if (LAB) return m;
  if (S.win === 0) { achAdd('realmLinksWins', 1); if (wLinksMargin(S.text) >= 5) achAdd('realmRouts', 1); }
  const aces = (S.log || []).filter(e => e.k === 'shot' && e.side === 0 && e.lie0 === 'T' && e.holed).length;
  if (aces) achAdd('realmAces', aces);
  const eagles = S.stat && S.stat[0] ? S.stat[0].eagles || 0 : 0;
  if (eagles) achAdd('realmEagles', eagles);
  return m;
};
const wW111DivotWon = wDivotWon;
wDivotWon = function () { wW111DivotWon(); if (!LAB) achAdd('realmDivots', 1); };

const wW111RenderHelp = renderHelp;
renderHelp = function () {
  wW111RenderHelp();
  const d = $('wHelpLinksCup'); if (!d || $('wHelpLinksFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinksFeel"><b>On the course</b> you hear the strike of every shot and the tap of a putt, the ball in the cup and the gallery for your holed shots (a roar for a long one), the water, and a chime for a power, a potion or an enchantment; sounds follow your Sound effects setting, and the realm's music plays on. Golf matches won, Divot Cups, a hole in one, an eagle and a win by 5 and 4 or more have medals in the record book.</p>`);
};
