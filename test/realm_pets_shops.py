# Realm pets (issue #104, phase 4): pet shops and keepers. The three shopkeepers and two keepers stand in their towns;
# each shop's loose pets wait on open ground. A shop is shut until its quest is done: Graftonbury's three loose
# Blinkpups caught and Wick told (PUPS), Saltmere's two saltfish for the mimic (LEDGER), Cinderhold's three fire beetles
# (BEETLES); each is a side plot in the journal. Open, a shop sells one of its region's pets a week (the stock turns),
# into the kennel at its price; not with a full kennel or short of gold; a pet let go there comes back at the price.
# A keeper sells its one pet only once its condition is met (a golf win at Mossgate Links, a hockey win at the Pond
# Rink). How to play explains. Screenshots go to /tmp. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

ESC = "for (let k = 0; k < 6 && !document.getElementById('modal').hidden; k++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wPshopOpen === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        pl = await pg.evaluate("""(() => { const npc = [...Object.values(W_PSHOP.shops), ...Object.values(W_PSHOP.keepers)].filter(S => !MAPS[S.town].npcs.some(n => n.id === S.npc)).map(S => S.npc);
          const loose = ['hq', 'cind'].map(id => Object.values(MAPS[W_PSHOP.shops[id].town].meta).filter(x => x.loose === id).length);
          // (everybody in the five towns has a way to them, with the others standing about in the way, as in the game)
          const reach = [...new Set([...Object.values(W_PSHOP.shops), ...Object.values(W_PSHOP.keepers)].map(S => S.town))].flatMap(t => { const m = MAPS[t];
            const saved = m.npcs.map(n => { const c = m.t[n.y][n.x]; m.t[n.y][n.x] = '#'; return c; }); const seen = bfsReach(m, m.spawn[0], m.spawn[1]); for (let i = m.npcs.length - 1; i >= 0; i--) m.t[m.npcs[i].y][m.npcs[i].x] = saved[i];
            // (one behind a counter is talked to across it)
            const counter = n => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (DB.tiles[m.t[n.y + dy] && m.t[n.y + dy][n.x + dx]] || {}).use === 'counter');
            return m.npcs.filter(n => !counter(n)).filter(n => ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(n.y + dy) * m.w + n.x + dx])).map(n => t + ':' + n.id); });
          // (every loose pet, and every counter's talking tile, has a way to it with people in the way)
          const lp = ['hq', 'cind'].flatMap(id => { const m = MAPS[W_PSHOP.shops[id].town], G = wPlaceGuard(m); return Object.keys(m.meta).filter(k => m.meta[k].loose === id).filter(k => { const [x, y] = k.split(',').map(Number); return !G.side(G.seen0, x, y); }); });
          const ct = [...new Set([...Object.values(W_PSHOP.shops), ...Object.values(W_PSHOP.keepers)].map(S => S.town))].flatMap(t => { const m = MAPS[t], G = wPlaceGuard(m);
            return m.npcs.flatMap(n => { const c = W_SIDES.find(([dx, dy]) => (DB.tiles[m.t[n.y + dy] && m.t[n.y + dy][n.x + dx]] || {}).use === 'counter'); if (!c) return []; const tx = n.x + 2 * c[0], ty = n.y + 2 * c[1];
              return G.seen0[ty * m.w + tx] && !m.npcs.some(o => o !== n && o.x === tx && o.y === ty) ? [] : [t + ':' + n.id]; }); });
          reach.push(...lp.map(k => 'loose ' + k), ...ct.map(k => 'counter ' + k));
          return { npc, loose, reach, audit: wAudit().filter(s => /pet|keeper/.test(s)) }; })()""")
        check(pl == {'npc': [], 'loose': [3, 3], 'reach': [], 'audit': []}, 'the three shopkeepers and two keepers stand in their towns, and the loose pets wait on open ground', pl)

        q = await pg.evaluate("""(() => { const out = {};
          const pets0 = wSay('pshop_hq', 'pets'); out.shut = { act: pets0.act || null, says: /Blinkpups/.test(pets0.text) };
          out.early = /Blinkpups blinked out/.test(wSay('pshop_hq', 'pups').text) && !wFlag('q_petshop_hq');
          const m = MAPS.graftonbury, spots = Object.keys(m.meta).filter(k => m.meta[k].loose === 'hq').map(k => k.split(',').map(Number));
          WG.map = 'graftonbury'; out.v0 = wTileVariant(m, spots[0][0], spots[0][1], W_PSHOP_CH);
          for (const [x, y] of spots) wUse(x, y);
          out.v1 = wTileVariant(m, spots[0][0], spots[0][1], W_PSHOP_CH); out.caught = [0, 1, 2].every(i => wFlag('pq_hq_' + i));
          out.walk0 = spots.every(([x, y]) => walkCh(wTileAt(m, x, y)));
          wSay('pshop_hq', 'pups'); out.open = wFlag('q_petshop_hq') && wPshopIsOpen('hq'); out.journal = /Done: The pups/.test(WLOG.map(l => l[0]).join(' '));
          const pets1 = wSay('pshop_hq', 'pets'); out.act = pets1.act; return out; })()""")
        check(q['shut'] == {'act': None, 'says': True} and q['early'], 'a shop is shut until its quest is done: PETS and PUPS say what is wrong', q)
        check(q['walk0'], 'a caught loose pet leaves only the ground: you can walk there', q)
        check(q['v0'].endswith('1') and q['v1'].endswith('0') and q['caught'] and q['open'] and q['journal'] and q['act'] == 'petshop', 'catch the three loose Blinkpups, tell Wick: the shop opens, the side plot is done', q)

        b = await pg.evaluate("""(() => { RUN.gold = 500; const kind = wPshopStock('hq'), next = wPshopStock('hq', wWeek() + 1), price = wPshopPrice(kind), g0 = RUN.gold;
          wRunAct('petshop', 'pshop_hq'); const box = document.getElementById('modalBox'), btn = box.querySelector('[data-psbuy]'), shows = /This week/.test(box.textContent) && /Next week/.test(box.textContent);
          btn.click(); const q = wPets().owned.find(x => x.kind === kind);
          const r = { kind, next, shows, paid: g0 - RUN.gold === price, has: !!q, from: q && q.from, closed: document.getElementById('modal').hidden };
          r.again = wPshopBuy('hq', kind); wRunAct('petshop', 'pshop_hq'); r.soldShown = !document.querySelector('#modalBox [data-psbuy]') && /Sold out/.test(document.getElementById('modalBox').textContent); for (let k = 0; k < 6 && !document.getElementById('modal').hidden; k++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          WG.pshopWk.hq = wWeek() - 1;
          r.other = wPshopBuy('hq', next); RUN.gold = 1; r.poor = wPshopBuy('hq', kind); RUN.gold = 500;
          for (const k of ['sprite', 'bogfrog', 'chestnut', 'jellycube', 'imp']) wPetAdd(k, 'egg:x'); r.full = wPshopBuy('hq', kind);
          wRunAct('petshop', 'pshop_hq'); r.disabled = document.querySelector('#modalBox [data-psbuy]').disabled; """ + ESC + """
          wPetLetGo(q.id); wPetAdd('mephitling', 'egg:x'); const g1 = RUN.gold; wRunAct('petshop', 'pshop_hq'); const back = document.querySelector('#modalBox [data-psback]'); r.backFull = back && back.disabled; """ + ESC + """
          wPetLetGo(wPets().owned.find(x => x.kind === 'imp').id); wRunAct('petshop', 'pshop_hq'); document.querySelector('#modalBox [data-psback]').click();
          r.back = wPets().owned.some(x => x.kind === kind && x.from === 'shop:hq'); r.backPaid = g1 - RUN.gold === price; return r; })()""")
        check(b['shows'] and b['kind'] != b['next'] and b['paid'] and b['has'] and b['from'] == 'shop:hq' and b['closed'], 'open, the shop sells this week\'s pet (next week\'s is another) into the kennel, at its price', b)
        check(b['again'] != '' and b['soldShown'], 'one pet a week: a second this week is sold out, and the window says so', b)
        check(b['other'] != '' and b['poor'] != '' and b['full'] != '' and b['disabled'], 'not a pet out of stock, not short of gold, not with a full kennel', b)
        check(b['backFull'] and b['back'] and b['backPaid'], 'a pet let go at the shop comes back there at its price, once there is room', b)
        await pg.evaluate("wRunAct('petshop', 'pshop_hq')")
        await pg.screenshot(path='/tmp/pets_shop.png')
        await pg.evaluate(ESC)

        s = await pg.evaluate("""(() => { const out = {}; while (wHas('saltfish')) wAddItem('saltfish', -1);
          out.none = /saltfish/.test(wSay('pshop_salt', 'ledger').text) && !wFlag('q_petshop_salt');
          wAddItem('saltfish', 3); wSay('pshop_salt', 'ledger'); out.open = wFlag('q_petshop_salt'); out.left = wHas('saltfish', 1) && !wHas('saltfish', 2);
          for (let i = 0; i < 3; i++) wSetFlag('pq_cind_' + i); wSay('pshop_cind', 'beetles'); out.cind = wPshopIsOpen('cind');
          out.stock = [wPshopStock('salt'), wPshopStock('cind')].map(k => PETS[k].el); return out; })()""")
        check(s == {'none': True, 'open': True, 'left': True, 'cind': True, 'stock': ['tide', 'ember']}, 'two saltfish for the mimic open Saltmere\'s shop; three beetles open Cinderhold\'s; each sells its region\'s pets', s)

        k = await pg.evaluate("""(() => { const out = {}; RUN.gold = 500; WG.lkg = null; WG.hkg = null;
          const a = wSay('pkeep_moss', 'pets'); out.no = { act: a.act || null, says: /golf match/.test(a.text) };
          WG.lkg = { w: 1, l: 0, games: [] }; const b = wSay('pkeep_moss', 'pets'); out.yes = b.act;
          out.frost = wPshopBuy('rime', 'frostpup') !== ''; WG.hkg = { w: 1, l: 0, games: [] };
          while (wPets().owned.length > 4) wPetLetGo(wPets().owned[wPets().owned.length - 1].id);
          out.hoot = wPshopBuy('moss', 'hootling'); out.fp = wPshopBuy('rime', 'frostpup'); out.once = wPshopBuy('moss', 'hootling') !== '';
          out.got = ['hootling', 'frostpup'].every(k => wPets().owned.some(x => x.kind === k && x.from.startsWith('keeper:'))); return out; })()""")
        check(k['no'] == {'act': None, 'says': True} and k['yes'] == 'petshop' and k['frost'], 'a keeper sells only once its condition is met (a golf win at Mossgate Links; a hockey win at the Pond Rink)', k)
        check(k['hoot'] == '' and k['fp'] == '' and k['got'] and k['once'], 'then the Hootling and the Frostpup come from their keepers, one each a journey', k)

        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpPetShops'); return !!h && ['Graftonbury', 'Saltmere', 'Cinderhold', 'Hootling', 'Frostpup', 'one a week'].every(w => h.textContent.includes(w)); })()")
        check(hp, 'How to play explains pet shops and keepers', hp)
        await pg.evaluate("showPage('play')")
        await pg.evaluate("(() => { const m = MAPS.cinderhold, k = Object.keys(m.meta).find(k => m.meta[k].loose === 'cind'), [x, y] = k.split(',').map(Number); for (let i = 0; i < 3; i++) WG.flags['pq_cind_' + i] = 0; delete WG.flags.q_petshop_cind; wEnterMap('cinderhold', x, y + 1); wDrain(); })()")
        await pg.wait_for_function("document.getElementById('modal').hidden && UI.view === 'world'")
        await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        await pg.screenshot(path='/tmp/pets_loose.png')

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
