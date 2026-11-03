# Realm gridiron stances (issue #29): Safe, Balanced or Risky on each side of the ball. Over seeded downs Risky gives more
# sacks, turnovers and big plays than Safe, on offense and on defense; on the short pass (an in and a seam) Safe throws
# the in and Risky often takes the seam, and on the deep pass Safe checks down to the back; a play costs less stamina on Safe and more on
# Risky; fumbles (rare) are lost or kept, run back, and counted in the box, the banner and the log; the stance buttons,
# S, the scoreboard, the log line and the tip box; your stance stays until you change it and is saved with the game;
# the coaches play Risky behind late and Safe ahead late, and on fourth and short a Knight or better weighs the
# fumble (a tired back: punt, or go on Safe on fourth and 1); Play mode takes about half the effect on the throw and the
# carrier; the Gunslinger and Grinder medals; How to play. Asserts; exits nonzero on failure.
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

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

# n seeded downs, every call against every defense, from midfield-ish spots; what came of them, for these stances
DOWNS = """([n, off, def]) => { const o = { n, sack: 0, int: 0, fum: 0, lost: 0, big: 0, gain: 0 }, oc = Object.keys(wGF.plays), dc = Object.keys(wGF.defs);
  for (let i = 0; i < n; i++) {
    const r = wGF.down(oc[i % oc.length], dc[(i / oc.length | 0) % dc.length], { seed: 9000 + i, powers: false, st: { stc: { off, def } } });
    o.sack += r.what === 'sack'; o.int += r.what === 'int'; o.fum += r.what === 'fum'; o.lost += r.what === 'fum' && !!r.lost; o.big += r.gain >= 20; o.gain += r.gain;
  }
  return o; }"""
