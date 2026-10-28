/* ---------- events: the dungeon between fights ---------- */
// each option returns an outcome: { text, then?: 'remove'|'upgrade'|{cards}|{relic}|{fight} }
const EVENTS = [
  { id: 'deck', t: 'The Deck of Many Fates', art: { kind: 'goblin', team: { color: '#7a5a34', light: '#e8c27a', short: 'BKE' }, num: 7 }, acts: [0, 1, 2],
    text: 'A goblin bookie with a green visor fans a deck of glowing cards across an overturned beer keg. "Pick one, any one. The house always pays out. Mostly."',
    opts: () => [
      { label: 'Draw one card', desc: 'A boon or a bane, at random.', go: () => fate() },
      { label: 'Draw two cards', desc: 'Twice the fate. Twice the fun.', go: () => { const a = fate(), b = fate(); return { text: a.text + ' ' + b.text, then: a.then || b.then }; } },
      { label: 'Walk away', desc: '', go: () => ({ text: 'The bookie shrugs and shuffles. "Your loss. Literally, usually."' }) },
    ] },
  { id: 'bowling', t: 'The Ogre’s Bowling Alley', art: { kind: 'ogre', team: { color: '#c94a3a', light: '#ffd9a0', short: 'LNS' }, num: 300 }, acts: [0, 1, 2],
    text: 'Mawgrum’s cousin runs four lanes in a limestone cavern. The pins are skulls. The ball is also a skull, but bigger. "One frame. Strike pays big. Gutter pays nothing. Dropping it on your foot is free."',
    opts: () => [
      { label: 'Bowl a frame', desc: 'Roll a d20.', go: () => { const r = evRoll(); if (r === 20) { gainGold(90); return { text: `Natural 20. STRIKE. The skulls explode outward and the ogre weeps with joy. +90 gold, and he insists you keep the lucky ball.`, then: { relic: RUN.relics.includes('bowling') ? randomRelic() : 'bowling' } }; } if (r >= 14) { const g = gainGold(50); return { text: `You roll ${r}. Spare! +${g} gold.` }; } if (r >= 7) { const g = gainGold(15); return { text: `You roll ${r}. Seven pins. +${g} gold for effort.` }; } if (r > 1) return { text: `You roll ${r}. Gutter ball. The ogre laughs for a very long time.` }; RUN.hp = Math.max(1, RUN.hp - 9); return { text: 'Natural 1. You drop the skull on your foot. −9 HP.' }; } },
      { label: 'Just watch', desc: 'Heal 5.', go: () => { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 5); return { text: 'You sit on the bench and eat stale cavern pretzels. +5 HP.' }; } },
    ] },
  { id: 'penalty', t: 'The Penalty Spot', art: { kind: 'skeleton', team: { color: '#5fa8c9', light: '#e3f3ff', short: 'PKS' }, num: 1 }, acts: [0, 1, 2],
    text: 'A skeleton keeper stands in a goal chalked on the cavern wall, rattling. "One kick. Beat me and I pay. Miss and you pay. I have not let one in for three hundred years."',
    opts: () => [
      { label: 'Take the penalty (bet 20 gold)', desc: 'Roll a d20. 10+ scores.', ok: () => RUN.gold >= 20, go: () => { const r = evRoll(); RUN.gold -= 20; if (r === 20) { gainGold(60); return { text: 'Natural 20. Top corner. The keeper falls apart, then hands you his boots. +60 gold.', then: { relic: RUN.relics.includes('goldenboot') ? randomRelic() : 'goldenboot' } }; } if (r >= 10) { const g = gainGold(45); return { text: `You roll ${r}. GOAL. He picks the ball out of the net and pays up. +${g} gold.` }; } return { text: `You roll ${r}. Saved, with one bony finger. The 20 gold is his.` }; } },
      { label: 'Go in goal for him', desc: 'Lose 6 HP. Learn a Through Ball.', go: () => { RUN.hp = Math.max(1, RUN.hp - 6); return { text: 'He takes a hundred penalties at you and laughs at every one. You learn how a striker thinks. -6 HP.', then: { cards: [{ id: 'scr_through', up: false }] } }; } },
      { label: 'Walk on', desc: '', go: () => ({ text: '"Coward," he calls after you, kindly.' }) },
    ] },
  { id: 'golf', t: 'The Lich’s Nine Holes', art: { kind: 'lich', team: { color: '#3d6a3a', light: '#cfe8a0', short: 'GLF' }, num: 9 }, acts: [0, 1, 2],
    text: 'A lich in plaid trousers is playing through a graveyard. "Par three, over the open grave. Care to make it interesting?"',
    opts: () => [
      { label: 'Play the hole (bet 25 gold)', desc: 'Roll a d20. 12+ wins.', ok: () => RUN.gold >= 25, go: () => { const r = evRoll(); RUN.gold -= 25; if (r === 20) { gainGold(100); return { text: 'Hole in one. The lich drops his club, then teaches you the shot. +100 gold.', then: { cards: [{ id: 'holeinone', up: false }] } }; } if (r >= 12) { const g = gainGold(60); return { text: `You roll ${r}. Birdie. +${g} gold.` }; } RUN.hp = Math.max(1, RUN.hp - 6); return { text: `You roll ${r}. Into the grave. Something in it does not want the ball back. −25 gold, −6 HP.` }; } },
      { label: 'Caddy for him', desc: 'Gain 30 gold. Pull a hamstring.', go: () => { gainGold(30); RUN.deck.push(mkCard('injury')); return { text: 'Eighteen holes carrying a bag of femurs. +30 gold, and a Pulled Hamstring in your deck.' }; } },
      { label: 'Keep walking', desc: '', go: () => ({ text: '"Fore," he calls after you, for no reason.' }) },
    ] },
  { id: 'collector', t: 'The Card Collector', art: { kind: 'spider', team: { color: '#5a4a7a', light: '#d2c4f2', short: 'TCG' }, num: 1 }, acts: [0, 1, 2],
    text: 'In a web strung with sleeved trading cards, a spider sorts her collection with all eight arms. "I trade. Fair trades. Mostly fair."',
    opts: () => [
      { label: 'Trade away a card', desc: 'Remove a card from your deck.', go: () => ({ text: 'She looks at your deck and sniffs. "Which one do you hate?"', then: 'remove' }) },
      { label: 'Buy a pack (60 gold)', desc: 'Choose one of three uncommon or rare cards.', ok: () => RUN.gold >= 60, go: () => { RUN.gold -= 60; return { text: 'She slits a foil pack with a fang.', then: { cards: [0, 1, 2].map(() => ({ id: pick(cardPool(R() < .35 ? 'r' : 'u')).id, up: false })) } }; } },
      { label: 'Leave', desc: '', go: () => ({ text: 'She is already back to sorting.' }) },
    ] },
  { id: 'shrine', t: 'Shrine of the Patron Saint of Lost Causes', art: { kind: 'skeleton', team: { color: '#8a7a4a', light: '#f2e6b8', short: 'STL' }, num: 0 }, acts: [0, 1, 2],
    text: 'A skeleton in a faded jersey sits on a throne of broken trophies. Candles burn in old helmets. Someone has left a foam finger as an offering.',
    opts: () => [
      { label: 'Pray', desc: 'Roll a d20. 10+ heals 20 and upgrades a random card; under 10 adds an Ejection Notice.', go: () => { const r = evRoll(); if (r >= 10) { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 20); const c = shuffle(RUN.deck.filter(upgradable))[0]; if (c) c.up = true; return { text: `You roll ${r}. The candles flare. +20 HP${c ? `, and ${CARDS[c.id].n} is upgraded` : ''}.` }; } RUN.deck.push(mkCard('penalty')); return { text: `You roll ${r}. The skeleton points at you, then at the exit. An Ejection Notice is added to your deck.` }; } },
      { label: 'Leave an offering (50 gold)', desc: 'Raise max HP by 7.', ok: () => RUN.gold >= 50, go: () => { RUN.gold -= 50; RUN.maxhp += 7; RUN.hp += 7; return { text: 'You tuck the coins into a helmet. You feel sturdier. +7 max HP.' }; } },
      { label: 'Move along', desc: '', go: () => ({ text: 'The candles gutter as you pass.' }) },
    ] },
  { id: 'cooler', t: 'The Victory Cooler', art: null, scene: 'cooler', acts: [0, 1, 2],
    text: 'An enormous cooler sits on a plinth, sweating, full of something glowing green and fizzing. Tradition is clear on what to do with a cooler like this.',
    opts: () => [
      { label: 'Dump it over your heads', desc: 'Heal 30% of max HP.', go: () => { const h = Math.round(RUN.maxhp * .3); RUN.hp = Math.min(RUN.maxhp, RUN.hp + h); return { text: `The traditional shower. It is freezing and it stings and it is wonderful. +${h} HP.` }; } },
      { label: 'Drink it', desc: 'Lose 6 HP. Raise max HP by 5. Gain a tonic.', go: () => { RUN.hp = Math.max(1, RUN.hp - 6); RUN.maxhp += 5; RUN.hp += 5; const t = pick(Object.keys(TONICS)); const ok = gainTonic(t); return { text: `It tastes like a battery. −6 HP, +5 max HP${ok ? `, and you bottle the rest as ${TONICS[t].n}` : ''}.` }; } },
    ] },
  { id: 'lists', t: 'The Jousting Lists', art: { kind: 'skeleton', team: { color: '#3a5a9a', light: '#c8d8ff', short: 'KNT' }, num: 1 }, acts: [1, 2],
    text: 'A skeleton knight on a skeleton horse waits at the end of a tilt rail, lance couched. "Three passes, stranger. Unhorse me and the lance is yours."',
    opts: () => [
      { label: 'Take up the lance', desc: 'Roll a d20. 11+ wins Couched Lance and 40 gold. Lose and take 12 damage.', go: () => { const r = evRoll(); if (r >= 11) { const g = gainGold(40); return { text: `You roll ${r}. The knight goes over the back of his horse in a clatter of ribs. +${g} gold.`, then: { cards: [{ id: 'lance', up: r === 20 }] } }; } RUN.hp = Math.max(1, RUN.hp - 12); return { text: `You roll ${r}. You are unhorsed, though you did not have a horse. −12 HP.` }; } },
      { label: 'Decline', desc: '', go: () => ({ text: 'He lowers his lance, disappointed. His horse is too.' }) },
    ] },
  { id: 'scalper', t: 'The Scalper Imp', art: { kind: 'imp', team: { color: '#3a3a3a', light: '#ffd166', short: 'TIX' }, num: 0 }, acts: [0, 1, 2],
    text: 'An imp in a trench coat flashes the lining: trophies, tickets, an autographed something. "Who needs gear? I got gear. Prices are prices."',
    opts: () => { const rid = RUN.scalper || (RUN.scalper = randomRelic()); return [
      { label: `Buy ${rid ? RELICS[rid].n : 'nothing'} (130 gold)`, desc: rid ? RELICS[rid].desc : '', ok: () => rid && RUN.gold >= 130, go: () => { RUN.gold -= 130; RUN.scalper = null; return { text: 'He counts every coin twice.', then: { relic: rid } }; } },
      { label: 'Rob him', desc: 'Roll a d20. 14+ takes it free; otherwise lose 10 HP and he bolts.', ok: () => !!rid, go: () => { const r = evRoll(); RUN.scalper = null; if (r >= 14) return { text: `You roll ${r}. You come away with the coat.`, then: { relic: rid } }; RUN.hp = Math.max(1, RUN.hp - 10); return { text: `You roll ${r}. The coat is full of pitchforks. −10 HP.` }; } },
      { label: 'Wave him off', desc: '', go: () => { RUN.scalper = null; return { text: '"Your loss, pal."' }; } },
    ]; } },
  { id: 'film', t: 'Coach’s Film Room', art: { kind: 'minotaur', team: { color: '#6a5a3a', light: '#e8d8a8', short: 'CCH' }, num: 0 }, acts: [0, 1, 2],
    text: 'An old minotaur coach runs grainy footage on a cave wall with a lantern and a lot of patience. "Again. Watch your feet. Again."',
    opts: () => [
      { label: 'Watch the tape', desc: 'Upgrade a card.', ok: () => RUN.deck.some(upgradable), go: () => ({ text: 'You watch until your eyes hurt. Then once more.', then: 'upgrade' }) },
      { label: 'Fall asleep in the back', desc: 'Heal 12.', go: () => { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 12); return { text: 'Best sleep you have had in years. +12 HP.' }; } },
    ] },
  { id: 'tryouts', t: 'Open Tryouts', art: null, scene: 'tryouts', acts: [0, 1],
    text: '', opts: () => { const k = RUN.tryout || (RUN.tryout = pick(Object.keys(KIND_NAME).filter(k => !runKinds().includes(k)))); return [
      { label: `Sign the ${KIND_NAME[k]}`, desc: `Add ${CARDS[SIG[k]].n} to your deck. ${KIND_NAME[k]} cards join your rewards.`, go: () => { RUN.extra.push(k); RUN.deck.push(mkCard(SIG[k])); RUN.tryout = null; return { text: `The ${KIND_NAME[k]} signs on the practice squad, with a clause about snacks.` }; } },
      { label: 'Run cuts', desc: 'Remove two basic cards from your deck.', ok: () => RUN.deck.filter(c => c.id === 'check' || c.id === 'hold').length >= 2, go: () => { for (let i = 0; i < 2; i++) { const j = RUN.deck.findIndex(c => (c.id === 'check' || c.id === 'hold') && !c.up); if (j >= 0) RUN.deck.splice(j, 1); } RUN.tryout = null; return { text: 'You trim the roster. Two basics go home.' }; } },
      { label: 'No thanks', desc: '', go: () => { RUN.tryout = null; return { text: 'You keep the line as it is.' }; } },
    ]; } },
  { id: 'boxing', t: 'The Pit Boxing Ring', art: { kind: 'bugbear', team: { color: '#9a1a1a', light: '#ffc8a8', short: 'BOX' }, num: 0 }, acts: [1, 2],
    text: 'A bugbear in satin trunks bounces in a ring roped with chain. "Three rounds. Go the distance and the purse is yours."',
    opts: () => [
      { label: 'Go three rounds', desc: 'Lose 15 HP. Gain 100 gold.', ok: () => RUN.hp > 15, go: () => { RUN.hp -= 15; const g = gainGold(100); return { text: `You go the distance. Barely. −15 HP, +${g} gold.` }; } },
      { label: 'Spar one round', desc: 'Lose 5 HP. Upgrade a random card.', ok: () => RUN.hp > 5, go: () => { RUN.hp -= 5; const c = shuffle(RUN.deck.filter(upgradable))[0]; if (c) c.up = true; return { text: `A good workout. −5 HP${c ? `, ${CARDS[c.id].n} upgraded` : ''}.` }; } },
      { label: 'Skip it', desc: '', go: () => ({ text: 'He shadowboxes at your back as you leave.' }) },
    ] },
  { id: 'curling', t: 'The Underground Lake', art: { kind: 'witch', team: { color: '#4a7ab8', light: '#d8ecff', short: 'CRL' }, num: 4 }, acts: [1, 2],
    text: 'Morwen’s aunt is curling alone on a frozen black lake, sweeping like her life depends on it. "Throw one stone. Land it in the house and I will make it worth your while."',
    opts: () => [
      { label: 'Throw the stone', desc: 'Roll a d20. 16+ wins a trophy, 8+ wins 30 gold, under 8 you fall through the ice (−8 HP).', go: () => { const r = evRoll(); if (r >= 16) return { text: `You roll ${r}. Button. Dead centre.`, then: { relic: randomRelic() } }; if (r >= 8) { const g = gainGold(30); return { text: `You roll ${r}. In the house. +${g} gold.` }; } RUN.hp = Math.max(1, RUN.hp - 8); return { text: `You roll ${r}. The ice cracks. −8 HP.` }; } },
      { label: 'Help her sweep', desc: 'Add Hurry Hard to your deck.', go: () => ({ text: '"HARD! HARD!" She is pleased with you.', then: { cards: [{ id: 'sweep', up: false }] } }) },
    ] },
];
function evRoll() { let r = d20(); if (RUN.luck) { r = 20; RUN.luck = 0; } return Math.min(20, r + (r !== 20 ? mod('d20') : 0)); }
function fate() {
  const f = ri(1, 9);
  switch (f) {
    case 1: { const g = gainGold(80); return { text: `The Sun: +${g} gold.` }; }
    case 2: return { text: 'The Star: choose a rare card.', then: { cards: [0, 1, 2].map(() => ({ id: pick(cardPool('r')).id, up: false })) } };
    case 3: return { text: 'The Key: a trophy.', then: { relic: randomRelic() } };
    case 4: { RUN.maxhp += 8; RUN.hp += 8; return { text: 'The Throne: +8 max HP.' }; }
    case 5: { const cs = shuffle(RUN.deck.filter(upgradable)).slice(0, 2); cs.forEach(c => c.up = true); return { text: `The Moon: ${cs.map(c => CARDS[c.id].n).join(' and ') || 'nothing'} upgraded.` }; }
    case 6: { const l = Math.floor(RUN.gold * .3); RUN.gold -= l; return { text: `The Rogue: −${l} gold.` }; }
    case 7: RUN.deck.push(mkCard('injury')); return { text: 'The Skull: a Pulled Hamstring joins your deck.' };
    case 8: RUN.hp = Math.max(1, RUN.hp - 10); return { text: 'The Flames: −10 HP.' };
    default: { const ok = gainTonic(pick(Object.keys(TONICS))); return { text: ok ? 'The Fool: a free tonic.' : 'The Fool: a free tonic, but your belt is full.' }; }
  }
}
function pickEvent() {
  const seenE = RUN.events || (RUN.events = []);
  let pool = EVENTS.filter(e => e.acts.includes(RUN.act) && !seenE.includes(e.id));
  if (!pool.length) pool = EVENTS.filter(e => e.acts.includes(RUN.act));
  const e = pick(pool); seenE.push(e.id); return e;
}

