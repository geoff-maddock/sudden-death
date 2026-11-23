# Realm: baseball in the Umbral (issue #99, phase 4a). Tier U is tier 4 in the ball game's tables (the Lich, CPU skill
# 3, and a rating bonus) with tiers 1 to 3 as they were. Brimstone Diamond's hexes: a game without them plays exactly as
# before (the same seed gives the same game), and a game with them carries them in its rules, its snapshot and its
# line score. The Bone Diamond's champion: PLAY (guards beaten, gate paid) shows a game card that names tier U and the
# hexes; backing out costs nothing; Play puts the game on the diamond at tier U, the Lich on their side only, the
# champion on the mound with her Dead Ball, the hexes on the bar; Save and leave and Resume keep it all; a loss counts
# a try, and a win pays the piece. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-umbral-ball-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

SR = "document.getElementById('v-diamond').shadowRoot"
# a seeded Math.random from the first line of the page, so a seed replays a game exactly (the engine's R is Math.random;
# the league line is left out: the founding clubs' league ratings move after every game)
SEED = """window.__rs = 1; Math.random = function () { let t = (window.__rs = (window.__rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };"""
CLEAR = "while (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox [data-close], #modalBox .btn'); if (!b) break; b.click(); }"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        await pg.add_init_script(SEED)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmb4aGo === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---------- the tables ----------
        tb = await pg.evaluate("({ diff: W_BALL.diff, bonus: W_BALL.oppBonus, skill: W_BALL_SKILL.slice(), eng: wBD.skills })")
        check(tb['diff'] == {'1': 0, '2': 1, '3': 2, '4': 3} and tb['skill'][3] == 'Lich' and tb['eng'][3] == 'Lich', 'tier U is tier 4: the Lich, CPU skill 3; tiers 1 to 3 keep their skills', tb)
        check(tb['bonus']['1'] == 0 and tb['bonus']['2'] == 0 and tb['bonus']['3'] == 1 and tb['bonus']['4'] >= 1, 'and a rating bonus at tier U, tiers 1 to 3 as they were', tb)

        # ---------- no hexes: the same game as before ----------
        same = await pg.evaluate("""(() => {
          const A = JSON.stringify(wBD.club('ironmaw')), H = JSON.stringify(wBD.club('mirewood'));
          const play = (seed, extra, opts) => { window.__rs = seed; wBD.sim(Object.assign({ defs: [JSON.parse(A), JSON.parse(H)], innings: 3, diff: 1, rules: Object.assign({}, W_BALL.rules, extra) }, opts || {}));
            const G = wBD.G; return JSON.stringify({ r: G.teams.map(t => [t.R, t.H, t.line]), log: (G.full || []).map(l => l.text).filter(t => !/ League \\(/.test(t)), hx: G.hx }); };
          const out = { det: [], empty: [], junk: [], opt: [], diff: 0, hx: null };
          for (const s of [11, 22, 33]) { const base = play(s, {}); out.det.push(base === play(s, {})); out.empty.push(base === play(s, { hexes: [] })); out.junk.push(base === play(s, { hexes: ['nope'] })); out.opt.push(base === play(s, {}, { hexes: undefined }));
            if (base !== play(s, { hexes: ['phase', 'drift'], hexBy: 1 })) out.diff++; }
          play(5, { hexes: ['phase', 'font'], hexBy: 1 }); out.hx = { rules: wBD.G.rules.hexes, by: wBD.G.rules.hexBy, on: !!wBD.G.hx };
          return out; })()""")
        check(all(same['det']), 'a seeded game replays exactly', same)
        check(all(same['empty']) and all(same['junk']) and all(same['opt']), 'no hexes (none passed, an empty list, or names the engine does not know) plays the very same game', same)
        check(same['diff'] >= 2 and same['hx'] == {'rules': ['phase', 'font'], 'by': 1, 'on': True}, 'with hexes the game changes, and carries them in its rules', same)
        hx = await pg.evaluate("""(() => { const A = JSON.stringify(wBD.club('ironmaw')), H = JSON.stringify(wBD.club('mirewood')), out = { phase: [], drift: 0, none: 0, font: null };
          const run = (seed, hexes) => { window.__rs = seed; wBD.sim({ defs: [JSON.parse(A), JSON.parse(H)], innings: 3, diff: 1, rules: Object.assign({}, W_BALL.rules, hexes ? { hexes, hexBy: 1 } : {}) }); return wBD.G.full || []; };
          for (let s = 1; s <= 12; s++) {
            out.phase.push([run(s, ['phase']).filter(l => (l.tags || []).some(t => t.k === 'hex')).length, wBD.G.inning]);
            out.drift += run(s, ['drift']).filter(l => /bases shift/.test(l.text)).length;
            out.none += run(s, null).filter(l => /bases shift/.test(l.text) || (l.tags || []).some(t => t.k === 'hex')).length;
          }
          wBD.start({ defs: [JSON.parse(A), JSON.parse(H)], mode: 'demo', innings: 3, diff: 1, rules: Object.assign({}, W_BALL.rules, { hexes: ['font'], hexBy: 1 }) });
          out.font = wBD.G.teams.map(t => t.mana); wBD.simToEnd(true); wBD.hide(); return out; })()""")
        check(sum(n for n, i in hx['phase']) > 0 and all(n <= i for n, i in hx['phase']) and hx['drift'] > 0 and hx['none'] == 0, 'the Phantom Pitch passes through the bat at most once an inning; Restless Bases shifts the runners; neither without its hex', hx)
        check(hx['font'] == [3, 6], 'the Black Font fills the casting side\'s mana at the start', hx)

        # ---------- a journey that won the Crown, with five players ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("W_NADIR.diamond.cond = null; wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; wRecruit({ kind: 'troll', lvl: 2 }, 'tavern'); wRecruit({ kind: 'harpy', lvl: 2 }, 'tavern'); wDrain(); WG.cardOffer = null; " + CLEAR)
        await pg.evaluate(CLEAR)
        ch = await pg.evaluate("""(() => { const C = W_NADIR.diamond, D = DB.chars[C.char], m = MAPS[C.map];
          return { C: { ground: C.ground, map: C.map, region: C.region, engine: C.engine, piece: C.piece, hexes: C.hexes, toll: C.toll, gold: C.gold }, greet: D.greet, act: D.topics.play.act,
            placed: !!m.npcs.find(n => n.id === C.char), h1: wUmb4aHexes('diamond', 2), h2: wUmb4aHexes('diamond', 2), table: W_UMB4A.hexes, known: Object.keys(wBD.hexes()), audit: wAudit(), probs: wBallProblems() }; })()""")
        check(ch['C'] == {'ground': 'g_ballpark', 'map': 'u:g_ballpark', 'region': 'plains', 'engine': 'diamond', 'piece': 'baseball', 'hexes': 2, 'toll': 30, 'gold': 100} and ch['placed'], 'the champion waits at the Bone Diamond for the Iron Stitch', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['act'] == 'unadir:diamond', 'she names PLAY and RULES, and PLAY asks for the game', ch)
        check(ch['h1'] == ch['h2'] and len(set(ch['h1'])) == 2 and all(h in ch['table'] and h in ch['known'] for h in ch['h1']), 'her hexes come from baseball\'s own table, two, the same for the try', ch)
        check(ch['audit'] == [] and ch['probs'] == [], 'the audit is clean, and the nine can play', ch)

        # ---------- PLAY: the card ----------
        await pg.evaluate("WG.umbral.guards = { 'g_ballpark:0': 1, 'g_ballpark:1': 1 }; WG.umbral.gates = { diamond: 1 }; RUN.gold = 500; wSave()")
        g0 = await pg.evaluate("RUN.gold")
        r = await pg.evaluate("wNadirMatch('diamond')")
        await pg.wait_for_selector('#wUmbHexes')
        card = await pg.evaluate("(() => { const n = wBD.hexes(); return { text: document.getElementById('modalBox').textContent, names: wUmb4aHexes('diamond', 2).map(h => n[h].n) }; })()")
        check(r == '' and 'tier U' in card['text'] and 'Lich' in card['text'] and all(n in card['text'] for n in card['names']) and 'Dead Ball' in card['text'], 'PLAY shows the game card: tier U, the Lich, her pitch and the hexes, before the first pitch', card)
        await pg.screenshot(path='/tmp/realm-umbral-ball-card.png')
        await pg.click('#modalBox [data-close]'); await pg.wait_for_function("document.getElementById('modal').hidden")
        check(await pg.evaluate("!WG.ball || !WG.ball.live") and await pg.evaluate("RUN.gold") == g0 and await pg.evaluate("WG.umbral.tries.diamond || 0") == 0, 'backing out of the card starts nothing and costs nothing')

        # ---------- Play ----------
        await pg.evaluate("wNadirMatch('diamond')"); await pg.wait_for_selector('#wUmbHexes')
        await pg.click('#modalBox [data-uhow="play"]')
        await pg.wait_for_function("UI.view === 'diamond' && WG.ball.live && wBD.G.phase === 'plate'", timeout=15000)
        live = await pg.evaluate("""(() => { const G = wBD.G, W = WG.ball.live.world, star = G.teams[1].def.roster.find(p => p.pos === 'P');
          return { diff: G.diff, d0: G.teams[0].def.diff, d1: G.teams[1].def.diff, ctl: G.teams.map(t => t.ctl), tier: W.tier, kind: W.kind, hexes: G.rules.hexes, by: G.rules.hexBy, hx: !!G.hx,
            want: wUmb4aHexes('diamond', 2), names: W.ref.hexes.map(h => wBD.hexes()[h].n), note: document.getElementById('wDiamondNote').textContent, title: document.getElementById('wDiamondTitle').textContent,
            ls: (""" + SR + """.querySelector('#lineScore caption') || {}).textContent || '', star: { n: star.n, pitches: star.pitches },
            lvl: G.teams[1].def.roster.map(p => p.lvl), mine: wNineTier() }; })()""")
        check(live['diff'] == 3 and live['d1'] == 3 and live['d0'] == 2 and live['ctl'] == ['p1', 'cpu'] and live['tier'] == 4 and live['kind'] == 'unadir_ball', 'Play: on the diamond at tier U, the Lich on their side (your side\'s own skill is an Archmage\'s)', live)
        check(live['hexes'] == live['want'] and live['by'] == 1 and live['hx'], 'the hexes drawn for this try are on the game', live)
        check(all(n in live['note'] for n in live['names']) and 'Lich' in live['note'] and all(n in live['ls'] for n in live['names']), 'and on the bar and the scoreboard', live)
        check(live['star']['n'] == 'Vesper Quill' and 'deadball' in live['star']['pitches'] and all(l == live['mine'] for l in live['lvl']), 'the champion pitches, with her Dead Ball; her nine are at your level', live)
        await pg.screenshot(path='/tmp/realm-umbral-ball-play.png')
        await pg.wait_for_function("!!WG.ball.live.snap", timeout=15000)
        await pg.click('#wBallSave'); await pg.wait_for_function("UI.view === 'world'")
        kept = await pg.evaluate("(() => { const s = JSON.parse(localStorage.getItem(wSaveKey())).WG.ball.live; return { hexes: s.snap.rules.hexes, by: s.snap.rules.hexBy, d1: s.snap.defs[1].diff, d0: s.snap.defs[0].diff, kind: s.world.kind }; })()")
        check(kept['hexes'] == live['want'] and kept['by'] == 1 and kept['d1'] == 3 and kept['d0'] == 2 and kept['kind'] == 'unadir_ball', 'Save and leave keeps the hexes and the skills in the save', kept)
        await pg.evaluate(CLEAR)
        await pg.evaluate("wResumeBall()"); await pg.wait_for_function("UI.view === 'diamond' && wBD.live", timeout=15000)
        back = await pg.evaluate("({ hexes: wBD.G.rules.hexes, hx: !!wBD.G.hx, diff: wBD.G.diff, d1: wBD.G.teams[1].def.diff, note: document.getElementById('wDiamondNote').textContent })")
        check(back['hexes'] == live['want'] and back['hx'] and back['diff'] == 3 and back['d1'] == 3 and all(n in back['note'] for n in live['names']), 'Resume: the same game, hexes and all', back)

        # ---------- a loss counts a try ----------
        await pg.click('#wBallGive'); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("UI.view === 'world' && !WG.ball.live")
        lost = await pg.evaluate("({ tries: WG.umbral.tries.diamond || 0, pieces: WG.umbral.pieces.slice(), gold: RUN.gold })")
        check(lost['tries'] == 1 and 'baseball' not in lost['pieces'] and lost['gold'] == g0, 'a loss counts a try (and the first game was free)', lost)
        await pg.evaluate(CLEAR)

        # ---------- the next try: the toll, then a win pays the piece ----------
        if await pg.evaluate("typeof wUmbTollAtKickoff === 'function'"):
            g1 = await pg.evaluate("RUN.gold")
            await pg.evaluate("wNadirMatch('diamond')"); await pg.wait_for_selector('#wUmbHexes')
            await pg.click('#modalBox [data-close]'); await pg.wait_for_function("document.getElementById('modal').hidden")
            check(await pg.evaluate("RUN.gold") == g1, 'backing out of a retry\'s card costs no toll either')
        # (their nine weakened for the check, so Simulate wins)
        await pg.evaluate("window.__k = wUmb4aNine; wUmb4aNine = (t, id) => { const d = window.__k(t, id); for (const p of d.roster.concat(d.pen)) for (const s of wBD.stats) p[s] = 1; return d; }")
        res = None
        for i in range(4):
            g1 = await pg.evaluate("RUN.gold")
            await pg.evaluate("wNadirMatch('diamond')"); await pg.wait_for_selector('#wUmbHexes')
            await pg.click('#modalBox [data-uhow="sim"]')
            await pg.wait_for_selector('#wBallOk', timeout=15000)
            res = await pg.evaluate("({ gold: RUN.gold, tries: WG.umbral.tries.diamond || 0, pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.diamond, last: WG.ball.games[0], live: !!WG.ball.live })")
            res['paid'] = g1 - res['gold']
            await pg.click('#wBallOk'); await pg.evaluate(CLEAR)
            if res['last']['r'] == 'win': break
        expect = 30 - 100 - await pg.evaluate("W_BALL.gold * 4")
        check(res['last']['r'] == 'win' and res['pieces'] == ['baseball'] and res['beaten'] and not res['live'], 'a win pays the piece', res)
        check(res['paid'] == expect, 'the try cost the toll, and the win paid the champion\'s gold and the ball game\'s', {'res': res, 'expect': expect})
        done = await pg.evaluate("wNadirMatch('diamond')")
        check('yours' in done, 'and she has nothing left to play for', done)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
