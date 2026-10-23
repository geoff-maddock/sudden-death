# Realm match seam (phase 2): a wild match from the world, won with a bot and back on the same tile; a lost match
# and the blackout; Hardcore, where a loss ends the save; an alpha match that opens the prize chest; and cards from
# a strongbox and a topic (wGainCard), kept by the save. Asserts every step and exits nonzero on any failure.
# Screenshots: /tmp/realm-match-*.png at 1280x800 and 390x844.
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

# a small greedy bot on the engine (the same calls test/lab.js makes): attacks first, at the weakest enemy
BOT = r'''window.__wbot = function (maxTurns) {
  let g = 0;
  while (B && !B.over && g++ < (maxTurns || 60)) {
    let guard = 0;
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = -1, bs = -1;
      B.hand.forEach((c, i) => { if (!canPlay(c)) return; const d = def(c); if (d.type === 'junk' || d.type === 'curse') return; const s = d.type === 'atk' ? 3 : d.type === 'pow' ? 2 : 1; if (s > bs) { bs = s; best = i; } });
      if (best < 0) break;
      playCard(best, B.enemies.indexOf(tgt));
    }
    if (B.over) break;
    runSteps(endTurn());
  }
  return B && B.over;
};
// lose on purpose: one HP and end every turn until the line falls
window.__wlose = function () { let g = 0; while (B && !B.over && g++ < 40) { RUN.hp = 1; runSteps(endTurn()); } return B && B.over; };
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
// a walkable, calm world tile in a region
window.__wspot = function (rg) { const m = MAPS.world; for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== rg) continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (td && td.walk && !td.enter && td.enc) return [x, y]; } return null; };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_timeout(900)
    await pg.add_script_tag(content=BOT)
    await pg.evaluate(NOTIPS)

async def new_journey(pg, hardcore=False):
    await pg.click('#bNew'); await pg.wait_for_timeout(250)
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes'); await pg.wait_for_timeout(250)
    if hardcore: await pg.check('#wHard')
    await pg.click('#wGo'); await pg.wait_for_timeout(400)

async def to_world(pg, rg):
    return await pg.evaluate(f"(() => {{ const p = __wspot('{rg}'); wEnterMap('world', p[0], p[1]); WG.min = 12 * 60; wDrain(); return {{map: WG.map, x: WG.x, y: WG.y}}; }})()")

async def win_match(pg):
    # the checks are about the realm, not the fight: the simple bot sometimes runs out of turns on the Hatch-Mother
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; for (const e of alive()) e.hp = Math.min(e.hp, 6)")
    over = await pg.evaluate('__wbot(120)')
    await pg.evaluate('__wend()'); await pg.wait_for_timeout(300)
    return over

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg, clear=True)
            await new_journey(pg)
            desk = tag == 'desk'
            if desk:
                check(await pg.evaluate('!!RUN && RUN.party.length === 3 && RUN.gold === 120 && WG.gold === undefined && WG.party === undefined'), 'a new journey makes a RUN: three players, the only purse (120 gold)')
                check(await pg.evaluate("document.getElementById('wHud').textContent.includes('Team HP')"), 'the HUD shows team HP')

            # ---------- a wild match in the Mosswold (tier 2), won ----------
            here = await to_world(pg, 'bloom')
            act0 = await pg.evaluate('RUN.act')
            await pg.evaluate("wEncounterHook(wRegionHere(), '\"', { kind: 'wild' }); wDrain()")
            await pg.wait_for_timeout(300)
            card = await pg.evaluate("(() => { const b = document.getElementById('modalBox'); return document.getElementById('modal').hidden ? null : { text: b.textContent, play: !!document.getElementById('wPlay'), run: !!document.getElementById('wRun') }; })()")
            check(card is not None and card['play'] and card['run'], f'[{tag}] the pre-game card offers Play and Run', card)
            sport = await pg.evaluate('RUN.pending ? null : true')
            check(sport is True, f'[{tag}] nothing is pending until Play')
            await pg.screenshot(path=f'/tmp/realm-match-pregame-{tag}.png')
            if desk:
                check(card is not None and any(s in card['text'] for s in ['Golf', 'Jousting']), 'the card names a Mosswold sport (golf or jousting)', card and card['text'][:200])
            await pg.click('#wPlay'); await pg.wait_for_timeout(1500)
            check(await pg.evaluate("UI.view") == 'fight', f'[{tag}] Play starts the match')
            if desk:
                st = await pg.evaluate('({act: RUN.act, w: RUN.pending && RUN.pending.world, sport: B.sport})')
                check(st['act'] == 1 and st['w'] and st['w']['kind'] == 'wild' and st['w']['tier'] == 2, 'during a tier 2 match RUN.act is 1 and RUN.pending.world is set', st)
                check(await pg.evaluate("document.querySelector('#runbar').textContent.includes('Tier') && document.getElementById('bAbandon').textContent === 'Concede'"), 'the run bar shows the tier and Concede')
            await pg.evaluate("(() => { const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'); if (i >= 0) playCard(i, B.enemies.indexOf(alive()[0])); consumeFx(); renderFightHUD(); })()")
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'/tmp/realm-match-fight-{tag}.png')
            g0 = await pg.evaluate('RUN.gold'); d0 = await pg.evaluate('RUN.deck.length')
            over = await win_match(pg)
            check(over == 'win' and await pg.evaluate("UI.view") == 'panel', f'[{tag}] the bot wins and the reward panel opens', over)
            check(await pg.evaluate("document.getElementById('bCont').textContent") == 'Back to the road', f'[{tag}] the reward panel says Back to the road')
            await pg.screenshot(path=f'/tmp/realm-match-reward-{tag}.png')
            await pg.evaluate("document.querySelector('[data-ci]') && document.querySelector('[data-ci]').click()")
            await pg.wait_for_timeout(150)
            await pg.click('#bCont'); await pg.wait_for_timeout(400)
            back = await pg.evaluate('({view: UI.view, map: WG.map, x: WG.x, y: WG.y, act: RUN.act, gold: RUN.gold, deck: RUN.deck.length, pending: RUN.pending, last: WG.lastMatch, log: WLOG.slice(-6).map(l => l[0]).join(" | "), saved: !!(wLoadSave() && wLoadSave().RUN)})')
            check(back['view'] == 'world', f'[{tag}] Continue returns to the world')
            check([back['map'], back['x'], back['y']] == [here['map'], here['x'], here['y']], f'[{tag}] the party is on the same tile', {'before': here, 'after': back})
            if desk:
                check(back['gold'] > g0 and back['deck'] == d0 + 1, 'the purse and the picked card are applied', {'gold': [g0, back['gold']], 'deck': [d0, back['deck']]})
                check(back['act'] == act0 and back['pending'] is None, 'RUN.act is back to what it was, nothing pending', back)
                check(back['last'] and back['last']['kind'] == 'wild' and back['last']['result'] == 'win' and 'pickup game' in back['log'], 'the wild handler ran (W_ON_END.wild)', back)
                check(back['saved'], 'the realm save holds WG and RUN')

            # ---------- a lost match: blackout ----------
            await pg.evaluate("WG.home = 'mossgate'; RUN.gold = 200; RUN.fans = 40; startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } })")
            await pg.wait_for_timeout(500)
            over = await pg.evaluate('__wlose()')
            await pg.evaluate('__wend()'); await pg.wait_for_timeout(400)
            bo = await pg.evaluate('({view: UI.view, map: WG.map, gold: RUN.gold, fans: RUN.fans, hp: RUN.hp, max: RUN.maxhp, wake: !!document.getElementById("wWake"), saved: !!wLoadSave(), last: WG.lastMatch, blackouts: WG.blackouts})')
            check(over == 'lose' and bo['view'] == 'world' and bo['wake'], f'[{tag}] a lost match blacks out, back in the world with a message', bo)
            await pg.screenshot(path=f'/tmp/realm-match-blackout-{tag}.png')
            if desk:
                check(bo['map'] == 'mossgate', 'you wake at your last inn (WG.home)', bo)
                check(bo['gold'] == 180 and bo['fans'] == 30, 'a tenth of the gold and a quarter of the fans are gone', bo)
                # half, plus whatever level-ups the loss's share of XP paid out after the blackout (+2 HP each)
                check(-(-bo['max'] // 2) <= bo['hp'] <= -(-bo['max'] // 2) + 12, 'HP is back to half', bo)
                check(bo['saved'] and bo['last']['result'] == 'lose' and bo['blackouts'] == 1, 'the save is still there, and the loss is counted', bo)
            await pg.click('#wWake'); await pg.wait_for_timeout(200)
            # a level-up pick the loss paid out opened under the Blackout box: it shows again once you are up
            pend = await pg.evaluate("({ offer: !!WG.cardOffer, shown: !document.getElementById('modal').hidden && /Pick a card/.test(document.querySelector('#modalBox header').textContent) })")
            if pend['offer']:
                check(pend['shown'], f'[{tag}] a card pick from the lost match shows again after you get up', pend)
                await pg.click('#modalBox [data-close]'); await pg.wait_for_timeout(200)
                while await pg.evaluate("!!WG.cardOffer || !document.getElementById('modal').hidden"):
                    await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click())"); await pg.wait_for_timeout(200)
            if not desk:
                await ctx.close(); continue

            # ---------- conceding from the run bar is a blackout too ----------
            await pg.evaluate("startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } })")
            await pg.wait_for_timeout(1500)
            await pg.click('#bAbandon'); await pg.wait_for_timeout(200)
            await pg.click('#cfYes'); await pg.wait_for_timeout(500)
            check(await pg.evaluate('UI.view === "world" && WG.blackouts === 2 && !RUN.pending'), 'Concede from the run bar blacks out')
            await pg.evaluate("document.getElementById('wWake') && document.getElementById('wWake').click()")

            # ---------- an alpha: the Hatch-Mother in the Drowned Hatchery ----------
            ap = await pg.evaluate(r'''(() => { const m = MAPS.hatchery; let a = null, c = null;
              for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (m.t[y][x] === 'M') a = [x, y]; if (m.meta[k].chest === 'hatchery_prize') c = [x, y]; }
              const free = (x, y) => { const ch = wTileAt(m, x, y); return ch && DB.tiles[ch].walk && !DB.tiles[ch].enter; };
              for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (free(a[0] + dx, a[1] + dy)) { wEnterMap('hatchery', a[0] + dx, a[1] + dy); wDrain(); return { a, c }; }
              return null; })()''')
            check(ap is not None, 'found the Hatch-Mother')
            await pg.evaluate("for (const R of wDungeonRooms('hatchery')) wSetFlag(R.flag)")  # phase 5: the alpha waits for every room
            await pg.evaluate(f"wUse({ap['a'][0]}, {ap['a'][1]}); wDrain()"); await pg.wait_for_timeout(300)
            ac = await pg.evaluate("({ text: document.getElementById('modalBox').textContent, notyet: !!document.getElementById('wNotYet'), run: !!document.getElementById('wRun') })")
            check('Hatch-Mother' in ac['text'] and ac['notyet'] and not ac['run'], 'the alpha card names the Hatch-Mother, with Not yet instead of Run', ac['text'][:160])
            await pg.click('#wPlay'); await pg.wait_for_timeout(1500)
            st = await pg.evaluate('({type: B.type, lead: B.enemies.find(isBoss).n, act: RUN.act, trait: B.trait})')
            check(st['type'] == 'boss' and 'Hatch-Mother' in st['lead'] and st['act'] == 1, 'the alpha plays a boss match at tier 2, led by the Hatch-Mother (phase 5)', st)
            over = await win_match(pg)
            check(over == 'win', 'the alpha match is won', over)
            await pg.click('#bCont'); await pg.wait_for_timeout(400)
            ab = await pg.evaluate(f"({{ flag: wFlag('alpha_hatchmother'), tile: wTileAt(MAPS.hatchery, {ap['a'][0]}, {ap['a'][1]}), view: UI.view, map: WG.map }})")
            check(ab['flag'] and ab['tile'] == 'g' and ab['view'] == 'world' and ab['map'] == 'hatchery', 'beating the alpha marks it beaten and clears its tile', ab)
            g1 = await pg.evaluate('RUN.gold')
            await pg.evaluate(f"wUse({ap['c'][0]}, {ap['c'][1]}); wDrain()")
            check(await pg.evaluate("wFlag('chest_hatchery_prize')") and await pg.evaluate('RUN.gold') > g1, 'the prize chest now opens and pays')

            # ---------- cards from the world: a strongbox choice, a skipped choice, and a topic ----------
            # (phase 3: the alpha win levelled players up; set their card picks aside so they do not pop up here)
            await pg.evaluate("WG.wprompts.length = 0")
            d0 = await pg.evaluate('RUN.deck.length')
            await pg.evaluate(r'''(() => { const m = MAPS.cottage; for (const k in m.meta) if (m.meta[k].chest === 'cottage_chest') { const [x, y] = k.split(',').map(Number); wEnterMap('cottage', m.spawn[0], m.spawn[1]); wDrain(); wUse(x, y); wDrain(); return; } })()''')
            await pg.wait_for_timeout(250)
            n = await pg.evaluate("document.querySelectorAll('#modalBox [data-wco]').length")
            check(n == 3 and await pg.evaluate('!!WG.cardOffer'), 'the cottage strongbox offers a pick of three cards', n)
            await pg.screenshot(path='/tmp/realm-match-cardpick-desk.png')
            pick = await pg.evaluate('WG.cardOffer.list[1].id')
            await pg.click('#modalBox [data-wco="1"]'); await pg.wait_for_timeout(200)
            last = await pg.evaluate('RUN.deck[RUN.deck.length - 1]')
            check(await pg.evaluate('RUN.deck.length') == d0 + 1 and last['id'] == pick and bool(last.get('own')) and await pg.evaluate('WG.cardOffer') is None, 'picking one adds exactly that card, with an owner', {'pick': pick, 'last': last})
            await pg.evaluate(r'''(() => { const m = MAPS.hollowshrine; for (const k in m.meta) if (m.meta[k].chest === 'shrine_chest') { const [x, y] = k.split(',').map(Number); wEnterMap('hollowshrine', m.spawn[0], m.spawn[1]); wDrain(); wUse(x, y); wDrain(); return; } })()''')
            await pg.wait_for_timeout(250)
            rars = await pg.evaluate("WG.cardOffer && WG.cardOffer.list.map(c => CARDS[c.id].rar)")
            check(rars and all(r == 'u' for r in rars), 'the shrine strongbox offers uncommons', rars)
            await pg.click('#modalBox [data-close]'); await pg.wait_for_timeout(200)
            check(await pg.evaluate('RUN.deck.length') == d0 + 1 and await pg.evaluate('WG.cardOffer') is None, 'Skip takes nothing')
            await pg.evaluate("wSay('clerk', 'licence'); wDrain()")
            check(await pg.evaluate("RUN.deck.filter(c => c.id === 'pickroll').length") == 1 and await pg.evaluate('RUN.deck.length') == d0 + 2, "Imelda's licence topic pays Pick and Roll")
            await pg.evaluate("wSay('clerk', 'licence')")
            check(await pg.evaluate("RUN.deck.filter(c => c.id === 'pickroll').length") == 1, 'asking again does not pay twice')
            deck = await pg.evaluate('RUN.deck.map(c => c.uid + c.id).join()')
            await pg.reload(); await pg.wait_for_timeout(800)
            await pg.click('#bResume'); await pg.wait_for_timeout(500)
            check(await pg.evaluate('RUN.deck.map(c => c.uid + c.id).join()') == deck, 'the save keeps the new cards')
            await pg.add_script_tag(content=BOT); await pg.evaluate(NOTIPS)

            # ---------- the encounter roll (TC's encounterRoll) and a real step into one ----------
            rolls = await pg.evaluate("""(() => { const m = MAPS.world, sv = WG.min; WG.min = 12 * 60;
              const day = [wEncounterRoll(m, '"', .05), wEncounterRoll(m, '=', .001), wEncounterRoll(m, '.', .5)]; WG.min = 23 * 60;
              const night = [wEncounterRoll(m, '=', .01), wEncounterRoll(m, '"', .13), wEncounterRoll(MAPS.graftonbury, 'o', 0)]; WG.min = sv; return { day, night }; })()""")
            check(rolls == {'day': ['fight', None, None], 'night': ['fight', 'fight', None]}, 'rolls: tall grass by day, the road only at night, night 25% busier, never in town', rolls)
            key = await pg.evaluate(r'''(() => { const p = __wspot('plains'); wEnterMap('world', p[0], p[1]); WG.min = 12 * 60; WG.grace = 0; wDrain(); const m = MAPS.world;
              for (const [k, dx, dy] of [['ArrowRight',1,0],['ArrowLeft',-1,0],['ArrowDown',0,1],['ArrowUp',0,-1]]) { const c = wTileAt(m, WG.x + dx, WG.y + dy), td = DB.tiles[c]; if (td && td.walk && !td.enter && td.enc) return k; } return null; })()''')
            hp0 = await pg.evaluate('RUN.hp')
            await pg.evaluate('window.__mr = Math.random; Math.random = () => 0')
            await pg.keyboard.press(key); await pg.wait_for_timeout(300)
            await pg.evaluate('Math.random = window.__mr')
            check(await pg.evaluate("!!document.getElementById('wRun') && !RUN.pending"), 'a step into the grass with a low roll brings up a wild match')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
            check(await pg.evaluate('UI.view') == 'world' and await pg.evaluate('RUN.hp') == hp0 - 3 and await pg.evaluate('WG.grace') == 4, 'closing the card runs away by day: 3 HP, no match', await pg.evaluate('[UI.view, RUN.hp, WG.grace]'))
            # the cup counter stays "coming soon"
            await pg.evaluate("wRunAct('cup:mossgate', 'clerk'); wDrain()")
            check(await pg.evaluate("UI.view === 'world' && !RUN.pending && document.getElementById('modal').hidden"), 'cups still do not start a match (phase 6)')

            # ---------- the help page ----------
            await pg.evaluate("showPage('help')")
            check(await pg.evaluate("!!document.getElementById('wHelp') && document.getElementById('wHelp').textContent.includes('Hardcore')"), 'How to play has a "The realm" section')
            await pg.evaluate("showPage('play')")

            # ---------- Hardcore: a loss ends the journey ----------
            await boot(pg)
            await new_journey(pg, hardcore=True)
            check(await pg.evaluate('WG.hardcore === true') and await pg.evaluate("document.getElementById('wHud').textContent.includes('Hardcore')"), 'Hardcore is chosen at new game and shown in the HUD')
            nrec = await pg.evaluate("loadRecords().runs.length")
            await pg.evaluate("startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } })")
            await pg.wait_for_timeout(500)
            await pg.evaluate('__wlose()'); await pg.evaluate('__wend()'); await pg.wait_for_timeout(400)
            hc = await pg.evaluate("({ screen: UI.screen, save: localStorage.getItem(wSaveKey()), recs: loadRecords().runs.length, res: loadRecords().runs[0] && loadRecords().runs[0].result, lede: document.querySelector('#scr-end .lede').textContent, again: document.getElementById('bAgain').textContent })")
            check(hc['screen'] == 'end' and hc['save'] is None, 'in Hardcore a loss shows the end screen and clears the save', hc)
            check(hc['recs'] == nrec + 1 and hc['res'] == 'lose' and 'journey ends' in hc['lede'], 'the run goes in the record book as a loss', hc)
            await pg.screenshot(path='/tmp/realm-match-hardcore-end-desk.png')
            await pg.click('#bAgain'); await pg.wait_for_timeout(300)
            check(await pg.evaluate("UI.screen === 'title' && document.getElementById('resumeRow').hidden"), 'the end screen goes back to the title, with no journey to continue')

            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, 'no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm match passed')

asyncio.run(main())
