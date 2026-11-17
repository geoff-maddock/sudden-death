"""What a following does in the engines (issue #79, phase 3). Each engine takes opts.fans [a, b]: 1 is a lift to start
(spirit; mana in football), 2 is that and the same again, once, when behind going into the last period. The Realm
sends it for your side at a game away from home: a supporters' club 1, a travelling army 2; none at home, none in LAB
mode unless asked, none for the other side; Simulate gets it."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:600])
    else:
        print('ok', what)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1200, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wFanLift === 'function'"); await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo'); await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the engines ----------
        e = await pg.evaluate("""(() => { const out = {};
          const two = (start, read, late, behind) => { const r = {}; start([0, 0]); r.none = read(); start([1, 0]); r.one = read(); r.lateOne = (behind(), late()); start([2, 0]); r.two = read(); r.level = late(); behind(); r.late = late(); r.after = read(); r.again = late();
            start([2, 0], false); r.off = read(); return r; };
          out.hk = two((f, pw) => wHK.start({ seed: 3, fans: f, powers: pw }), () => wHK.G.spirit.slice(), () => wHK.fansLate(), () => { wHK.G.score = [0, 1]; });
          out.bk = two((f, pw) => wBK.start({ seed: 3, fans: f, powers: pw }), () => wBK.G.spirit.slice(), () => wBK.fansLate(), () => { wBK.G.score = [10, 14]; });
          out.gf = two((f, pw) => wGF.start({ seed: 3, fans: f, powers: pw }), () => (wGF.G.mana || [0, 0]).slice(), () => wGF.fansLate(), () => { wGF.G.score = [0, 7]; });
          const F = [{ n: 'A', kind: 'goblin' }, { n: 'B', kind: 'ogre' }], sp = () => wBX.G.F.map(f => f.spirit);
          const bx = {}; wBX.start({ fighters: F, seed: 3, fans: [0, 0] }); bx.none = sp(); wBX.start({ fighters: F, seed: 3, fans: [1, 0] }); bx.one = sp();
          wBX.start({ fighters: F, seed: 3, fans: [2, 0] }); bx.early = wBX.fansLate(); const G = wBX.G; G.round = G.rounds; G.cards = [[[9, 10], [9, 10], [9, 10]]]; bx.late = wBX.fansLate(); bx.after = sp(); bx.again = wBX.fansLate();
          wBX.start({ fighters: F, seed: 3, fans: [2, 0] }); wBX.G.round = wBX.G.rounds; wBX.G.cards = [[[10, 9], [10, 9], [10, 9]]]; bx.ahead = wBX.fansLate();
          wBX.start({ fighters: F, seed: 3, fans: [2, 0], powers: false }); bx.off = sp();
          out.bx = bx; out.R = [wHK.fansRules, wBK.fansRules, wGF.fansRules, wBX.fansRules]; return out; })()""")
        for k, n in [('hk', 10), ('bk', 10), ('gf', 1)]:
            r = e[k]; base = r['none'][0]
            check(r['none'][0] == r['none'][1] and r['one'] == [base + n, base] and r['two'] == [base + n, base], f'{k}: the lift is a start value for that side only', r)
            check(r['lateOne'] == [] and r['level'] == [] and r['late'] == [0] and r['after'] == [base + 2 * n, base] and r['again'] == [], f'{k}: behind going into the last period, a travelling army lifts again, once', r)
            check(r['off'] == r['none'] or r['off'] == [0, 0], f'{k}: nothing without powers', r)
        b = e['bx']
        check(b['one'] == [b['none'][0] + 10, b['none'][1]] and b['early'] == [] and b['late'] == [0] and b['after'][0] == b['none'][0] + 20 and b['again'] == [] and b['ahead'] == [] and b['off'] == b['none'],
              'bx: the same in the ring, by the cards of the judges going into the last round', b)
        check(e['R'] == [{'spirit': 10}, {'spirit': 10}, {'mana': 1}, {'spirit': 10}], 'each engine has its own number', e['R'])

        # ---------- from the Realm ----------
        w = await pg.evaluate("""(() => { const at = n => { RUN.fans = n; return ['hockey', 'basketball', 'football', 'boxing'].map(wFanLift); };
          WG.ground = null; const steps = [399, 400, 899, 900].map(at);
          WG.ground = { town: 'rimewatch', parts: {} }; const home = at(900); WG.ground = null;
          LAB = true; let lab; try { lab = at(900); } finally { LAB = false; }
          return { steps, home, lab, homeReg: (() => { WG.ground = { town: 'rimewatch', parts: {} }; const r = wHomeRegion(); WG.ground = null; return r; })() }; })()""")
        check(w['steps'] == [[0] * 4, [1] * 4, [1] * 4, [2] * 4] and w['lab'] == [0] * 4, 'a supporters club brings the away end, a travelling army the late lift; not in LAB mode', w)
        check(w['home'][0] == 0 and w['home'][1:] == [2, 2, 2], 'not at a ground in your home region', w)
        s = await pg.evaluate("""(() => { const kinds = ['troll', 'harpy', 'spider', 'lich', 'witch', 'vampire', 'werewolf']; let i = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          RUN.fans = 950; WG.ground = null; const club = Object.values(WG.rivals)[0], n0 = WLOG.length, seen = [];
          const keep = wW99HkSim; const spy = wHK.simGame; wHK.simGame = o => { seen.push((o.fans || []).slice()); return spy(o); };
          let r; try { r = wStartRink({ club, how: 'sim' }); } finally { wHK.simGame = spy; }
          const line = WLOG.slice(n0).map(l => l[0]).find(t => t.includes('away end')) || '';
          // a game between two other clubs gets none
          const other = []; const spy2 = wW99HkSim; wRinkSimClubs(club, Object.values(WG.rivals)[1] || club, 1);
          return { r, seen, line, next: W_FAN_NEXT }; })()""")
        check(s['r'] == '' and s['next'] is None and 'travelling army' in s['line'], 'a simulated world game is played with your fans in the away end, and says so', s)
        fans_in = await pg.evaluate("""(() => { RUN.fans = 950; WG.ground = null; WG.hkg.met = {}; WG.hkg.live = null; const club = Object.values(WG.rivals)[0]; const r = wStartRink({ club, how: 'manage' });
          const f = wHK.G && wHK.G.fans, sp = wHK.G && wHK.G.spirit.slice(); return { r, f, sp, plain: JSON.stringify(wHK.G.fans) }; })()""")
        check(fans_in['r'] == '' and fans_in['f'] == [2, 0] and fans_in['sp'] == [10, 0], 'a world game you manage starts with the lift for your side only', fans_in)
        await pg.evaluate("(() => { try { wLeaveRink && wLeaveRink(); } catch (e) {} })()")
        hp = await pg.evaluate("(() => { showPage('help'); renderHelp(); const h = document.getElementById('wHelpFanLift'); const t = h ? h.textContent : ''; showPage('play'); return t; })()")
        check('10 spirit' in hp and '1 mana in football' in hp and 'sing all game' in hp and 'Simulate' in hp, 'How to play explains the lift in the engines', hp)
        check(await pg.evaluate("W_FOLLOW.live[3]"), 'the third step is marked as in the game')
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
