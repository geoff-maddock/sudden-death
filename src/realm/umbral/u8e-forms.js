/* u8e: corrupted forms (issue #111, phase E). Loads after the earlier Umbral parts; changes them only by reassignment
   (saved originals carry the wWU8E prefix).

   Every side the dark plays is drawn in shadow, in every sport: drained and violet, pale glowing eyes, two short horns
   and cracks of light (the figures' shade: src/render/creatures.js for the card game, src/figures/figures.js for the
   scoped engines, Brimstone Diamond's own figures for baseball). Each Nadir team, the finale's included, goes to its
   engine with shade: 1 (W_UMB4*.team and the team each adapter builds); the engines keep it on the team (gfTeam,
   bkTeam, hkTeam, glTeam; bowling and curling pass it to their figures) and draw that side's players with it. A boxing
   Nadir fighter is drawn with it from f.umb. Golf has no figures: its hitter's mark glows. Your side never has it, and a
   team without it is drawn as it always was.

   Truer dark traits in the card game (W_UMB3.traits, three replaced; the others keep theirs):
     wraith  Half There: the first hit from an Attack or a set play (grouped on purpose, as the sports layer does)
             against it each of your turns does nothing (status u_phase: hurtEnemy spends it on such a hit, never a
             skill's, poison, burn or a raw blow; turnStart puts it back). atkDmg stays pure: previews show the real
             number, and the breakdown notes the first hit is lost.
     ogre    Won't Flinch: Weak and Exposed don't take on it (status u_still: the sums ignore them, and they come off
             after a card or tonic resolves and when it is done, at the end and the start of your turn, and before its swing;
             the log says so. One laid on in the other side's turn shows until then).
     spider  Webs the Bench: at the start of every other turn of yours (the first, the third...) one card in your hand
             costs 1 more that turn (every turn cost 17.5 points against the Spider Matriarch next to no trait, 8 next to the
             old Slimed, in a paired lab; every other turn, 4 next to the old: docs/realm/BALANCE.md. Measured with the realm bot
             as it was then, valuing a card by its printed cost; it now reads cardCost, the Webbed +1 included) (B.uWeb,
             the card's uid; status u_web on the spider), marked Webbed on the card.
   All of it is plain data on B and its players (uHalf, uStill, uWeb), so a mid-match save keeps it.

   wUmbShrug, wUmbShrugAll, wUmbWithout, wUmbWeb
   Wraps: wUmb4aNine, wUmbGfTeam, wUmbBkTeam, wUmbHkTeam, wUmbGlFour, wUmbBlFive, wUmbCrFour (wWU8ENine, wWU8EGfTeam,
   wWU8EBkTeam, wWU8EHkTeam, wWU8EGlFour, wWU8EBlFive, wWU8ECrFour: the team goes with shade); atkDmg (wSdAtkDmg),
   hurtEnemy (wSdHurtEnemy), enemyHitDmg (wSdEnemyHitDmg), resolve (wSdResolve), playCard (wSdPlayCard), useTonic (wSdUseTonic), endTurn (wSdEndTurn), doMove (wSdDoMove), playerTurnStart
   (wSdPlayerTurnStart), cardCost (wSdCardCost), cardHTML (wSdCardHTML: Webbed), renderHelp (wWU8ERenderHelp),
   wUmbQuick (wWU8EQuick: the traits on the Quick start's Umbral tab). */

/* ---------- every Nadir side in shadow ---------- */
for (const T of [W_UMB4A, W_UMB4B, W_UMB4D, W_UMB4E, W_UMB4F, W_UMB4G, W_UMB4H]) for (const k of ['team', 'finaleTeam']) if (T[k]) T[k].shade = 1;
const wWU8ENine = wUmb4aNine, wWU8EGfTeam = wUmbGfTeam, wWU8EBkTeam = wUmbBkTeam, wWU8EHkTeam = wUmbHkTeam, wWU8EGlFour = wUmbGlFour, wWU8EBlFive = wUmbBlFive, wWU8ECrFour = wUmbCrFour;
const wU8EShade = f => function () { const T = f.apply(this, arguments); if (T && typeof T === 'object') T.shade = 1; return T; };
wUmb4aNine = wU8EShade(wWU8ENine); wUmbGfTeam = wU8EShade(wWU8EGfTeam); wUmbBkTeam = wU8EShade(wWU8EBkTeam); wUmbHkTeam = wU8EShade(wWU8EHkTeam);
wUmbGlFour = wU8EShade(wWU8EGlFour); wUmbBlFive = wU8EShade(wWU8EBlFive); wUmbCrFour = wU8EShade(wWU8ECrFour);

