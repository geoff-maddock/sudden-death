# Realm: hockey in the Umbral (issue #99, phase 4e). Tier U on the ice (tier 4: more rating points, the Lich coaching,
# a full bag), hockey's hexes (each does what it says, none changes a game without them), and the Dead Pond's champion
# end to end: PLAY opens the card with the hexes, the face-off starts the Realm's hockey game at tier U with them
# (named in the log, over the opening face-off and on the scoreboard, kept in the snapshot), it saves and resumes after
# a reload, a loss counts a try, the toll is paid once at the next face-off (backing away is free), a win pays the Dead
# Puck, and a finale round plays through the same adapter.
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

# end the game on the rink now: their lead (or yours), late in the third, and let it run out
END = """(win) => { const G = wHK.G; G.score = win ? [3, 0] : [0, 3]; G.p = 3; G.clock = .05; wHK.speed = 8; wHK.pause(false); }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbHkTeam === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const ks = Object.keys(SIG).filter(k => FA_NAMES[k] && wHK.kinds.includes(k) && !wRoster().some(p => p.kind === k));
          while (wRoster().length < 8) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) { p.lvl = 6; delete p.hk; wHkOf(p); } WG.rink = null; wSixSync(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_HKG.oppBonus), skill: [1, 2, 3, 4].map(t => wRinkSkill(t)), name: W_BALL_SKILL[wRinkSkill(4)[1]],
          bag: W_RINK_KIT.opp[4], bag3: W_RINK_KIT.opp[3], pots: Object.keys(wHK.potions) })""")
        check(tb['bonus'] == {'1': 0, '2': 2, '3': 5, '4': tb['bonus']['4']} and tb['bonus']['4'] > tb['bonus']['3'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich',
              'tier U is a fourth row: more rating points than tier 3, the Lich (skill 3); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(tb['bag'][k] >= tb['bag3'].get(k, 0) and tb['bag'][k] >= 1 for k in tb['pots']), 'their bench brings a full bag at tier U', tb)

        # ---------- the Lich decides, and plays better ----------
        lc = await pg.evaluate("""(() => { const out = {};
          wHK.start({ seed: 11, skill: [1, 3], mode: 'watch' }); const G = wHK.G; out.skill = G.skill.slice();
          // your side sits in Man without the puck: Cycle and Crash beat it, Point shots lose to it
          G.call[0].def = 'man'; G.call[0].att = 'cycle';
          for (const sk of [2, 3]) { G.skill[1] = sk; const n = {}, d = {}; for (let i = 0; i < 600; i++) { wHK.cpuCall(1); n[G.call[1].att] = (n[G.call[1].att] || 0) + 1; d[G.call[1].def] = (d[G.call[1].def] || 0) + 1; G.scout[1].n = 0; } out[sk] = { att: n, def: d }; }
          out.tired = [wHK.lichRules.tired, wHK.staRules.tired];
          // the same six on both sides, the Lich against the Archmage, each on either side half the time (seeded)
          const T = { name: 'A', short: 'A', color: '#333', light: '#eee', kinds: ['vampire', 'harpy', 'witch', 'werewolf', 'troll', 'wraith', 'elf', 'goblin'] };
          let w = 0, n = 160; for (let i = 0; i < n; i++) { const s = i % 2, sk = [2, 2]; sk[s] = 3; const g = wHK.simGame({ seed: 7000 + i, teams: [T, T], skill: sk, pond: true }); w += g.win === s; }
          out.lichWin = w / n; return out; })()""")
        a2, a3 = lc['2']['att'], lc['3']['att']
        good = lambda a: (a.get('cycle', 0) + a.get('crash', 0)) / 600
        d2, d3 = lc['2']['def'], lc['3']['def']
        check(lc['skill'] == [1, 3] and good(a3) > good(a2) + .03 and a3.get('point', 0) < a2.get('point', 0) and d3.get('collapse', 0) > d2.get('collapse', 0) + 20,
              'the engine takes skill 3, and the Lich answers your call harder than the Archmage: more of what beats your Man and your Cycle, less of what loses to them', lc)
        check(lc['tired'][0] > lc['tired'][1] and lc['lichWin'] > .52, 'the Lich changes lines sooner, and beats the Archmage with the same six', lc)

        # ---------- hexes ----------
        hx = await pg.evaluate("""(() => { const out = {}, J = x => JSON.stringify(x), sim = o => { const g = wHK.simGame(o); delete g.watch; return J(g); };
          out.same = sim({ seed: 21, skill: [1, 3], pond: true }) === sim({ seed: 21, skill: [1, 3], pond: true, hexes: [] }) && sim({ seed: 22 }) === sim({ seed: 22, hexes: ['nothing'] });
          wHK.start({ seed: 5, skill: [1, 3] }); out.noHex = wHK.hex();
          wHK.start({ seed: 5, skill: [1, 3], hexes: ['holes', 'slide'] }); const H = wHK.hex(), R = wHK.rules;
          out.ids = H.ids; out.on = H.on; out.msg = wHK.msg; out.snap = J(wHK.snapshot().G.hex) === J(H);
          out.holes = H.holes.map(h => [wHK.up(0, h.x), h.y]); out.attEnd = R.len - R.blue; out.count = wHK.hexRules.holes.count;
          return out; })()""")
        check(hx['same'] and hx['noHex'] is None, 'no hexes (or none the engine knows) and the game is the same game, seed for seed', hx)
        check(hx['ids'] == ['holes', 'slide'] and hx['on'] == 0 and 'Hexes: The Ice Opens, The Wandering Net' in hx['msg'] and hx['snap'], 'hexes go on the game, against your side, named over the opening face-off, and kept in its snapshot', hx)
        check(len(hx['holes']) == hx['count'] >= 2 and all(u > hx['attEnd'] for u, _ in hx['holes']), 'The Ice Opens: its holes are in the end you attack', hx)

        # the holes swallow a free puck: a whistle, the face-off in your own end
        ho = await pg.evaluate("""(() => { wHK.start({ seed: 6, skill: [1, 3], hexes: ['holes'], powers: false }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const h = wHK.hex().holes[0]; wHK.loose(h.x, h.y, 0, .3); wHK.step(); const out = { ph: wHK.phase, msg: wHK.msg }; n = 0; while (wHK.phase !== 'drop' && n++ < 400) wHK.step();
          out.fo = wHK.up(0, wHK.play.puck.x); out.half = wHK.rules.len / 2; return out; })()""")
        check(ho['ph'] == 'dead' and 'swallows the puck' in ho['msg'] and abs(ho['fo'] - ho['half']) < .01, 'a puck that slides into a hole is gone: a whistle, and the face-off back at centre ice', ho)

        # the net slides away from the puck (yours to shoot at only), the goalie with it, and shots from the wing are worse
        sl = await pg.evaluate("""(() => { const out = {};
          for (const hx of [[], ['slide']]) { wHK.start({ seed: 9, skill: [1, 3], hexes: hx, powers: false }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
            const L = wHK.play, gx = wHK.goalX(0), d = wHK.dir(0), me = L.pl.findIndex(q => q.side === 0 && q.pos === 'LW');
            for (let i = 0; i < 40 && wHK.phase === 'live'; i++) { L.puck.y = -6; wHK.step(); }
            const k = hx.length ? 'slide' : 'none';
            out[k] = { off: [wHK.netOff(0), wHK.netOff(1)], spot: wHK.goalSpot(1, gx - d * 6, -6)[1], odds: wHK.shotOdds(me, 'wrist', gx - d * 7, -5) }; }
          return out; })()""")
        s0, s1 = sl['none'], sl['slide']
        check(s0['off'] == [0, 0] and s1['off'][0] == 0 and s1['off'][1] > .5 and s1['spot'] > s0['spot'] + .5 and s1['odds']['ang'] > s0['odds']['ang'] and s1['odds']['miss'] > s0['odds']['miss'],
              'The Wandering Net: the net you shoot at slides away from the puck (yours stays put), its goalie goes with it, and a shot from the wing comes at a worse angle', sl)

        # Grave Cold: the same seconds of play, your skaters tire 35% faster (theirs as before); The Hollow Whistle: your fouls called twice as often
        cw = await pg.evaluate("""(() => { const drain = hx => { wHK.start({ seed: 3, skill: [1, 1], hexes: hx, powers: false }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); wHK.step(90);
            const S = wHK.sta(), on = wHK.play.pl.filter(q => !q.off && q.pos !== 'G'); return [0, 1].map(s => on.filter(q => q.side === s).reduce((a, q) => a + 1 - S[s][q.ri], 0)); };
          const pens = hx => { let a = 0, b = 0; for (let i = 0; i < 40; i++) { const g = wHK.simGame({ seed: 300 + i, skill: [1, 1], hexes: hx }); a += g.pens.filter(x => x.side === 0).length; b += g.pens.filter(x => x.side === 1).length; } return [a, b]; };
          return { cold: [drain([]), drain(['cold'])], k: wHK.hexRules.cold.k, pens: [pens([]), pens(['whistle'])] }; })()""")
        c0, c1 = cw['cold']
        check(cw['k'] > 1 and c0[0] > 0 and abs(c1[0] / c0[0] - cw['k']) < .03 and abs(c1[1] - c0[1]) < 1e-9, 'Grave Cold: your skaters tire faster over the same play (by its number), theirs as before', cw)
        (p0, q0), (p1, q1) = cw['pens']
        check(p1 > p0 * 1.5 and q1 < q0 * 1.5, 'The Hollow Whistle: your fouls are called far more often, theirs about as before', cw['pens'])

        # ---------- the champion ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.rink, ch = DB.chars[C.char], T = wUmbHkTeam(6), cap = T.roster.findIndex(p => p.n === 'Hollis Grael');
          wHK.start({ seed: 4, teams: [wSixMine(), T], skill: [1, 3] }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); wHK.spiritAdd(1, 100);
          const ult = wHK.ultOptions(1).find(o => o.n === 'Hollis Grael');
          return { C, greet: ch.greet, play: ch.topics.play.act, map: !!MAPS[C.map] && MAPS[C.map].npcs.some(n => n.id === C.char), team: T.name, n: T.roster.length, atC: T.spot.C === cap,
            ult: ult && ult.id, kindUlt: wHK.pows.wraith.ult.id, ids: wHK.powerIds().concat(wHK.ownUlts), h1: wUmbHkHexes('rink', 1), h2: wUmbHkHexes('rink', 1), audit: wAudit() }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_rink' and C['map'] == 'u:g_rink' and C['region'] == 'rime' and C['engine'] == 'rink' and C['piece'] == 'hockey' and C['hexes'] in (1, 2) and C['toll'] > 0 and ch['map'],
              'the Dead Pond\'s champion holds the Dead Puck and stands on the dark ground', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:rink' and ch['team'] == 'Dead Pond Nadir' and ch['n'] == 8 and ch['atC'],
              'he says PLAY and RULES, and fields the Nadir six and a bench, himself at centre', ch)
        check(ch['ult'] == 'longnight' and ch['kindUlt'] != 'longnight' and ch['ids'].count('longnight') == 1 and len(ch['ids']) == len(set(ch['ids'])), 'he brings his own ultimate, The Long Night (an id nothing else uses)', ch)
        check(ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])

        # PLAY, past the guards and the gate: the card, then the face-off
        await pg.evaluate("""WG.umbral.guards = { 'g_rink:0': WG.dayAbs, 'g_rink:1': WG.dayAbs }; WG.umbral.gates = { rink: WG.dayAbs };
          window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && (t.includes('Hex') || t === 'HEXES')) window.__ft.push(t); return ft.apply(this, arguments); };
          window.__g0 = RUN.gold; wRunAct('unadir:rink', 'nadir_rink')""")
        await pg.wait_for_function("!!document.querySelector('[data-uhk]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbHkHexes('rink', W_NADIR.rink.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wHK.hexes[h].n)), toll: t.includes('toll'), hx }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'], 'PLAY opens the game card: tier U, the Lich, and the hexes for this try', cd)
        await pg.click('[data-uhk="manage"]')
        await pg.wait_for_function("UI.view === 'rink' && wRinkLive() && wHK.on")
        await pg.evaluate("wHK.speed = 8")
        gm = await pg.evaluate("""(() => { const G = wHK.G, W = WG.hkg.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, hex: wHK.hex(), opp: G.teams[1].name, bag: G.bags[1], gold: RUN.gold - window.__g0, note: document.getElementById('wRinkNote').textContent, log: WLOG.slice(-6).map(l => l[0]).join(' | ') }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadirhk' and gm['skill'] == [1, 3] and gm['opp'] == 'Dead Pond Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']) and gm['gold'] == 0,
              'the face-off starts the Realm\'s hockey game at tier U against the Nadir: the Lich coaching, a full bag, and no toll on a first try', gm)
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and 'draws the hexes' in gm['log'] and 'Hexes:' in gm['note'], 'the drawn hexes are on the game, named in the log and in the line under the bar', gm)
        await pg.wait_for_function("window.__ft.includes('HEXES') && window.__ft.some(t => t.includes('Hexes:'))", timeout=20000)
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes:')).slice(-1)[0]")
        names = await pg.evaluate("wHK.hex().ids.map(h => wHK.hexes[h].n)")
        check(all(n in ft for n in names), 'the hexes are announced before the face-off and stay on the scoreboard', ft)

        # Save and leave at a whistle, a reload, Resume: still tier U with its hexes; then a loss counts a try
        await pg.wait_for_function("!!WG.hkg.live.snap", timeout=120000)
        await pg.evaluate("wHK.pause(true)")
        rl = await pg.evaluate("""(() => { const sn = WG.hkg.live.snap; wHK.hide(); WHK = null; const save = JSON.parse(JSON.stringify({ WG, RUN })); WHKG.asked = true; wStart(save); showView('world');
          const live = wRinkLive(); RUN.gold = 0; const why = wNadirMatch('rink'), card = !document.getElementById('modal').hidden && !!document.querySelector('[data-uhk]'); RUN.gold = 500; const G = wHK.G;
          return { live, why, card, view: UI.view, skill: G.skill, hex: wHK.hex() && wHK.hex().ids, kind: WG.hkg.live.world.kind, score: G.score, snapScore: sn.G.score }; })()""")
        check(rl['live'] and rl['why'] == '' and not rl['card'] and rl['view'] == 'rink' and rl['skill'] == [1, 3] and rl['hex'] == cd['hx'] and rl['kind'] == 'unadirhk' and rl['score'] == rl['snapScore'],
              'saved and reloaded, PLAY resumes the game where it was (no card, no toll asked), still tier U with its hexes', rl)
        await pg.evaluate("wHK.pause(true)"); await pg.evaluate(f"({END})(false)")
        await pg.wait_for_function("!wRinkLive()", timeout=60000)
        ls = await pg.evaluate("({ tries: WG.umbral.tries.rink || 0, pieces: WG.umbral.pieces.slice(), last: WG.hkg.games[0] })")
        check(ls['tries'] == 1 and 'hockey' not in ls['pieces'] and ls['last']['r'] == 'lose', 'a loss, reported at the end of the resumed game, counts a try, and the piece stays with him', ls)
        await pg.evaluate("wLeaveRink(); wDrain(); for (const b of document.querySelectorAll('#modalBox [data-close], #wRinkOk')) b.click()")

        # backing away from the card costs nothing, even on a retry; the toll is paid once, at the face-off
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('rink'); const card = !!document.querySelector('[data-uhk]'); const toll = document.getElementById('modalBox').textContent.includes('toll, 30 gold');
          document.getElementById('wUhkNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wRinkLive() }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'], 'on a retry the card names the toll, and backing away costs nothing', bk)
        await pg.evaluate("RUN.gold = 200; wNadirMatch('rink')")
        await pg.wait_for_function("!!document.querySelector('[data-uhk]')")
        await pg.click('[data-uhk="play"]')
        await pg.wait_for_function("UI.view === 'rink' && wRinkLive() && wHK.on")
        tl = await pg.evaluate("""(() => { const g1 = RUN.gold; const again = wUmbTollAtKickoff('rink'); return { paid: 200 - g1, again, mode: wHK.mode }; })()""")
        check(tl['paid'] == 30 and tl['again'] == 0 and tl['mode'] == 'play', 'the retry pays its toll once, as the puck drops (Play: you skate it)', tl)

        # a win pays the Dead Puck (and its gold)
        await pg.evaluate("wHK.pause(true)"); await pg.evaluate("window.__g1 = RUN.gold"); await pg.evaluate(f"({END})(true)")
        await pg.wait_for_function("!wRinkLive()", timeout=60000)
        wn = await pg.evaluate("({ pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.rink, gold: RUN.gold - window.__g1, again: wNadirMatch('rink') })")
        check('hockey' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 and 'yours' in wn['again'], 'a win pays the Dead Puck and the gold, and he has nothing left to play for', wn)
        await pg.evaluate("wLeaveRink(); wDrain(); for (const b of document.querySelectorAll('#modalBox [data-close], #wRinkOk')) b.click()")

        # Simulate plays it at once and settles it
        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.rink; wDrain(); const n0 = WG.hkg.games.length; const why = wNadirMatch('rink');
          document.querySelector('[data-uhk="sim"]').click(); const g = WG.hkg.games[0];
          return { why, played: WG.hkg.games.length - n0, live: wRinkLive(), r: g.r, tier: g.tier, settled: g.r === 'win' ? U.pieces.includes('hockey') : (U.tries.rink || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['settled'], 'Simulate plays the champion\'s game at once, and settles it', sm)
        await pg.evaluate("wDrain(); for (const b of document.querySelectorAll('#modalBox [data-close], #wRinkOk')) b.click()")

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.rink; LAB = true; const n0 = WG.hkg.games.length; const why = wNadirMatch('rink'); LAB = false;
          return { why, played: WG.hkg.games.length - n0 }; })()""")
        check(lb['why'] == '' and lb['played'] == 1, 'in LAB mode (the realm bot) PLAY simulates at once', lb)

        # a finale round in hockey, through the same adapter (LAB): no piece, no toll, the round counted
        fn = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.finaleSports = ['hockey', 'card', 'baseball']; U.finale = 0; U.tries = {}; const g0 = RUN.gold;
          LAB = true; const n0 = WG.hkg.games.length; let why; try { why = wUmbFinale(); } finally { LAB = false; }
          const g = WG.hkg.games[0], C = W_NADIR.finale;
          return { why, played: WG.hkg.games.length - n0, engine: C && C.engine, piece: C && C.piece, toll: C && C.toll, r: g && g.r, kind: WG.lastMatch && WG.lastMatch.kind, finale: U.finale || 0, tries: U.tries.finale || 0, pieces: U.pieces.length }; })()""")
        check(fn['why'] == '' and fn['played'] == 1 and fn['engine'] == 'rink' and not fn['piece'] and fn['toll'] == 0 and fn['kind'] == 'unadirhk'
              and ((fn['r'] == 'win' and fn['finale'] == 1) or (fn['r'] == 'lose' and fn['tries'] == 1 and fn['finale'] == 0)) and fn['pieces'] == 9,
              'a finale round in hockey plays through the same adapter: no piece and no toll, and the round is counted', fn)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
