/* ---------- the run ---------- */
function resumeRun(r) {
  RUN = r; UID = Math.max(UID, ...RUN.deck.map(c => c.uid)) + 1;
  RUN.path = RUN.path || [];
  if (RUN.battle) restoreBattle(RUN.battle);
  else if (RUN.pending) beginFight(RUN.pending);
  else if (RUN.panel) renderPanel();
  else { showView('map'); renderMap(); }
}
function enterNode(k) {
  const n = RUN.map.nodes[k]; if (!n) return;
  RUN.pos = k; RUN.path.push(k); RUN.floor = n.r;
  skyTick();
  if (n.t === 'fight' || n.t === 'elite' || n.t === 'rival' || n.t === 'boss') { const enc = rollEncounter(n.t === 'fight' ? 'normal' : n.t, n.sport); if (n.trait) enc.trait = n.trait; if (n.stakes) enc.stakes = n.stakes; RUN.pending = enc; saveRun(); beginFight(enc); return; }
  if (n.t === 'rest') RUN.panel = { t: 'rest' };
  else if (n.t === 'shop') RUN.panel = { t: 'shop', shop: makeShop() };
  else if (n.t === 'event') RUN.panel = { t: 'event', id: pickEvent().id };
  else if (n.t === 'chest') RUN.panel = { t: 'chest', relic: randomRelic(), gold: ri(25, 45) };
  saveRun(); renderPanel();
}
function beginFight(enc) {
  A.ent = {}; A.pops = []; A.dice = null; A.spops = [];
  UI.sel = -1; UI.busy = false; UI.kbTarget = null;
  sprClear();
  startCombat(enc.ids, enc.type, enc.sport, enc.trait);
  showView('fight');
  A.vfx = [];
  if (enc.type === 'boss') for (const e of B.enemies) if (isBoss(e)) { const a = entA(e.uid); a.enter = A.t + .9; a.landed = 0; }
  const boss = enc.type === 'boss' ? ENEMIES[enc.ids.find(id => ENEMIES[id].boss) || enc.ids[0]] : null;
  B.fx.unshift({ k: 'banner', t: boss ? boss.n.split(',')[0] : enc.type === 'rival' ? `Rivalry game: ${B.enemies[0].n}` : enc.type === 'elite' ? `Elite: ${ENEMIES[enc.ids[0]].n}${enc.trait ? ` (${ELITE_TRAITS[enc.trait].n})` : ''}` : `${SPORTS[B.sport].n}: ${SPORTS[B.sport].rule}`, sub: boss && boss.id === 'baron' ? 'Four quarters, four sports. Every three turns the game changes.' : SPORT_BRIEF[B.sport] });
  consumeFx(); renderFightHUD();
  sfx.horn();
}
function finishFight() {
  UI.busy = false; if (RUN) RUN.battle = null;
  if (B.over === 'lose') { logGame(true); recordRun('lose'); showEnd('lose'); return; }
  afterCombat();
  const rw = combatRewards();
  RUN.pending = null;
  RUN.panel = { t: 'reward', rw, type: B.type, strike: B.strike, potg: B.sc && B.sc.potg, goals: RUN.goalsDone || [], stakes: settleStakes() }; RUN.goalsDone = [];
  saveRun(); renderPanel(); sfx.crowd(1);
}
function backToMap() { RUN.panel = null; saveRun(); showView('map'); renderMap(); }
function advanceAct() {
  RUN.act++;
  if (RUN.act >= 3) { RUN.act = 2; RUN.floor = FLOORS; recordRun('win'); showEnd('win'); return; }
  RUN.hp = Math.min(RUN.maxhp, RUN.hp + Math.round((RUN.maxhp - RUN.hp) * diffOf(RUN).heal));
  RUN.map = genMap(RUN.act); setGoals(RUN.act); RUN.pos = null; RUN.path = []; RUN.actFights = 0; RUN.floor = 0; RUN.panel = null;
  saveRun(); showView('map'); renderMap();
}