/* ---------- truer dark traits ---------- */
ST.u_phase = { n: 'Half There', pill: 'Half There', col: '#c8b8ff', desc: 'The first hit from an Attack or a set play against it each turn does nothing.' };
ST.u_still = { n: 'Won\'t Flinch', pill: 'Won\'t Flinch', col: '#c8b8ff', desc: 'Weak and Exposed don\'t take on it.' };
ST.u_web = { n: 'Webs the Bench', pill: 'Webs the Bench', col: '#c8b8ff', desc: 'Every other turn of yours (the first, the third and on), one card in your hand costs 1 more that turn.' };
Object.assign(W_UMB3.traits, {
  wraith: { n: 'Half There', d: 'The first hit from an Attack or a set play against it each turn does nothing.', go: e => { e.uHalf = 1; e.st.u_phase = 1; } },
  ogre: { n: 'Won\'t Flinch', d: 'Weak and Exposed don\'t take on it.', go: e => { e.uStill = 1; e.st.u_still = 1; } },
  spider: { n: 'Webs the Bench', d: 'Every other turn of yours (the first, the third and on), one card in your hand costs 1 more that turn.', go: e => { e.uWeb = 1; e.st.u_web = 1; } },
});
// Half There comes back at the start of each of your turns (after u3's hook gives a newcomer its form)
onHook('turnStart', () => { if (B && B.umb) for (const e of B.enemies) if (e.uHalf && !e.dead && !e.fled) e.st.u_phase = 1; });
// a status set aside for one sum and put back at once (the maths of Won't Flinch: nothing is changed)
function wUmbWithout(e, k, f) { const v = e.st[k]; if (!v) return f(); delete e.st[k]; try { return f(); } finally { e.st[k] = v; } }
// the damage maths stay pure: Exposed counts for nothing on an Unflinching player; Half There is only a note in the
// breakdown (WHY, the explanation dmgWhy asks for), since only the first real hit is lost (hurtEnemy)
// (an Attack or a set play: grouped together here on purpose, as the sports layer groups them; most of the engine
// checks 'atk' alone)
const wUmbIsAtk = t => t === 'atk' || t === 'play';
const wSdAtkDmg = atkDmg;
atkDmg = function (base, e, card) {
  const args = arguments, n = e && e.uStill && e.st && B && B.umb ? wUmbWithout(e, 'vuln', () => wSdAtkDmg.apply(this, args)) : wSdAtkDmg.apply(this, args);
  // (a short note, not a multiplier: the total is the real hit; only an Attack's or a set play's)
  if (WHY && e && e.st && e.st.u_phase && B && B.phase === 'player' && card && wUmbIsAtk(def(card).type)) WHY.push(['Half There', '', 'Half There: 1st hit lost']);
  return n;
};
// Half There: the first hit from an Attack or a set play against it this turn does nothing (not poison, burn, or a raw blow:
// an instant kill, Tempest, Haunt)
const wSdHurtEnemy = hurtEnemy;
hurtEnemy = function (e, dmg, o) {
  o = o || {};
  if (e && !e.dead && !e.fled && e.st && e.st.u_phase && B && B.phase === 'player' && B.inCard && wUmbIsAtk(B.curType) && !o.raw && !o.psn && !o.burn) {
    delete e.st.u_phase; dmg = 0;
    fx({ k: 'say', e: e.uid, t: 'Half There' });
    log(`${e.n} is Half There: the hit passes straight through.`, 'bad');
  }
  return wSdHurtEnemy.call(this, e, dmg, o);
};
// Won't Flinch: Weak and Exposed come off it at the game's own moments (after a card or a tonic, at the end and the start
// of your turn, before its swing); in between, the sums ignore them
function wUmbShrug(e) {
  const ks = ['weak', 'vuln'].filter(k => e.st[k]); if (!ks.length) return;
  for (const k of ks) delete e.st[k];
  fx({ k: 'say', e: e.uid, t: 'Won\'t Flinch' });
  log(`${e.n} Won't Flinch: ${ks.map(k => ST[k].n).join(' and ')} doesn't take.`, 'bad');
}
function wUmbShrugAll() { if (B && B.umb && !B.over) for (const e of B.enemies) if (e.uStill && !e.dead && !e.fled) wUmbShrug(e); }
const wSdEnemyHitDmg = enemyHitDmg;
enemyHitDmg = function (e) { const args = arguments; return e && e.uStill && e.st && B && B.umb ? wUmbWithout(e, 'weak', () => wSdEnemyHitDmg.apply(this, args)) : wSdEnemyHitDmg.apply(this, args); };
const wSdResolve = resolve;
resolve = function () { const r = wSdResolve.apply(this, arguments); wUmbShrugAll(); return r; };
// (and when a card or a tonic that went ahead is done, and when your turn ends: Weak or Exposed laid on outside a
// card's ops, by a hook, a pet, Haunt or the end of your turn, comes off there; addSt is a constant, so this is the
// moment after, never inside a sum. One laid on in the other side's turn shows until its next swing)
const wSdPlayCard = playCard, wSdUseTonic = useTonic, wSdEndTurn = endTurn;
playCard = function () { const r = wSdPlayCard.apply(this, arguments); if (r) wUmbShrugAll(); return r; };
useTonic = function () { const r = wSdUseTonic.apply(this, arguments); if (r) wUmbShrugAll(); return r; };
endTurn = function () { const mine = !!B && B.phase === 'player' && !B.over, r = wSdEndTurn.apply(this, arguments); if (mine) wUmbShrugAll(); return r; };
const wSdDoMove = doMove;
doMove = function (e) { if (e && e.uStill && B && B.umb) wUmbShrug(e); return wSdDoMove.apply(this, arguments); };
// Webs the Bench: a card of the hand you drew costs 1 more this turn
function wUmbWeb() {
  const sp = B.enemies.find(e => e.uWeb && !e.dead && !e.fled); if (!sp || B.turn % 2 === 0) return; // (every other turn: the first, the third...)
  const can = B.hand.filter(c => def(c).cost >= 0); if (!can.length) return;
  const c = pick(can); B.uWeb = c.uid;
  fx({ k: 'say', e: sp.uid, t: 'Webs the Bench' });
  log(`${sp.n} Webs the Bench: ${def(c).n} costs 1 more this turn.`, 'bad');
}
const wSdPlayerTurnStart = playerTurnStart;
playerTurnStart = function () {
  if (B && B.uWeb != null) B.uWeb = null;
  const r = wSdPlayerTurnStart.apply(this, arguments);
  if (B && B.umb && !B.over && B.phase === 'player') { wUmbShrugAll(); wUmbWeb(); }
  return r;
};
const wSdCardCost = cardCost;
// (a turn of free Attacks wins: a webbed Attack is free with the rest)
cardCost = function (card) { const n = wSdCardCost.apply(this, arguments); return n >= 0 && card && B && B.uWeb != null && card.uid === B.uWeb && !(B.freeAtk && def(card).type === 'atk') ? n + 1 : n; };
const wSdCardHTML = cardHTML;
cardHTML = function (card, o) {
  const h = wSdCardHTML.apply(this, arguments);
  if (!(o && o.live && B && B.uWeb != null && card && card.uid === B.uWeb)) return h;
  return h.replace('<div class="card ', '<div class="card uwebbed ').replace(/(<div class="art"[^>]*>)/, '$1<span class="uweb" title="Webs the Bench: it costs 1 more this turn">Webbed +1</span>');
};
(() => { if (typeof document === 'undefined') return; const st = document.createElement('style'); st.textContent = `.card.uwebbed .art{box-shadow:inset 0 0 0 2px #c8b8ff}.card.uwebbed .cost{color:#e4defa;border-color:#c8b8ff;background:#3a2a4a}.card .uweb{position:absolute;left:calc(var(--cw)*.03);top:calc(var(--cw)*.28);font-family:var(--hud);font-size:calc(var(--cw)*.075);line-height:1;color:#1a1022;background:#c8b8ff;padding:2px 4px 0;border-radius:3px;z-index:2}`; document.head.appendChild(st); })();

