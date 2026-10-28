# Realm eggs (issue #12, phases 1 and 2): nests hold their region's eggs. Taking them fills the bag, costs a little
# time, and empties the nest for W_EGG.days (the empty look shows); an alpha's nest stays shut until the alpha is
# beaten. Each region's egg cooks into a strong dish; nobody sells egg dishes; the Grand Tour (one egg of each) is
# taught by Old Wenna and is the strongest dish, and eating it rests the team's legs. How to play explains it.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_EGG !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(CLOSE_ALL)

        # ---------- the eggs ----------
        e = await pg.evaluate("(() => ({ eggs: Object.keys(DB.eggs).sort(), items: Object.values(DB.eggs).every(id => DB.items[id] && DB.items[id].name.endsWith('Egg')) }))()")
        check(e['eggs'] == ['aether', 'bloom', 'ember', 'rime', 'tide'] and e['items'], 'five eggs, one for each region', e)

        # ---------- a world nest ----------
        n = await pg.evaluate("""(() => { const m = MAPS.world; let at = null;
          for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (m.t[y][x] === 'N' && !m.meta[k].alpha) { at = [x, y, m.meta[k].elem]; break; } }
          if (!at) return null; const [x, y, el] = at;
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (DB.tiles[m.t[y + dy][x + dx]].walk) { wEnterMap('world', x + dx, y + dy); break; }
          wDrain(); const id = DB.eggs[el], n0 = WG.items[id] || 0, t0 = WG.dayAbs * 1440 + WG.min;
          wUse(x, y); const n1 = WG.items[id] || 0, t1 = WG.dayAbs * 1440 + WG.min;
          wUse(x, y); const n2 = WG.items[id] || 0, log = WLOG.slice(-1)[0][0];
          WG.dayAbs += W_EGG.days; wUse(x, y); const n3 = WG.items[id] || 0;
          return { id, got: n1 - n0, mins: t1 - t0, again: n2 - n1, empty: log === DB.tiles.N.look0, later: n3 - n2 }; })()""")
        check(n and 1 <= n['got'] <= 2 and n['mins'] == 20, 'a full nest gives 1 or 2 of its region\'s eggs, for 20 minutes', n)
        check(n and n['again'] == 0 and n['empty'], 'then it is empty, and says so', n)
        check(n and 1 <= n['later'] <= 2, f'it fills again after {4} days', n)

        # ---------- an alpha's nest ----------
        a = await pg.evaluate("""(() => { const m = MAPS.genevault; let at = null;
          for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (m.t[y][x] === 'N' && m.meta[k].alpha) { at = [x, y, m.meta[k].alpha]; break; } }
          if (!at) return null; const [x, y, al] = at; WG.map = 'genevault'; const before = JSON.stringify(WG.items);
          wUse(x, y); const shut = WLOG.slice(-1)[0][0], same = JSON.stringify(WG.items) === before;
          WG.flags['alpha_' + al] = 1; wUse(x, y); const after = WG.items.meadowegg || 0; WG.map = 'world';
          return { shut, same, after }; })()""")
        check(a and 'alpha' in a['shut'] and a['same'] and a['after'] >= 1, 'an alpha\'s nest stays shut until its alpha is beaten, then gives eggs', a)

        # ---------- cooking ----------
        c = await pg.evaluate("""(() => { const R = ['souffle', 'custard', 'bake', 'devilled', 'flip'];
          const known = R.every(id => wRecipeKnown(id)), uses = R.map(id => Object.keys(DB.recipes[id].needs).find(k => Object.values(DB.eggs).includes(k)));
          const sold = Object.values(DB.innMenu).some(menu => Object.keys(menu).some(id => R.concat('grandtour').includes(id)));
          WG.items.cinderegg = 2; WG.items.emberpepper = 1; const r = wCook('devilled'), pantry = WG.pantry.devilled || 0;
          return { known, eggs: new Set(uses).size, sold, r, pantry, gt: wRecipeKnown('grandtour') }; })()""")
        check(c['known'] and c['eggs'] == 5 and not c['sold'], 'each region\'s egg has its own dish, known at any hearth, and no kitchen sells one', c)
        check(c['r'] == '' and c['pantry'] == 1 and c['gt'] is False, 'you cook them yourself; the Grand Tour needs teaching first', c)
        # strong: each egg dish beats the plain dish of its region's forage
        s = await pg.evaluate("""(() => { const tot = f => (f.block || 0) / 4 + Object.values(f.st || {}).reduce((a, b) => a + b, 0) + (f.draw || 0) + 2 * (f.energy || 0) + (f.heal || 0) / 5;
          const pairs = [['souffle', 'risotto'], ['custard', 'stew'], ['bake', 'broth'], ['devilled', 'chili'], ['flip', 'sorbet']];
          return { stronger: pairs.every(([e, p]) => tot(DB.meals[e].fx) > tot(DB.meals[p].fx)), top: ['souffle', 'custard', 'bake', 'devilled', 'flip', 'feast'].every(id => tot(DB.meals.grandtour.fx) > 2 * tot(DB.meals[id].fx)) }; })()""")
        check(s == {'stronger': True, 'top': True}, 'each egg dish is stronger than its region\'s plain dish, and the Grand Tour is more than twice any of them', s)

        # ---------- Old Wenna and the Grand Tour ----------
        w = await pg.evaluate("""(() => { for (const id of Object.values(DB.eggs)) delete WG.items[id];
          WG.items.meadowegg = 1; const no = wSay('wenna', 'grand').text, kept = WG.items.meadowegg;
          for (const id of Object.values(DB.eggs)) WG.items[id] = (WG.items[id] || 0) + 1;
          const yes = wSay('wenna', 'grand').text, left = Object.values(DB.eggs).map(id => WG.items[id] || 0);
          return { no, kept, yes, left, known: wRecipeKnown('grandtour'), nest: DB.chars.wenna.topics.nest.t.includes('GRAND') }; })()""")
        check('one of each' in w['no'] and w['kept'] == 1, 'without one egg of each, Wenna says what to bring and takes nothing', w)
        check(w['known'] and w['left'] == [1, 0, 0, 0, 0] and w['nest'], 'with one of each, she takes them and teaches the Grand Tour (and her NEST topic points to it)', w)
        g = await pg.evaluate("""(() => { for (const id of Object.values(DB.eggs)) WG.items[id] = 1; const r = wCook('grandtour');
          for (const p of wRoster()) p.legs = 4; const e = wEat('grandtour'); return { r, e, legs: wRoster().map(p => p.legs || 0), meal: WG.meal }; })()""")
        check(g['r'] == '' and g['e'] == '' and all(x == 0 for x in g['legs']) and g['meal'] == 'grandtour', 'cook and eat the Grand Tour: it rests the team\'s legs at once', g)
        k = await pg.evaluate("""(() => { const k = Object.keys(ENEMIES).find(id => !ENEMIES[id].boss && !ENEMIES[id].elite && !ENEMIES[id].ai.quarters);
          RUN.pending = { world: { kind: 'wild' } }; startCombat([k], 'normal', 'baseball'); fire('fightStart');
          const r = { str: sv(B.P, 'str'), dex: sv(B.P, 'dex'), bedrock: sv(B.P, 'barricade'), block: B.P.block, meal: WG.meal }; B = null; RUN.pending = null; return r; })()""")
        check(k['str'] >= 3 and k['dex'] >= 3 and k['bedrock'] >= 1 and k['block'] >= 12 and k['meal'] is None, 'at kickoff the Grand Tour gives 3 Strength, 3 Footwork, Bedrock and 12 Block, then it is eaten', k)

        # ---------- How to play ----------
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpEggs'); return e ? e.textContent : ''; })()")
        check('Grand Tour' in h and 'Old Wenna' in h and 'nobody sells them' in h, 'How to play explains eggs, their dishes and the Grand Tour', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
