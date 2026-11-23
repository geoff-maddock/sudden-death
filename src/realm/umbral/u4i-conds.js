/* u4i: the champions' conditions (issue #99, "some champions also want a condition"). Loads after the sports'
   parts (u4a..u4h); changes earlier parts only by reassignment (saved originals carry the wWU4I prefix).

   Four of the eight sports' champions want more than a win (W_UMB4I.conds, kept on each one's W_NADIR entry as C.cond):
     night   Vesper Gloam (basketball) and Sexton Vale (golf) play only after dark: by day, PLAY is turned away (a game
             left half-played resumes whatever the hour).
     margin  Vesper Quill (baseball) and Hollis Grael (hockey), the two the journey lab found the easiest, want it won
             by two or more: a win by less pays the game's own XP, gold and fans as any win does, but the piece stays
             with them and it counts as a try (the next costs the toll).
   The condition is named on the champion's game card (above the card's own words) and in the log at PLAY. The Seal's
   final rounds have none (u5 builds them without C.cond).

   W_UMB4I
   Wraps: wNadirMatch (wWU4INadirMatch: night turned away, the condition named), W_ON_END.unadir_ball and
   W_ON_END[W_UMB4E.kind] (wWU4IEnd: a win by less than the margin is reported as a loss). */

const W_UMB4I = {
  conds: {
    court: { k: 'night', n: 'plays only after dark' },
    links: { k: 'night', n: 'plays only after dark' },
    diamond: { k: 'margin', by: 2, n: 'wants it won by two runs or more', unit: ['run', 'runs'] },
    rink: { k: 'margin', by: 2, n: 'wants it won by two goals or more', unit: ['goal', 'goals'] },
  },
  kinds: { diamond: 'unadir_ball', rink: W_UMB4E.kind },
};
for (const id in W_UMB4I.conds) if (W_NADIR[id]) W_NADIR[id].cond = W_UMB4I.conds[id];

const wWU4INadirMatch = wNadirMatch;
wNadirMatch = function (id) {
  const C = W_NADIR[id], U = wUmb(), cd = C && C.cond;
  if (!cd || !U || U.pieces.includes(C.piece)) return wWU4INadirMatch.apply(this, arguments);
  const who = DB.chars[C.char] ? DB.chars[C.char].name : 'The champion';
  const live = C.engine && W_UMB4.live[C.engine] && W_UMB4.live[C.engine]();
  if (cd.k === 'night' && !live && !wIsNight()) return `${who} ${cd.n}. Come back when it is dark.`;
  const why = wWU4INadirMatch.apply(this, arguments);
  if (why || live) return why;
  wLog(`${who} ${cd.n}.`, 'd');
  const box = $('modalBox');
  if (!LAB && box && !$('modal').hidden && !box.querySelector('.wumbcond')) {
    const p = document.createElement('p'); p.className = 'hint wumbcond'; p.innerHTML = `<b>${esc(who)} ${esc(cd.n)}.</b>${cd.k === 'margin' ? ' A win by less pays as a win, but the piece stays with them.' : ''}`;
    const h = box.querySelector('h2, h3'); if (h) h.after(p); else box.prepend(p);
  }
  return why;
};

// a win by less than the margin: the game pays as a win (its own settle has run), the piece stays and it counts a try
for (const id in W_UMB4I.kinds) {
  const kind = W_UMB4I.kinds[id], wWU4IEnd = W_ON_END[kind];
  W_ON_END[kind] = function (r, ref, W) {
    const C = ref && ref.id && W_NADIR[ref.id], cd = C && C.cond;
    if (r === 'win' && cd && cd.k === 'margin' && W && typeof W.us === 'number' && typeof W.them === 'number' && W.us - W.them < cd.by) {
      const d = W.us - W.them, who = DB.chars[C.char] ? DB.chars[C.char].name : 'The champion';
      wLog(`You won ${W.us} to ${W.them}, by ${d} ${cd.unit[d === 1 ? 0 : 1]}, but ${who} wanted it by ${cd.by}. The piece stays with them.`, 'b');
      r = 'lose';
    }
    return wWU4IEnd.call(this, r, ref, W);
  };
}