/* ---------- How to play and the Quick start ---------- */
const W_UMB8E_HELP = 'On the dark side every player is drawn in shadow, horned and cracked with light, in every sport. Three dark traits bend the card game\'s rules: a Wraith is <b>Half There</b> (the first hit from an Attack or a set play against it each turn does nothing), an Ogre <b>Won\'t Flinch</b> (Weak and Exposed don\'t take on it), and a Spider Queen <b>Webs the Bench</b> (every other turn of yours, the first, the third and on, one card in your hand costs 1 more that turn, marked Webbed).';
const wWU8ERenderHelp = renderHelp;
renderHelp = function () {
  const r = wWU8ERenderHelp.apply(this, arguments), u = $('wHelpUmbral');
  if (u && u.tagName === 'DIV' && !$('wHelpUmbForms')) u.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpUmbForms"><b>Their true forms.</b> ${W_UMB8E_HELP}</p>`);
  return r;
};
const wWU8EQuick = wUmbQuick;
wUmbQuick = function () {
  const q = wWU8EQuick.apply(this, arguments);
  q.lede += ' Last, the dark traits that bend the card game\'s rules.';
  q.steps.push({ h: 'Dark traits that bend the rules', t: ['wraith', 'ogre', 'spider'].map(k => `<b>${esc(W_UMB3.traits[k].n)}</b> (${esc(KIND_NAME[k])}): ${esc(W_UMB3.traits[k].d)}`).join(' ') });
  return q;
};
