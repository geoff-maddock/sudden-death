# Brimstone Diamond source (issue #4, phase 0): src/bd/ builds into the standalone game, which boots and plays a
# 3-inning CPU game to the end; build.sh's `scope` line keeps a scope's names private, checks duplicates inside
# each scope, and refuses nesting; the scoped build of Brimstone Diamond boots, plays the same kind of game
# through its exports, and leaves none of its names on the page. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-diamond-source-*.png.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

def build(manifest):
    r = subprocess.run(['./build.sh', manifest], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

def url(name): return 'file://' + os.path.join(ROOT, 'build', name)

# a CPU against CPU game, 3 innings, simulated to the final out; `api` is where newGame/simToEnd/G live
def play(api):
    return f"""(() => {{
  const A = {api};
  A.newGame({{ mode: 'demo', team: 'ironmaw', opp: 'mirewood', innings: 3, diff: 1 }});
  A.simToEnd(true);
  const t = A.G.teams;
  return {{ phase: A.G.phase, inning: A.G.inning, runs: [t[0].R, t[1].R], hits: [t[0].H, t[1].H], names: t.map(x => x.def.name) }};
}})()"""

async def main():
    code, out = build('src/bd/manifest.txt')
    check(code == 0, 'src/bd/manifest.txt builds the standalone game', out[-400:])
    code, out = build('test/fixtures/scope/ok.txt')
    check(code == 0, 'a scope may reuse a global name', out[-400:])
    r = subprocess.run(['node', '-e', "const fs=require('fs'); eval(fs.readFileSync('build/scope-ok.js','utf8')+"
                        "'; process.stdout.write(JSON.stringify([pick(), sc.pick(), sc.secret, sc.hoisted, typeof secret, typeof hoisted]))')"],
                       cwd=ROOT, capture_output=True, text=True)
    check(r.stdout == json.dumps(['outer', 'inner', 7, 'h', 'undefined', 'undefined'], separators=(',', ':')),
          'the scope returns its exports and keeps its own names private', r.stdout + r.stderr)
    code, out = build('test/fixtures/scope/dup-in-scope.txt')
    check(code != 0 and 'Duplicate names (scope sc): pick' in out, 'a duplicate inside a scope fails the build', out[-300:])
    code, out = build('test/fixtures/scope/dup-global.txt')
    check(code != 0 and 'Duplicate names (global): pick' in out, 'a duplicate global still fails the build', out[-300:])
    code, out = build('test/fixtures/scope/nest.txt')
    check(code != 0 and 'Scopes do not nest' in out, 'a scope inside a scope is refused', out[-300:])
    code, out = build('test/fixtures/bd-scope.txt')
    check(code == 0, 'Brimstone Diamond builds inside a scope', out[-400:])

    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))

        # the standalone game, as the original: its names are page globals
        await pg.goto(url('brimstone-diamond.html')); await pg.evaluate('localStorage.clear()')
        await pg.goto(url('brimstone-diamond.html'))
        await pg.wait_for_function("typeof simToEnd === 'function' && document.getElementById('cv')")
        await pg.screenshot(path='/tmp/realm-diamond-source-standalone.png')
        g = await pg.evaluate(play('{ G, newGame, simToEnd }'))
        check(g['phase'] == 'over' and g['inning'] >= 3 and g['runs'][0] != g['runs'][1],
              'standalone: a 3-inning CPU game plays to a final', g)
        check(await pg.evaluate("(window.__bdErrs || []).length === 0"), 'standalone: no __bdErrs',
              await pg.evaluate("window.__bdErrs"))

        # the scoped game: only wBD on the page
        open(os.path.join(ROOT, 'build', 'blank.html'), 'w').write('<!doctype html><title>blank</title>')
        blank = await br.new_page(); await blank.goto(url('blank.html'))
        base = set(await blank.evaluate("Object.getOwnPropertyNames(window)"))
        pg2 = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs2 = []; pg2.on('pageerror', lambda e: errs2.append(str(e)))
        await pg2.goto(url('bd-scoped.html')); await pg2.evaluate('localStorage.clear()')
        await pg2.goto(url('bd-scoped.html'))
        await pg2.wait_for_function("typeof wBD === 'object' && typeof wBD.simToEnd === 'function'")
        leaked = await pg2.evaluate("""(() => ['G', 'S', 'R', 'W', 'H', 'KIND', 'drawFig', 'newGame', 'simToEnd', 'frame', 'update',
          'MOON', 'LEAGUES', 'GEAR', 'CAREER', 'pick', 'clamp', 'portraitURL', 'saveSettings', 'showPage', 'sfx']
          .filter(n => { try { return eval('typeof ' + n) !== 'undefined'; } catch (e) { return true; } }))()""")
        check(leaked == [], 'scoped: none of its names is visible on the page', leaked)
        own = set(await pg2.evaluate("Object.getOwnPropertyNames(window)"))
        extra = sorted(n for n in own - base if n not in ('__bdErrs',))
        check(extra == [], 'scoped: nothing new on window but __bdErrs', extra)
        g2 = await pg2.evaluate(play('wBD'))
        check(g2['phase'] == 'over' and g2['inning'] >= 3 and g2['runs'][0] != g2['runs'][1],
              'scoped: a 3-inning CPU game plays to a final through wBD', g2)
        await pg2.screenshot(path='/tmp/realm-diamond-source-scoped.png')
        check(await pg2.evaluate("(window.__bdErrs || []).length === 0"), 'scoped: no __bdErrs',
              await pg2.evaluate("window.__bdErrs"))
        check(not errs and not errs2, 'no page errors', errs + errs2)
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm diamond source passed')

asyncio.run(main())
