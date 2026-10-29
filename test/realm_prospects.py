# Realm rare eggs, the incubator and prospects (issue #12, phases 3 to 5). A dungeon's rare nest gives its one rare egg
# once the alpha is beaten, then is an ordinary nest; the Road to Nowhere's nest gives the Dusk Egg only after dark,
# and that finishes "The road to nowhere". Pell's incubator takes an egg for 6 of its element's energy and hatches it in
# 3 days into a one-of-a-kind level 1 prospect: a kind from where the egg was found, their own name, a card nobody else
# brings (never in a pool), and double XP until level 10. The audit is clean; How to play explains it.
# Asserts; exits nonzero on failure.
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

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
# the rare nest of a map: [x, y, meta]
RARE = "(id => { const m = MAPS[id]; for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (m.t[y][x] === 'N' && m.meta[k].rare) return [x, y, m.meta[k]]; } return null; })"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_HATCH !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(CLOSE_ALL)

        # ---------- a dungeon's rare nest ----------
        d = await pg.evaluate(f"""(() => {{ const at = ({RARE})('hatchery'); if (!at) return null; const [x, y, mt] = at; WG.map = 'hatchery';
          wUse(x, y); const shut = !wHas('clutchegg');
          WG.flags['alpha_' + mt.alpha] = 1; wUse(x, y); const got = wHas('clutchegg'), flag = wFlag('rare_hatchery');
          const n0 = WG.items.clutchegg; WG.dayAbs += 10; wUse(x, y); const again = WG.items.clutchegg === n0, plain = Object.values(DB.eggs).some(id => wHas(id));
          WG.map = 'world'; return {{ shut, got, flag, again, plain }}; }})()""")
        check(d and d['shut'] and d['got'] and d['flag'], 'a dungeon\'s rare nest gives its rare egg once the alpha is beaten, and sets rare_<map>', d)
        check(d and d['again'] and d['plain'], 'after that it is an ordinary nest: no second rare egg, just its eggs', d)

        # ---------- the Road to Nowhere ----------
        r = await pg.evaluate(f"""(() => {{ const at = ({RARE})('umbralden'); const [x, y] = at; WG.map = 'umbralden';
          WG.min = 12 * 60; wUse(x, y); const day = wHas('duskegg');
          WG.min = 23 * 60; wUse(x, y); const night = wHas('duskegg'), done = wFlag('rare_umbralden'), log = WLOG.map(l => l[0]).join(' | ');
          WG.map = 'world'; WG.min = 9 * 60; return {{ day, night, done, logged: log.includes('Done: The road to nowhere') }}; }})()""")
        check(r == {'day': False, 'night': True, 'done': True, 'logged': True}, 'the Road\'s nest gives the Dusk Egg only after dark, and "The road to nowhere" is done', r)

        # ---------- the incubator ----------
        i = await pg.evaluate("""(() => { const m = MAPS.graftonbury; let at = null;
          for (let y = 0; y < m.h && !at; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === 'E') { at = [x, y]; break; }
          WG.map = 'graftonbury'; const [x, y] = at;
          WG.energy.tide = 2; wUse(x, y); const poor = !WG.incu && wHas('clutchegg');
          WG.energy.tide = 8; wUse(x, y); const inside = WG.incu && WG.incu.egg, tide = WG.energy.tide, gone = !wHas('clutchegg');
          wUse(x, y); const early = !!WG.incu;
          const n0 = wRoster().length; WG.dayAbs = WG.incu.due; wUse(x, y);
          const P = wRoster()[wRoster().length - 1], kinds = DB.regions.tide.kinds;
          return { poor, inside, tide, gone, early, hatched: wRoster().length === n0 + 1 && !WG.incu, p: P && { n: P.n, kind: P.kind, lvl: P.lvl, hatched: P.hatched, from: P.from },
            inRegion: P && kinds.includes(P.kind), card: RUN.deck.some(c => c.id === 'hx_clutch' && c.wp === P.id), at }; })()""")
        check(i['poor'] and i['inside'] == 'hatchery' and i['tide'] == 2 and i['gone'], 'the incubator needs 6 of the egg\'s energy; it takes the egg and the energy', i)
        check(i['early'] and i['hatched'], 'it isn\'t ready early; on the due day it hatches and the prospect joins', i)
        check(i['p'] and i['p']['lvl'] == 1 and i['p']['hatched'] == 'hatchery' and i['p']['from'] == 'hatched' and i['inRegion'] and i['card'],
              'a level 1 prospect of a Brinefen kind, marked as hatched, with their own card', i)
        u = await pg.evaluate("""(() => { const P = wRoster().find(p => p.hatched), names = wRoster().map(p => p.n);
          const pool = ['c', 'u', 'r', 'l'].some(r => cardPool(r).some(c => c.id.startsWith('hx_'))), sigs = Object.values(SIG).some(id => id.startsWith('hx_'));
          return { unique: names.filter(n => n === P.n).length === 1, pool, sigs, team: (W_FROM[P.from] || '') }; })()""")
        check(u['unique'] and not u['pool'] and not u['sigs'] and 'Pell' in u['team'], 'the name is theirs alone, their card is never in a pool, and the Team screen says hatched at Pell\'s', u)
        x = await pg.evaluate("""(() => { const P = wRoster().find(p => p.hatched), V = wRoster().find(p => !p.hatched);
          P.lvl = 3; P.xp = 0; V.lvl = 3; V.xp = 0; wGiveXp(P, 10); wGiveXp(V, 10); const a = [P.xp, V.xp];
          P.lvl = 9; P.xp = 0; wGiveXp(P, 10); return a.concat([P.xp, W_PARTY.maxLvl]); })()""")
        check(x == [20, 10, 20, 10], 'prospects earn double XP until level 10, the top level, so all the way up', x)

        # ---------- Pell, the audit, How to play ----------
        o = await pg.evaluate("""(() => { renderHelp(); const h = document.getElementById('wHelpHatch');
          return { pell: !!DB.chars.pell.topics.incubator && DB.chars.pell.topics.job.t.includes('INCUBATOR'), audit: wAudit().filter(x => /egg|rare_/.test(x)), help: h ? h.textContent : '',
            pay: DB.sideplots.find(s => s.id === 'rare_umbralden').pay }; })()""")
        check(o['pell'] and not o['audit'] and 'Rare eggs' in o['help'] and 'double XP' in o['help'] and 'Dusk Egg' in o['pay'], 'Pell explains the INCUBATOR, the audit is clean, How to play and the quest say what the eggs are', o)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
