/* ---------- the map ---------- */
const UI = { view: 'map', sel: -1, tsel: 0, busy: false, speed: 1 };
function nodeXY(n) {
  if (n.k === 'boss') return { x: 340, y: 62 };
  let h = 0; for (const ch of n.k + RUN.act) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { x: 70 + n.c * 90 + ((h % 21) - 10), y: 160 + (FLOORS - 1 - n.r) * 76 + (((h >> 5) % 13) - 6) };
}
function renderMap() {
  const M = RUN.map, can = nextNodes().map(n => n.k), A = ACTS[RUN.act];
  const H = 160 + FLOORS * 76 + 10;
  const path = RUN.path || [];
  let edges = '', nodes = '';
  for (const n of Object.values(M.nodes)) for (const k of n.next) {
    const a = nodeXY(n), b = nodeXY(M.nodes[k]); const walked = path.includes(n.k) && (path.includes(k) || RUN.pos === n.k && false);
    const onPath = path.indexOf(k) === path.indexOf(n.k) + 1 && path.includes(n.k);
    edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${onPath ? '#ffb347' : '#5a4636'}" stroke-width="${onPath ? 3.5 : 2}" stroke-dasharray="${onPath ? '' : '5 6'}"/>`;
  }
  for (const n of Object.values(M.nodes)) {
    const p = nodeXY(n), isCan = can.includes(n.k), done = path.includes(n.k), cur = RUN.pos === n.k;
    if (n.t === 'boss') {
      const bid = bossId(), BD = ENEMIES[bid];
      nodes += `<g class="mnode${isCan ? ' can' : ''}" data-node="boss" ${isCan ? 'tabindex="0" role="button"' : ''} aria-label="Boss: ${esc(BD.n)}"><circle class="ring" cx="${p.x}" cy="${p.y}" r="50" fill="none" stroke="#ffb347" stroke-width="2"/><clipPath id="bclip"><circle cx="${p.x}" cy="${p.y}" r="44"/></clipPath><image href="${portraitURL(BD.kind, BD.team, '', 120)}" x="${p.x - 44}" y="${p.y - 44}" width="88" height="88" clip-path="url(#bclip)"/><circle cx="${p.x}" cy="${p.y}" r="44" fill="none" stroke="#e0533a" stroke-width="3"/><text x="${p.x + 60}" y="${p.y - 4}" fill="#efe4cc" font-family="Grenze Gotisch, Georgia, serif" font-weight="700" font-size="24">${esc(BD.n.split(',')[0])}</text><text x="${p.x + 60}" y="${p.y + 18}" fill="#b8a68c" font-family="Alegreya Sans, sans-serif" font-size="15">${esc((BD.n.split(', ')[1] || '').replace(/^the /, 'The '))}</text></g>`;
      continue;
    }
    nodes += `<g class="mnode${isCan ? ' can' : ''}" data-node="${n.k}" ${isCan ? 'tabindex="0" role="button"' : ''} aria-label="${NODE_NAME[n.t]}${n.sport ? `, ${SPORT_NAME[n.sport]}` : ''}${n.stakes ? `, high stakes: ${STAKES[n.stakes].n}` : ''}${n.trait ? `, ${ELITE_TRAITS[n.trait].n}` : ''}${isCan ? ', available' : done ? ', visited' : ''}" ${!done && (n.trait || n.sport || n.stakes) ? `data-tip="${esc((n.sport ? `<span class=\"t\">${SPORT_NAME[n.sport]}</span>${SPORTS[n.sport].desc}` : '') + (n.trait ? '<br><br>' + traitTip(n.trait) : '') + (n.stakes ? `<br><br><b style="color:#ff8a7a">High stakes: ${STAKES[n.stakes].n}.</b> ${STAKES[n.stakes].desc}` : ''))}"` : ''}>
      <circle class="ring" cx="${p.x}" cy="${p.y}" r="21" fill="${done ? '#3a2c22' : '#1c1511'}" stroke="${cur ? '#ffb347' : isCan ? '#ffb347' : done ? '#7f6d5a' : '#4a3a2e'}" stroke-width="${cur ? 3 : 2}" ${isCan ? '' : ''}/>
      <svg x="${p.x - 13}" y="${p.y - 13}" width="26" height="26" viewBox="0 0 24 24" opacity="${done || isCan || !RUN.pos ? 1 : .55}">${NODE_ICO[n.t]}</svg>
      ${n.sport && !done ? `<g aria-hidden="true" transform="translate(${p.x - 26} ${p.y + 6})"><circle cx="9" cy="9" r="10" fill="#1c1511" stroke="#5a4636"/><svg x="1" y="1" width="16" height="16" viewBox="0 0 24 24">${SPORT_GLYPH[n.sport]}</svg></g>` : ''}
      ${n.stakes && !done ? `<g aria-hidden="true"><circle cx="${p.x + 17}" cy="${p.y - 15}" r="9" fill="#3a0e0a" stroke="#ff6a5a" stroke-width="1.5"/><text x="${p.x + 17}" y="${p.y - 11}" text-anchor="middle" font-size="12" font-family="Jersey 10, monospace" fill="#ff6a5a">${STAKES[n.stakes].icon}</text></g>` : ''}
      ${n.trait && !done ? `<g aria-hidden="true"><circle cx="${p.x + 17}" cy="${p.y - 15}" r="9" fill="#1c1511" stroke="${['#7fe08a', '#ffd166', '#ffb347', '#ff6a5a'][ELITE_TRAITS[n.trait].risk]}" stroke-width="1.5"/><text x="${p.x + 17}" y="${p.y - 11}" text-anchor="middle" font-size="11" font-family="Jersey 10, monospace" fill="${['#7fe08a', '#ffd166', '#ffb347', '#ff6a5a'][ELITE_TRAITS[n.trait].risk]}">${ELITE_TRAITS[n.trait].n[0]}</text></g>` : ''}
      ${done && !cur ? `<path d="M${p.x - 15} ${p.y + 15}L${p.x + 15} ${p.y - 15}" stroke="#ffb347" stroke-width="2" opacity=".7"/>` : ''}</g>`;
  }
  $('v-map').innerHTML = `<div class="mapwrap">
    <div><div class="maphead"><h2 class="pgh">Act ${['I', 'II', 'III'][RUN.act]}: ${esc(A.n)}</h2><p class="lede">${esc(A.sub)}. Pick where your line goes next. You can only move up the paths; hover a room to see everywhere it leads.</p></div>
    <div class="mapscroll" id="mapScroll"><svg viewBox="0 0 680 ${H}" role="group" aria-label="Dungeon map">${edges}${nodes}</svg></div></div>
    <div class="side">
      <section><h4>The map</h4><div class="legend">${['fight', 'elite', 'rival', 'event', 'rest', 'shop', 'chest'].map(t => `<div>${svgI(NODE_ICO[t])}<span><b style="color:var(--bone)">${NODE_NAME[t]}</b>. ${{ fight: 'A brawl; the badge shows which sport.', elite: 'A tougher foe. Drops a trophy.', rival: 'One per act: a souped-up elite. Bigger purse and a Hall of Fame card on offer. You can route around it.', event: 'Something strange. Usually a d20 is involved.', rest: 'Heal up or study film to upgrade a card.', shop: 'Cards, trophies, tonics, and card removal.', chest: 'A trophy and some gold.' }[t]}</span></div>`).join('')}</div></section>
      ${goalsPanel()}
      <section><h4>The schedule</h4><p class="hint" style="margin:0 0 8px;font-size:14px">Home sport this act: <b style="color:var(--bone)">${SPORT_NAME[ACT_HOME[RUN.act]]}</b>. Every fight room shows the game it will be.</p><div class="sched">${scheduleCounts().map(([s, n]) => `<span>${sportSVG(s, 20)} ${SPORT_NAME[s]} <b>${n}</b></span>`).join('')}</div></section>
      ${skyPanel()}
      <section><h4>Your line</h4>${RUN.party.map(p => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><img src="${portraitURL(p.kind, clubTeam(), p.num, 76)}" alt="" width="40" height="40" style="border-radius:6px"><div><b style="font-family:var(--display);font-size:20px">${esc(p.n)}</b><br><small style="color:var(--dim)">${KIND_NAME[p.kind]}, #${p.num}</small></div></div>`).join('')}${RUN.extra.length ? `<p class="hint" style="margin:4px 0 0">Practice squad: ${RUN.extra.map(k => KIND_NAME[k]).join(', ')}.</p>` : ''}</section>
    </div></div>`;
  const reach = k => { const out = new Set([k]), st = [k]; while (st.length) { const n = M.nodes[st.pop()]; if (n) for (const x of n.next) if (!out.has(x)) { out.add(x); st.push(x); } } return out; };
  const dim = set => $('v-map').querySelectorAll('.mnode').forEach(g => g.style.opacity = !set || set.has(g.dataset.node) || path.includes(g.dataset.node) ? '' : '.28');
  $('v-map').querySelectorAll('.mnode.can').forEach(g => { g.addEventListener('mouseenter', () => dim(reach(g.dataset.node))); g.addEventListener('focus', () => dim(reach(g.dataset.node))); g.addEventListener('mouseleave', () => dim(null)); g.addEventListener('blur', () => dim(null)); });
  $('v-map').querySelectorAll('.mnode.can').forEach(g => { const go = () => enterNode(g.dataset.node); g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
  // scroll so the next choices are in view
  // (a frame later: the run may have ended or been replaced by then, and its map with it)
  requestAnimationFrame(() => { const sc = $('mapScroll'); if (!sc || !RUN || RUN.map !== M) return; const nx = nextNodes()[0]; if (!nx) return; const svg = sc.querySelector('svg'); const k = svg.clientHeight / H; sc.scrollTop = Math.max(0, nodeXY(nx).y * k - sc.clientHeight * .6); });
}
