# Football powers, phase 5 of issue #61: a second offense and defense power for every league kind, the choice on the
# Seven tab, and the situation powers (Goal-line Wall, Two-minute Drill, Fourth-down Gamble). Asserts: the book; a
# player brings the powers picked; each second power's effects reach the play; the situation powers appear only when
# the moment fits, are the team's (no stamina), once a game, and do what they say (the Gamble's effects on the play,
# the Wall's zone at the goal line, the Drill's clock); the coaches use them; and in the Realm: the Seven tab's lists
# (kept, and locked during a game), a club's picks (the same each time), the lineup naming them, and How to play.
# Exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
TEAMS = """const KA = ['kobold', 'minotaur', 'golem', 'ogre', 'dwarf', 'goblin', 'troll'], KB = ['harpy', 'elf', 'golem', 'zombie', 'troll', 'skeleton', 'goblin'];
  const team = (name, ks, pw) => ({ name, short: name, color: '#c00', light: '#fff', roster: ks.map((kind, i) => Object.assign({ n: name + kind, kind, num: i + 1, r: wGF.rate(kind) }, pw ? { pw } : {})) });"""
# your call in a game on the field: wait for it, with the field paused
YOUR_CALL = "wGF.phase === 'call' && (wGF.yourBall ? !!document.querySelector('#wGridCalls button:not([disabled])') : !!document.querySelector('#wGridDefs button:not([disabled])'))"

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1400, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wSevenSetPw === 'function'")
        await pg.evaluate("SET.tips = false")

        # ---- the book ----
        bk = await pg.evaluate("""(() => { const B = wGF.powerBook, K = Object.keys(B).filter(k => !W_STARS.some(s => s.kind === k));
          return { n: K.length, two: K.filter(k => B[k].off2 && B[k].def2 && B[k].off2.desc && B[k].def2.desc && B[k].off2.n !== B[k].off.n && B[k].def2.n !== B[k].def.n).length,
            sits: Object.keys(wGF.situations) }; })()""")
        check(bk['n'] == 18 and bk['two'] == 18, 'every league kind has a second offense and defense power, named and described', bk)
        check(sorted(bk['sits']) == ['gamble', 'goalwall', 'twominute'], 'three situation powers', bk['sits'])

        # ---- the pick, and each second power on the play ----
        pk = await pg.evaluate("""(() => { %s
          wGF.start({ teams: [team('A', KA, { off: 1, def: 0 }), team('B', KB, null)], seed: 3, mode: 'call' }); const G = wGF.G; G.poss = 0;
          const off = wGF.powers().list.filter(o => !o.sit && !o.ult).map(o => [o.kind, o.name]);
          G.poss = 1; const def = wGF.powers().list.filter(o => !o.sit && !o.ult).map(o => [o.kind, o.name]);
          return { off: off.every(([k, n]) => n === wGF.powerBook[k].off2.n), def: def.every(([k, n]) => n === wGF.powerBook[k].def.n), nOff: off.length, nDef: def.length }; })()""" % TEAMS)
        check(pk['off'] and pk['def'] and pk['nOff'] == 7 and pk['nDef'] == 7, 'a player brings the powers picked: the second on offense here, the first on defense', pk)
        fx = await pg.evaluate("""(() => { const B = wGF.powerBook, bad = [];
          for (const k in B) for (const r of ['off2', 'def2']) { const P = B[k][r]; if (!P) continue;
            const L = wGF.snap('run', 'man', { seed: 5, st: { pw: r === 'off2' ? { off: { id: P.id, name: P.n }, def: null } : { off: null, def: { id: P.id, name: P.n } } } }), F = L.fx;
            for (const key in P.fx) { const z = ['oSpd','dSpd','cSpd','rSpd','rushSpd','coverSpd','backSpd','midSpd','deepSpd','shed','int','errM','ballV','qbT','fum'].includes(key) ? 1 : 0;
              if (Math.abs(F[key] - (z ? z * P.fx[key] : P.fx[key])) > 1e-9) bad.push(`${k} ${P.n}: ${key} ${F[key]}`); } }
          return bad; })()""")
        check(not fx, 'each second power\'s effects reach the play', fx)

        # ---- situation powers ----
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'witch', 'vampire']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wGridironGame({ mode: 'call' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        await pg.evaluate("wGF.pause(true); window.__sn = wGF.snapshot()")
        RES = "(() => { wGF.resume(__sn); wGF.pause(true); wGridBar(); })()"
        await pg.evaluate(RES)
        when = await pg.evaluate("""(() => { const G = wGF.G, has = id => wGF.powers().list.some(o => o.key === 'sit:' + id), out = {};
          G.poss = 0; G.down = 1; out.first = has('gamble'); G.down = 4; out.fourth = has('gamble');
          G.poss = 1; G.ball = 50; out.mid = has('goalwall'); G.ball = 92; out.goal = has('goalwall'); out.notOff = has('gamble');
          G.poss = 0; G.down = 1; G.half = 1; G.clock = 300; out.early = has('twominute'); G.half = 2; G.clock = 100; G.score = [0, 7]; out.late = has('twominute'); G.score = [14, 0]; out.ahead = has('twominute');
          G.score = [0, 0]; const o = wGF.powers().list.find(x => x.key === 'sit:twominute'); out.team = o && [o.n, o.ri, o.stamCost];
          return out; })()""")
        check(not when['first'] and when['fourth'], 'the Fourth-down Gamble only on fourth down', when)
        check(not when['mid'] and when['goal'] and not when['notOff'], 'the Goal-line Wall only on defense inside your 10 (and no offense powers on defense)', when)
        check(not when['early'] and when['late'] and not when['ahead'], 'the Two-minute Drill only late in the game, and not when ahead', when)
        check(when['team'] == ['The team', None, 0], 'a situation power is the team\'s: no player, no stamina', when)
        # the Gamble on a play
        await pg.evaluate(RES)
        gm = await pg.evaluate("""(() => { const G = wGF.G; G.poss = 0; G.down = 4; G.togo = 2; G.ball = 50; G.mana[0] = 4; wGridBar();
          const ok = wGF.pickPower('sit:gamble'); const called = wGF.call('run'); return { ok, called, mana: G.mana[0] }; })()""")
        await pg.evaluate("wGF.pause(false)")
        await pg.wait_for_function("wGF.phase === 'live' && !!wGF.play", timeout=20000)
        g2 = await pg.evaluate("({ breakN: wGF.play.fx.breakN, cStr: wGF.play.fx.cStr, mana: wGF.G.mana[0], used: wGF.sitUsed(0) })")
        check(gm['ok'] and gm['called'] and g2['breakN'] >= 1 and g2['cStr'] >= 1.5 and g2['mana'] == 2 and g2['used'].get('gamble'), 'the Gamble, picked on fourth down: 2 mana, and on the play the carrier breaks a tackle and is stronger', [gm, g2])
        await pg.wait_for_function("['post', 'call', 'kick', 'kickoff', 'over', 'half'].includes(wGF.phase)", timeout=20000)
        await pg.evaluate("wGF.pause(true)")
        again = await pg.evaluate("(() => { const G = wGF.G; G.poss = 0; G.down = 4; G.mana[0] = 6; const o = (wGF.powers() || { list: [] }).list.find(x => x.key === 'sit:gamble'); return o ? [o.ok, o.why] : null; })()")
        check(again == [False, 'used this game'], 'once a game', again)
        # the Wall: its zone at the goal line
        await pg.evaluate(RES)
        await pg.evaluate("(() => { const G = wGF.G; G.poss = 1; G.ball = 93; G.down = 1; G.togo = 7; G.mana[0] = 4; wGF.setMode('call'); wGridBar(); wGF.pickPower('sit:goalwall'); wGF.call('man'); wGF.pause(false); })()")
        await pg.wait_for_function("wGF.phase === 'live'", timeout=20000)
        wl = await pg.evaluate("({ zones: wGF.zones().map(z => [z.id, z.left, z.desc]), tkl: wGF.play.fx.tkl, dStr: wGF.play.fx.dStr })")
        await pg.evaluate("wGF.pause(true)")
        check(any(z[0] == 'goalwall' and z[2] for z in wl['zones']) and wl['tkl'] >= .15 and wl['dStr'] >= 1.5, 'the Goal-line Wall leaves its zone at the goal line, and it works on the play', wl)
        await pg.screenshot(path='/tmp/realm-grid-goalwall.png')
        # the Drill: no runoff after its play
        await pg.evaluate(RES)
        await pg.evaluate("(() => { const G = wGF.G; G.poss = 0; G.half = 2; G.clock = 110; G.score = [0, 3]; G.down = 1; G.togo = 10; G.ball = 40; G.mana[0] = 4; wGridBar(); wGF.pickPower('sit:twominute'); wGF.call('run'); window.__c0 = G.clock; wGF.pause(false); })()")
        await pg.wait_for_function("wGF.phase === 'live'", timeout=20000)
        hur = await pg.evaluate("wGF.play.fx.hurry")
        await pg.wait_for_function("wGF.phase !== 'live' && wGF.phase !== 'pre'", timeout=20000)
        dr = await pg.evaluate("({ used: __c0 - wGF.G.clock, t: wGF.play ? wGF.play.t : null })")
        await pg.evaluate("wGF.pause(true)")
        check(hur == 1 and dr['t'] is not None and dr['used'] <= round(dr['t']) + 1, 'the Two-minute Drill: only the play\'s own time comes off the clock, no runoff', [hur, dr])
        # the coaches use them
        cpu = await pg.evaluate("""(() => { %s let n = 0, names = {};
          for (let i = 0; i < 12; i++) { wGF.simGame({ teams: [team('A', KA, null), team('B', KB, null)], seed: 700 + i, skill: [2, 1] });
            for (const d of wGF.G.drives) for (const e of d.plays) for (const p of (e.pw || [])) if (Object.values(wGF.situations).some(s => s.n === p.name)) { n++; names[p.name] = (names[p.name] || 0) + 1; } }
          return { n, names }; })()""" % TEAMS)
        check(cpu['n'] > 0, 'the coaches use the situation powers', cpu)
        await pg.evaluate("wGF.pause(false); WGF = null; wLeaveGridiron()")
        await pg.evaluate(CLOSE_ALL)

        # ---- the Seven tab ----
        await pg.evaluate("wOpenCamp('seven')")
        sv = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody select[data-gpw="off"]'); if (!s) return null; const pid = +s.dataset.gpwid, p = wPlayer(pid);
          s.value = '1'; s.dispatchEvent(new Event('change')); const d = document.querySelector(`#wCampBody select[data-gpw="def"][data-gpwid="${pid}"]`); d.value = '1'; d.dispatchEvent(new Event('change'));
          const after = document.querySelector(`#wCampBody select[data-gpw="off"][data-gpwid="${pid}"]`);
          return { pid, kept: p.gfPw, shown: after && after.value, s: wSevenPlayer(p).pw, lists: document.querySelectorAll('#wCampBody select[data-gpw]').length }; })()""")
        check(sv and sv['kept'] == {'off': 1, 'def': 1} and sv['shown'] == '1' and sv['s'] == {'off': 1, 'def': 1} and sv['lists'] >= 2,
              'the Seven tab sets the powers a player brings each way, and they are kept', sv)
        await pg.evaluate(CLOSE_ALL)
        opp = await pg.evaluate("""(() => { wGfg().opp = {}; const club = Object.keys(CLUBS)[0]; const a = wGridOpp(club, 1), b = wGridOpp(club, 1), key = t => t.roster.map(m => m.n + ':' + JSON.stringify(m.pw || null)).join();
          return { same: key(a) === key(b), all: a.roster.filter(m => wGridHasTwo(m.kind)).every(m => m.pw && [0, 1].includes(m.pw.off) && [0, 1].includes(m.pw.def)) }; })()""")
        check(opp['same'] and opp['all'], 'a club\'s players bring their powers, the same each time', opp)
        await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        await pg.evaluate("wGF.pause(true); wGridBar()")
        lock = await pg.evaluate("(() => wSevenSetPw(%d, 'off', 0))()" % sv['pid'])
        check(lock != '' , 'the powers can\'t change during a game', lock)
        ln = await pg.evaluate("""(() => { const p = wPlayer(%d), B = wGF.powerBook[p.kind]; const tds = [...document.querySelectorAll('#wGridLineup td[title^="Powers"]')].map(td => td.title);
          return { mine: tds.some(t => t.includes(B.off2.n) && t.includes(B.def2.n)), n: tds.length }; })()""" % sv['pid'])
        check(ln['mine'], 'the lineup on the field names the powers each player brings', ln)
        await pg.evaluate("wGridConcede()")
        await pg.wait_for_selector('#modalBox button', timeout=5000)
        await pg.evaluate("document.querySelector('#modalBox .btn, #modalBox button').click()")
        await pg.wait_for_function("!wGridLive()", timeout=10000)
        await pg.evaluate(CLOSE_ALL)

        # ---- How to play ----
        await pg.evaluate("renderHelp()")
        hp = await pg.evaluate("({ text: (document.getElementById('wHelpGfPow2') || {}).textContent || '', rows: document.querySelectorAll('#wHelpGfPow2 tr').length })")
        check(all(w in hp['text'] for w in ['Seven tab', 'Goal-line Wall', 'Two-minute Drill', 'Fourth-down Gamble']) and hp['rows'] == 19, 'How to play explains the second powers and the situation powers', hp['rows'])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print(f'\n{len(FAILS)} failed' if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
