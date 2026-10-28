/* w38: soccer at Rimewatch (issue #10). Loads after w37-map.js; changes earlier parts only by reassignment (saved
   originals carry the wW38 prefix).

   The Rimewatch Sheet was the realm's second curling ground. It is now the Hoarfrost Pitch, a soccer ground
   (w21-grounds.js), and the Frostspire plays hockey and soccer (w1-data.js). It keeps its id, g_sheet, so a home
   ground there, the fixtures drawn there and the journal carry over. Its record (WG.grd.rec.g_sheet) was curling,
   so an older save clears it once, with a line in the log; WG.soccer = 1 marks it done.

   Wrapped: wStart (wW38Start). */

const wW38Start = wStart;
wStart = function () {
  const r = wW38Start.apply(this, arguments);
  if (WG && WG.soccer !== 1) {
    const R = WG.grd && WG.grd.rec;
    if (R && R.g_sheet) { delete R.g_sheet; wLog('The Rimewatch Sheet is a soccer ground now: the Hoarfrost Pitch. Your curling record there is in the past.', 'g'); }
    WG.soccer = 1;
  }
  return r;
};