# n seeded downs of one call against every defense, for each offense stance: the share of throws 15+ air yards out,
# the mean air yards, and the plays of 20 yards or more
AIR = """([n, oc]) => { const out = {}, dc = Object.keys(wGF.defs);
  for (const off of ['safe', 'bal', 'risky']) { const o = { th: 0, a15: 0, air: 0, big: 0 };
    for (let i = 0; i < n; i++) { const r = wGF.down(oc, dc[i % dc.length], { seed: 9000 + i, powers: false, st: { stc: { off, def: 'bal' } } });
      if (r.air != null) { o.th++; o.a15 += r.air >= 15; o.air += r.air; } o.big += r.gain >= 20; }
    out[off] = { th: o.th, a15: o.th ? o.a15 / o.th : 0, air: o.th ? o.air / o.th : null, big: o.big };
  }
  return out; }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1400, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wGF === 'object' && typeof wGridStanceBar === 'function'")
        await pg.evaluate("SET.tips = false")

        # ---------- the effects, over seeded downs ----------
        N = 2400
        ro = await pg.evaluate(DOWNS, [N, 'risky', 'bal']); so = await pg.evaluate(DOWNS, [N, 'safe', 'bal'])
        bo = await pg.evaluate(DOWNS, [N, 'bal', 'bal'])
        print('  offense, risky / balanced / safe:', ro, bo, so)
        check(ro['sack'] > bo['sack'] > so['sack'], 'on offense, Risky is sacked more than Balanced, and Balanced more than Safe', [ro, bo, so])
        check(ro['int'] + ro['fum'] > so['int'] + so['fum'] and ro['fum'] > so['fum'], 'on offense, Risky throws more picks and fumbles more than Safe', [ro, so])
        check(ro['big'] > so['big'], 'on offense, Risky makes more plays of 20 yards or more than Safe', [ro, so])
        rd = await pg.evaluate(DOWNS, [N, 'bal', 'risky']); sd = await pg.evaluate(DOWNS, [N, 'bal', 'safe'])
        print('  defense, risky / safe:', rd, sd)
        check(rd['sack'] > sd['sack'], 'on defense, Risky gets more sacks than Safe', [rd, sd])
        check(rd['int'] + rd['fum'] > sd['int'] + sd['fum'], 'on defense, Risky forces more turnovers than Safe', [rd, sd])
        check(rd['big'] > sd['big'], 'on defense, Risky gives up more plays of 20 yards or more than Safe', [rd, sd])
        check(bo['fum'] < N * .02 and so['fum'] <= bo['fum'], 'fumbles are rare, and rarer on Safe', [bo, so])

        # ---------- the short pass's two depths: the stance picks the man ----------
        sh = await pg.evaluate(AIR, [900, 'short'])
        print('  short pass, safe / balanced / risky:', sh)
        check(all(sh[s]['th'] > 800 for s in sh) and all(sh[s]['air'] is not None for s in sh), 'a thrown ball records its air yards', sh)
        check(sh['safe']['a15'] <= .02 and sh['bal']['a15'] <= .1 and sh['risky']['a15'] >= .3, 'on the short pass, Safe throws the in, and Risky often takes the seam', sh)
        check(sh['risky']['big'] >= 2 * sh['safe']['big'], 'and Risky makes at least twice the plays of 20 yards or more', sh)
        dp = await pg.evaluate(AIR, [900, 'deep'])
        print('  deep pass, safe / balanced / risky:', dp)
        check(dp['bal']['a15'] >= .98 and dp['risky']['a15'] >= .98 and .2 <= 1 - dp['safe']['a15'] <= .6, 'on the deep pass, Safe checks down to the back on some throws, and the others throw long', dp)
        check(dp['risky']['big'] > dp['safe']['big'] * .9 and dp['safe']['air'] < dp['risky']['air'] - 8, 'and Safe throws shorter', dp)

        # ---------- Play mode: about half the effect on the throw and the carrier ----------
        fx = await pg.evaluate("""(() => { const out = {};
          for (const mode of ['watch', 'play']) { wGF.snap('short', 'man', { mode, powers: false, st: { stc: { off: 'risky', def: 'bal' } } }); const F = wGF.play.fx; out[mode] = { errM: F.errM, fum: F.fum, cStr: F.cStr, shed: F.shed, qbT: F.qbT }; }
          return out; })()""")
        R = await pg.evaluate("wGF.stances.risky.off")
        w, h = fx['watch'], fx['play']
        check(abs(w['errM'] - R['errM']) < 1e-9 and abs(w['fum'] - R['fum']) < 1e-9 and abs(w['cStr'] - R['cStr']) < 1e-9, 'run by the coaches, the offense takes Risky in full', fx)
        check(abs(h['errM'] - R['errM'] ** .5) < 1e-9 and abs(h['fum'] - R['fum'] ** .5) < 1e-9 and abs(h['cStr'] - R['cStr'] / 2) < 1e-9, 'played by hand, the throw and the carrier take about half of it', fx)
        check(abs(h['shed'] - R['shed']) < 1e-9, 'and the blocking all of it', fx)

        # ---------- stamina by stance ----------
        st = await pg.evaluate("""(() => { const out = {}; for (const s of ['safe', 'bal', 'risky']) { let sum = 0;
          for (let i = 0; i < 20; i++) { wGF.simGame({ teams: wGridTeams(), skill: [1, 1], seed: 300 + i, stance: [s, 'bal'] }); const G = wGF.G, on = [...new Set(Object.values(G.teams[0].off).concat(Object.values(G.teams[0].def)))];
            sum += on.reduce((a, j) => a + G.stam[0][j], 0) / on.length; }
          out[s] = sum / 20; } return out; })()""")
        check(st['safe'] > st['bal'] > st['risky'], 'a game played Safe leaves the seven fresher than Balanced, and Risky more worn', st)
        check(st['safe'] - st['risky'] >= 15, 'and the difference shows by the end', st)
        sm = await pg.evaluate("wGF.simGame({ teams: wGridTeams(), skill: [1, 1], seed: 5, stance: ['risky', null] }).stance")
        check(sm[0] == 'risky', "a game's summary has the stance each side used most", sm)

        # ---------- fumbles in a game: lost, kept, run back ----------
        fm = await pg.evaluate("""(() => { const R = wGF.fumRules, was = Object.assign({}, R); R.base = 1;
          let out = null;
          try {
            for (let i = 0; i < 12 && !out; i++) {
              wGF.simGame({ teams: wGridTeams(), skill: [1, 1], seed: 700 + i });
              const G = wGF.G, box = wGF.box(), plays = G.drives.flatMap(d => d.plays.map(e => Object.assign({ side: d.side, end: d.end }, e)));
              const td = G.drives.findIndex(d => d.end === 'fumtd');
              if (td < 0 || td + 1 >= G.drives.length) continue;
              const sum = k => box.reduce((a, b) => a + (b.line[k] || 0), 0);
              out = { lost: plays.filter(e => e.what === 'fum' && e.end === 'fum').length, kept: plays.filter(e => e.what === 'fum' && e.end !== 'fum' && e.end !== 'fumtd').length,
                msgs: plays.filter(e => e.what === 'fum').slice(0, 3).map(e => e.msg), tdMsg: G.drives[td].plays.slice(-1)[0].msg,
                tdSide: G.drives[td].side, nextSide: G.drives[td + 1].side, fum: sum('fum'), fuml: sum('fuml'), ff: sum('ff'), fr: sum('fr') };
            }
          } finally { Object.assign(R, was); }
          return out; })()""")
        check(fm is not None, 'with fumbles forced on, a fumble is run back for a touchdown', fm)
        if fm:
            check(fm['lost'] >= 1 and fm['kept'] >= 1, 'a fumble is lost to the defense, or kept by the offense', fm)
            check(all('fumble' in m.lower() for m in fm['msgs']), 'and the result says so', fm['msgs'])
            check('touchdown' in fm['tdMsg'].lower(), 'a fumble run back all the way is a touchdown', fm['tdMsg'])
            check(fm['nextSide'] == fm['tdSide'], 'and the side that fumbled gets the kickoff', fm)
            check(fm['fum'] >= fm['fuml'] > 0 and fm['ff'] == fm['fum'] and fm['fr'] == fm['fuml'], 'the box counts fumbles, fumbles lost, forced and recovered', fm)
        check(await pg.evaluate("wGF.fumRules.base") < .05, 'the fumble rules are put back')
        big = await pg.evaluate("""(() => { const R = wGF.fumRules, was = Object.assign({}, R); R.base = 1; R.def = 1;
          try { for (let i = 0; i < 40; i++) { const s = wGF.sim({ seed: 40 + i, powers: false }); if (s.end === 'fum') return { big: wGF.view().big, why: wGF.why, msg: wGF.msg }; } } finally { Object.assign(R, was); }
          return null; })()""")
        check(big is not None and big['big']['k'] == 'fum' and big['msg'].startswith('Fumble!'), 'a lost fumble puts FUMBLE on the grass', big)

        # ---------- the coaches ----------
        co = await pg.evaluate("""(() => { wGF.game({ seed: 3 }); const G = wGF.G, out = {};
          G.half = 2; G.clock = 60; G.down = 1; G.togo = 10; G.ball = 50;
          G.score = [0, 7]; out.behindOff = wGF.cpu.stance(0, 'off', 1); out.behindDef = wGF.cpu.stance(0, 'def', 2);
          G.score = [7, 0]; out.aheadOff = wGF.cpu.stance(0, 'off', 1); out.aheadDef = wGF.cpu.stance(0, 'def', 2);
          G.half = 1; G.clock = 300; G.score = [0, 0]; G.down = 3; G.togo = 12; out.longThird = wGF.cpu.stance(0, 'off', 1);
          G.down = 1; G.togo = 10; G.ball = 5; out.backedUp = wGF.cpu.stance(0, 'off', 1);
          G.ball = 50; const n = {}; for (let i = 0; i < 400; i++) { const k = wGF.cpu.stance(0, 'off', 0); n[k] = (n[k] || 0) + 1; } out.squire = n;
          return out; })()""")
        check(co['behindOff'] == 'risky' and co['behindDef'] == 'risky', 'the coaches play Risky when behind late', co)
        check(co['aheadOff'] == 'safe' and co['aheadDef'] == 'safe', 'and Safe when ahead late', co)
        check(co['longThird'] == 'risky' and co['backedUp'] == 'safe', 'Risky on third and long, Safe backed up near their own goal', co)
        sq = co['squire']
        check(all(sq.get(k, 0) > 40 for k in ('safe', 'bal', 'risky')) and sq['bal'] > sq['safe'] and sq['bal'] > sq['risky'], 'a Squire picks at random, leaning to Balanced', sq)

        # ---------- fourth and short: the coaches weigh the fumble ----------
        f4 = await pg.evaluate("""(() => { wGF.game({ seed: 3 }); const G = wGF.G, rb = G.teams[0].off.RB, out = {};
          G.poss = 0; G.skill = [1, 1]; G.half = 1; G.clock = 300; G.score = [0, 0]; G.down = 4; G.togo = 2; G.ball = 45;
          G.stam[0][rb] = 100; out.fresh = [wGF.kick().coach, wGF.fumRisk(0).x, wGF.kick().wary];
          G.stam[0][rb] = 30; out.tired = [wGF.kick().coach, wGF.fumRisk(0).x, wGF.kick().wary];
          G.togo = 1; G.ball = 55; out.oneTired = [wGF.kick().coach, wGF.cpu.stance(0, 'off', 1)];
          G.togo = 2; G.ball = 45; G.skill = [0, 1]; out.squire = wGF.kick().coach;
          G.skill = [1, 0]; out.vsSquire = [wGF.kick().coach, wGF.fumRisk(0).x];
          return out; })()""")
        check(f4['fresh'][0] == 'go' and not f4['fresh'][2], 'fourth and 2 past their 40 with a fresh back: the coach goes for it', f4)
        check(f4['tired'][0] == 'punt' and f4['tired'][1] > f4['fresh'][1] and 'tired' in f4['tired'][2], 'with the back tired against a defense that goes for the ball, a Knight punts, and says why', f4)
        check(f4['oneTired'] == ['go', 'safe'], 'on fourth and 1 past midfield the coach still goes, playing Safe', f4)
        check(f4['squire'] == 'go', 'a Squire never weighs it', f4)
        check(f4['vsSquire'][1] < f4['tired'][1], "against a Squire's defense (any stance) the risk counts for less", f4)
        wy = await pg.evaluate("""(() => { wGF.fumRules.wary = 0; const out = [];
          for (let i = 0; i < 40 && !out.length; i++) { wGF.simGame({ teams: wGridTeams(), skill: [1, 1], seed: 40 + i });
            for (const d of wGF.G.drives) for (const e of d.plays) if (e.oc === 'punt' && /rather than risk a fumble/.test(e.why || '')) out.push(e.why); }
          wGF.fumRules.wary = 2.2; return out; })()""")
        check(len(wy) > 0 and wy[0].startswith('The coach punts on fourth and short rather than risk a fumble: '), 'a punt for the fumble says so after the play', wy[:1])

        # ---------- the bar, in a game you call ----------
        await pg.evaluate("wGridironGame({ mode: 'call', seed: 11 })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        bar = await pg.evaluate("""(() => { const S = wGF.stance(), el = document.getElementById('wGridStance');
          return { shown: !el.hidden, label: document.getElementById('wGridStanceL').textContent, role: S.role, on: [...el.querySelectorAll('button.on')].map(b => b.dataset.gstance), note: document.getElementById('wGridNote').textContent }; })()""")
        check(bar['shown'] and bar['on'] == ['bal'], 'in You call, the stance buttons are on the bar, Balanced to start', bar)
        check(bar['label'] == ('Offense:' if bar['role'] == 'off' else 'Defense:'), 'for the side of the ball you are on', bar)
        check('S: your stance' in bar['note'], 'and the note names the key', bar)
        await pg.click('#wGridStance [data-gstance="risky"]')
        r1 = await pg.evaluate("(() => { const S = wGF.stance(); return { mine: S.mine, role: S.role, on: [...document.querySelectorAll('#wGridStance button.on')].map(b => b.dataset.gstance) }; })()")
        check(r1['mine'][r1['role']] == 'risky' and r1['on'] == ['risky'], 'a click sets your stance', r1)
        await pg.hover('#wGridStance [data-gstance="safe"]')
        tip = await pg.evaluate("document.getElementById('wGridTip').hidden ? '' : document.getElementById('wGridTip').textContent")
        check('Safe' in tip and 'stamina' in tip.lower(), 'pointing at a stance shows its pros and cons in the tip box', tip)
        await pg.mouse.move(5, 5)
        await pg.keyboard.press('s')
        r2 = await pg.evaluate("wGF.stance().mine[wGF.stance().role]")
        check(r2 == 'safe', 'S steps the stance (Risky to Safe)', r2)
        await pg.keyboard.press('s'); await pg.keyboard.press('s')
        r3 = await pg.evaluate("wGF.stance().mine[wGF.stance().role]")
        check(r3 == 'risky', 'and on round: Balanced, then Risky', r3)
        # the snap shows both stances, and the log keeps them; the stance stays for the next down
        await pg.evaluate("(() => { const S = wGF.stance(); wGF.setStance('off', 'risky'); wGF.setStance('def', 'risky'); wGF.call(wGF.yourBall ? 'short' : 'man'); })()")
        await pg.wait_for_function("['pre', 'live'].includes(wGF.phase)", timeout=15000)
        play = await pg.evaluate("wGF.stance().play")
        check(play and play[('off' if r1['role'] == 'off' else 'def')] == 'risky', 'at the snap, the play is run in your stance', play)
        await pg.wait_for_function("wGF.G.drive.plays.length + (wGF.G.drives || []).reduce((a, d) => a + d.plays.length, 0) >= 1 && wGF.phase !== 'live' && wGF.phase !== 'pre'", timeout=30000)
        await pg.evaluate("wGridBar()")
        log = await pg.evaluate("document.getElementById('wGridLog').textContent")
        check('(Risky)' in log, 'the play log names the stance', log[:300])
        kept = await pg.evaluate("(() => { const S = wGF.stance(); return S.mine.off === 'risky' && S.mine.def === 'risky'; })()")
        check(kept, 'your stance stays for the next down')
        # saved with the game
        sv = await pg.evaluate("(() => { const sn = wGF.snapshot(); wGF.setStance('off', 'safe'); wGF.resume(sn); return wGF.stance().mine; })()")
        check(sv == {'off': 'risky', 'def': 'risky'}, 'a saved game keeps your stances', sv)
        await pg.evaluate("wGF.setMode('watch'); WGF.mode = 'watch'; wGridBar()")
        check(await pg.evaluate("document.getElementById('wGridStance').hidden"), 'under Coaches the buttons are hidden: the coaches pick')
        await pg.evaluate("WGF = null; wLeaveGridiron()")

        # ---------- medals ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'witch']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("ACH.some(a => a.id === 'w_gsling' && a.stat === 'realmGridRisky') && ACH.some(a => a.id === 'w_ggrind' && a.stat === 'realmGridSafe')"), 'the Gunslinger and Grinder medals are in the record book')
        for stance, stat in (('risky', 'realmGridRisky'), ('safe', 'realmGridSafe')):
            v0 = await pg.evaluate(f"ACHS.stats.{stat} || 0")
            await pg.evaluate("delete wGfg().met.local")
            await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
            await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
            await pg.evaluate(f"(() => {{ const G = wGF.G; G.stUse[0] = {{ {stance}: 40, bal: 3 }}; G.half = 2; G.clock = 1; G.score = [28, 0]; wGF.setMode('watch'); }})()")
            await pg.wait_for_function("wGF.phase === 'over' && !WG.gfg.live", timeout=60000)
            check(await pg.evaluate(f"ACHS.stats.{stat} || 0") == v0 + 1, f'a game won playing mostly {stance} counts for its medal')
            await pg.evaluate("WGF = null; wLeaveGridiron()"); await pg.evaluate(CLOSE_ALL)

        # ---------- How to play ----------
        await pg.evaluate("renderHelp()")
        how = await pg.evaluate("(document.getElementById('wGridHow') || {}).textContent || ''")
        check('Stances.' in how and 'Fumbles' in how and 'Risky' in how and 'Safe' in how, 'How to play: Football: how it works explains stances and fumbles')
        check(await pg.evaluate("!!document.getElementById('wHelpGfStance') && document.getElementById('wHelpGfStance').textContent.includes('Gunslinger')"), 'and How to play has a stances line, with the medals')

        check(not errs, 'no page errors', errs)
        await br.close()
    print('FAILED: ' + ', '.join(FAILS) if FAILS else 'all passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
