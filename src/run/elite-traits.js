/* p5b: elite scouting reports. Every elite on the map comes with a trait you can read before you choose
   your route: what makes this one dangerous, and what it pays if you beat it. Some are worth it at full HP and
   ruinous when you are hurt; one (Rattled) is a soft target that pays nothing extra. */
const ELITE_TRAITS = {
  enraged: { n: 'Enraged', desc: 'Starts with 2 more Strength.', pay: 'One more card to choose from.', risk: 3,
    apply: () => { for (const e of alive()) addSt(e, 'str', 2); }, reward: out => { out.cards = cardChoices('elite', out.cards.length + 1); } },
  armored: { n: 'Armored', desc: 'Starts with 20 Block.', pay: '30 more gold.', risk: 2,
    apply: () => { for (const e of alive()) e.block += 20; }, reward: out => { out.gold += 30; } },
  hulking: { n: 'Hulking', desc: 'Has 30% more HP.', pay: 'A tonic.', risk: 2,
    apply: () => { for (const e of alive()) { e.max = Math.round(e.max * 1.3); e.hp = e.max; } }, reward: out => { out.tonic = out.tonic || pick(Object.keys(TONICS)); } },
  dirty: { n: 'Dirty player', desc: 'Slips 2 Slimed into your draw pile.', pay: '35 more gold.', risk: 1,
    apply: () => { for (let i = 0; i < 2; i++) B.draw.splice(ri(0, B.draw.length), 0, mkCard('slimed')); }, reward: out => { out.gold += 35; } },
  veteran: { n: 'Veteran', desc: 'Gains 1 Strength every turn after the first.', pay: 'One more card to choose from, and 20 gold.', risk: 3,
    turn: () => { if (B.turn > 1) for (const e of alive()) addSt(e, 'str', 1); }, reward: out => { out.cards = cardChoices('elite', out.cards.length + 1); out.gold += 20; } },
  rattled: { n: 'Rattled', desc: 'Starts Weak (2) and Exposed (1).', pay: 'Nothing extra.', risk: 0,
    apply: () => { for (const e of alive()) { addSt(e, 'weak', 2); addSt(e, 'vuln', 1); } }, reward: () => { } },
};
function traitTip(id) { const T = ELITE_TRAITS[id]; return `<span class="t">Elite: ${T.n}</span>${T.desc}<br><b>Pays:</b> the usual trophy, plus ${T.pay.charAt(0).toLowerCase() + T.pay.slice(1)}`; }
function assignTraits(nodes) { for (const n of Object.values(nodes)) if (n.t === 'elite' && !n.trait) n.trait = pick(Object.keys(ELITE_TRAITS)); return nodes; }
onHook('fightStart', () => { const T = B.trait && ELITE_TRAITS[B.trait]; if (T && T.apply) { T.apply(); log(`Scouting report: ${T.n}. ${T.desc}`, 'sys'); } });
onHook('turnStart', () => { const T = B.trait && ELITE_TRAITS[B.trait]; if (T && T.turn) T.turn(); });

