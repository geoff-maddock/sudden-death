// headless bot runs: drives the model, not the view
window.LABRUN = function (opts = {}) {
  LAB = true;
  const est = (c, tgt) => { const d = def(c); let dmg = 0, blk = 0; const walk = ops => { for (const o of ops) { if (o[0] === 'd') { const n = (o[3] || d.tgt) === 'all' ? alive().length : 1; dmg += atkDmg(o[1], tgt, c) * (o[2] || 1) * n; } else if (o[0] === 'drain' || o[0] === 'dunk') dmg += atkDmg(o[1], tgt, c); else if (o[0] === 'b') blk += o[1] + sv(B.P, 'dex'); else if (o[0] === 'bodyslam') dmg += B.P.block; else if (o[0] === 'roll') { walk(o[2].map(x => x)); } else if (o[0] === 'bones') blk += Math.min(36, o[1] * B.draw.length); } }; walk(d.fx); return { dmg, blk }; };
  function botTurn() {
    let guard = 0;
    if (opts.dumb) { // a careless player: plays whatever it can, at whoever, in any order
      while (B.phase === 'player' && !B.over && guard++ < 30) { const al = alive(); if (!al.length) break; const ok = B.hand.map((c, i) => [c, i]).filter(([c]) => canPlay(c) && def(c).type !== 'junk'); if (!ok.length) break; const [c, i] = pick(ok); playCard(i, B.enemies.indexOf(pick(al))); }
      return;
    }
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      let incoming = 0; for (const e of al) { if (sv(e, 'stun')) continue; const I = intentInfo(e); if (I.kinds.includes('atk')) incoming += I.dmg * I.hits; }
      const need = Math.max(0, incoming - B.P.block);
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = null, bs = 0;
      B.hand.forEach((c, i) => {
        if (!canPlay(c)) return; const d = def(c);
        let s = 0;
        if (d.type === 'pow') s = B.turn <= 3 ? 40 : 6;
        else if (d.type === 'junk') s = .5;
        else { const { dmg, blk } = est(c, tgt); s = dmg * (need > 0 ? .8 : 1.2) + Math.min(blk, need) * 1.3 + blk * .15; if (dmg >= tgt.hp + tgt.block) s += 12;
          for (const o of d.fx) { if (o[0] === 's' && ['weak', 'vuln', 'psn', 'burn', 'stun'].includes(o[1])) s += 5 + (o[1] === 'stun' ? 8 : 0); if (o[0] === 's' && (o[3] === 'self')) s += 6; if (o[0] === 'draw') s += 4 * o[1]; if (o[0] === 'nrg') s += 7 * o[1]; if (o[0] === 'lose') s -= o[1] * (RUN.hp < 25 ? 3 : .8); if (o[0] === 'heal') s += Math.min(o[1], RUN.maxhp - RUN.hp); if (o[0] === 'roll') s += 6; if (o[0] === 'audible') s += 2; if (o[0] === 'add') s += 8; } }
        s -= (d.toll || 0) * (RUN.hp < 30 ? 3 : 1) + (d.foul || 0) * 4 + (d.exert || 0) * 5 + (d.fatigue || 0) * 2 + (d.goldc ? 4 : 0);
        if (d.type === 'play' || d.type === 'gear') s += 6 + (d.sport === B.sport ? 6 : 0);
        const v = s / (d.cost + .6);
        if (s > 0 && v > bs) { bs = v; best = i; }
      });
      if (best == null) break;
      playCard(best, B.enemies.indexOf(tgt));
      if (RUN.hp < RUN.maxhp * .3) { const k = RUN.tonics.findIndex(t => t === 'heal'); if (k >= 0) useTonic(k); }
    }
    if ((B.type !== 'normal') && B.turn === 1) RUN.tonics.forEach((t, k) => { if (t && t !== 'heal') useTonic(k, B.enemies.indexOf(alive()[0])); });
  }
  function fight(enc) {
    startCombat(enc.ids, enc.type, enc.sport, enc.trait);
    let g = 0;
    while (!B.over && g++ < 80) { botTurn(); if (B.over) break; runSteps(endTurn()); }
    if (!B.over) { B.over = 'lose'; B.stall = 1; }
    return B.over;
  }
  const clubs = opts.club ? [opts.club] : CLUB_IDS;
  const club = pick(clubs), picks = opts.picks || shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3);
  if (opts.free) newRun('free', shuffle([...Array(18).keys()]).slice(0, 3), genDraftClass(), CLUBS[pick(CLUB_IDS)].relic); else newRun(club, picks); RUN.path = []; if (opts.hard) RUN.diff = 3; if (opts.diff != null) RUN.diff = opts.diff;
  const log = { club, party: RUN.party.map(p => p.kind), fights: [], result: null, act: 0, floor: 0, death: null };
  outer: for (let act = 0; act < 3; act++) {
    while (true) {
      const opts2 = nextNodes();
      const route = opts.route || 'balanced', hpf = RUN.hp / RUN.maxhp;
      const val = n => { switch (n.t) {
        case 'fight': return 2; case 'event': return 2.2; case 'chest': return 5; case 'boss': return 0;
        case 'shop': return RUN.gold >= 120 ? 4 : .8;
        case 'rest': return hpf < .55 ? 7 : 1.5;
        case 'elite': case 'rival': { const bonus = n.t === 'rival' ? 1 : 0, risk = n.trait ? ELITE_TRAITS[n.trait].risk : 1.5; return route === 'safe' ? -6 : route === 'greedy' ? 6 + bonus : (hpf > .65 ? 4.5 + bonus : hpf > .45 ? .5 : -6) - (risk - 1.5) * (hpf > .8 ? .5 : 2); }
      } return 0; };
      const memo = {}; const best = k => { if (k === 'boss') return 0; if (memo[k] != null) return memo[k]; const nd = RUN.map.nodes[k]; return (memo[k] = val(nd) + Math.max(...nd.next.map(best))); };
      const n = opts2.slice().sort((a, b) => (b.k === 'boss' ? 99 : best(b.k)) - (a.k === 'boss' ? 99 : best(a.k)) + (R() - .5) * .2)[0];
      RUN.pos = n.k; RUN.path.push(n.k); RUN.floor = n.r; skyTick();
      if (['fight', 'elite', 'rival', 'boss'].includes(n.t)) {
        const enc = rollEncounter(n.t === 'fight' ? 'normal' : n.t, n.sport); if (n.trait) enc.trait = n.trait; if (n.stakes) enc.stakes = n.stakes; RUN.pending = enc;
        const hp0 = RUN.hp;
        if (n.t === 'boss') log['bossHp' + act] = RUN.hp;
        if (n.t === 'elite' || n.t === 'rival') log.elites = (log.elites || 0) + 1;
        const res = fight(enc);
        log.fights.push({ act, ids: enc.ids.join('+'), type: enc.type, sport: enc.sport, lost: hp0 - RUN.hp, turns: B.turn, res, stall: !!B.stall, sw: !!(B.sc && B.sc.win), hl: B.sc ? B.sc.hl.slice() : [], us: B.sc && B.sc.us, them: B.sc && B.sc.them });
        if (res === 'lose') { log.result = 'lose'; log.death = enc.ids.join('+'); log.act = act; log.floor = n.r; break outer; }
        afterCombat();
        settleStakes();
        const rw = combatRewards();
        if (rw.reel) RUN.deck.push(mkCard(rw.reel[0].id)); gainGold(rw.gold); if (rw.relic) gainRelic(rw.relic); if (rw.tonic) gainTonic(rw.tonic); if (rw.boss) gainRelic(rw.boss[0]);
        // spend what season goals and sports wins pay, as a player would
        while ((RUN.rareTokens || 0) > 0) { RUN.deck.push(mkCard(pick(cardPool('r')).id)); RUN.rareTokens--; }
        while ((RUN.pracTokens || 0) > 0) { const pc = RUN.deck.filter(practicable).sort((a, b) => (CARDS[b.id].type === 'atk') - (CARDS[a.id].type === 'atk'))[0]; if (pc) pc.sk = 1; RUN.pracTokens--; }
        if (RUN.deck.length < 26) { const c = rw.cards.slice().sort((a, b) => ({ r: 3, u: 2, c: 1 }[CARDS[b.id].rar] - { r: 3, u: 2, c: 1 }[CARDS[a.id].rar]))[0]; RUN.deck.push(mkCard(c.id, c.up)); }
        if (n.t === 'boss') { RUN.act++; if (RUN.act >= 3) { log.result = 'win'; log.act = 2; break outer; } RUN.hp = Math.min(RUN.maxhp, RUN.hp + Math.round((RUN.maxhp - RUN.hp) * diffOf(RUN).heal)); RUN.map = genMap(RUN.act); RUN.pos = null; RUN.path = []; RUN.actFights = 0; continue outer; }
      } else if (n.t === 'rest') { if (RUN.hp < RUN.maxhp * .65 && !hasRelic('ioun')) RUN.hp = Math.min(RUN.maxhp, RUN.hp + Math.round(RUN.maxhp * .3)); else { const c = shuffle(RUN.deck.filter(upgradable))[0]; if (c) c.up = true; } }
      else if (n.t === 'shop') { if ((RUN.fans || 0) >= 150) { RUN.fans -= 150; RUN.maxhp += 3; RUN.hp += 3; } if ((RUN.fans || 0) >= 120) { const pc = RUN.deck.filter(practicable)[0]; if (pc) { pc.sk = 1; RUN.fans -= 120; } } const S = makeShop(); if (RUN.gold >= RUN.removeCost) { const j = RUN.deck.findIndex(c => c.id === 'check' || CARDS[c.id].type === 'curse'); if (j >= 0) { RUN.deck.splice(j, 1); RUN.gold -= RUN.removeCost; RUN.removeCost += 25; } } for (const w of S.cards) if (RUN.gold >= w.price + 20 && CARDS[w.id].rar !== 'c') { RUN.gold -= w.price; RUN.deck.push(mkCard(w.id)); } for (const w of S.relics) if (RUN.gold >= w.price) { RUN.gold -= w.price; gainRelic(w.id); } }
      else if (n.t === 'chest') { gainRelic(randomRelic()); gainGold(ri(25, 45)); }
      else if (n.t === 'event') {
        const ev = pickEvent(); const os = ev.opts().filter(o => !o.ok || o.ok()); const o = pick(os.slice(0, Math.max(1, os.length - 1))); const r = o.go(); const T = r.then;
        if (T === 'remove') { const j = RUN.deck.findIndex(c => c.id === 'check'); if (j >= 0) RUN.deck.splice(j, 1); } else if (T === 'upgrade') { const c = RUN.deck.find(upgradable); if (c) c.up = true; } else if (T && T.cards) RUN.deck.push(mkCard(T.cards[0].id, T.cards[0].up)); else if (T && T.relic) gainRelic(T.relic);
        if (RUN.hp <= 0) RUN.hp = 1;
      }
    }
  }
  log.hp = RUN.hp; log.deck = RUN.deck.length; log.relics = RUN.relics.length; log.maxhp = RUN.maxhp; log.route = opts.route || 'balanced'; log.style = RUN.style || 0;
  return log;
};
