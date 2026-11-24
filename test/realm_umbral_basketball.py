# Realm: basketball in the Umbral (issue #99, phase 4d). Tier U on the court (tier 4: more rating points, the Lich
# coaching, a full bag), the Lich's own calls, basketball's hexes (each does what it says, none changes a game without
# them), and the Black Court's champion end to end: PLAY (past the guards and the gate) opens the card with the hexes,
# the tip starts the Realm's basketball game at tier U with them (named in the log, before the tip and on the
# scoreboard), it saves, survives a reload and resumes, a loss counts a try and a win pays the Black Net; the toll is
# paid at the tip, backing away from the card costs nothing; a finale round goes through the same adapter.
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

# force the game on the court to its end: the fourth quarter's last moment, at this score
END = "const G = wBK.G; G.score = %s; G.q = 4; G.clock = .05; wBK.speed = 8; wBK.pause(false)"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbBkTeam === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""W_NADIR.court.cond = null;   // (the champion's condition is realm_umbral_conds' to check)
          wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const ks = Object.keys(SIG).filter(k => FA_NAMES[k] && wBK.kinds.includes(k) && !W_STARS.some(s => s.kind === k) && !wRoster().some(p => p.kind === k));
          while (wRoster().length < 5 + W_BKG.bench) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) { p.lvl = 6; delete p.bk; wBkOf(p); } WG.court = null; wCourtSync(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_BKG.oppBonus), skill: [1, 2, 3, 4].map(t => wCourtSkill(t)), name: W_BALL_SKILL[wCourtSkill(4)[1]], bag: W_COURT_KIT.opp[4],
          pots: Object.keys(wBK.potions), lich: wBK.lichRules && wBK.lichRules.edge > 0, skills: wBK.skills })""")
        check(tb['bonus'] == {'1': 0, '2': 2, '3': 5, '4': tb['bonus']['4']} and tb['bonus']['4'] > tb['bonus']['3'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich',
              'tier U is a fourth row: more rating points than tier 3, the Lich (skill 3); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(v >= 1 for v in tb['bag'].values()), 'their bench brings a full bag at tier U', tb)
        check(tb['skills'] == ['Squire', 'Knight', 'Archmage'], 'the scrimmage\'s coach picker is as it was (the Lich is the Umbral\'s only)', tb['skills'])

        # ---------- the Lich decides, not just a label ----------
        lc = await pg.evaluate("""(() => { const out = { def: {}, set: {} };
          // on defense, against a coach by hand who ran Isolation all game and has just called Spread: the Archmage plays
          // what beats the habit; the Lich sees the call too, and Switch everything is the one that holds against both
          wBK.start({ seed: 11, skill: [1, 3], powers: false }); wBK.hide(); let G = wBK.G; wBK.setMode('manage');
          G.seen[0] = Array(8).fill('iso'); G.call[0].off = 'spread';
          for (const sk of [2, 3]) { G.skill[1] = sk; const n = {}; for (let i = 0; i < 600; i++) { const c = wBK.cpu.def(1); n[c] = (n[c] || 0) + 1; } out.def[sk] = n; }
          // on offense, against Man, a set just run once: the Archmage runs Pick and roll again; the Lich moves on
          // before the scout catches it, to Isolation (Man's other weakness)
          G.call[0].def = 'man'; G.scout[1] = { last: 'pick', n: 1 };
          for (const sk of [2, 3]) { G.skill[1] = sk; const n = {}; for (let i = 0; i < 600; i++) { const c = wBK.cpu.set(1); n[c] = (n[c] || 0) + 1; } out.set[sk] = n; }
          return out; })()""")
        D2, D3, S2, S3 = lc['def']['2'], lc['def']['3'], lc['set']['2'], lc['set']['3']
        # (Spread's edge against each defense: +1 against Zone and Pack the paint, -1 against Man and the Press)
        sp = lambda n: (n.get('zone', 0) + n.get('pack', 0) - n.get('man', 0) - n.get('press', 0)) / sum(n.values())
        check(sp(D2) > .5 and sp(D3) < sp(D2) - .3 and D3.get('switch', 0) > D2.get('switch', 0),
              'the Lich reads the call on the floor as well as the habit: the Archmage plays into the new set (Zone, Pack the paint), the Lich gives it far less', {'archmage': [D2, sp(D2)], 'lich': [D3, sp(D3)]})
        check(S2.get('pick', 0) > S2.get('iso', 0) and S3.get('iso', 0) > S3.get('pick', 0), 'on offense the Lich changes sets before the scout catches up; the Archmage runs the same pick again', lc['set'])

        # ---------- hexes ----------
        hx = await pg.evaluate("""(() => { const out = {}, J = x => JSON.stringify(x), sim = o => { const g = wBK.simGame(o); return J([g.score, g.box.map(b => b.tot), g.tally]); };
          out.same = sim({ seed: 21, skill: [1, 3], court: true }) === sim({ seed: 21, skill: [1, 3], court: true, hexes: [] }) && sim({ seed: 22 }) === sim({ seed: 22, hexes: ['nothing'] });
          wBK.start({ seed: 5 }); wBK.hide(); out.noHex = wBK.hex();
          // The Crooked Whistle: the same seeds, your five foul half again as often
          const pf = h => { let n = [0, 0]; for (let s = 1; s <= 40; s++) { const g = wBK.simGame({ seed: 200 + s, hexes: h }); n[0] += g.box[0].tot.pf; n[1] += g.box[1].tot.pf; } return n; };
          out.whistle = [pf([]), pf(['whistle'])];
          // The Rim Drifts: with the rim furthest out, your jumper worse by the drift, at the rim a share of that; theirs as it was
          const look = h => { wBK.start({ seed: 6, hexes: h, powers: false }); wBK.hide(); const G = wBK.G; G.secs = wBK.hexRules.drift.period / 4; G.cur = null;
            const P = wBK.play, a = P.pl.findIndex(p => p.side === 0), b = P.pl.findIndex(p => p.side === 1), hx0 = wBK.hoopX(0), hx1 = wBK.hoopX(1);
            P.pl.forEach(p => { p.x = 14; p.y = 7; }); return [wBK.shotP(a, hx0 - wBK.dir(0) * 5, 0).p, wBK.shotP(a, hx0 - wBK.dir(0) * .8, 0).p, wBK.shotP(b, hx1 - wBK.dir(1) * 5, 0).p]; };
          out.drift = [look([]), look(['drift'])];
          // The Shadow Sixth: on your first possession past the middle of a quarter it comes out, once (its effects on the floor)
          wBK.start({ seed: 7, hexes: ['shadow'], powers: false }); wBK.hide(); let G = wBK.G; G.clock = G.qlen * .4; wBK.give(0);
          out.shadow = { con: wBK.fx('con'), shot: wBK.fx('shot'), stl: wBK.fx('stl'), out: wBK.hex().out, n: wBK.hex().shadows }; wBK.give(1); wBK.give(0); out.shadow.again = wBK.hex().shadows;
          out.shadowGame = wBK.simGame({ seed: 8, hexes: ['shadow'] }) && wBK.hex().shadows;
          // Cold Hands: your free throws worse by the hex, theirs as they were
          const fts = h => { wBK.start({ seed: 9, hexes: h, powers: false }); wBK.hide(); const P = wBK.play, a = P.pl.findIndex(p => p.side === 0), b = P.pl.findIndex(p => p.side === 1);
            wBK.freeThrows(0, a, 2); const you = wBK.ftNow(a); wBK.freeThrows(1, b, 2); return [you, wBK.ftNow(b)]; };
          out.cold = [fts([]), fts(['cold'])];
          // named before the tip
          wBK.start({ seed: 10, hexes: ['whistle', 'cold'] }); wBK.hide(); out.msg = wBK.msg;
          const R = wBK.hexRules; out.rules = { drift: R.drift.p, rim: R.drift.rim, cold: R.cold.ft, con: R.shadow.fx.con };
          return out; })()""")
        RU = hx['rules']
        check(hx['same'] and hx['noHex'] is None, 'no hexes (or none the engine knows) and the game is the same game, seed for seed', hx)
        (p0, q0), (p1, q1) = hx['whistle']
        check(p1 / p0 > 1.25 and abs(q1 / q0 - 1) < .2, 'The Crooked Whistle: your five called for half again the fouls, theirs about as before', hx['whistle'])
        (j0, r0, t0), (j1, r1, t1) = hx['drift']
        check(RU['drift'] > 0 and abs((j0 - j1) - RU['drift']) < .005 and abs((r0 - r1) - RU['drift'] * RU['rim']) < .005 and t0 == t1, 'The Rim Drifts: your jumper worse by the drift with the rim furthest out, a layup a share of that, theirs as it was', hx['drift'])
        sh = hx['shadow']
        check(sh['out'] and sh['n'] == 1 and sh['again'] == 1 and abs(sh['con'] - RU['con']) < 1e-9 and RU['con'] > 1 and sh['shot'] < 0 and sh['stl'] > 1 and hx['shadowGame'] >= 4,
              'The Shadow Sixth: out on your first possession past the middle of the quarter, once a quarter (four in a game), with its effects on the floor', hx)
        (y0, o0), (y1, o1) = hx['cold']
        check(RU['cold'] > 0 and abs((y0 - y1) - RU['cold']) < 1e-9 and o0 == o1, 'Cold Hands: your free throws worse by the hex, theirs as they were', hx['cold'])
        check('Hexes: The Crooked Whistle, Cold Hands' in hx['msg'], 'the hexes are named before the tip', hx['msg'])

        # ---------- the champion ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.court, ch = DB.chars[C.char], T = wUmbBkTeam(6), cap = T.roster[T.spot.PG];
          return { C, greet: ch.greet, play: ch.topics.play.act, map: !!MAPS[C.map] && MAPS[C.map].npcs.some(n => n.id === C.char), team: T.name, pg: cap.n, ult: cap.ult,
            n: T.roster.length, h1: wUmbBkHexes('court', 1), h2: wUmbBkHexes('court', 1), audit: wAudit(), gated: wNadirMatch('court') }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_court' and C['map'] == 'u:g_court' and C['region'] == 'plains' and C['engine'] == 'court' and C['piece'] == 'basketball' and C['hexes'] in (1, 2) and ch['map'],
              'the Black Court\'s champion holds the Black Net and stands on the dark ground', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:court' and ch['pg'] == 'Vesper Gloam' and ch['ult'] == 'lightsout' and ch['n'] == 7,
              'she says PLAY and RULES, and fields the Nadir five and a bench, herself at the point with her own ultimate', ch)
        check(ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])
        check('Hand of the Nadir' in ch['gated'], 'before the guards are beaten she will not play', ch['gated'])

        # PLAY, past the guards and the gate: the card, then the tip
        await pg.evaluate("""WG.umbral.guards = { 'g_court:0': WG.dayAbs, 'g_court:1': WG.dayAbs }; WG.umbral.gates = { court: WG.dayAbs };
          window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && t.includes('Hex')) window.__ft.push(t); return ft.apply(this, arguments); };
          window.__g0 = RUN.gold; wRunAct('unadir:court', 'nadir_court')""")
        await pg.wait_for_function("!!document.querySelector('[data-ubk]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbBkHexes('court', W_NADIR.court.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wBK.hexes[h].n)), hx, free: t.includes('first game is free') }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'] and cd['free'], 'PLAY opens the game card: tier U, the Lich, and the hexes for this try; the first game is free', cd)
        await pg.click('[data-ubk="manage"]')
        await pg.wait_for_function("UI.view === 'court' && wCourtLive() && !!WBK && WBK.world")
        gm = await pg.evaluate("""(() => { const G = wBK.G, W = WG.bkg.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, hex: wBK.hex(), opp: G.teams[1].name, bag: G.bags[1], pg: G.teams[1].roster[G.teams[1].spot.PG].ult,
            msg: wBK.msg, log: WLOG.slice(-6).map(l => l[0]).join(' | '), gold: RUN.gold - window.__g0 }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadirbk' and gm['skill'] == [1, 3] and gm['opp'] == 'Black Court Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']) and gm['pg'] == 'lightsout',
              'the tip starts the Realm\'s basketball game at tier U against the Nadir: the Lich coaching, a full bag, the captain with her ultimate', gm)
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and 'draws the hexes' in gm['log'] and gm['gold'] == 0,
              'the drawn hexes are on the game, and named in the log at the tip; the first try costs nothing', gm)
        await pg.wait_for_function("window.__ft.some(t => t.includes('Hexes:'))")
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes:')).slice(-1)[0]")
        names = await pg.evaluate("wBK.hex().ids.map(h => wBK.hexes[h].n)")
        check(all(n in ft for n in names), 'the hexes are on the scoreboard', ft)

        # save and leave at a stoppage, then a reload: the game waits, and resumes still tier U with its hexes
        await pg.evaluate("wBK.speed = 8")
        await pg.wait_for_function("!!WG.bkg.live.snap && ['dead', 'ft', 'break', 'timeout'].includes(wBK.phase) ? (wBK.pause(true), true) : false", timeout=60000)
        await pg.evaluate("wCourtLeaveGame()")
        await pg.wait_for_function("UI.view === 'world'")
        rl = await pg.evaluate("""(() => { const save = JSON.parse(localStorage.getItem(pkey('sd-realm'))), live = save.WG.bkg.live; wStart(save); WBKG.asked = false;
          const asked = wNextPrompt(); return { saved: !!live && live.world.kind === 'unadirbk', hexSaved: !!live.snap.G.hex, asked, card: !!document.getElementById('wBkRes'), name: document.getElementById('modalBox').textContent.includes('Black Court Nadir') }; })()""")
        check(rl['saved'] and rl['hexSaved'] and rl['asked'] and rl['card'] and rl['name'], 'Save and leave keeps the game in the save, hexes and all; after a reload it is offered', rl)
        await pg.click('#wBkRes')
        h = await pg.wait_for_function("UI.view === 'court' && wBK.on ? (wBK.pause(true), { skill: wBK.G.skill, hex: wBK.hex() && wBK.hex().ids, world: WBK.world }) : null")
        rs = await h.json_value()
        check(rs['world'] and rs['skill'] == [1, 3] and rs['hex'] == cd['hx'], 'resumed after the reload it is still tier U, the Lich and its hexes', rs)

        # left again at a stoppage, PLAY picks the game up where it was: no card, no toll
        await pg.evaluate("wBK.speed = 8; wBK.pause(false)")
        await pg.wait_for_function("['dead', 'ft', 'break', 'timeout'].includes(wBK.phase) ? (wBK.pause(true), true) : false", timeout=60000)
        await pg.evaluate("wCourtLeaveGame()")
        await pg.wait_for_function("UI.view === 'world'")
        pr = await pg.evaluate("""(() => { const live = W_UMB4.live.court(), g0 = RUN.gold, why = wNadirMatch('court');
          return { live, why, card: !!document.querySelector('[data-ubk]'), view: UI.view, still: wCourtLive(), gold: RUN.gold - g0 }; })()""")
        check(pr['live'] and pr['why'] == '' and not pr['card'] and pr['view'] == 'court' and pr['still'] and pr['gold'] == 0, 'with a game left half-played, PLAY resumes it (no card, no toll)', pr)
        await pg.wait_for_function("UI.view === 'court' && wBK.on")

        # a loss (the clock runs out behind) counts a try, and pays no piece
        await pg.evaluate(END % '[0, 30]')
        await pg.wait_for_function("!wCourtLive()", timeout=60000)
        ls = await pg.evaluate("({ tries: WG.umbral.tries.court || 0, pieces: WG.umbral.pieces.slice(), last: WG.bkg.games[0] })")
        check(ls['tries'] == 1 and 'basketball' not in ls['pieces'] and ls['last']['r'] == 'lose', 'a loss counts a try, and the Black Net stays with her', ls)
        await pg.evaluate("wLeaveCourt(); wDrain()")

        # backing away from the card costs nothing, even on a retry
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('court'); const card = !!document.querySelector('[data-ubk]'); const toll = document.getElementById('modalBox').textContent.includes('toll');
          document.getElementById('wUbkNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wCourtLive(), paid: (WG.umbral.paid || {}).court || 0 }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'] and bk['paid'] == 0, 'on a retry the card names the toll, and backing away costs nothing', bk)

        # the retry's toll is paid at the tip; a win pays the Black Net (and its gold)
        await pg.evaluate("RUN.gold = 200; window.__g1 = RUN.gold; wNadirMatch('court')")
        await pg.wait_for_function("!!document.querySelector('[data-ubk]')")
        await pg.click('[data-ubk="play"]')
        await pg.wait_for_function("UI.view === 'court' && wCourtLive() && WBK && WBK.world")
        tl = await pg.evaluate("({ gold: RUN.gold - window.__g1, paid: WG.umbral.paid.court, log: WLOG.slice(-4).map(l => l[0]).join(' | ') })")
        check(tl['gold'] == -20 and tl['paid'] == 1 and 'toll' in tl['log'], 'the retry\'s toll is paid at the tip, once', tl)
        await pg.evaluate(END % '[30, 0]')
        await pg.wait_for_function("!wCourtLive()", timeout=60000)
        wn = await pg.evaluate("({ pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.court, gold: RUN.gold - window.__g1, again: wNadirMatch('court') })")
        check('basketball' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 - 20 and 'yours' in wn['again'], 'a win pays the Black Net and the gold, and she has nothing left to play for', wn)
        await pg.evaluate("wLeaveCourt(); wDrain()")

        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.court; wDrain(); const n0 = WG.bkg.games.length; const why = wNadirMatch('court');
          document.querySelector('[data-ubk="sim"]').click(); const g = WG.bkg.games[0], card = !!document.getElementById('wCourtOk'); if (card) document.getElementById('wCourtOk').click();
          return { why, played: WG.bkg.games.length - n0, live: wCourtLive(), r: g.r, tier: g.tier, card, settled: g.r === 'win' ? U.pieces.includes('basketball') : (U.tries.court || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['card'] and sm['settled'], 'Simulate plays the champion\'s game at once, shows the final, and settles it', sm)

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.court; LAB = true; const n0 = WG.bkg.games.length; const why = wNadirMatch('court'); LAB = false;
          return { why, played: WG.bkg.games.length - n0 }; })()""")
        check(lb['why'] == '' and lb['played'] == 1, 'in LAB mode (the realm bot) PLAY simulates at once', lb)

        # a finale round through the same adapter: Nadir Athletic, no toll, no piece; a win takes the round, a loss counts it
        fn = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.tries = { court: 2 }; U.well = {}; U.finaleSports = ['basketball', 'card', 'golf']; U.finale = 0;
          RUN.gold = 200; const g0 = RUN.gold, n0 = WG.bkg.games.length; wRunAct('ufinale'); const card = document.querySelector('[data-ubk]'), t = document.getElementById('modalBox').textContent;
          const words = { seal: t.includes('The Seal'), toll: t.includes('toll'), team: t.includes('Nadir Athletic') }; const hexes = W_NADIR.finale.hexes;
          document.querySelector('[data-ubk="sim"]').click(); const g = WG.bkg.games[0], ok = document.getElementById('wCourtOk'); if (ok) ok.click();
          return { card: !!card, words, hexes, played: WG.bkg.games.length - n0, name: g.name, tier: g.tier, r: g.r, round: U.finale, ftries: U.tries.finale || 0, gold: RUN.gold - g0, pieces: U.pieces.length, live: wCourtLive() }; })()""")
        check(fn['card'] and fn['words']['seal'] and fn['words']['team'] and not fn['words']['toll'] and fn['hexes'] == 2 and fn['played'] == 1 and fn['name'] == 'Nadir Athletic' and fn['tier'] == 4 and not fn['live'],
              'a finale round of basketball goes through the adapter: the card says the Seal, Nadir Athletic, two hexes, no toll', fn)
        check((fn['r'] == 'win' and fn['round'] == 1) or (fn['r'] != 'win' and fn['round'] == 0 and fn['ftries'] == 1) and fn['pieces'] == 9,
              'a finale round settles as the finale\'s: a win takes the round, a loss counts a try; the pieces stay', fn)

        # and as the realm bot drives it: in LAB the real adapter simulates the round at once, and reports it
        fl = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; U.tries.finale = 0; const n0 = WG.bkg.games.length; LAB = true; let why;
          try { why = wUmbFinale(); } finally { LAB = false; } const g = WG.bkg.games[0];
          return { why, played: WG.bkg.games.length - n0, name: g.name, r: g.r, moved: (U.finale || 0) + (U.tries.finale || 0) }; })()""")
        check(fl['why'] == '' and fl['played'] == 1 and fl['name'] == 'Nadir Athletic' and fl['moved'] == 1, 'in LAB a finale round of basketball plays through the real adapter at once and is reported', fl)

        # a Hardcore journey lost in a finale round: the end screen, and no result card over it
        hc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; WG.hardcore = true; const keep = wBK.simGame;
          wBK.simGame = o => { const g = keep(o); g.score = [0, 40]; return g; };
          try { wRunAct('ufinale'); document.querySelector('[data-ubk="sim"]').click(); } finally { wBK.simGame = keep; }
          return { screen: UI.screen, card: !!document.getElementById('wCourtOk') && !document.getElementById('modal').hidden }; })()""")
        check(hc['screen'] == 'end' and not hc['card'], 'a Hardcore journey lost in a finale round ends on the end screen, with no result card over it', hc)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
