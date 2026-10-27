# Realm games at the grounds (issue #6, phase 2): a ground hosts your team only with a full squad for its sport (the
# number depends on the sport), and then its groundskeeper puts on a Friendly or a Challenge, a card-game match locked
# to the ground's sport, against the city's club. Starts a journey with the three founders (every ground says how
# many more to recruit), recruits up to each squad, plays and wins a Friendly at the Pond Rink (hockey only, the
# Rimewatch Hockey Club, back inside the rink after, the record on the scoreboard, one game a day), loses a Challenge
# at the Anvil Ring (an elite, a tier up, a blackout, the loss on the record), and saves and restores a match at the
# Charter Court. The sport never drifts, the journal and How to play say so, and the audit is clean.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-gmatch-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .ghost, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 80) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''
KINDS = ['troll', 'harpy', 'golem', 'wraith', 'spider']

async def new_journey(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_GRD_SQUAD !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def recruit_to(pg, n):
    await pg.evaluate(f"(() => {{ const K = {json.dumps(KINDS)}; let i = 0; while (wRoster().length < {n} && i < 10) wRecruit({{ kind: K[i++ % K.length], lvl: 2 }}, 'tavern'); }})()")
    await pg.evaluate(CLOSE_ALL)

async def enter_ground(pg, gid):
    await pg.evaluate(f"(() => {{ const L = DB.locs.find(l => l.id === '{gid}'); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); }})()")
    await pg.evaluate(CLOSE_ALL)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg)

        # ---------- the squad rule ----------
        sq = await pg.evaluate("({ sq: W_GRD_SQUAD, sports: Object.keys(SPORTS), max: W_PARTY.max, ball: W_BALL.minOwn, n: wRoster().length })")
        S = sq['sq']
        check(sorted(S) == sorted(sq['sports']) and all(4 <= v <= sq['max'] for v in S.values()) and len(set(S.values())) >= 3 and S['baseball'] == sq['ball'],
              'every sport has its own squad size, more than the founders and no more than a full roster', S)
        check(sq['n'] == 3, 'a new journey starts with three players', sq['n'])
        probs = await pg.evaluate("W_GRDS.map(g => [g.id, g.sport, wGrdProblems(g.id)])")
        check(all(p_ and 'Recruit' in p_[0] for _, _, p_ in probs), 'with the founders alone, no ground will host you, and each says how many to recruit', probs)
        await enter_ground(pg, 'g_rink')
        await pg.evaluate("(() => { const r = wSay('gk_rink', 'game'); wRunAct(r.act, 'gk_rink'); })()")
        card = await pg.evaluate("(() => { const b = document.getElementById('modalBox'); return { open: !document.getElementById('modal').hidden, btns: [...b.querySelectorAll('[data-gplay]')].map(x => x.disabled), text: b.textContent }; })()")
        check(card['open'] and card['btns'] == [True, True] and '3 of 6' in card['text'] and 'Recruit 3 more' in card['text'], 'the rink keeper\'s card: 3 of 6, recruit 3 more, and no Play', card)
        await pg.screenshot(path='/tmp/realm-gmatch-short.png')
        await pg.evaluate(CLOSE_ALL)

        await recruit_to(pg, 4)
        open4 = await pg.evaluate("Object.fromEntries(W_GRDS.filter(g => g.sport !== 'baseball').map(g => [g.id, !wGrdProblems(g.id).length]))")
        check(all(v == (S[g['sport']] <= 4) for g in [{'id': i, 'sport': s} for i, s, _ in probs if s != 'baseball'] for v in [open4[g['id']]]),
              'with four players, exactly the grounds whose squad is four will host you', open4)
        await recruit_to(pg, 7)
        check(await pg.evaluate("W_GRDS.every(g => !wGrdProblems(g.id).length)"), 'with seven, every ground will', await pg.evaluate("W_GRDS.map(g => wGrdProblems(g.id))"))

        # ---------- the sport is the ground's ----------
        drift = await pg.evaluate("""(() => { const bad = [];
          for (const g of W_GRDS) if (g.sport !== 'baseball') for (const mode of ['friendly', 'challenge']) for (let i = 0; i < 6; i++) {
            const e = wBuildEncounter({ type: W_GRD_PLAY[mode].type, sport: g.sport, tier: wGrdTier(g.id, mode), world: { kind: 'ground', ref: { g: g.id, mode }, region: W_GRD_REG[g.city] } });
            if (e.sport !== g.sport || e.world.kind !== 'ground') bad.push([g.id, mode, e.sport]); }
          return bad; })()""")
        check(not drift, 'a ground\'s match is always its own sport, whoever turns up', drift)

        # ---------- a Friendly at the Pond Rink ----------
        await pg.evaluate("(() => { const r = wSay('gk_rink', 'game'); wRunAct(r.act, 'gk_rink'); })()")
        await pg.click('[data-gplay="friendly"]')
        await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("document.getElementById('modalBox').textContent")
        check('Friendly at The Pond Rink' in pre and 'Rimewatch Hockey Club' in pre and 'hockey only' in pre, 'the pre-game card: a Friendly at the Pond Rink, hockey only, the Rimewatch Hockey Club', pre[:300])
        await pg.screenshot(path='/tmp/realm-gmatch-pregame.png')
        await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        f = await pg.evaluate("({ sport: B.sport, kind: RUN.pending.world.kind, ref: RUN.pending.world.ref, type: B.type, tier: RUN.pending.world.tier, team: B.enemies.filter(e => !isBoss(e) && !ENEMIES[e.id].team).map(e => e.team && e.team.name) })")
        check(f['sport'] == 'hockey' and f['kind'] == 'ground' and f['ref'] == {'g': 'g_rink', 'mode': 'friendly'} and f['type'] == 'normal' and f['tier'] == 2,
              'the match: hockey, a normal game at tier 2, with the ground on the world context', f)
        check(all(t == 'Rimewatch Hockey Club' for t in f['team']), 'the other side wears the city club\'s colours', f['team'])
        await pg.wait_for_timeout(600)
        await pg.screenshot(path='/tmp/realm-gmatch-fight.png')
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the Friendly is won', view)
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        after = await pg.evaluate("({ map: WG.map, rec: WG.grd.rec.g_rink, met: WG.grd.met.g_rink === WG.dayAbs, probs: wGrdProblems('g_rink'), log: WLOG.slice(-8).map(l => l[0]).join(' ') })")
        check(after['map'] == 'g_rink' and after['rec']['w'] == 1 and after['rec']['l'] == 0 and after['rec']['last']['mode'] == 'friendly', 'back inside the rink, and the win is on the record', after)
        check(after['met'] and any('today' in x for x in after['probs']) and 'beat the Rimewatch Hockey Club' in after['log'], 'one game a day at a ground', after)
        await pg.evaluate("WLOG.length = 0; wUse(11, 2); wDrain()")
        board = await pg.evaluate("WLOG.map(l => l[0]).join(' ')")
        check('scoreboard' in board and 'record here: 1–0' in board, 'the scoreboard shows your last game here', board)
        jr = await pg.evaluate("wJRules('g_rink').join(' ')")
        check('squad is 6' in jr and '1–0' in jr, 'the journal has the squad and your record', jr)

        # ---------- a Challenge at the Anvil Ring, lost ----------
        await enter_ground(pg, 'g_ring')
        await pg.evaluate("(() => { const r = wSay('gk_ring', 'game'); wRunAct(r.act, 'gk_ring'); })()")
        await pg.click('[data-gplay="challenge"]')
        await pg.wait_for_selector('#wPlay'); await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        ch = await pg.evaluate("({ sport: B.sport, type: B.type, tier: RUN.pending.world.tier, trait: !!RUN.pending.trait || !!(B.trait) })")
        check(ch['sport'] == 'boxing' and ch['type'] == 'elite' and ch['tier'] == 3, 'a Challenge: an elite, boxing, a tier up (3 in the Cindermaw)', ch)
        await pg.evaluate("(() => { B.over = 'lose'; B.phase = 'done'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        lost = await pg.evaluate("({ map: WG.map, rec: WG.grd.rec.g_ring, met: WG.grd.met.g_ring === WG.dayAbs })")
        check(lost['rec']['l'] == 1 and lost['rec']['w'] == 0 and lost['met'] and lost['map'] != 'g_ring', 'losing is a blackout, and the loss goes on the record', lost)
        await pg.evaluate(CLOSE_ALL)

        # ---------- save and restore a match at the Charter Court ----------
        await enter_ground(pg, 'g_court')
        await pg.evaluate("wStartGrd('g_court', 'friendly')")
        await pg.wait_for_selector('#wPlay'); await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        await pg.evaluate("snapBattle()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'fight' && !!B")
        rs = await pg.evaluate("({ sport: B.sport, ref: RUN.pending.world.ref, kind: RUN.pending.world.kind })")
        check(rs['sport'] == 'basketball' and rs['kind'] == 'ground' and rs['ref']['g'] == 'g_court', 'a match at a ground saves and restores with its ground', rs)
        view = await pg.evaluate(WIN)
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("WG.grd.rec.g_court.w === 1 && WG.map === 'g_court'"), 'and finishes at the court, on the record', await pg.evaluate("[WG.map, WG.grd.rec]"))

        # ---------- words ----------
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGrdPlay'); return h ? h.textContent : ''; })()")
        check('Games at the grounds' in help_ and 'football 7' in help_ and 'golf 4' in help_, 'How to play explains the squad sizes and the games', help_)
        talk = await pg.evaluate("W_GRDS.filter(g => g.sport !== 'baseball').map(g => { const id = 'gk_' + g.id.slice(2); return [id, wSay(id, 'game').act, wSay(id, 'job').text.includes('GAME')]; })")
        check(all(a == 'gmatch' and j for _, a, j in talk), 'every keeper but the Ballpark\'s puts on a GAME', talk)
        check(await pg.evaluate("wSay('gk_ballpark', 'game').act") == 'ball', 'the Ballpark\'s GAME is still a ball game')
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm gmatch passed')

asyncio.run(main())
