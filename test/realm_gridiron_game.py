# Realm gridiron game (issue #9, phase 2): a full game of Cinder Gridiron. Two halves on a game clock, both sides'
# drives, kickoffs after scores and at the half, the extra point, and Sudden Death when it's tied. Headless, 200 seeded
# games end with a sane score, take 6 to 9 minutes to watch (question 1), come out near even between the two
# exhibition clubs, and play the same twice. In the Realm: Clinker Dunn puts on GRIDIRON (their GAME is still the card-game match); in Call the plays you call
# your side's defense when the other side has the ball; the play log keeps every drive under its own heading; and
# switching who calls it doesn't restart the game. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-gridiron-game.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined'"); await pg.evaluate("wGF.speed = 4")  # the field at 4 steps a frame: the same game, sooner

        # ---------- headless games ----------
        g = await pg.evaluate("""(() => { const N = 200, a = { n: N, home: 0, away: 0, tie: 0, ot: 0, otOk: true, pts: 0, lo: 1e9, hi: 0, secs: 0, sLo: 1e9, sHi: 0, drives: 0, halves: true, ends: {} };
          const t0 = performance.now();
          for (let i = 0; i < N; i++) { const s = wGF.simGame({ seed: i + 1 });
            const [h, w] = s.score; if (h > w) a.home++; else if (w > h) a.away++; else a.tie++;
            if (s.half === 3) { a.ot++; }
            if (s.half < 2) a.halves = false;
            a.pts += (h + w) / N; a.lo = Math.min(a.lo, h + w); a.hi = Math.max(a.hi, h + w);
            a.secs += s.secs / N; a.sLo = Math.min(a.sLo, s.secs); a.sHi = Math.max(a.sHi, s.secs); a.drives += s.drives / N;
            for (const k in s.ends) a.ends[k] = (a.ends[k] || 0) + s.ends[k]; }
          a.ms = (performance.now() - t0) / N;
          const x = wGF.simGame({ seed: 77 }), y = wGF.simGame({ seed: 77 }); a.same = JSON.stringify(x) === JSON.stringify(y);
          return a; })()""")
        print('     games:', g)
        check(g['halves'] and set(g['ends']) <= {'td', 'fg', 'miss', 'punt', 'downs', 'int', 'fum', 'fumtd', 'safety', 'clock'} and 4 <= g['drives'] <= 20,
              'every game plays both halves, drive after drive, and each drive ends in a known way', g)
        check(10 <= g['pts'] <= 50 and g['hi'] < 100, 'games score like football: 10 to 50 points between the sides on average', g)
        check(360 <= g['secs'] <= 540, 'a game takes 6 to 9 minutes to watch', g)
        check(.25 <= g['home'] / g['n'] <= .75, 'the two exhibition clubs come out near even under the coaches (each wins 25% to 75%)', g)
        check(g['same'] and g['ms'] < 300, 'a seeded game plays the same twice, and a headless game takes well under 300 ms', g)

        # the flow of one game: drives alternate, a score is followed by a kickoff to the other side, and a drive's half is kept
        f = await pg.evaluate("""(() => { wGF.simGame({ seed: 5 }); const G = wGF.G, D = G.drives; let alt = true, kick = true;
          for (let i = 1; i < D.length; i++) { const p = D[i - 1], d = D[i];
            if (p.half === d.half && d.side === p.side && !['clock'].includes(p.end)) alt = false; }
          return { n: D.length, alt, halves: [...new Set(D.map(d => d.half))], score: G.score,
            pts: D.reduce((s, d) => s, 0) }; })()""")
        check(f['alt'] and 1 in f['halves'] and 2 in f['halves'], 'drives go back and forth, and each knows its half', f)

        # Sudden Death: tied when the clock runs out in the second half, a short extra period starts, and the first score wins it
        o = await pg.evaluate("""(() => { const out = { seen: 0, ok: true }; for (let i = 0; i < 300 && out.seen < 3; i++) { const s = wGF.simGame({ seed: 3000 + i });
            if (s.half !== 3) continue; out.seen++; const G = wGF.G, ot = G.drives.filter(d => d.half === 3), last = ot[ot.length - 1];
            const scored = ot.filter(d => ['td', 'fg', 'safety', 'fumtd'].includes(d.end));
            if (scored.length > 1 || (scored.length === 1 && last !== scored[0]) || (s.score[0] === s.score[1]) !== (scored.length === 0)) out.ok = false; }
          return out; })()""")
        check(o['seen'] >= 1 and o['ok'], 'a tie goes to Sudden Death: the first score wins, and no score is a tie', o)

        # ---------- in the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_bowl, r = wSay('gk_bowl', 'gridiron'), m = wSay('gk_bowl', 'game'); return { job: K.topics.job.t.includes('GRIDIRON'), act: r.act, match: m.act }; })()""")
        check(k == {'job': True, 'act': 'ggame', 'match': 'gmatch'}, 'Clinker Dunn puts on GRIDIRON, and their GAME is still the card-game match', k)
        # (GRIDIRON opens the game card since phase 5; the exhibition is the game on its own)
        await pg.evaluate("wGridironGame()")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.isGame && wGF.phase === 'call'", timeout=30000)
        v = await pg.evaluate("({ title: document.getElementById('wGridTitle').textContent, again: document.getElementById('wGridAgain').textContent, clock: wGF.clock(), mode: document.querySelector('#wGridModes .on').dataset.gmode })")
        check('game' in v['title'] and v['again'] == 'Start over' and v['clock'] and v['clock']['half'] == 1 and v['clock']['text'] == '6:00' and v['mode'] == 'call',
              'a game opens in Call the plays, on the clock: 1st half, 6:00', v)

        # on defense you pick the defense: get the other side the ball (punt it away if it's ours), then call a blitz
        if await pg.evaluate("wGF.yourBall"):
            await pg.click('[data-gkick="punt"]')
            await pg.wait_for_function("wGF.phase === 'call' && !wGF.yourBall", timeout=30000)
        d = await pg.evaluate("""(() => { const b = [...document.querySelectorAll('[data-gdef]')];
          return { defs: !document.getElementById('wGridDefs').hidden, calls: document.getElementById('wGridCalls').hidden, n: b.length, on: b.every(x => !x.disabled), note: document.getElementById('wGridNote').textContent }; })()""")
        check(d['defs'] and d['calls'] and d['n'] == 3 and d['on'] and 'defense' in d['note'], 'when they have the ball, the bar has the three defenses, open for your call', d)
        await pg.click('[data-gdef="blitz"]')
        await pg.wait_for_function("wGF.phase === 'live'", timeout=8000)
        check(await pg.evaluate("wGF.play.dc") == 'blitz', 'the defense you call is the one on the field')
        await pg.wait_for_function("wGF.phase === 'call' || wGF.phase === 'kickoff' || wGF.phase === 'over'", timeout=20000)
        lg = await pg.evaluate("({ heads: document.querySelectorAll('#wGridLog .wghead').length, plays: document.querySelectorAll('#wGridLog li:not(.wghead)').length, drives: wGF.G.drives.length })")
        check(lg['heads'] >= 1 and lg['plays'] >= 1, 'the log keeps every drive under its own heading', lg)
        # switching who calls it goes on with the same game
        before = await pg.evaluate("({ drives: wGF.G.drives.length, clock: wGF.G.clock, plays: wGF.G.plays })")
        await pg.click('[data-gmode="watch"]')
        after = await pg.evaluate("({ drives: wGF.G.drives.length, clock: wGF.G.clock, plays: wGF.G.plays, game: wGF.isGame })")
        check(after['game'] and after['drives'] == before['drives'] and after['plays'] == before['plays'], 'switching to the Coaches goes on with the same game', [before, after])
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/realm-gridiron-game.png')
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpGridiron'); return e ? e.textContent : ''; })()")
        check('GRIDIRON' in h and 'Sudden Death' in h, 'How to play says how a game goes', h)
        # leaving mid-game asks first: Cancel goes on with the game (paused while asked), Forfeit leaves
        await pg.click('#wGridBack')
        q = await pg.evaluate("({ title: (document.querySelector('#modal h3') || {}).textContent, view: UI.view, paused: wGF.on })")
        await pg.click('#cfNo')
        q['after'] = await pg.evaluate("({ view: UI.view, game: wGF.isGame && wGF.live })")
        check(q['title'] == 'Forfeit the game?' and q['after'] == {'view': 'gridiron', 'game': True}, 'Back to the world mid-game asks to forfeit; Cancel goes on with the game', q)
        await pg.click('#wGridBack'); await pg.click('#cfYes')
        check(await pg.evaluate("UI.view === 'world' && !wGF.on"), 'Forfeit and leave parks the game')

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
