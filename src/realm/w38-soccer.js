/* w38: soccer at Rimewatch (issue #10). Loads after w37-map.js; changes earlier parts only by reassignment (saved
   originals carry the wW38 prefix).

   The Rimewatch Sheet was the realm's second curling ground. It is now the Hoarfrost Pitch, a soccer ground
   (w21-grounds.js), and the Frostspire plays hockey and soccer (w1-data.js). It keeps its id, g_sheet, so a home
   ground there, the fixtures drawn there and the journal carry over. Its record (WG.grd.rec.g_sheet) was curling,
   so an older save clears it once, with a line in the log. Contracts for curling in the Frostspire (taken, or on a
   board) can no longer be met, so they come down too. WG.soccer = 1 marks it done.

   Wrapped: wStart (wW38Start). */

const wW38Start = wStart;
wStart = function () {
  const r = wW38Start.apply(this, arguments);
  if (WG && WG.soccer !== 1) {
    const R = WG.grd && WG.grd.rec;
    if (R && R.g_sheet) { delete R.g_sheet; wLog('The Rimewatch Sheet is a soccer ground now: the Hoarfrost Pitch. Your curling record there is in the past.', 'g'); }
    const N = WG.notice, gone = c => c && c.region === 'rime' && c.sport === 'curling';
    if (N) {
      const n = (N.taken || []).filter(gone).length;
      N.taken = (N.taken || []).filter(c => !gone(c));
      for (const k in N.boards || {}) if (N.boards[k] && N.boards[k].list) N.boards[k].list = N.boards[k].list.filter(c => !gone(c));
      if (n) wLog(`${n === 1 ? 'A contract' : n + ' contracts'} for curling in the Frostspire came down: nobody curls there now.`, 'g');
    }
    WG.soccer = 1;
  }
  return r;
};
