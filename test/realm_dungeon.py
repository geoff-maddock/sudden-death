# Realm phase 5, dungeons and magic gear: the door refuses without cups or the key and opens with them; a room's
# famous team plays an elite match with a scouting report; winning it marks the room beaten, and that survives a
# save and reload; the alpha waits for every room, then plays as a Sudden Death boss; the prize strongbox drops a
# trophy and a gear card, a deep prize a pick of Hall of Fame legends; a lair's alpha is a boss and pays on a win.
# Waits on state, not fixed sleeps. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-dungeon-*.png
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
// stand just outside a room, on a walkable tile, and return the step that walks in
window.__doorOf = function (R) { const m = MAPS[R.dg];
  for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
    if (wTileAt(m, x, y) !== 'g') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ox = x + dx, oy = y + dy, c = wTileAt(m, ox, oy);
      if (c === 'g' && !wRoomAt(R.dg, ox, oy)) { wEnterMap(R.dg, ox, oy); WG.grace = 0; return [-dx, -dy]; } } }
  return null; };
// stand next to a tile of a map and return its position
window.__beside = function (mapId, pred) { const m = MAPS[mapId];
  for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (!pred(m.t[y][x], m.meta[k])) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = wTileAt(m, x + dx, y + dy); if (c && DB.tiles[c].walk && !DB.tiles[c].enter) { wEnterMap(mapId, x + dx, y + dy); WG.grace = 0; return [x, y]; } } }
  return null; };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"
LAST = "WLOG.slice(-4).map(l => l[0]).join(' | ')"

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof W_DUNGEON !== 'undefined' && !!document.getElementById('bNew')")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew')
    await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes'); await pg.wait_for_function("!!document.getElementById('wGo')")
    await pg.click('#wGo')
    await pg.wait_for_function("!!WG && UI.view === 'world'")

async def modal_text(pg):
    return await pg.evaluate("document.getElementById('modal').hidden ? null : document.getElementById('modalBox').textContent")

async def win_and_continue(pg):
    # renown (cups and bosses behind you) makes these teams tough; the checks are about the dungeon, not the fight
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 600); RUN.hp = RUN.maxhp; for (const e of alive()) e.hp = Math.min(e.hp, 6)")
    over = await pg.evaluate('__wbot(120)')
    await pg.evaluate('__wend()')
    await pg.wait_for_function("!!document.getElementById('bCont')")
    await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending")
    # level-ups and card picks queued by the win: set them aside
    await pg.evaluate("WG.cardOffer = null; WG.wprompts = []; document.getElementById('modal').hidden = true")
    return over

async def gate_checks(pg):
    await pg.evaluate("for (const f of ['cup_moss', 'cup_salt', 'cup_cind', 'cup_rime']) delete WG.flags[f]; delete WG.items.keycard")
    async def knock(loc):
        return await pg.evaluate(f"""(() => {{ const L = DB.locs.find(l => l.id === '{loc}'); wEnterMap('world', L.x, L.y + 1); WG.grace = 99;
          wTryMove(0, -1); return {{ map: WG.map, log: {LAST} }}; }})()""")
    r = await knock('hatchery')
    check(r['map'] == 'world' and '1 cup won (you have 0)' in r['log'], 'the Hatchery door refuses with no cups, and says what it wants', r)
    await pg.evaluate("wSetFlag('cup_moss'); wSetFlag('cup_salt')")  # phase 6 sets these; tests only
    r = await knock('genevault')
    check(r['map'] == 'world' and 'Vault Keycard' in r['log'].split('|')[-1] and 'cups won' not in r['log'].split('|')[-1], 'the Sealed Vault with two cups but no keycard asks for the keycard only', r)
    await pg.evaluate("delete WG.flags.cup_salt; wAddItem('keycard', 1)")
    r = await knock('genevault')
    check(r['map'] == 'world' and '2 cups won (you have 1)' in r['log'], 'the Sealed Vault with the keycard but one cup asks for two cups', r)
    await pg.evaluate("wSetFlag('cup_salt')")
    r = await knock('genevault')
    check(r['map'] == 'genevault' and 'rooms still hold famous teams' in r['log'], 'with two cups and the keycard the Sealed Vault opens, and says what is inside', r)
    r = await knock('hatchery')
    check(r['map'] == 'hatchery', 'the Hatchery opens with a cup', r)
    rooms = await pg.evaluate("Object.fromEntries(DB.dungeons.map(d => [d.id, wDungeonRooms(d.id).map(r => r.flag)]))")
    check(all(len(v) >= 3 for v in rooms.values()), 'every dungeon has at least three famous-team rooms', rooms)
    return rooms

