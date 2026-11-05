# Realm superstars, phase 2 (issue #24): the Phoenix, end to end. Drawn in all four scopes (the Realm's and each
# engine's); never on a CPU side or a call-up. Met through Ash Peregrine in Cinderhold: locked, the story and the feat;
# unlocked, a price in gold or Cinder Eggs. It joins at the team's average level with its signature card, one superstar
# a journey, and a full roster asks who to release before anything is paid. Rebirth: in a card-game match while it
# starts, once (and not from the bench); in the ring it beats one count it would have lost, once a bout. Its football
# powers and ultimate, its baseball template and Sunfire, a whole game in each engine with it. The captain's bonus,
# the Stars tab, How to play. Asserts; exits nonzero. Screenshots: /tmp/realm-phoenix-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #wRelNo, #modalBox button'); if (!b) break; b.click(); } })()"""
UNLOCK = "(() => { const S = wStarsAll(); S.un.phoenix = '2026-11-05'; localStorage.setItem(wStarsKey(), JSON.stringify(S)); })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenStar === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- a kind in every scope, never anyone else's ----------
        k = await pg.evaluate("""(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 200; let drew = true;
          try { drawFig(cv.getContext('2d'), 'phoenix', 100, 190, 160, { color: '#8a2a1c', light: '#ffd9a0', short: 'P' }, { num: 1 }); } catch (e) { drew = String(e); }
          return { drew, name: KIND_NAME.phoenix, sig: SIG.phoenix, cards: Object.values(CARDS).filter(c => c.kind === 'phoenix').length, bx: wBX.kinds.includes('phoenix'), gf: wGF.kinds.includes('phoenix'),
            bd: wBD.rate('phoenix').ult, calls: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].some(pos => wBD.kindsAt(pos).includes('phoenix')),
            trait: (wBX.traits.phoenix || {}).n, pow: wBX.powerBook.phoenix && wBX.powerBook.phoenix.ult.n, gfb: wGF.powerBook.phoenix && wGF.powerBook.phoenix.ult.n, cap: W_CAPTAIN.phoenix && W_CAPTAIN.phoenix.n }; })()""")
        check(k['drew'] is True and k['name'] == 'Phoenix' and k['sig'] == 'phx_flare' and k['cards'] == 6, 'the Phoenix is a kind: drawn, named, a signature card and five more', k)
        check(k['bx'] and k['gf'] and k['bd'] == 'sunfire' and not k['calls'], 'every engine knows it (Sunfire on the diamond), and no call-up is ever one', k)
        check(k['trait'] == 'Rebirth' and k['pow'] == 'Sunfire' and k['gfb'] == 'Rebirth' and k['cap'] == 'Sunrise', 'its nature in the ring, its powers, and its captain\'s bonus', k)

        # ---------- the meeting, locked ----------
        t = await pg.evaluate("({ job: DB.chars.scout.topics.job.t.includes('PHOENIX'), act: DB.chars.scout.topics.phoenix.act })")
        check(t == {'job': True, 'act': 'star:phoenix'}, 'Ash Peregrine in Cinderhold knows the story (a PHOENIX topic)', t)
        lk = await pg.evaluate("""(() => { wRunAct('star:phoenix', 'scout'); const b = document.getElementById('modalBox');
          return { story: b.textContent.includes('crater rim'), feat: b.textContent.includes('Win the Cinder Cup'), buy: !!document.getElementById('wStarGold') }; })()""")
        check(lk == {'story': True, 'feat': True, 'buy': False}, 'locked, the meeting tells the story and the feat, and offers nothing to buy', lk)
        await pg.evaluate(CLOSE)

        # ---------- unlocked: the price, and signing ----------
        await pg.evaluate(UNLOCK)
        await pg.evaluate("(() => { const R = wRoster(); [3, 5, 4].forEach((l, i) => { R[i].lvl = l; }); RUN.gold = 50; wAddItem('cinderegg', 2); wRunAct('star:phoenix', 'scout'); })()")
        pr = await pg.evaluate("({ gold: !!document.getElementById('wStarGold') && document.getElementById('wStarGold').disabled, eggs: !!document.getElementById('wStarItems') && !document.getElementById('wStarItems').disabled, lvl: document.getElementById('modalBox').textContent.includes('level 4') })")
        check(pr == {'gold': True, 'eggs': True, 'lvl': True}, 'unlocked: 300 gold (too dear for 50) or two Cinder Eggs, joining at the team\'s average level', pr)
        await pg.screenshot(path='/tmp/realm-phoenix-meet.png')
        await pg.click('#wStarItems')
        sg = await pg.evaluate("""(() => { const p = wRoster().find(x => x.kind === 'phoenix');
          return { p: p && { n: p.n, lvl: p.lvl, star: p.star }, eggs: WG.items.cinderegg || 0, gold: RUN.gold, star: WG.star, card: wCardsOf(p.id).some(c => c.id === 'phx_flare'), again: wStarCanSign('phoenix') }; })()""")
        check(sg['p'] == {'n': 'Ashwing', 'lvl': 4, 'star': 'phoenix'} and sg['eggs'] == 0 and sg['gold'] == 50 and sg['star'] == 'phoenix' and sg['card'], 'Ashwing joins at level 4 for the eggs, with Flare', sg)
        check('already' in sg['again'], 'and only once a journey', sg)
        one = await pg.evaluate("(() => { const keep = WG.star; WG.star = 'kraken'; const r = wStarCanSign('phoenix'); WG.star = keep; return r; })()")
        check('One superstar a journey' in one, 'another superstar this journey rules it out', one)
        await pg.evaluate(CLOSE)

        # ---------- a full roster asks first, and nothing is paid if you say no ----------
        fu = await pg.evaluate("""(() => { const keepStar = WG.star; WG.star = null; const ph = wRoster().find(x => x.kind === 'phoenix'); const st = WG.roster.indexOf(ph);
          WG.roster.splice(st, 1); while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: 'goblin' }, 'tavern'));
          RUN.gold = 500; const why = wSignStar('phoenix', 'gold'); const asked = !!document.getElementById('wRelNo'); document.getElementById('wRelNo').click();
          const r = { why, asked, gold: RUN.gold, star: WG.star, has: wRoster().some(x => x.kind === 'phoenix') };
          while (wRoster().length > 3) WG.roster.pop(); WG.roster.unshift(ph); WG.star = keepStar; return r; })()""")
        check(fu == {'why': '', 'asked': True, 'gold': 500, 'star': None, 'has': False}, 'a full roster asks who to release, and letting it go costs nothing', fu)
        await pg.evaluate(CLOSE)

        # ---------- Rebirth in a card-game match ----------
        rb = await pg.evaluate("""(() => { const ph = wRoster().find(x => x.kind === 'phoenix'); wMovePlayer(ph.id, 0);
          startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } }); const out = { starts: wPhxStarts() };
          loseHP(RUN.hp + 5); out.first = { hp: RUN.hp, want: Math.round(RUN.maxhp * W_PHX.reborn), over: B.over || null };
          loseHP(RUN.hp + 5); out.second = { hp: RUN.hp, over: B.over || null };
          return out; })()""")
        check(rb['starts'] and rb['first']['hp'] == rb['first']['want'] and rb['first']['over'] is None, 'Rebirth: the first time Team HP falls to 0, the Phoenix brings it back to 30%', rb)
        check(rb['second'] == {'hp': 0, 'over': 'lose'}, 'once a match: the second time, the line falls', rb)
        await pg.evaluate("(() => { B.forfeit = 1; finishFight(); })()")
        await pg.evaluate(CLOSE)
        bn = await pg.evaluate("""(() => { const ph = wRoster().find(x => x.kind === 'phoenix'); wMovePlayer(ph.id, wRoster().length - 1); RUN.hp = RUN.maxhp;
          startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } }); const starts = wPhxStarts(); loseHP(RUN.hp + 5); const r = { starts, over: B.over || null };
          B.forfeit = 1; finishFight(); RUN.hp = RUN.maxhp; wMovePlayer(ph.id, 0); return r; })()""")
        check(bn == {'starts': False, 'over': 'lose'}, 'from the bench it does nothing', bn)
        await pg.evaluate(CLOSE)

        # ---------- Rebirth in the ring ----------
        rg = await pg.evaluate("""(() => { W_RING_MODE = 'watch'; wRingBout({ kinds: ['phoenix', 'ogre'], seed: 5 }); wBX.pause(true); let n = 0;
          while (wBX.phase !== 'round' && n++ < 200) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); }
          const G = wBX.G, f = G.F[0]; G.powers = false; const down = () => { for (const x of G.F) { x.a = { k: 'idle', t: 0, dur: 0, id: 0 }; x.think = 99; } f.r.chin = 1; f.hpMax = 4; f.hp = .1; f.fx = []; G.kd[0] = 1;
            f.a = { k: 'stun', t: 0, dur: 9, id: 0 }; f.x = -1; G.F[1].x = 1; f.y = G.F[1].y = 0; let L = 0; while (G.down == null && f.hp > 0 && L++ < 60) wBX.land(1, 'hook');
            L = 0; while (wBX.phase !== 'kd' && L++ < 5) wBX.step(); };
          down(); const r = { down1: G.down };
          n = 0; while (wBX.phase === 'kd' && n++ < 4000) wBX.step(); r.after1 = wBX.phase; r.reborn = f.reborn; r.hp = Math.round(f.hp); r.ev = wBX.ev.some(e => e.k === 'reborn');
          n = 0; while (wBX.phase !== 'round' && n++ < 400) wBX.step();
          down(); n = 0; while (wBX.phase === 'kd' && n++ < 4000) wBX.step(); r.after2 = wBX.phase; r.how = G.over && G.over.how;
          wBX.pause(false); wLeaveRing(); return r; })()""")
        check(rg['down1'] == 0 and rg['after1'] != 'over' and rg['reborn'] == 2 and rg['hp'] >= 68 and rg['ev'], 'in the ring, a count the Phoenix would lose it beats, with most of its health', rg)
        check(rg['after2'] == 'over' and rg['how'] == 'ko', 'once a bout: the next one counts it out', rg)
        await pg.evaluate(CLOSE)

        # ---------- a whole game in each engine, with the Phoenix in it ----------
        gm = await pg.evaluate("""(() => { const out = {};
          const nine = wNineDef(); out.nine = nine.roster.filter(r => r.kind === 'phoenix').map(r => [r.pos, r.ult]);
          const opp = wGridOpp('local', 1), sq = wGridSquad(opp); out.seven = sq.team.roster.some(r => r.kind === 'phoenix');
          const g = wGF.simGame({ teams: [sq.team, opp], skill: [1, 1] }); out.gf = Array.isArray(g.score);
          const side = wRingSide(new Set()); out.ring = side.fighters.some(f => f.kind === 'phoenix'); out.card = !!wBX.simCard({ sides: [side, wRingOpp(Object.values(WG.rivals)[0], 1, new Set())], skill: [1, 1] }).result;
          return out; })()""")
        check(gm['nine'] == [['CF', 'sunfire']] and gm['seven'] and gm['gf'] and gm['ring'] and gm['card'], 'it plays centre field with Sunfire, makes the seven and the card, and whole games run', gm)
        bd = await pg.evaluate("(async () => { const keep = WG.ball && WG.ball.live; while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); const r = wStartBall({ club: 'local', how: 'sim' }); return { r, played: !!(WG.ball && WG.ball.games && WG.ball.games.length) || r === '' }; })()")
        check(bd['r'] == '', 'a whole baseball game simulates with it', bd)
        await pg.evaluate(CLOSE)

        # ---------- drawn inside an engine: a bout on screen ----------
        await pg.evaluate("W_RING_MODE = 'watch'; wRingBout({ kinds: ['phoenix', 'elf'], seed: 3 })")
        await pg.wait_for_function("UI.view === 'ring'")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path='/tmp/realm-phoenix-ring.png')
        await pg.evaluate("wLeaveRing()"); await pg.evaluate(CLOSE)

        # ---------- the Stars tab, How to play ----------
        await pg.evaluate("wOpenCamp('stars')"); await pg.wait_for_selector('#modalBox .wstars')
        tb = await pg.evaluate("(() => { const r = document.querySelector('#modalBox [data-star=\"phoenix\"]'); return { img: !!r.querySelector('img'), mine: r.textContent.includes('Ashwing is on your team') }; })()")
        check(tb == {'img': True, 'mine': True}, 'the Stars tab shows its portrait, and that it is yours this journey', tb)
        await pg.evaluate(CLOSE)
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpPhoenix'); return e ? e.textContent : ''; })()")
        check('Ash Peregrine' in h and 'Rebirth' in h and 'Sunfire' in h, 'How to play explains the Phoenix', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
