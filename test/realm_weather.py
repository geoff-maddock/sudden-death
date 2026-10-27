# Realm weather (epic 2, phase 7): each morning the Frostspire may have a blizzard, the Brinefen fog, the Cindermaw an
# ash storm; the Plains and the Mosswold stay fair. Weather changes matches out in the open and at outdoor grounds,
# not cups or the indoor halls: a blizzard puts 2 Frostbite cards in your draw pile and makes the enemies Weak, fog
# gives both sides 6 Block, ash gives both 4 Burn. Each side carries a marker, and Whiteout, Fog Bank and Cinder Wind
# do more in their weather. The top bar names it, the pre-game card says what it does, the world draws it, the save
# keeps the day's roll, and How to play explains it.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-weather-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
# out in the open near a city, with today's weather set
OUT = """((city, k) => { const L = DB.locs.find(l => l.map === city), r = W_GRD_REG[city]; wEnterMap('world', L.x, L.y + 1); wResetParty(); WUI.cam = null; WG.min = 12 * 60;
  WG.wx = { day: WG.dayAbs, by: k ? { [r]: k } : {} }; WUI.hudKey = null; wRenderHud(); return r; })"""
KICK = """(() => { RUN.pending = null; B = null; const enc = wWildMatch(wRegionHere()); return { wx: enc.world.wx || null }; })()"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_WX !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the roll: by region, once a day ----------
        roll = await pg.evaluate("""(() => { const seen = {}; for (let d = 0; d < 300; d++) { WG.dayAbs++; for (const r in DB.regions) { const k = wWeather(r); if (k) (seen[r] = seen[r] || new Set()).add(k); } }
          const same = (() => { const a = wWeather('rime'); return a === wWeather('rime'); })();
          return { seen: Object.fromEntries(Object.entries(seen).map(([r, s]) => [r, [...s]])), same }; })()""")
        check(roll['seen'] == {'rime': ['blizzard'], 'tide': ['fog'], 'ember': ['ash']}, 'blizzards in the Frostspire, fog on the Brinefen, ash in the Cindermaw; the Plains and the Mosswold stay fair', roll['seen'])
        check(roll['same'], 'the weather holds all day')

        # ---------- the top bar, and the world drawn in it ----------
        await pg.evaluate(OUT + "('rimewatch', 'blizzard')"); await pg.wait_for_timeout(700)
        hud = await pg.evaluate("document.querySelector('#wHud .wwhere').textContent")
        check('Blizzard' in hud, 'the top bar names the weather', hud)
        await pg.screenshot(path='/tmp/realm-weather-blizzard.png')
        for k, city in [('fog', 'saltmere'), ('ash', 'cinderhold')]:
            await pg.evaluate(OUT + f"('{city}', '{k}')"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'/tmp/realm-weather-{k}.png')

        # ---------- a blizzard match: the card, Frostbite, Weak enemies, the marker ----------
        await pg.evaluate(OUT + "('rimewatch', 'blizzard')")
        await pg.evaluate("wWildMatch('rime')"); await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("(() => { const e = document.querySelector('#modalBox .wwx'); return e ? e.textContent : ''; })()")
        check('Blizzard' in pre and 'Frostbite' in pre, 'the pre-game card says what the weather does', pre)
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        bz = await pg.evaluate("""({ frost: [...B.draw, ...B.hand, ...B.discard, ...B.exhaust].filter(c => c.id === 'frostbite').length, weak: alive().every(e => sv(e, 'weak') >= 1),
          mark: sv(B.P, 'snowed') === 1 && alive().every(e => sv(e, 'snowed') === 1), name: ST.snowed.n })""")
        check(bz['frost'] == 2 and bz['weak'] and bz['mark'], 'a blizzard: 2 Frostbite cards, Weak enemies, both sides Snowed In', bz)
        await pg.wait_for_timeout(600); await pg.screenshot(path='/tmp/realm-weather-match.png')
        await pg.evaluate("(() => { B.over = 'lose'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)

        # ---------- fog and ash, straight through kickoff ----------
        fa = await pg.evaluate("""(() => { const out = {};
          const go = (city, k) => { const L = DB.locs.find(l => l.map === city); wEnterMap('world', L.x, L.y + 2); WG.min = 12 * 60; WG.wx = { day: WG.dayAbs, by: { [W_GRD_REG[city]]: k } };
            LAB = true; try { RUN.pending = null; B = null; wWildMatch(W_GRD_REG[city]); } finally { LAB = false; } return B; };
          go('saltmere', 'fog'); out.fog = { p: B.P.block, e: alive().map(e => e.block), mark: sv(B.P, 'fogbound') };
          RUN.hp = RUN.maxhp; go('cinderhold', 'ash'); out.ash = { p: sv(B.P, 'burn'), hp: RUN.maxhp - RUN.hp, e: alive().map(e => sv(e, 'burn')), mark: sv(B.P, 'ashen') };
          go('mossgate', null); out.fair = RUN.pending.world.wx || null;
          RUN.pending = null; B = null; showView('world'); return out; })()""")
        check(fa['fog']['p'] >= 6 and all(b >= 6 for b in fa['fog']['e']) and fa['fog']['mark'] == 1, 'fog: both sides start with 6 Block', fa['fog'])
        check(fa['ash']['p'] == 2 and all(b >= 4 for b in fa['ash']['e']) and fa['ash']['mark'] == 1, 'ash: both sides start with 4 Burn (yours has burned once by your first turn)', fa['ash'])
        check(fa['fair'] is None, 'fair weather changes nothing', fa['fair'])

        # ---------- under cover: cups, indoor halls; outdoor grounds count ----------
        cover = await pg.evaluate("""(() => { WG.wx = { day: WG.dayAbs, by: { rime: 'blizzard', tide: 'fog' } };
          const rink = W_GRDS.find(g => g.city === 'rimewatch' && g.sport === 'hockey'), sheet = W_GRDS.find(g => g.city === 'rimewatch' && g.sport === 'curling');
          return { cup: wMatchWeather({ kind: 'cup', region: 'rime', map: 'rimewatch', ref: { cup: 'rime' } }), rink: wMatchWeather({ kind: 'ground', region: 'rime', map: rink.id, ref: { g: rink.id } }),
            sheet: wMatchWeather({ kind: 'ground', region: 'rime', map: sheet.id, ref: { g: sheet.id } }), room: wMatchWeather({ kind: 'room', region: 'tide', map: 'hatchery' }),
            wild: wMatchWeather({ kind: 'wild', region: 'tide', map: 'world' }) }; })()""")
        check(cover == {'cup': None, 'rink': 'blizzard', 'sheet': None, 'room': None, 'wild': 'fog'}, 'cups, dungeons and indoor halls are under cover; outdoor grounds are not', cover)

        # ---------- the cards ----------
        cards = await pg.evaluate("""(() => { const out = {}; const k = Object.keys(ENEMIES).find(id => !ENEMIES[id].boss && !ENEMIES[id].elite && !ENEMIES[id].ai.quarters);
          const play = (id, mark) => { RUN.pending = null; startCombat([k], 'normal', 'baseball'); if (mark) for (const t of [B.P, ...alive()]) addSt(t, mark, 1);
            B.energy = 9; const e = alive()[0], hp = e.hp, blk = B.P.block; B.hand.push(mkCard(id)); playCard(B.hand.length - 1, B.enemies.indexOf(e)); return { dmg: hp - e.hp, blk: B.P.block - blk, weak: sv(e, 'weak'), vuln: sv(e, 'vuln') }; };
          out.wo = [play('wx_whiteout', 'snowed').blk, play('wx_whiteout').blk];
          out.fb = [play('wx_fogbank', 'fogbound'), play('wx_fogbank')];
          out.cw = [play('wx_cinder', 'ashen').dmg, play('wx_cinder').dmg];
          out.pool = { hockey: wSportPool(['hockey']).includes('wx_whiteout'), curling: wSportPool(['curling']).includes('wx_fogbank'), football: wSportPool(['football']).includes('wx_cinder') };
          out.text = cardText(mkCard('wx_whiteout'), {});
          B = null; return out; })()""")
        check(cards['wo'][0] > cards['wo'][1], 'Whiteout gives more Block in a blizzard', cards['wo'])
        check(cards['fb'][0]['vuln'] >= 2 and cards['fb'][1]['vuln'] == 0, 'Fog Bank does more in fog', cards['fb'])
        check(cards['cw'][0] > cards['cw'][1], 'Cinder Wind hits harder in an ash storm', cards['cw'])
        check(all(cards['pool'].values()) and 'Snowed In' in cards['text'], 'the cards are in their regions\' pools, and say when they do more', cards)

        # ---------- the save, How to play ----------
        await pg.evaluate("(() => { WG.wx = { day: WG.dayAbs, by: { ember: 'ash' } }; wSave(); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("wWeather('ember') === 'ash' && !wWeather('rime')"), 'the save keeps the day\'s weather')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpWeather'); return h ? h.textContent : ''; })()")
        check('Weather' in help_ and 'Blizzard' in help_ and 'Fog' in help_ and 'Ash storm' in help_, 'How to play explains the weather', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm weather passed')

asyncio.run(main())