async def room_checks(pg):
    step = await pg.evaluate("__doorOf(wDungeonRooms('hatchery')[0])")
    check(step is not None, 'found the way into the first Hatchery room')
    team = await pg.evaluate("wDungeonRooms('hatchery')[0].team")
    await pg.evaluate(f"wTryMove({step[0]}, {step[1]}); wDrain()")
    await pg.wait_for_function("!document.getElementById('modal').hidden && !!document.getElementById('wPlay')")
    txt = await modal_text(pg)
    check(team['name'] in txt and 'Famous team' in txt and 'room 1 of 3' in txt and 'Scouting report' in txt, 'walking into a room meets its famous team: the card names them and their scouting report', txt[:400])
    await pg.screenshot(path='/tmp/realm-dungeon-room.png')
    await pg.click('#wPlay')
    await pg.wait_for_function("UI.view === 'fight' && !!B && !!RUN.pending")
    st = await pg.evaluate("({ kind: RUN.pending.world.kind, ref: RUN.pending.world.ref, type: B.type, trait: B.trait, team: B.enemies[0].team && B.enemies[0].team.short, act: RUN.act })")
    check(st['kind'] == 'room' and st['type'] == 'elite' and st['trait'] and st['team'] == team['short'] and st['act'] == 1, 'the room plays an elite match with a trait, in the famous team colours, at tier 2', st)
    over = await win_and_continue(pg)
    check(over == 'win', 'the room match is won', over)
    r = await pg.evaluate(f"({{ flag: wFlag('room_hatchery_1'), left: wRoomsLeft('hatchery').length, log: WLOG.map(l => l[0]).join(' | ') }})")
    check(r['flag'] and r['left'] == 2 and 'Room 1 is yours' in r['log'], 'winning marks the room beaten', r)
    # the save is plain JSON and keeps it
    await pg.evaluate("wSave()")
    js = await pg.evaluate("(() => { const s = localStorage.getItem(wSaveKey()); return JSON.stringify(JSON.parse(s)) === s; })()")
    check(js, 'the save is plain JSON')
    await pg.reload()
    await pg.wait_for_function("!!document.getElementById('bResume')")
    await pg.click('#bResume')
    await pg.wait_for_function("!!WG && UI.view === 'world'")
    await pg.add_script_tag(content=HELP); await pg.evaluate(NOTIPS)
    await pg.evaluate("document.getElementById('modal').hidden = true")
    r = await pg.evaluate("({ flag: wFlag('room_hatchery_1'), left: wRoomsLeft('hatchery').length })")
    check(r['flag'] and r['left'] == 2, 'the beaten room survives a save and reload', r)
    # walking back in: no match
    step = await pg.evaluate("__doorOf(wDungeonRooms('hatchery')[0])")
    # no wild pickup game on this step (dungeons roll them too), so only the room could start a match
    await pg.evaluate(f"const m0 = W_ENC.mult; W_ENC.mult = 0; wTryMove({step[0]}, {step[1]}); wDrain(); W_ENC.mult = m0")
    check(await pg.evaluate("document.getElementById('modal').hidden && !RUN.pending && UI.view === 'world'"), 'walking into a beaten room starts nothing', await pg.evaluate("({m: document.getElementById('modal').hidden ? null : document.getElementById('modal').innerText.slice(0,300), p: !!RUN.pending, v: UI.view, ev: WG.event, co: !!WG.cardOffer, pr: WG.wprompts})"))
    # a deeper room: forced perk and stakes reach the match
    await pg.evaluate("const R = wDungeonRooms('hatchery')[2]; __doorOf(R); wStartRoom(R, { card: false, perk: 'ace', stakes: 'wager', trait: 'armored' })")
    await pg.wait_for_function("UI.view === 'fight' && !!B")
    st = await pg.evaluate("({ sp: B.sp, stakes: B.stakes, trait: B.trait, lv: RUN.pending.world.lv, why: RUN.pending.world.lvWhy })")
    check(st['sp'] and st['stakes'] == 'wager' and st['trait'] == 'armored' and st['lv'] >= 1 and any('room 3' in w for w in st['why']), 'a deep room carries a sport perk, high stakes and a depth level', st)
    await win_and_continue(pg)

