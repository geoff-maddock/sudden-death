/* The Anvil Ring: hexes (issue #99, phase 4c). A bout in the Umbral may carry one or two (opts.hexes, ids in
   BX_HEXES), each against one side (opts.hexOn, 0 when not given: the Realm's own side is always 0). They are
   announced in the log before the first bell, named on the tale of the tape and between rounds, and kept on the
   scoreboard all bout. With no hexes the bout is exactly as it was (G.hex is never set, and nothing draws from the
   random stream).
     shrink  the ropes close in BX_HEXES.shrink.rope feet a round (never nearer than BX_HEX_ROPE): less room to back
             away, and the ropes come sooner, for both fighters (bxRope, read wherever the ropes are)
     water   the hexed side's water is tainted: between rounds it gets back only a share of the breath and health the
             break would give (07-bout.js's corner)
     lead    the hexed side's gloves are heavy: every punch costs more breath (05-ring.js's bxAct)
     count   the referee counts fast over the hexed side: it needs a longer count to rise (07-bout.js's knockdown)
   G.hex, plain JSON: { ids, on }. */
const BX_HEXES = {
  shrink: { n: 'The Shrinking Ring', short: 'Shrinking Ring', desc: 'The ropes close in two feet every round: less room to back away, and the ropes come sooner.', rope: 2 },
  water: { n: 'Tainted Water', short: 'Tainted Water', desc: 'Your corner\'s water is tainted: between rounds your fighter gets back only four fifths of the breath and health they would.', corner: .8 },
  lead: { n: 'Leaden Gloves', short: 'Leaden Gloves', desc: 'Your fighter\'s gloves are heavy: every punch costs a tenth more breath.', sta: 1.1 },
  count: { n: 'The Quick Count', short: 'Quick Count', desc: 'The referee counts fast over your fighter: they need a count of two more to get up.', rise: 2 },
};
const BX_HEX_ROPE = 5;
function bxHexStart(o) {
  const ids = (o.hexes || []).filter((k, i, a) => BX_HEXES[k] && a.indexOf(k) === i);
  if (!ids.length) return;
  G.hex = { ids, on: o.hexOn === 1 ? 1 : 0 };
  for (const k of ids) bxLog(`Hex: ${BX_HEXES[k].n}. ${BX_HEXES[k].desc}`, true);
}
// whether hex k is on in this bout (and, given a fighter, whether it is against them)
const bxHex = (f, k) => !!(G && G.hex && G.hex.ids.includes(k) && (f == null || f.side === G.hex.on));
// where the ropes are now (the Shrinking Ring moves them in each round)
function bxRope() { return G && G.hex && G.hex.ids.includes('shrink') ? Math.max(BX_HEX_ROPE, BX_RING.rope - BX_HEXES.shrink.rope * (G.round - 1)) : BX_RING.rope; }
// the hexes on now, short, for the scoreboard
const bxHexWords = (long) => G && G.hex ? G.hex.ids.map(k => long ? BX_HEXES[k].n : BX_HEXES[k].short).join(' · ') : '';
