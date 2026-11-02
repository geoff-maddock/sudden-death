# Realm gridiron: the fixes from the review of phases 5 to 7 (issue #9). Conceding a cup game you lead puts you out;
# a game simulated during yours (the clubs' games at the Ash Bowl, the cup's other games) leaves yours on the field; a
# fixture at the Bowl counts head to head once; a power you pick doesn't outlive a punt; an ultimate is once a game per
# kind, not per player; Save and leave pressed during a play waits for the next call, so the play counts.
# Asserts; exits nonzero on failure.
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
WAIT = "ph => new Promise(r => { const w = () => (Array.isArray(ph) ? ph.includes(wGF.phase) : wGF.phase === ph) ? r() : setTimeout(w, 20); w(); })"
PLAYS = "sn => sn.G.drives.reduce((n, d) => n + d.plays.length, 0) + sn.G.drive.plays.length"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenGcup === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'goblin', 'dwarf']) if (wRoster().length < 6) wRecruit({ kind, lvl: 2 }, 'tavern'); RUN.gold = 500; })()")
        await pg.evaluate(CLOSE_ALL)

        # ---------- concede a cup game you lead: you're out ----------
        await pg.evaluate("wGcupEnter()"); await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wGcupPlay('manage')")
        await pg.wait_for_function("UI.view === 'gridiron' && WG.gfg.live && WG.gfg.live.world.kind === 'gcup' && wGF.phase === 'call'", timeout=30000)
        c = await pg.evaluate("""(() => { const G = wGF.G; G.score = [14, 7]; wGridConcede(); document.getElementById('cfYes').click();
          const D = WG.gcup, g = D.games[0][0]; return { out: D.out, w: g.w, yd: g.yd, h2h: WG.gfg.games[0].r }; })()""")
        check(c['out'] and c['w'] != 'me' and not c['yd'] and c['h2h'] == 'lose', 'concede a cup game you lead 14-7: a loss, and you are out', c)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(async () => { for (let i = 0; i < 20; i++) { if (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox [data-close], #modalBox button'); if (b) b.click(); } else wDrain(); await new Promise(r => setTimeout(r, 50)); } })()")
        b = await pg.evaluate("(() => { wGcupCatchUp(); const D = WG.gcup; return { done: D.done, marks: D.games.flat().filter(g => g.yd).every(g => g.ra === g.rb) }; })()")
        check(b['done'] and b['marks'], 'the bracket plays out, and only tied games are marked as settled on yards', b)
        await pg.evaluate(CLOSE_ALL)

        # ---------- a game simulated during yours leaves yours on the field ----------
        await pg.evaluate("WG.gfg.met = {}; wStartGrid({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call' && !!WG.gfg.live.snap", timeout=30000)
        k = await pg.evaluate("""(() => { const G0 = wGF.G, sc = G0.score.slice(), ph = wGF.phase, t = G0.teams[1].name, cl = wLeagueClubs();
          wSimAt(cl[0], cl[1], 'g_bowl'); wGridSimClubs(cl[1], cl[2], 2);
          return { same: wGF.G === G0, score: JSON.stringify(wGF.G.score) === JSON.stringify(sc), ph: wGF.phase === ph, them: wGF.G.teams[1].name === t }; })()""")
        check(all(k.values()), "simulating the clubs' games at the Bowl during your game leaves your game on the field", k)

        # ---------- a picked power doesn't outlive a punt ----------
        pw = await pg.evaluate(f"""(async () => {{ const wait = {WAIT};
          for (let i = 0; i < 40 && !wGF.yourBall; i++) {{ await wait('call'); if (wGF.yourBall) break; wGF.call('zone'); await wait(['pre', 'kick', 'live', 'post']); }}
          await wait('call'); wGF.setAuto(false); const o = wGF.powers().list.find(x => x.ok); if (!o) return {{ skip: true }};
          wGF.pickPower(o.key); const picked = wGF.powers().pick; wGF.setAuto(true); wGF.pickPower(o.key);
          wGF.call('punt'); await wait(['kick', 'post']); await wait('call');
          return {{ picked, pick: wGF.powers().pick, ball: wGF.yourBall, auto: wGF.powers().auto }}; }})()""")
        check(pw.get('skip') or (pw['picked'] and pw['pick'] is None and not pw['ball']), 'a power picked before a punt is gone at the next call, so Auto powers can cast', pw)

        # ---------- Save and leave during a play: you leave at the next call, and the play counts ----------
        sv = await pg.evaluate(f"""(async () => {{ const wait = {WAIT}, plays = {PLAYS};
          await wait('call'); const n0 = plays(WG.gfg.live.snap);
          wGF.call(wGF.yourBall ? 'run' : 'zone'); await wait(['pre', 'live']);
          document.getElementById('wGridSave').click();
          const mid = {{ view: UI.view, txt: document.getElementById('wGridSave').textContent, off: document.getElementById('wGridSave').disabled }};
          for (let i = 0; i < 400 && UI.view === 'gridiron'; i++) await new Promise(r => setTimeout(r, 25));
          const L = WG.gfg.live; return {{ mid, view: UI.view, saved: !!(L && L.snap), more: L && L.snap ? plays(L.snap) - n0 : 0 }}; }})()""")
        check(sv['mid']['view'] == 'gridiron' and sv['mid']['off'] and 'next call' in sv['mid']['txt'], 'Save and leave during a play waits, and says it will leave at the next call', sv)
        check(sv['view'] == 'world' and sv['saved'] and sv['more'] >= 1, 'then you leave, and the saved game includes that play', sv)
        await pg.evaluate("wResumeGrid()"); await pg.wait_for_function("UI.view === 'gridiron'")
        t = await pg.evaluate("({ txt: document.getElementById('wGridSave').textContent, off: document.getElementById('wGridSave').disabled })")
        check(t['txt'] == 'Save and leave' and not t['off'], 'resumed, the button is Save and leave again', t)
        await pg.evaluate("wGridConcede(); document.getElementById('cfYes').click()"); await pg.evaluate(CLOSE_ALL)

        # ---------- a fixture at the Bowl: head to head counted once ----------
        h = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_bowl'; f.done = 0;
          const club = f.a === 'me' ? f.b : f.a, H = wH2h(), h0 = H[club] ? H[club].w + H[club].l : 0; WG.gfg.met = {};
          wGfixPlay('sim'); const g = WG.gfg.games[0], h1 = H[club] ? H[club].w + H[club].l : 0;
          return { club, inClubs: !!CLUBS[club], r: g.r, more: h1 - h0, sport: H[club] && H[club].last && H[club].last.sport }; })()""")
        check(h['more'] == (0 if h['r'] == 'tie' else 1) and (h['r'] == 'tie' or h['sport'] == 'football'), 'a fixture at the Ash Bowl counts once head to head, with the football score', h)
        await pg.evaluate(CLOSE_ALL)

        # ---------- an ultimate is once a game per kind ----------
        u = await pg.evaluate("""(() => { wGF.simGame({ seed: 41 }); const keys = wGF.G.ultUsed.flatMap(o => Object.keys(o));
          const G = wGF.G, role = wGF.powers().role, k = wGF.kinds.find(x => wGF.powerBook[x].ult.role === role);
          G.teams[0].roster[0].kind = G.teams[0].roster[1].kind = k; G.ultUsed = [{ [k]: true }, {}];
          const ults = wGF.powers().list.filter(o => o.ult && o.kind === k);
          return { keys, kinds: keys.every(x => wGF.kinds.includes(x)), n: ults.length, used: ults.every(o => !o.ok && o.why === 'used this game') }; })()""")
        check(u['kinds'] and u['n'] == 2 and u['used'], 'ultimates are marked by kind: two players of one kind share it', u)

        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
