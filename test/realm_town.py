# Realm phase 4, towns: cook a meal at an inn hearth (its buff applies at the next kickoff, then clears), buy a meal
# from an inn's kitchen, the inn's Meals button, Brother Quill's enchanting (upgrade, Practice star, gear) paid in
# energy, a card vendor (region stock, buy, trade a card away, stock turning over after a week), every seeded card find
# in the five regions paying out, and the save keeping meals, energy and stock. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-town-*.png (meals, enchanter, card shop) at 1280x800 and 390x844.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''window.__wbot = function (maxTurns) {
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
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
// a match with no other kickoff effects in the way: no trophies, a sport with no first-turn tricks
window.__kick = function () { RUN.relics = []; RUN.luck = 0; startMatch({ ids: ['cheer'], type: 'normal', tier: 1, sport: 'baseball', trait: null, lv: 0, ambush: false, card: false, world: { kind: 'wild', region: 'plains' } }); };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_timeout(900)
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_timeout(250)
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes'); await pg.wait_for_timeout(250)
    await pg.click('#wGo'); await pg.wait_for_timeout(400)

async def close_modal(pg):
    await pg.evaluate("document.getElementById('modal').hidden || (document.querySelector('#modalBox [data-close]') || document.getElementById('modal')).click()")
    await pg.wait_for_timeout(150)

async def finish(pg):
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp")
    over = await pg.evaluate('__wbot(80)')
    await pg.evaluate('__wend()'); await pg.wait_for_timeout(250)
    await pg.evaluate("document.getElementById('bCont') && document.getElementById('bCont').click()"); await pg.wait_for_timeout(300)
    return over

