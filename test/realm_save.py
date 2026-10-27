# Realm saves (phase 2): one record per profile, { v: 2, WG, RUN }. Saves mid-world and mid-match (after a card is
# played), reloads the page, continues, and checks the position, the team (deck, HP, gold) and the restored fight
# (hand, piles, enemy HP and intents, the score). Also: Save and quit from the pause screen, the match carrying on
# after the restore, and a phase 1 save (WG only) migrating to v2. Asserts, and exits nonzero on any failure.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)))
    if not ok: FAILS.append(what)
    return ok

TEAM = "JSON.stringify({ map: WG.map, x: WG.x, y: WG.y, min: WG.min, day: WG.dayAbs, hp: RUN.hp, max: RUN.maxhp, gold: RUN.gold, fans: RUN.fans || 0, deck: RUN.deck.map(c => c.uid + ':' + c.id + (c.up ? '+' : '')), party: RUN.party.map(p => p.kind), hardcore: WG.hardcore })"
FIGHT = """JSON.stringify({ turn: B.turn, energy: B.energy, sport: B.sport, type: B.type, hand: B.hand.map(c => c.uid + ':' + c.id), draw: B.draw.map(c => c.uid), disc: B.discard.map(c => c.uid),
  foes: B.enemies.map(e => [e.id, e.n, e.hp, e.block, e.intent, JSON.stringify(e.st)]), sc: [B.sc.us, B.sc.them], hp: RUN.hp, act: RUN.act, world: RUN.pending && RUN.pending.world })"""
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 80) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''

async def fresh(ctx):
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: ERRS.append(str(e)))
    await pg.goto(REALM_URL); await pg.wait_for_timeout(800)
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    return pg