async def alpha_checks(pg, rooms):
    a = await pg.evaluate("__beside('hatchery', (c, m) => c === 'M')")
    check(a is not None, 'found the Hatch-Mother')
    await pg.evaluate(f"wUse({a[0]}, {a[1]}); wDrain()")
    r = await pg.evaluate(f"({{ open: !document.getElementById('modal').hidden, pending: !!RUN.pending, log: {LAST} }})")
    check(not r['open'] and 'beaten every room' in r['log'], 'the alpha will not play until every room is beaten', r)
    await pg.evaluate("for (const R of wDungeonRooms('hatchery')) wSetFlag(R.flag)")
    await pg.evaluate(f"wUse({a[0]}, {a[1]}); wDrain()")
    await pg.wait_for_function("!document.getElementById('modal').hidden && !!document.getElementById('wPlay')")
    txt = await modal_text(pg)
    check('Hatch-Mother' in txt and 'Sudden Death boss' in txt, 'the alpha card names the Hatch-Mother as a Sudden Death boss', txt[:300])
    await pg.click('#wPlay')
    await pg.wait_for_function("UI.view === 'fight' && !!B")
    st = await pg.evaluate("({ type: B.type, boss: B.enemies.filter(isBoss).map(e => [e.id, e.n]), act: RUN.act })")
    check(st['type'] == 'boss' and st['boss'] and st['boss'][0][0] == 'cube' and 'Hatch-Mother' in st['boss'][0][1] and st['act'] == 1, 'the Hatch-Mother is the Gelatinous Cube boss at tier 2, under her own name', st)
    over = await win_and_continue(pg)
    check(over == 'win' and await pg.evaluate("wFlag('alpha_hatchmother')"), 'the boss is beaten and the alpha flagged', over)
    # the prize: a trophy and a gear card
    c = await pg.evaluate("__beside('hatchery', (ch, m) => m.chest === 'hatchery_prize')")
    b0 = await pg.evaluate("({ relics: RUN.relics.slice(), gear: RUN.deck.filter(c => /^gr_/.test(c.id)).length, gold: RUN.gold })")
    await pg.evaluate(f"wUse({c[0]}, {c[1]}); wDrain()")
    b1 = await pg.evaluate("({ relics: RUN.relics.slice(), gear: RUN.deck.filter(c => /^gr_/.test(c.id)).length, gold: RUN.gold, log: WLOG.slice(-6).map(l => l[0]).join(' | ') })")
    check(len(b1['relics']) == len(b0['relics']) + 1 and b1['gear'] == b0['gear'] + 1 and b1['gold'] > b0['gold'] and 'Magic gear' in b1['log'], 'the prize strongbox pays gold, a trophy and a gear card', [b0, b1])
    # a deep prize: a pick of Hall of Fame legends
    await pg.evaluate("WG.cardOffer = null; wMagicDrop(W_MAGIC.genevault_prize, 'test')")
    await pg.wait_for_function("!!WG.cardOffer && document.querySelectorAll('#modalBox [data-wco]').length === 3")
    rars = await pg.evaluate("WG.cardOffer.list.map(c => CARDS[c.id].rar)")
    check(rars == ['l', 'l', 'l'], 'a deep prize offers a pick of three Hall of Fame legends', rars)
    await pg.screenshot(path='/tmp/realm-dungeon-legends.png')
    n0 = await pg.evaluate("RUN.deck.filter(c => CARDS[c.id].rar === 'l').length")
    await pg.click('#modalBox [data-wco="0"]')
    await pg.wait_for_function(f"RUN.deck.filter(c => CARDS[c.id].rar === 'l').length === {n0 + 1}")
    check(True, 'picking one puts the legend in the deck')