async def desk_checks(pg):
    # ---------- cook at an inn hearth, through the innkeeper's MEAL topic ----------
    await pg.evaluate("WG.items.mossberry = 2; WG.items.grain = 3; WG.items.salt = 1; WG.pantry = {}; WG.meal = null")
    r = await pg.evaluate("wSay('hq_inn', 'meal')")
    check(r.get('act') == 'meals', 'innkeepers answer MEAL', r)
    await pg.evaluate("wRunAct('meals', 'hq_inn')"); await pg.wait_for_timeout(200)
    n = await pg.evaluate("document.querySelectorAll('#wMealBody [data-wbuym]').length")
    check(n == 2 and await pg.evaluate("!document.querySelector('#wMealBody [data-wcook=\"stew\"]').disabled && document.querySelector('#wMealBody [data-wcook=\"chili\"]').disabled"), "the inn's menu sells two meals; the hearth cooks what you have the ingredients for", n)
    t0 = await pg.evaluate('WG.dayAbs * 1440 + WG.min')
    await pg.click('#wMealBody [data-wcook="stew"]'); await pg.wait_for_timeout(150)
    ck = await pg.evaluate("({ pantry: WG.pantry, berries: WG.items.mossberry || 0, grain: WG.items.grain, t: WG.dayAbs * 1440 + WG.min })")
    check(ck['pantry'].get('stew') == 1 and ck['berries'] == 0 and ck['grain'] == 2 and ck['t'] - t0 >= 60, 'cooking Mossberry Stew uses 2 mossberries and a grain, takes an hour, and fills the pantry', ck)
    await pg.screenshot(path='/tmp/realm-town-meals-desk.png')
    await pg.click('#wMealBody [data-weat="stew"]'); await pg.wait_for_timeout(100)
    check(await pg.evaluate("WG.meal === 'stew' && !WG.pantry.stew && document.getElementById('wMealBody').textContent.includes('Start the next match with 8 Block')"), 'eating it makes it the meal for the next match, and the menu says what it does')
    await close_modal(pg)
    check(await pg.evaluate("document.getElementById('wHudEn').textContent.includes('fed')"), 'the HUD shows you have eaten')

    # ---------- the meal at kickoff, then gone ----------
    await pg.evaluate('__kick()'); await pg.wait_for_timeout(300)
    k = await pg.evaluate("({ block: B.P.block, meal: B.wMeal, left: WG.meal, log: B.log.map(l => l.t).join(' | ') })")
    check(k['block'] >= 8 and k['meal'] == ['stew'] and k['left'] is None and 'Mossberry Stew' in k['log'], 'the stew gives 8 Block at kickoff, says so, and is used up', k)
    await finish(pg)
    await pg.evaluate('__kick()'); await pg.wait_for_timeout(300)
    k2 = await pg.evaluate("({ block: B.P.block, meal: B.wMeal || null })")
    check(k2['meal'] is None and k2['block'] < 8, 'the match after has no meal', k2)
    await finish(pg)

    # ---------- buy a meal at the inn, and its Stamina ----------
    await pg.evaluate("RUN.gold = 100; WUI.talk = { id: 'hq_inn', text: '', seen: [] }; wOpenInn(15, 'Dolores Hen')"); await pg.wait_for_timeout(150)
    check(await pg.evaluate("!!document.getElementById('wInnMeals')"), 'the inn card has a Meals button')
    await pg.click('#wInnMeals'); await pg.wait_for_timeout(150)
    await pg.click('#wMealBody [data-wbuym="risotto"]'); await pg.wait_for_timeout(100)
    b = await pg.evaluate("({ gold: RUN.gold, pantry: WG.pantry.risotto })")
    check(b == {'gold': 76, 'pantry': 1}, 'buying Aethercap Risotto costs 24 gold and fills the pantry', b)
    await pg.click('#wMealBody [data-weat="risotto"]'); await pg.wait_for_timeout(100)
    await close_modal(pg); await pg.evaluate("WUI.talk = null")
    await pg.evaluate('__kick()'); await pg.wait_for_timeout(300)
    e = await pg.evaluate("({ e: B.energy, max: B.maxE, meal: B.wMeal })")
    check(e['e'] == e['max'] + 1 and e['meal'] == ['risotto'], 'the risotto gives 1 more Stamina on the first turn', e)
    await finish(pg)
    # a snack, and a fortune that stacks with it
    await pg.evaluate("WG.items.jerky = 1; WG.charm = 'fortune'; wEat('jerky'); __kick()"); await pg.wait_for_timeout(300)
    s = await pg.evaluate("({ str: B.P.st.str || 0, e: B.energy, max: B.maxE, meal: B.wMeal, jerky: WG.items.jerky || 0, charm: WG.charm })")
    check(s['str'] >= 1 and s['e'] == s['max'] + 1 and s['meal'] == ['jerky', 'fortune'] and s['jerky'] == 0 and s['charm'] is None, 'a snack from the bag and a fortune both act at kickoff', s)
    await finish(pg)
    # eating a second meal puts the first back
    await pg.evaluate("WG.pantry = { hash: 1, stew: 1 }; wEat('hash'); wEat('stew')")
    check(await pg.evaluate("WG.meal === 'stew' && WG.pantry.hash === 1 && !WG.pantry.stew"), 'eating a second meal puts the first back in the pantry')

    # ---------- the enchanter ----------
    r = await pg.evaluate("wSay('quill', 'enchant')")
    check(r.get('act') == 'enchant', 'Brother Quill answers ENCHANT', r)
    await pg.evaluate("WG.energy = { ember: 5, bloom: 3, tide: 0, rime: 0, aether: 1 }; WG.enchUsed = {}; RUN.deck.forEach(c => { c.up = false; c.sk = 0; }); wRunAct('enchant', 'quill')"); await pg.wait_for_timeout(150)
    txt = await pg.evaluate("document.getElementById('modalBox').textContent")
    check('3 energy' in txt and '4 energy' in txt and '9 in all' in txt, 'the enchanter shows your energy and each price', txt[:300])
    await pg.screenshot(path='/tmp/realm-town-enchanter-desk.png')
    await pg.click('[data-wench="up"]'); await pg.wait_for_timeout(150)
    uid = await pg.evaluate("document.querySelector('#modalBox .cardgrid .card').dataset.uid")
    await pg.click('#modalBox .cardgrid .card'); await pg.wait_for_timeout(150)
    u = await pg.evaluate(f"({{ up: RUN.deck.find(c => c.uid == {uid}).up, en: WG.energy, used: WG.enchUsed.up, again: document.getElementById('modalBox').textContent.includes('4 energy') }})")
    check(u['up'] is True and u['en']['ember'] == 2 and u['used'] == 1, 'binding upgrades the card and takes 3 energy, from the biggest stock first', u)
    await pg.click('[data-wench="star"]'); await pg.wait_for_timeout(150)
    uid = await pg.evaluate("document.querySelector('#modalBox .cardgrid .card').dataset.uid")
    await pg.click('#modalBox .cardgrid .card'); await pg.wait_for_timeout(150)
    s = await pg.evaluate(f"({{ sk: RUN.deck.find(c => c.uid == {uid}).sk, total: Object.values(WG.energy).reduce((a, b) => a + b, 0), cost: wEnchCost('star'), upcost: wEnchCost('up') }})")
    check(s['sk'] == 1 and s['total'] == 2 and s['cost'] == 5 and s['upcost'] == 4, 'drilling adds a Practice star for 4 energy, and each price climbs by one', s)
    check(await pg.evaluate("[...document.querySelectorAll('[data-wench]')].every(b => b.disabled)"), 'with 2 energy left nothing is affordable')
    await close_modal(pg)
    g = await pg.evaluate("(() => { WG.energy.tide = 5; RUN.deck.push(mkCard('gr_bat')); const c = RUN.deck[RUN.deck.length - 1]; const r = wEnchant('gear', c); return { r, up: c.up, tide: WG.energy.tide }; })()")
    check(g['r'] == '' and g['up'] is True and g['tide'] == 3, 'recharging gear upgrades a gear card for 2 energy', g)
    check(await pg.evaluate("wEnchant('up', RUN.deck.find(c => c.up)) !== ''"), 'an upgraded card cannot be bound again')

    # ---------- a card vendor ----------
    r = await pg.evaluate("wSay('smith', 'cards')")
    check(r.get('act') == 'cards', 'the Cinderhold smith answers CARDS', r)
    await pg.evaluate("RUN.gold = 1000; wRunAct('cards', 'smith')"); await pg.wait_for_timeout(200)
    st = await pg.evaluate("""(() => { const s = WG.cardShops.smith, R = DB.regions.ember, sp = R.sports.map(x => x[0]);
      return { n: s.cards.length, ware: document.querySelectorAll('#modalBox [data-wbuyc]').length, fit: s.cards.filter(w => { const c = CARDS[w.id]; return sp.includes(c.sport) || R.kinds.includes(c.kind) || sportFits(c).some(x => sp.includes(x)); }).length,
        own: s.cards.every(w => CARDS[w.id].kind === 'any' || runKinds().includes(CARDS[w.id].kind)), prices: s.cards.every(w => Math.abs(w.price - PRICE[CARDS[w.id].rar]) <= PRICE[CARDS[w.id].rar] * .1 + 1) }; })()""")
    check(st['n'] == 5 and st['ware'] == 5 and st['fit'] >= 4 and st['own'] and st['prices'], 'the smith sells 5 cards at Sudden Death prices, mostly for Cindermaw sports and kinds, all playable', st)
    await pg.screenshot(path='/tmp/realm-town-cardshop-desk.png')
    b0 = await pg.evaluate("({ deck: RUN.deck.length, gold: RUN.gold, id: WG.cardShops.smith.cards[0].id, price: WG.cardShops.smith.cards[0].price })")
    await pg.click('#modalBox [data-wbuyc="0"]'); await pg.wait_for_timeout(150)
    b1 = await pg.evaluate("({ deck: RUN.deck.length, gold: RUN.gold, last: RUN.deck[RUN.deck.length - 1].id, sold: WG.cardShops.smith.cards[0].sold })")
    check(b1['deck'] == b0['deck'] + 1 and b1['gold'] == b0['gold'] - b0['price'] and b1['last'] == b0['id'] and b1['sold'], 'buying a card puts it in the deck and takes its price', [b0, b1])
    rc = await pg.evaluate('RUN.removeCost')
    await pg.click('#wRemove'); await pg.wait_for_timeout(150)
    await pg.click('#modalBox .cardgrid .card'); await pg.wait_for_timeout(150)
    b2 = await pg.evaluate("({ deck: RUN.deck.length, gold: RUN.gold, rc: RUN.removeCost, removed: WG.cardShops.smith.removed, dis: document.getElementById('wRemove').disabled })")
    check(b2['deck'] == b1['deck'] - 1 and b2['gold'] == b1['gold'] - rc and b2['rc'] == rc + 25 and b2['removed'] and b2['dis'], 'trading a card away removes it, costs removeCost (which rises by 25), once a week', b2)
    await close_modal(pg)
    wk = await pg.evaluate("(() => { const a = JSON.stringify(WG.cardShops.smith.cards), w = WG.cardShops.smith.week; WG.dayAbs += 7; const s = wShopStock('smith'); return { week: [w, s.week], same: JSON.stringify(s.cards) === a, removed: s.removed, sold: s.cards.some(c => c.sold) }; })()")
    check(wk['week'][1] == wk['week'][0] + 1 and not wk['removed'] and not wk['sold'], 'a week later the stock has turned over (new week, nothing sold, a trade available)', wk)
    await pg.evaluate("wRunAct('cards', 'hq_shop')"); await pg.wait_for_timeout(150)
    check(await pg.evaluate("document.querySelectorAll('#modalBox [data-wbuyc]').length === 5"), 'Odd Lots in Graftonbury sells cards too')
    await close_modal(pg)

    # ---------- every seeded card find pays ----------
    finds = await pg.evaluate("""(() => { const out = [];
      const chests = { cottage_chest: 'plains', genevault_c3: 'plains', shrine_chest: 'bloom', marigold_chest: 'tide', hatchery_c3: 'tide', emberdeep_c3: 'ember', chapel_chest: 'rime' };
      const topics = [['clerk', 'licence', 'plains', {}], ['brack', 'honey', 'bloom', { grain: 2 }], ['smith', 'peppers', 'ember', { emberpepper: 2 }], ['monk', 'mint', 'rime', { frostmint: 2 }]];
      const pay = () => { if (WG.cardOffer) { const c = WG.cardOffer.list[0]; WG.cardOffer = null; document.getElementById('modal').hidden = true; wGainCard({ id: c.id, up: c.up }, 'test'); return 'choice:' + c.id; } return 'card'; };
      for (const id in chests) { const d0 = RUN.deck.length; WG.cardOffer = null; wGiveLoot(DB.chests[id]); const offered = WG.cardOffer ? WG.cardOffer.list.length : 0; const how = pay(); out.push({ src: id, region: chests[id], offered, gained: RUN.deck.length - d0, how }); }
      for (const [ch, k, region, give] of topics) { for (const i in give) WG.items[i] = (WG.items[i] || 0) + give[i]; const d0 = RUN.deck.length; WG.cardOffer = null; const t = DB.chars[ch].topics[k]; if (t.once) delete WG.flags[t.once]; wSay(ch, k); const offered = WG.cardOffer ? WG.cardOffer.list.length : 0; const how = pay(); out.push({ src: ch + '.' + k, region, offered, gained: RUN.deck.length - d0, how }); }
      return out; })()""")
    for f in finds:
        check(f['gained'] == 1 and (f['offered'] in (0, 3)), f"card find {f['src']} ({f['region']}) pays a card", f)
    regs = {f['region'] for f in finds if f['gained'] == 1}
    check(regs == {'plains', 'bloom', 'tide', 'ember', 'rime'}, 'every region has a card find', sorted(regs))
    pool = await pg.evaluate("DB.chests.marigold_chest.cardChoice.pool.every(id => ['bowling', 'curling'].includes(CARDS[id].sport) && CARDS[id].kind === 'any')")
    check(pool, 'the Marigold wreck pays bowling and curling cards (league cards anyone can play)')

    # ---------- the save keeps meals, energy and stock ----------
    keep = await pg.evaluate("(() => { WG.pantry = { feast: 2 }; WG.meal = 'chili'; WG.charm = 'fortune'; WG.energy = { ember: 4, bloom: 1, tide: 0, rime: 2, aether: 3 }; wShopStock('netter'); wSave(); return JSON.stringify([WG.pantry, WG.meal, WG.charm, WG.energy, WG.cardShops, WG.enchUsed]); })()")
    await pg.reload(); await pg.wait_for_timeout(800)
    await pg.click('#bResume'); await pg.wait_for_timeout(500)
    got = await pg.evaluate("JSON.stringify([WG.pantry, WG.meal, WG.charm, WG.energy, WG.cardShops, WG.enchUsed])")
    check(got == keep, 'save and reload keep the pantry, the meal, the fortune, energy, shop stock and enchanter prices', [keep[:200], got[:200]])
    await pg.add_script_tag(content=HELP); await pg.evaluate(NOTIPS)
    await pg.evaluate("__kick()"); await pg.wait_for_timeout(300)
    check(await pg.evaluate("JSON.stringify(B.wMeal) === JSON.stringify(['chili', 'fortune']) && (B.P.st.str || 0) >= 2"), 'after a reload the saved meal still acts at kickoff')
    await finish(pg)

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
            if tag == 'desk':
                await desk_checks(pg)
            else:
                await pg.evaluate("WG.items.mossberry = 2; WG.items.grain = 1; WG.pantry = { hash: 1 }; wRunAct('meals', 'hq_inn')"); await pg.wait_for_timeout(250)
                await pg.screenshot(path='/tmp/realm-town-meals-phone.png'); await close_modal(pg)
                await pg.evaluate("WG.energy.ember = 6; wRunAct('enchant', 'quill')"); await pg.wait_for_timeout(250)
                await pg.screenshot(path='/tmp/realm-town-enchanter-phone.png'); await close_modal(pg)
                await pg.evaluate("RUN.gold = 300; wRunAct('cards', 'netter')"); await pg.wait_for_timeout(250)
                await pg.screenshot(path='/tmp/realm-town-cardshop-phone.png'); await close_modal(pg)
                await pg.evaluate("wEnterMap('world', 48, 40); WG.min = 12 * 60; startMatch({ type: 'normal', tier: 1, world: { kind: 'wild' } }); wDrain()"); await pg.wait_for_timeout(300)
                check(await pg.evaluate("!!document.querySelector('#modalBox [data-wpge]')"), '[phone] the pre-game card offers a bite from the pantry')
                await pg.screenshot(path='/tmp/realm-town-pregame-meal-phone.png')
                await pg.click('#modalBox [data-wpge]'); await pg.wait_for_timeout(100)
                check(await pg.evaluate("WG.meal === 'hash' && document.getElementById('wPgMeal').textContent.includes('Trail Hash')"), '[phone] eating from the pre-game card sets the meal')
            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm town passed')

asyncio.run(main())
