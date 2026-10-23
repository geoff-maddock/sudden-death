/* ================= How to play: the eighteen creatures ================= */
// One card per creature, built from the founding clubs' players: typical stats, powers, ultimate, traits and moon.
const CREATURE_NOTE = {
  goblin: 'Small, quick and sneaky. Built to steal bases and bunt.',
  kobold: 'Fire-proof pitchers who throw fireballs and call down meteors.',
  werewolf: 'Fast and fierce all over the field, fiercest under the full moon.',
  dwarf: 'Pure power at the plate. Not quick.',
  ogre: 'The strongest swing in the league and a fielder who eats runners. Weak contact.',
  minotaur: 'Power and speed. Tramples tags.',
  troll: 'Big-armed catchers with a ground-shaking swing. Heal fast.',
  golem: 'Living stone: slow as a wall, hard to hurt, immune to fielder spells, and stomps the ground to trip runners.',
  harpy: 'Flying outfielders with a shriek that scatters pitches.',
  elf: 'Keen-eyed contact hitters who read the pitch early.',
  wraith: 'Ghostly runners who turn invisible and haunt the basepaths.',
  vampire: 'All-rounders: blood pacts at the plate, bat swarms on the bases, a mesmerizing stare in the field.',
  lich: 'Undead sorcerers who strip the magic off pitches and move the ball with their minds.',
  zombie: 'Slow sluggers who refuse to strike out.',
  gorgon: 'Stares runners into stone.',
  spider: 'Web-slinging fielders with sticky bats.',
  skeleton: 'Rattling catchers who block the plate.',
  witch: 'Magic-pitch specialists: frost, hexes and phantoms.',
};
function creatureTraits(k) {
  const t = [];
  if (TIRELESS.includes(k)) t.push('Tireless (undead or stone): loses stamina half as fast, and shrugs off the Plague Cloud');
  const fr = FIRE_RES[k]; if (fr != null) t.push(fr === 0 ? 'Immune to fire' : fr < 1 ? `Fire hurts ${Math.round((1 - fr) * 100)}% less` : `Fire hurts ${Math.round((fr - 1) * 100)}% more`);
  if (k === 'golem') t.push('Takes 40% less damage from knocks');
  if (k === 'troll') t.push('Heals fast: +8 health every half-inning (others +3), +20 more between games');
  return t;
}
function renderCreatures() {
  const el = document.getElementById('creatures'); if (!el) return;
  const teamOf = p => Object.values(TEAMS).find(t => t.roster.includes(p)) || Object.values(TEAMS)[0];
  const STN = ['pow', 'con', 'spd', 'arm', 'fld'];
  const cards = KINDS.map(k => {
    const p = TEMPL[k], T = teamOf(p), u = ULT_BY_KIND[k] && ULT[ULT_BY_KIND[k]], mk = MOON_KIND[k];
    const pw = (id, ty) => id && AB[id] ? `<div class="ab"><span class="ty">${ty}</span><em>${esc(AB[id].name)}</em> ${esc(AB[id].desc)}</div>` : '';
    const moon = mk ? `<div class="ab"><span class="ty">MOON</span><em>${MOON[mk[0]]}</em> +1 ${mk[1].map(s => s.toUpperCase()).join(', +1 ')}${k === 'werewolf' ? ' (+2 POW at the full moon)' : ''}; −1 ${mk[1][0].toUpperCase()} at the ${MOON[(mk[0] + 4) % 8].toLowerCase()}</div>` : '';
    const traits = creatureTraits(k);
    return `<article class="card crcard">
      <header><img class="por" alt="" src="${portraitURL(p, T)}" width="64" height="64"><div><h4>${esc(p.race)}</h4><div class="sub">e.g. ${esc(p.n)} (${esc(T.name)}, ${p.pos})</div></div></header>
      <p class="sub cr-note">${esc(CREATURE_NOTE[k] || '')}</p>
      <div class="cr-stats">${STN.map(s => `<span><b style="color:${p[s] <= 3 ? '#ff8a7a' : p[s] >= 8 ? 'var(--torch)' : 'var(--bone)'}">${p[s]}</b>${s.toUpperCase()}</span>`).join('')}</div>
      ${pw(p.bat, 'BAT')}${pw(p.run, 'RUN')}${pw(p.field, 'FIELD')}
      ${p.pitches ? `<div class="ab"><span class="ty">PITCHES</span>${p.pitches.map(q => esc(PITCHES[q].name)).join(', ')}</div>` : ''}
      ${u ? `<div class="ab"><span class="ty">ULT</span><em>★ ${esc(u.name)}</em> ${esc(u.desc)}</div>` : ''}
      ${moon}
      ${traits.length ? `<div class="ab"><span class="ty">TRAITS</span>${traits.map(esc).join('. ')}.</div>` : ''}
    </article>`;
  }).join('');
  el.innerHTML = `<h3>The creatures</h3>
    <p class="hint">Eighteen kinds of monster play in the league. The numbers are the founding clubs' player of that kind; in the <a href="#builder" data-page="builder">Team builder</a> and in seasons, stats and powers vary, but the ultimate, traits and moon phase always come with the creature. Stats of 3 or less (red) cause real trouble; 8 or more (gold) are a strength.</p>
    <div class="crgrid">${cards}</div>`;
}
try { renderCreatures(); } catch (e) { }
