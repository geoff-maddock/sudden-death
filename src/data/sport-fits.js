/* What a card is good at, worked out from what it does. Shown on the card as small sport glyphs. */
function sportFits(d) {
  if (!d || ['junk', 'curse', 'status'].includes(d.type)) return [];
  let top = 0, hits = 0, all = false, blk = 0, draw = 0;
  const walk = ops => { for (const o of ops || []) {
    if (o[0] === 'd') { top = Math.max(top, o[1] * (o[2] || 1)); hits += o[2] || 1; if ((o[3] || d.tgt) === 'all') all = true; }
    if (o[0] === 'b') blk += o[1]; if (o[0] === 'draw') draw += o[1];
    if (o[0] === 'roll') { walk(o[2]); } } };
  walk(d.fx);
  const score = {};
  const add = (s, n) => score[s] = (score[s] || 0) + n;
  if (d.sport) add(d.sport, 6);
  if (all) add('bowling', 5);
  if (top >= 20) add('golf', 4);
  if (top >= 12) { add('hockey', 4); add('jousting', 3); }
  if (top >= 8) add('basketball', 2);
  if (top > 0 && d.cost <= 1) { add('baseball', 3); add('basketball', 2); }
  if (hits >= 2) add('boxing', 3);
  if (top > 0) add('boxing', 1);
  if (blk >= 6) { add('football', 3); add('curling', 3); }
  if (d.retain) add('curling', 3);
  if (draw) add('golf', 2);
  if (top >= 14) add('football', 2);
  return Object.entries(score).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
}