async def lair_checks(pg):
    r = await pg.evaluate("""(() => { for (const f of ['cup_moss', 'cup_salt', 'cup_cind', 'cup_rime']) delete WG.flags[f];
      const L = DB.locs.find(l => l.id === 'auroraroost'); wEnterMap('world', L.x, L.y + 1); WG.grace = 99; document.getElementById('modal').hidden = true;
      wUse(L.x, L.y); return { open: !document.getElementById('modal').hidden, log: WLOG.slice(-2).map(l => l[0]).join(' | ') }; })()""")
    check(not r['open'] and 'Aurora Roost is shut to you' in r['log'], 'the Aurora Roost wants a cup first', r)
    await pg.evaluate("wSetFlag('cup_rime'); const L = DB.locs.find(l => l.id === 'auroraroost'); wUse(L.x, L.y); wDrain()")
    await pg.wait_for_function("!document.getElementById('modal').hidden && !!document.getElementById('wPlay')")
    txt = await modal_text(pg)
    check('Aurora Matriarch' in txt and 'Sudden Death boss' in txt, 'the Aurora Matriarch is a Sudden Death boss', txt[:300])
    await pg.click('#wNotYet')
    await pg.wait_for_function("document.getElementById('modal').hidden")
    # the lair win pays from W_MAGIC (driven through the end handler, which the match calls by name)
    r0 = await pg.evaluate("RUN.relics.length")
    await pg.evaluate("WG.cardOffer = null; W_ON_END.lair('win', { alpha: 'grove', loc: 'eldergrove' }, { name: 'The Elder of the Grove' })")
    await pg.wait_for_function("!!WG.cardOffer")
    r = await pg.evaluate(f"({{ flag: wFlag('alpha_grove'), relics: RUN.relics.length, offer: WG.cardOffer.list.map(c => CARDS[c.id].rar) }})")
    check(r['flag'] and r['relics'] == r0 + 1 and all(x == 'l' for x in r['offer']), 'a lair win flags the alpha and pays a trophy and a pick of legends', r)
    await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
    bosses = await pg.evaluate("Object.fromEntries(Object.keys(DB.alphas).map(a => [a, W_ALPHA_BOSS[a] && ENEMIES[W_ALPHA_BOSS[a].boss] && ENEMIES[W_ALPHA_BOSS[a].boss].boss ? W_ALPHA_BOSS[a].tier : null]))")
    check(all(bosses.values()) and bosses['vaultwarden'] == 3 and bosses['seamwyrm'] == 3, 'every alpha has a Sudden Death boss; the deep ones are tier 3', bosses)

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page()
        pg.set_default_timeout(30000)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await boot(pg, clear=True)
        await new_journey(pg)
        rooms = await gate_checks(pg)
        await room_checks(pg)
        await alpha_checks(pg, rooms)
        await lair_checks(pg)
        await pg.evaluate("showPage('help')")
        check(await pg.evaluate("!!document.getElementById('wHelp5') && ['Dungeons', 'Getting in', 'Magic gear'].every(s => document.getElementById('wHelp5').textContent.includes(s))"), 'How to play explains dungeons, gates and magic gear')
        await pg.evaluate("showPage('play')")
        audit = await pg.evaluate('wAudit()')
        check(audit == [], 'wAudit is clean', audit)
        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm dungeon passed')

asyncio.run(main())
