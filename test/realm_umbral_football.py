# Realm: football in the Umbral (issue #99, phase 4b). Tier U on the gridiron (tier 4: more rating points, the Lich
# coaching, a full bag), football's hexes (each does what it says, none changes a game without them), and the Cinder
# Pit's champion end to end: PLAY opens the card with the hexes, kickoff starts the Realm's football game at tier U with
# them (named in the log and on the scoreboard), it saves and resumes, a win pays the Ash Ball and a loss counts a try;
# backing away from the card costs nothing.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbGfTeam === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const ks = Object.keys(SIG).filter(k => FA_NAMES[k] && wGF.kinds.includes(k) && !wRoster().some(p => p.kind === k));
          while (wRoster().length < W_GFG.minOwn) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) { p.lvl = 6; delete p.gf; wGfOf(p); } WG.seven = null; wSevenSync(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_GFG.oppBonus), skill: [1, 2, 3, 4].map(t => wGridSkill(t)), name: W_BALL_SKILL[wGridSkill(4)[1]], bag: W_GRID_KIT.opp[4],
          pots: Object.keys(wGF.potions), lich: wGF.lichRules && wGF.lichRules.edge > 0 })""")
        check(tb['bonus'] == {'1': 0, '2': 1, '3': 4, '4': tb['bonus']['4']} and tb['bonus']['4'] > tb['bonus']['3'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich',
              'tier U is a fourth row: more rating points than tier 3, the Lich (skill 3); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(v >= 1 for v in tb['bag'].values()), 'their sideline brings a full bag at tier U', tb)

        # ---------- the Lich decides, not just a label ----------
        lc = await pg.evaluate("""(() => { const out = { calls: {}, fourth: null };
          // the same down, the same history: a Lich and an Archmage defense call it differently over many tries (it reads the offense)
          wGF.start({ seed: 11, skill: [1, 3] }); const G = wGF.G; G.seen[0] = Array.from({ length: 8 }, () => ({ oc: 'run' }));
          for (const sk of [2, 3]) { G.skill[1] = sk; const n = {}; for (let i = 0; i < 400; i++) { const c = wGF.cpu.def(); n[c] = (n[c] || 0) + 1; } out.calls[sk] = n; }
          // fourth and 2 from your own 36: the Archmage punts, the Lich goes for it
          G.poss = 0; G.down = 4; G.togo = 2; G.ball = 36; G.skill = [3, 1]; out.fourth = wGF.kick().coach; G.skill = [2, 1]; out.fourth2 = wGF.kick().coach;
          return out; })()""")
        L3, L2 = lc['calls']['3'], lc['calls']['2']
        check(L3.get('blitz', 0) > L2.get('blitz', 0) and L3.get('zone', 0) * 2 < L2.get('zone', 0) and lc['fourth'] == 'go' and lc['fourth2'] == 'punt',
              'the Lich calls its own way: against a side that keeps running it blitzes more and all but drops the deep zone the run beats, and goes for it on fourth and short', lc)

        # ---------- hexes ----------
        hx = await pg.evaluate("""(() => { const out = {}, J = x => JSON.stringify(x), sim = o => { const g = wGF.simGame(o); return J([g.score, g.plays, g.box.map(b => b.line)]); };
          out.same = sim({ seed: 21, skill: [1, 3] }) === sim({ seed: 21, skill: [1, 3], hexes: [] }) && sim({ seed: 22 }) === sim({ seed: 22, hexes: ['nothing'] });
          wGF.start({ seed: 5 }); out.noHex = wGF.hex(); const k0 = wGF.kick().dist;
          wGF.start({ seed: 5, hexes: ['ashwind'] }); out.wind = wGF.kick().dist - k0;
          wGF.start({ seed: 5, hexes: ['shrink'] }); const G = wGF.G; G.hex.short = 10; G.poss = 1; out.goalThem = wGF.goal(); G.poss = 0; out.goalYou = wGF.goal();
          const g = wGF.simGame({ seed: 8, hexes: ['shrink'] }); out.late = wGF.hex().short;
          // Grave Cold: the same drive, your seven tire 40% faster (theirs as before)
          const tired = h => { wGF.sim({ seed: 31, hexes: h }); const G = wGF.G, on = s => [...new Set(Object.values(G.teams[s].off).concat(Object.values(G.teams[s].def)))]; return [0, 1].map(s => on(s).reduce((a, i) => a + 100 - G.stam[s][i], 0)); };
          out.cold = [tired([]), tired(['chill'])];
          // Fumbles Roll Dark: with fumbles made common, the other side falls on nearly all of yours
          const base = wGF.fumRules.base; wGF.fumRules.base = .25; const lost = h => { let f = 0, l = 0; for (let s = 1; s <= 8; s++) { const r = wGF.simGame({ seed: 100 + s, hexes: h }); for (const b of r.box) if (b.side === 0) { f += b.line.fum || 0; l += b.line.fuml || 0; } } return [f, l]; };
          out.fum = [lost([]), lost(['rolldark'])]; wGF.fumRules.base = base;
          return out; })()""")
        check(hx['same'] and hx['noHex'] is None, 'no hexes (or none the engine knows) and the game is the same game, seed for seed', hx)
        check(hx['wind'] == 6 and hx['goalThem'] == 90 and hx['goalYou'] == 100 and hx['late'] >= 10, 'Ash Wind makes your kicks play longer; The Pit Closes brings their end zone nearer, quarter by quarter', hx)
        c0, c1 = hx['cold']
        check(c0[0] > 0 and 1.05 < c1[0] / c0[0] <= 1.41 and c1[1] == c0[1], 'Grave Cold: your seven tire faster on the same drive (40% more a play; casting costs the same), theirs as before', hx['cold'])
        (f0, l0), (f1, l1) = hx['fum']
        check(f1 > f0 and f1 >= 8 and l1 / f1 >= .85 and l1 / f1 > l0 / max(1, f0), 'Fumbles Roll Dark: you fumble more, and they fall on nearly every one', hx['fum'])

        # ---------- the champion ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.gridiron, ch = DB.chars[C.char], T = wUmbGfTeam(6);
          return { C, greet: ch.greet, play: ch.topics.play.act, map: !!MAPS[C.map] && MAPS[C.map].npcs.some(n => n.id === C.char), team: T.name, qb: T.roster[T.off.QB].n, ult: T.roster[T.off.QB].ult,
            n: T.roster.length, h1: wUmbGfHexes('gridiron', 1), h2: wUmbGfHexes('gridiron', 1), audit: wAudit() }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_bowl' and C['map'] == 'u:g_bowl' and C['region'] == 'ember' and C['engine'] == 'gridiron' and C['piece'] == 'football' and C['hexes'] in (1, 2) and ch['map'],
              'the Cinder Pit\'s champion holds the Ash Ball and stands on the dark ground', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:gridiron' and ch['qb'] == 'Ossian Pyre' and ch['ult'] == 'nadirEclipse' and ch['n'] == 10,
              'he says PLAY and RULES, and fields the Nadir seven and a bench, himself at quarterback with his own ultimate', ch)
        check(ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])

        # PLAY, past the guards and the gate: the card, then kickoff
        await pg.evaluate("""WG.umbral.guards = { 'g_bowl:0': WG.dayAbs, 'g_bowl:1': WG.dayAbs }; WG.umbral.gates = { gridiron: WG.dayAbs };
          window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && t.includes('Hex')) window.__ft.push(t); return ft.apply(this, arguments); };
          window.__g0 = RUN.gold; wRunAct('unadir:gridiron', 'nadir_gridiron')""")
        await pg.wait_for_function("!!document.querySelector('[data-ugf]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbGfHexes('gridiron', W_NADIR.gridiron.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wGF.hexes[h].n)), hx }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'], 'PLAY opens the game card: tier U, the Lich, and the hexes for this try', cd)
        await pg.click('[data-ugf="manage"]')
        await pg.wait_for_function("UI.view === 'gridiron' && wGridLive() && !!WG.gfg.live.snap")
        gm = await pg.evaluate("""(() => { const G = wGF.G, W = WG.gfg.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, hex: wGF.hex(), opp: G.teams[1].name, bag: G.bags[1], log: WLOG.slice(-6).map(l => l[0]).join(' | ') }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadirgf' and gm['skill'] == [1, 3] and gm['opp'] == 'Cinder Pit Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']),
              'kickoff starts the Realm\'s football game at tier U against the Nadir: the Lich coaching, a full bag', gm)
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and 'draws the hexes' in gm['log'], 'the drawn hexes are on the game, and named in the log at kickoff', gm)
        await pg.wait_for_function("window.__ft.some(t => t.includes('Hexes:'))")
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes:')).slice(-1)[0]")
        names = await pg.evaluate("wGF.hex().ids.map(h => wGF.hexes[h].n)")
        check(all(n in ft for n in names), 'the hexes are on the scoreboard', ft)

        # save and leave, then resume: the hexes and the Lich come back with it
        rs = await pg.evaluate("""(() => { wGridLeave(); const out = { left: UI.view, live: wGridLive() }; wResumeGrid(); const G = wGF.G;
          return Object.assign(out, { back: UI.view, skill: G.skill, hex: wGF.hex() && wGF.hex().ids }); })()""")
        check(rs['live'] and rs['left'] != 'gridiron' and rs['back'] == 'gridiron' and rs['skill'] == [1, 3] and rs['hex'] == cd['hx'], 'save and leave keeps the game; resumed, it is still tier U with its hexes', rs)

        # a loss (the clock runs out behind) counts a try, and pays no piece
        await pg.evaluate("const G = wGF.G; G.score = [0, 21]; G.half = 2; G.clock = 0; wGF.speed = 8; WGF.mode = 'watch'; wGF.setMode('watch')")
        await pg.wait_for_function("!wGridLive()", timeout=60000)
        ls = await pg.evaluate("({ tries: WG.umbral.tries.gridiron || 0, pieces: WG.umbral.pieces.slice(), last: WG.gfg.games[0] })")
        check(ls['tries'] == 1 and 'football' not in ls['pieces'] and ls['last']['r'] == 'lose', 'a loss counts a try, and the piece stays with him', ls)
        await pg.evaluate("wLeaveGridiron()")

        # backing away from the card costs nothing, even on a retry
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('gridiron'); const card = !!document.querySelector('[data-ugf]'); const toll = document.getElementById('modalBox').textContent.includes('toll');
          document.getElementById('wUgfNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wGridLive() }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'], 'on a retry the card names the toll, and backing away costs nothing', bk)

        # a win pays the Ash Ball (and its gold); Simulate plays it at once
        await pg.evaluate("RUN.gold = 200; window.__g1 = RUN.gold; wNadirMatch('gridiron')")
        await pg.wait_for_function("!!document.querySelector('[data-ugf]')")
        await pg.click('[data-ugf="play"]')
        await pg.wait_for_function("UI.view === 'gridiron' && wGridLive() && !!WG.gfg.live.snap")
        await pg.evaluate("const G = wGF.G; G.score = [21, 0]; G.half = 2; G.clock = 0; wGF.speed = 8; WGF.mode = 'watch'; wGF.setMode('watch')")
        await pg.wait_for_function("!wGridLive()", timeout=60000)
        wn = await pg.evaluate("({ pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.gridiron, gold: RUN.gold - window.__g1, again: wNadirMatch('gridiron') })")
        check('football' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 - 30 and 'yours' in wn['again'], 'a win pays the Ash Ball and the gold, and he has nothing left to play for', wn)
        await pg.evaluate("wLeaveGridiron(); wDrain()")

        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.gridiron; wDrain(); const n0 = WG.gfg.games.length; const why = wNadirMatch('gridiron');
          document.querySelector('[data-ugf="sim"]').click(); const g = WG.gfg.games[0];
          return { why, played: WG.gfg.games.length - n0, live: wGridLive(), r: g.r, tier: g.tier, settled: g.r === 'win' ? U.pieces.includes('football') : (U.tries.gridiron || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['settled'], 'Simulate plays the champion\'s game at once, and settles it', sm)

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; LAB = true; const n0 = WG.gfg.games.length; const why = wNadirMatch('gridiron'); LAB = false;
          return { why, played: WG.gfg.games.length - n0 }; })()""")
        check(lb['why'] == '' and lb['played'] == 1, 'in LAB mode (the realm bot) PLAY simulates at once', lb)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
