/* w159: a match kept after its deciding result is settled as the page comes back (issue #120, phase 1's review). Loads
   last, after the Umbral, so a result's end (a cup's round, a fixture, an Umbral champion's piece, a round of the Seal
   and a Hardcore journey's loss) finds every part's state as the load left it. The load's own first world draw (the
   base wStart shows the world, and each part's wNextPrompt runs) waits for it: WKEPT.loading is set through the whole
   load, and the prompts settle a decided match only when it is not (a match the load could not settle, the world not
   free, settles at the prompt after). A settle that throws is logged and leaves the match waiting (wKeptOne).

   Golf, bowling and curling from the world save the match at once as a shot, a ball or a stone settles, the deciding
   one too (w107, w116, w125). A page that went just then came back with a match already decided, and settled it only
   on Resume: Later left it waiting, its rewards or its loss with it, its cup round or fixture lost to the calendar. Now
   the load settles it, as the result would have in play (rewards, the head to head and the table, each player's line,
   the cup's or the Umbral's end, and the log line); its result card shows when the world is free (each part's
   wNextPrompt), never a match waiting. A curling stone left sliding comes to rest on its release first; one that
   didn't decide the match leaves it waiting, the stone at rest.

   WKEPT: { loading } while a journey loads. wKeptOne(f): one part's settle, guarded. wKeptEnds(): each part's
   wLinksKeptEnd, wLanesKeptEnd and wShedKeptEnd, once.
   Wraps: wStart (wW159Start: a journey loaded settles a decided match it kept). */

const WKEPT = { loading: false };
function wKeptOne(f) { try { f(); return true; } catch (e) { console.error(e); return false; } }
function wKeptEnds() {
  for (const f of [wLinksKeptEnd, wLanesKeptEnd, wShedKeptEnd]) {
    if (!RUN || RUN.over) return;
    wKeptOne(f);
  }
}
const wW159Start = wStart;
wStart = function (save) {
  let r; WKEPT.loading = true;
  try { r = wW159Start.apply(this, arguments); } finally { WKEPT.loading = false; }
  // (only back in the world: a card match or its reward panel picked up first settles it later, at the prompt)
  if (save && WG && RUN && !RUN.over && UI.view === 'world') wKeptEnds();
  return r;
};