ERRS = []
async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await fresh(ctx)
        await pg.evaluate('localStorage.clear()')
        await pg.reload(); await pg.wait_for_timeout(800)
        await pg.click('#bNew'); await pg.wait_for_timeout(200); await pg.click('#wGo'); await pg.wait_for_timeout(400)

        # ---------- mid-world ----------
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'saltmere'); wEnterMap('world', L.x, L.y + 1); RUN.hp = 51; RUN.gold = 333; RUN.fans = 12; wGainCard('blitz', 'test'); wSave(); })()")
        world = json.loads(await pg.evaluate(TEAM))
        raw = json.loads(await pg.evaluate("localStorage.getItem(wSaveKey())"))
        check(raw['v'] == 2 and 'WG' in raw and 'RUN' in raw and 'gold' not in raw['WG'] and 'party' not in raw['WG'], 'the save is { v: 2, WG, RUN }, with no gold or party on WG')
        await pg.close()
        pg = await fresh(ctx)
        row = await pg.evaluate("document.getElementById('resumeRow').textContent")
        check('51/75 HP' in row and '333 gold' in row, 'the title row shows HP and gold from RUN', row)
        await pg.click('#bResume'); await pg.wait_for_timeout(500)
        check(json.loads(await pg.evaluate(TEAM)) == world and await pg.evaluate('UI.view') == 'world', 'Continue restores the place and the team (deck, HP, gold, fans)', {'saved': world, 'got': json.loads(await pg.evaluate(TEAM))})

        # ---------- mid-match, after a card ----------
        await pg.evaluate("startMatch({ type: 'elite', tier: 2, card: false, name: 'Test Captain', world: { kind: 'wild' } })")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("(() => { const i = B.hand.findIndex(c => canPlay(c)); if (i >= 0) playCard(i, B.enemies.indexOf(alive()[0])); consumeFx(); renderFightHUD(); })()")
        await pg.wait_for_timeout(300)
        check(await pg.evaluate('snapBattle()'), 'snapBattle saves the fight')
        fight = json.loads(await pg.evaluate(FIGHT)); team = json.loads(await pg.evaluate(TEAM))
        check(fight['world'] and fight['world']['kind'] == 'wild' and fight['act'] == 1, 'the match carries its world context, at tier 2', fight['world'])
        await pg.close()  # as if the tab were closed
        pg = await fresh(ctx)
        row = await pg.evaluate("document.getElementById('resumeRow').textContent")
        check('Paused mid-match' in row, 'the title row says a match is paused', row)
        await pg.click('#bResume'); await pg.wait_for_timeout(1000)
        check(await pg.evaluate('UI.view') == 'fight', 'Continue goes straight back into the match')
        f2 = json.loads(await pg.evaluate(FIGHT)); t2 = json.loads(await pg.evaluate(TEAM))
        diff = {k: [fight[k], f2[k]] for k in fight if fight[k] != f2[k]}
        check(not diff, 'the fight is restored exactly: hand, piles, enemies, intents, score, HP', diff)
        check(t2 == team, 'the team and the place are unchanged', {'saved': team, 'got': t2})
        check('Test Captain' in f2['foes'][0][1], 'the lead keeps its name')

        # pause, save and quit, continue again
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
        check(await pg.evaluate("!!document.getElementById('pConcede')"), 'the pause screen offers Concede the match')
        f3 = json.loads(await pg.evaluate(FIGHT))
        await pg.click('#pSave'); await pg.wait_for_timeout(400)
        check(await pg.evaluate("UI.screen") == 'title', 'Save and quit goes to the title')
        await pg.click('#bResume'); await pg.wait_for_timeout(1000)
        check(json.loads(await pg.evaluate(FIGHT)) == f3, 'and Continue restores the same fight again')

        # the restored match plays on to the end and back to the same tile
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the restored match can be won', view)
        await pg.click('#bCont'); await pg.wait_for_timeout(400)
        end = await pg.evaluate('({view: UI.view, map: WG.map, x: WG.x, y: WG.y, act: RUN.act, pending: RUN.pending, battle: RUN.battle})')
        check(end['view'] == 'world' and [end['map'], end['x'], end['y']] == [team['map'], team['x'], team['y']] and end['act'] == 0 and not end['pending'] and not end['battle'], 'back on the same tile, act and pending cleared', end)
        await pg.close()

        # ---------- a phase 1 save (WG only) ----------
        pg = await fresh(ctx)
        await pg.evaluate("""(() => { const W = { v: 1, world: WORLD_VER, map: 'mossgate', x: 6, y: 8, face: 'd', step: 9, gold: 77, year: 1, day: 3, dayAbs: 3, min: 600, flags: {}, items: { salve: 1 },
          energy: { bloom: 0, ember: 0, tide: 0, rime: 0, aether: 0 }, home: 'graftonbury', npc: {}, seen: {}, marks: [], harv: {}, xpk: {}, grace: 0, club: CLUB_IDS[0],
          party: CLUBS[CLUB_IDS[0]].roster.slice(0, 3).map(r => ({ n: r[0], kind: r[1], num: r[2] })) };
          localStorage.setItem(wSaveKey(), JSON.stringify({ v: 1, WG: W })); })()""")
        await pg.reload(); await pg.wait_for_timeout(800)
        await pg.click('#bResume'); await pg.wait_for_timeout(500)
        mig = await pg.evaluate("({ view: UI.view, map: WG.map, gold: RUN.gold, wg: WG.gold, party: RUN.party.length, deck: RUN.deck.length, v: JSON.parse(localStorage.getItem(wSaveKey())).v, home: WG.home })")
        check(mig['view'] == 'world' and mig['map'] == 'mossgate' and mig['gold'] == 77 and mig['wg'] is None and mig['party'] == 3 and mig['deck'] > 0 and mig['v'] == 2 and mig['home'] == 'graftonbury', 'a v1 save migrates: a RUN with its gold, saved back as v2', mig)

        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        check(not ERRS, 'no page errors', ERRS)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm save passed')

asyncio.run(main())
