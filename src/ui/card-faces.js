/* ---------- card text ---------- */
const KW = /\b(Block|Weak|Exposed|Plague|Burn|Stun|Stunned|Strength|Footwork|Spikes|Regen|Exhaust|Stamina|Bedrock|Haunt|Kindling|Retain|Innate|Combo|Momentum|Home|Fatigue|Exert|Foul|Grows)\b/g;
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function numSpan(v, base) { return v > base ? `<span class="hi">${v}</span>` : v < base ? `<span class="lo">${v}</span>` : `${v}`; }
const SELF_TXT = {
  str: n => `Gain ${n} Strength.`, dex: n => `Gain ${n} Footwork.`, ritual: n => `At the start of each turn, gain ${n} Strength.`, plate: n => `At the end of each turn, gain ${n} Block.`,
  barricade: () => 'Block no longer drains away between turns (Bedrock).', haunt: n => `Whenever you play a card, deal ${n} damage to a random enemy.`, kindle: n => `Burn you apply is increased by ${n}.`,
  nightgame: n => `Whenever an enemy falls, heal ${n}.`, trollblood: n => `At the start of each turn, heal ${n}.`, spin: n => `At the start of each turn, apply ${n} Weak to ALL enemies.`,
  tempest: n => `At the start of each turn, deal ${n} damage to a random enemy.`, necro: n => `At the start of each turn, apply ${n} Plague to ALL enemies.`, basilisk: n => `At the start of each turn, apply ${n} Exposed to a random enemy.`,
  coldsnap: n => `Whenever you play a Skill, gain ${n} Block.`, undying: () => 'The first time you would fall this fight, heal to 12 instead.', rage: n => `Whenever an attack hits you, gain ${n} Strength.`,
  drawnext: n => `Next turn, draw ${n} more.`, nrgnext: n => `Next turn, gain ${n} Stamina.`, oop: n => `Your next Attack this turn deals ${n} more damage.`, double: () => 'Your next card this turn is played twice.',
  intang: () => 'Until your next turn, every hit on you deals at most 1 damage.',
  pads: n => `Goalie Pads, ${n} charges: before an attack hits you, gain 5 Block.`, helmet: n => `Helmet, ${n} charges: each hit on you deals 3 less.`, shoulder: n => `Shoulder Pads, ${n} charges: when an attack hits you, deal 6 back.`,
  luckybat: n => `Lucky Bat, ${n} charges: your next Attacks deal 4 more per hit.`, cleats: n => `Cleats, ${n} charges: your next Skills give 4 more Block.`, sweat: n => `Sweatband, ${n} charges: draw 1 more each turn.`,
  called: () => 'Your next Attack this turn deals triple damage.', phyl: () => 'The first time you would fall this fight, heal to 30 instead.', pulled: () => 'Your next damaging Attack scores a goal (in hockey).', exert: n => `Exert ${n}.`, thorns: n => `Gain ${n} Spikes.`, regen: n => `Gain ${n} Regen.`, ward: n => `At the start of each turn, gain ${n} Block.`,
};
function opText(op, d, ctx) {
  const live = ctx && ctx.live, card = ctx && ctx.card, tg = ctx && ctx.tgt;
  const scope = op[0] === 's' ? (op[3] || (d.tgt === 'self' ? 'self' : d.tgt === 'all' ? 'all' : 'one')) : (op[3] || d.tgt);
  const dmgS = base => live ? numSpan(atkDmg(base, tg, card), base) : base;
  switch (op[0]) {
    case 'd': { const h = op[2] || 1, t = h > 1 ? ` ${h} times` : ''; return scope === 'all' ? `Deal ${dmgS(op[1])} damage to ALL enemies${t}.` : scope === 'rand' ? `Deal ${dmgS(op[1])} damage to a random enemy${t}.` : `Deal ${dmgS(op[1])} damage${t}.`; }
    case 'b': { const v = op[1] + (live ? sv(B.P, 'dex') + skyBlk(card) : 0); return `Gain ${live ? numSpan(v, op[1]) : op[1]} Block.`; }
    case 's': {
      if (scope === 'self') return (SELF_TXT[op[1]] || (n => `Gain ${n} ${ST[op[1]].n}.`))(op[2]);
      const nm = op[1] === 'stun' ? null : ST[op[1]].n;
      const extra = op[1] === 'burn' && live && sv(B.P, 'kindle') ? ` (+${sv(B.P, 'kindle')})` : '';
      if (op[1] === 'stun') return scope === 'all' ? 'Stun ALL enemies.' : 'Stun the target.';
      return scope === 'all' ? `Apply ${op[2]}${extra} ${nm} to ALL enemies.` : scope === 'rand' ? `Apply ${op[2]} ${nm} to a random enemy.` : `Apply ${op[2]}${extra} ${nm}.`;
    }
    case 'draw': return `Draw ${pl(op[1], 'card')}.`;
    case 'nrg': return `Gain ${op[1]} Stamina.`;
    case 'heal': return `Heal ${op[1]} HP.`;
    case 'lose': return `Lose ${op[1]} HP.`;
    case 'gold': return `gain ${op[1]} gold.`;
    case 'maxhp': return `raise your max HP by ${op[1]} for good.`;
    case 'roll': { const y = op[2].map(o => opText(o, d, ctx)).join(' '), n = op[3].map(o => opText(o, d, ctx)).join(' '); return `d20, ${op[1]}+${RUN && mod('d20') ? ` (+${mod('d20')})` : ''}. Hit: ${y}${n ? ` Miss: ${n}` : ''}`; }
    case 'kill': return `If this kills, ${op[1].map(o => opText(o, d, ctx)).join(' ')}`;
    case 'allkilled': return `If that clears the field, ${op[1].map(o => opText(o, d, ctx).replace(/^G/, 'g')).join(' ')}`;
    case 'ifst': return `If the target is ${ST[op[1]].n}: ${op[2].map(o => opText(o, d, ctx)).join(' ')} Otherwise: ${op[3].map(o => opText(o, d, ctx)).join(' ')}`;
    case 'add': return `Add ${op[2]} ${CARDS[op[1]].n}${op[2] > 1 ? 's' : ''} to your hand.`;
    case 'audible': return 'Discard your hand, then draw that many.';
    case 'devour': return `a non-boss enemy at ${op[1]} HP or less is eaten whole and you heal ${op[2]}; otherwise ${dmgS(16)} damage.`;
    case 'petrify': return `a non-boss enemy at ${Math.round(op[1] * 100)}% HP or less turns to stone; otherwise ${dmgS(18)} damage.`;
    case 'execute': return `A non-boss enemy dies outright; a boss takes ${dmgS(40)}.`;
    case 'bones': return `Gain ${op[1]} Block for each card in your draw pile${live ? ` (${Math.min(36, op[1] * B.draw.length)})` : ''}, up to 36.`;
    case 'bodyslam': return `Deal damage equal to your Block${live ? ` (${atkDmg(B.P.block - sv(B.P, 'str'), tg, card)})` : ''}.`;
    case 'drain': return `Deal ${dmgS(op[1])} damage. Heal what gets through.`;
    case 'dunk': return `Deal ${dmgS(op[1])} damage, or ${dmgS(op[2])} if the target is below half HP.`;
    case 'luck': return 'Your next d20 is a natural 20.';
    case 'loseblock': return 'Lose all your Block.';
    case 'strip': return 'Every enemy loses its Block and Strength.';
    case 'drainall': return `Deal ${dmgS(op[1])} damage to ALL enemies. Heal what gets through.`;
    case 'split': return `Deal ${dmgS(op[1])} damage to the enemies on each end.`;
    case 'petrifyall': return `Every non-boss enemy at ${Math.round(op[1] * 100)}% HP or less turns to stone; the rest take ${dmgS(op[2])}.`;
    case 'bonestorm': return `Deal ${op[1]} damage to ALL enemies for each card in your discard pile${live ? ` (${atkDmg(op[1] * B.discard.length, tg, card)})` : ''}.`;
    case 'freeatk': return 'Attacks cost 0 for the rest of the turn.';
    case 'runners': return 'Every runner on base scores.';
    case 'advance': return `Every runner moves up ${op[1]} base.`;
    case 'putOn': return 'Put a runner on first.';
    case 'yards': return `Gain ${op[1]} yards.`;
    case 'ifyards': return `Past midfield: touchdown. Otherwise gain ${op[3][0][1]} yards.`;
    case 'td': return 'Touchdown.';
    case 'atkcount': return 'Counts as an extra Attack toward On Fire.';
    case 'freestroke': return 'This turn does not count as a stroke.';
    case 'lance': return 'Shatters a lance: a point.';
    case 'passes': return `Adds ${op[1]} passes.`;
  }
  return '';
}
function costList(d) {
  const c = [];
  if (d.toll) c.push(`${d.toll} HP`); if (d.disc) c.push(`discard ${d.disc}`); if (d.fatigue) c.push(`${d.fatigue} Fatigue`);
  if (d.exert) c.push(`Exert ${d.exert}`); if (d.foul) c.push(`Foul ${d.foul}`); if (d.goldc) c.push(`${d.goldc} gold`);
  return c.join(', ');
}
function cardText(card, ctx) {
  const d = def(card);
  if (d.type === 'junk' || d.type === 'curse') return d.fl || '';
  let t = d.fx.map(o => opText(o, d, ctx)).join(' ');
  if (d.pierce) t += ' Ignores Block.';
  if (d.grow) t += ` Grows ${d.grow} damage each time you play it this fight${ctx && ctx.live && B.grow[card.uid] ? ` (+${B.grow[card.uid]})` : ''}.`;
  if (d.combo) t += ` Combo, after ${d.combo.t === 'atk' ? 'an Attack' : 'a Skill'}: ${d.combo.fx.map(o => opText(o, d, ctx)).join(' ')}`;
  if (d.mom) t += ` Momentum ${d.mom.n}: ${d.mom.fx.map(o => opText(o, d, ctx)).join(' ')}`;
  if (d.home) t += ` Home, in ${SPORT_NAME[d.sport].toLowerCase()}: ${d.home.map(o => opText(o, d, ctx)).join(' ')}`;
  if (d.retain) t += ' Retain.';
  if (d.innate) t += ' Innate.';
  if (d.ex) t += ' Exhaust.';
  t = t.replace(KW, '<b>$1</b>');
  const costs = costList(d);
  return (costs ? `<span class="cl">Costs ${costs}.</span> ` : '') + t;
}
const TYPE_NAME = { atk: 'attack', skl: 'skill', pow: 'power', play: 'set play', gear: 'gear', junk: 'status', curse: 'curse' };
function cardArt(card) {
  const d = def(card);
  if (d.type === 'junk' || d.type === 'curse') return junkURL();
  const team = RUN ? clubTeam() : { color: '#8a6a4a', light: '#e8d8a8', short: 'BRM' };
  if (d.kind === 'any') return emblemURL(d.sport || 'baseball', team.color);
  const m = RUN && memberOf(d.kind);
  return portraitURL(d.kind, team, m ? m.num : '', 120);
}
function cardHTML(card, o = {}) {
  const d = def(card), cost = d.cost;
  const kindLabel = d.kind === 'any' ? 'League' : d.kind === 'none' ? '' : (KIND_NAME[d.kind] || d.kind);
  const ownName = RUN && d.kind === 'any' && card.own ? memberName(card.own) : '';
  const ty = d.type === 'junk' || d.type === 'curse' ? (d.type === 'curse' ? 'Curse' : 'Status') : `${kindLabel} ${TYPE_NAME[d.type]}${ownName ? `, ${ownName}` : ''}`;
  const lcost = o.live && B ? cardCost(card) : cost;
  const cheap = o.live && B && lcost >= 0 && lcost < CARDS[card.id].cost;
  const badge = o.live && B ? sportBadge(card, o.tgt) : '';
  const tl = cardText(card, {}).replace(/<[^>]+>/g, '').length;
  return `<div class="card ${d.type}${d.rar === 'l' ? ' leg' : ''}${tl > 120 ? ' vlong' : tl > 80 ? ' long' : ''}${card.up ? ' up' : ''}${o.cls ? ' ' + o.cls : ''}" data-uid="${card.uid || ''}" data-id="${card.id}" ${o.attrs || ''} role="button" tabindex="0" aria-label="${esc(d.n)}, ${RAR_NAME[d.rar] || ''} ${TYPE_NAME[d.type] || ''}, costs ${cost < 0 ? 'nothing, unplayable' : cost} Stamina. ${esc(cardText(card, {}).replace(/<[^>]+>/g, ''))}">
    ${o.key ? `<span class="key">${o.key}</span>` : ''}
    <div class="art" style="background-image:url(${cardArt(card)})">${cost >= 0 ? `<span class="cost${cheap ? ' cheap' : ''}">${lcost}</span>` : ''}${['u', 'r', 'l'].includes(d.rar) ? `<span class="rar ${d.rar}" title="${RAR_NAME[d.rar]}"></span>` : ''}${d.sport ? `<span class="sp${B && o.live && d.sport === B.sport ? ' home' : ''}">${SPORT_NAME[d.sport]}</span>` : ''}${badge ? `<span class="bd">${esc(badge)}</span>` : ''}${d.rar === 'l' ? '<span class="hof">Hall of Fame</span>' : ''}</div>
    <div class="nm">${card.sk ? '<span class="skstar" title="Practiced: better at every sport">★</span>' : ''}${esc(d.n)}</div><div class="ty">${esc(ty)}</div>
    <div class="tx">${cardText(card, o.live ? { live: true, card, tgt: o.tgt } : {})}</div>
    ${(() => { const f = sportFits(d); return f.length ? `<div class="fits" title="Good for: ${f.map(s => SPORT_NAME[s]).join(', ')}">${f.map(s => sportSVG(s, 13)).join('')}</div>` : ''; })()}
    ${o.flav !== false && d.fl && d.type !== 'junk' && d.type !== 'curse' ? `<div class="fl">${esc(d.fl)}</div>` : ''}
  </div>`;
}

