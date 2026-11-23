/* u4i: the champions' conditions (issue #99, "some champions also want a condition"). Loads after the sports'
   parts (u4a..u4h); changes earlier parts only by reassignment (saved originals carry the wWU4I prefix).

   Four of the eight sports' champions want more than a win (W_UMB4I.conds, kept on each one's W_NADIR entry as C.cond):
     night   Vesper Gloam (basketball) and Sexton Vale (golf) play only after dark: by day, the game is turned away
             once everything else is in order (the guards beaten, the gate's item handed over, the toll affordable),
             so their other asks come first; a game left half-played resumes whatever the hour.
     margin  Vesper Quill (baseball) and Hollis Grael (hockey), the two the journey lab found the easiest, want it won
             by two or more: a win by less pays the game's own XP, gold and fans as any win does, but the piece stays
             with them and it counts as a try (the next costs the toll). The result card and the log say so, after the
             final score. (A hockey win in overtime or the shootout is always by one goal: the card says so.)
   The condition is named first in the champion's game card's body, and in the log when the card opens. The Seal's
   final rounds have none (u5 builds them without C.cond).

   W_UMB4I
   Wraps: W_UMB4.start for the night champions' engines (wWU4IStart: by day, turned away), wNadirMatch
   (wWU4INadirMatch: the condition named on the card), W_ON_END.unadir_ball and W_ON_END[W_UMB4E.kind] (wWU4IEnd: a
   win by less than the margin is reported as a loss), wBallSettle and wRinkSettle (wWU4IBallSettle, wWU4IRinkSettle:
   the margin's words after the final, on the result card and in the log). */

const W_UMB4I = {
  conds: {
    court: { k: 'night', n: 'plays only after dark' },
    links: { k: 'night', n: 'plays only after dark' },
    diamond: { k: 'margin', by: 2, n: 'wants it won by two runs or more', unit: ['run', 'runs'] },
    rink: { k: 'margin', by: 2, n: 'wants it won by two goals or more', unit: ['goal', 'goals'], more: 'A win in overtime or the shootout is by one goal, so it won\'t do.' },
  },
  kinds: { diamond: 'unadir_ball', rink: W_UMB4E.kind },
  note: null, settling: 0,   // (the margin's words, while a settle runs: shown after its final)
};
for (const id in W_UMB4I.conds) if (W_NADIR[id]) W_NADIR[id].cond = W_UMB4I.conds[id];
const wUmbCondWho = C => DB.chars[C.char] ? DB.chars[C.char].name : 'The champion';

// night: the adapter is where the game would start (u4 has checked the guards, the gate and the toll by then)
for (const id in W_UMB4I.conds) {
  const e = W_UMB4I.conds[id].k === 'night' && W_NADIR[id] && W_NADIR[id].engine, wWU4IStart = e && W_UMB4.start[e];
  if (!wWU4IStart) continue;
  W_UMB4.start[e] = function (C) {
    const cd = C && C.cond, live = W_UMB4.live[e] && W_UMB4.live[e]();
    if (cd && cd.k === 'night' && !live && !wIsNight()) return `${wUmbCondWho(C)} ${cd.n}. Come back when it is dark.`;
    return wWU4IStart.apply(this, arguments);
  };
}

// the condition named, first in the card's body (the cards are a <header> row, then a .wmsg body), when a card opens
const wWU4INadirMatch = wNadirMatch;
wNadirMatch = function (id) {
  const C = W_NADIR[id], U = wUmb(), cd = C && C.cond, open0 = !$('modal').hidden;
  const why = wWU4INadirMatch.apply(this, arguments);
  if (why || !cd || !U || U.pieces.includes(C.piece) || LAB || open0 || $('modal').hidden) return why;
  const box = $('modalBox'), who = wUmbCondWho(C);
  if (!box || box.querySelector('.wumbcond')) return why;
  wLog(`${who} ${cd.n}.`, 'd');
  const p = document.createElement('p'); p.className = 'hint wumbcond';
  p.innerHTML = `<b>${esc(who)} ${esc(cd.n)}.</b>${cd.k === 'margin' ? ' A win by less pays as a win, but the piece stays with them.' : ''}${cd.more ? ' ' + esc(cd.more) : ''}`;
  const body = box.querySelector('.wmsg'), head = box.querySelector('header');
  if (body) body.prepend(p); else if (head) head.after(p); else box.prepend(p);
  return why;
};

// a win by less than the margin: the game pays as a win (its own settle), the piece stays and it counts a try
for (const id in W_UMB4I.kinds) {
  const kind = W_UMB4I.kinds[id], wWU4IEnd = W_ON_END[kind];
  W_ON_END[kind] = function (r, ref, W) {
    const C = ref && ref.id && W_NADIR[ref.id], cd = C && C.cond;
    if (r === 'win' && cd && cd.k === 'margin' && W && typeof W.us === 'number' && typeof W.them === 'number' && W.us - W.them < cd.by) {
      const d = W.us - W.them;
      const t = `You won ${W.us} to ${W.them}, by ${d} ${cd.unit[d === 1 ? 0 : 1]}, but ${wUmbCondWho(C)} wanted it by ${cd.by}. The piece stays with them.`;
      if (W_UMB4I.settling) W_UMB4I.note = t; else wLog(t, 'b');
      r = 'lose';
    }
    return wWU4IEnd.call(this, r, ref, W);
  };
}
// the settle logs its final after the end's dispatch and returns it for the result card: the margin's words follow it
const wUmbCondSettle = orig => function () {
  W_UMB4I.settling++; W_UMB4I.note = null; let m;
  try { m = orig.apply(this, arguments); } finally { W_UMB4I.settling--; }
  const n = W_UMB4I.note; W_UMB4I.note = null;
  if (!n) return m;
  wLog(n, 'b');
  return typeof m === 'string' ? `${m} ${n}` : m;
};
const wWU4IBallSettle = wBallSettle, wWU4IRinkSettle = wRinkSettle;
wBallSettle = wUmbCondSettle(wWU4IBallSettle);
wRinkSettle = wUmbCondSettle(wWU4IRinkSettle);
