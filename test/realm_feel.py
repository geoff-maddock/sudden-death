# Realm phase 8, the feel: region, town, dungeon and night themes (what musicWanted asks for, not the audio), a
# realm match's theme (bosses keep Sudden Death's), realm coach's tips (once each, never in LAB), realm achievements
# (cups, alphas, the Crown, recruits, renown, regions), the Crown win in the record book with the save intact,
# salves and trail rations (what they heal, what they cost, the Bag tab), and the How to play section.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-feel-*.png.
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

HELP = r'''
window.__wspot = function (rg, road) { const m = MAPS.world, hq = DB.locs.find(l => l.id === 'graftonbury'); let best = null, bd = 1e9;
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== rg) continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (!(td && td.walk && !td.enter)) continue;
    if (road ? (c !== '=' && c !== 'b') : (c === '=' || c === 'b')) continue;
    const d = Math.hypot(x - hq.x, y - hq.y); if (d < bd) { bd = d; best = [x, y]; } } return best; };
window.__go = function (rg, hour, road) { const p = __wspot(rg, road); wEnterMap('world', p[0], p[1]); WG.min = (hour == null ? 12 : hour) * 60; WG.grace = 99; wDrain(); return p; };
window.__wbot = function (maxTurns) {
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
window.__closeAll = function () { WG.wprompts = []; WG.cardOffer = null; let n = 0;
  while (!document.getElementById('modal').hidden && n++ < 8) (document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox #wWake') || document.querySelector('#modalBox #wNotYet') || document.getElementById('modal')).click();
  WG.wprompts = []; WG.cardOffer = null; return document.getElementById('modal').hidden; };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS)); tipQ.length = 0; if (document.getElementById('coach')) document.getElementById('coach').hidden = true"
T = 30000

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wStart === 'function' && !!document.getElementById('bNew')", timeout=T)
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew')
    await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')", timeout=T)
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo', timeout=T)
    await pg.click('#wGo')
    await pg.wait_for_function("WG && RUN && UI.view === 'world'", timeout=T)
    await pg.evaluate(NOTIPS)

async def music_checks(pg):
    th = await pg.evaluate("""Object.keys(THEMES).filter(k => k.startsWith('w_')).map(k => { const t = THEMES[k];
      return { k, ok: t.mel.length === 64 && t.prog.length === 4 && !!SCALES[t.scale] && t.bassPat.length === 16 && ['k', 's', 'h'].every(d => t.drums[d].length === 16) && t.bpm > 0 && t.root > 20 && !!t.name }; })""")
    check(len(th) >= 7 and all(t['ok'] for t in th), f'{len(th)} realm themes, in Sudden Death\'s theme format', th)
    w = await pg.evaluate("""(() => { const o = {};
      for (const r of ['plains', 'bloom', 'tide', 'ember', 'rime']) { __go(r, 12); o[r] = musicWanted(); }
      __go('plains', 23, false); o.night = musicWanted();
      __go('plains', 23, true); o.nightRoad = musicWanted();
      const g = MAPS.graftonbury; wEnterMap('graftonbury', g.spawn[0], g.spawn[1]); o.town = musicWanted();
      const h = MAPS.hatchery; wEnterMap('hatchery', h.spawn[0], h.spawn[1]); o.dungeon = musicWanted(); o.want = MUS.want;
      return o; })()""")
    for r in ['plains', 'bloom', 'tide', 'ember', 'rime']:
        check(w[r] == ['w_' + r, 'calm'], f'the world view in {r} plays its region theme, calm', w[r])
    check(w['night'] == ['w_night', 'calm'] and w['nightRoad'] == ['w_plains', 'calm'], 'off the road at night: the night theme; on the road: the region\'s', [w['night'], w['nightRoad']])
    check(w['town'][0] == 'w_town' and w['dungeon'][0] == 'w_dungeon' and w['want'] == 'w_dungeon', 'a town and a dungeon have their own themes (MUS.want follows)', w)

    # a realm match: the region's theme in fight mode
    await pg.evaluate("__go('ember', 12); startMatch({ type: 'normal', card: false, world: { kind: 'wild' } })")
    await pg.wait_for_function("B && !B.over && UI.view === 'fight' && B.phase === 'player'", timeout=T)
    m = await pg.evaluate("""(() => { const o = { wild: musicWanted() }; const t0 = B.type; B.type = 'boss'; o.boss = musicWanted(); B.type = t0;
      o.room = wMusicMatch({ kind: 'room', region: 'tide', map: 'hatchery' }); o.cup = wMusicMatch({ kind: 'cup', region: 'rime', map: 'world' }); return o; })()""")
    check(m['wild'][0] == 'w_ember' and m['wild'][1] in ('fight', 'hype'), 'a wild match in the Cindermaw plays the Cindermaw theme, in fight mode', m)
    check(m['boss'][0].startswith('act'), 'a boss keeps Sudden Death\'s act theme', m)
    check(m['room'] == 'w_dungeon' and m['cup'] == 'w_rime', 'a dungeon room plays the dungeon theme; a cup its region\'s', m)
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; __wbot(80); consumeFx(); renderFightHUD(); finishFight()")
    await pg.wait_for_selector('#bCont', timeout=T)
    await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending", timeout=T)
    await pg.evaluate("__closeAll()")
    lab = await pg.evaluate("(() => { LAB = true; const t = MUS.timer; musicSet('w_plains', 'calm'); const o = MUS.timer === null || MUS.timer === t; LAB = false; return o && !MUS.timer; })()")
    check(lab, 'no music in LAB')

async def tip_checks(pg):
    ids = await pg.evaluate("Object.keys(TIPS).filter(k => k.startsWith('w_'))")
    check(len(ids) >= 9 and await pg.evaluate("Object.keys(TIPS).filter(k => k.startsWith('w_')).every(k => TIPS[k].length === 2 && TIPS[k][0] && TIPS[k][1].length < 260)"), f'{len(ids)} realm tips, each a title and a short line', ids)
    for need in ['w_walk', 'w_wild', 'w_blackout', 'w_level', 'w_recruit', 'w_cup', 'w_door', 'w_renown', 'w_champ']:
        check(need in ids, f'a tip for {need}')
    # tips on: the first walk
    await pg.evaluate("__go('plains', 12); RUN.hp = RUN.maxhp; WG.blackouts = 0; WG.day = 1; SET.tips = true; TIPS_SEEN.length = 0; tipQ.length = 0; wFeelTips()")
    await pg.wait_for_function("!document.getElementById('coach').hidden", timeout=T)
    c = await pg.evaluate("({ q: tipQ.slice(), txt: document.getElementById('coach').textContent })")
    check(c['q'][:1] == ['w_walk'] and 'The realm' in c['txt'], 'the first walk shows the realm tip', c)
    await pg.screenshot(path='/tmp/realm-feel-tip.png')
    await pg.click('#cOk')
    await pg.wait_for_function("TIPS_SEEN.includes('w_walk')", timeout=T)
    again = await pg.evaluate("wFeelTips(); tipQ.includes('w_walk')")
    check(not again, 'the walk tip shows once, then never again')
    persisted = await pg.evaluate("JSON.parse(localStorage.getItem(pkey('sd-tips')) || '[]').includes('w_walk')")
    check(persisted, 'a seen tip is kept for the profile')
    # a shut dungeon door
    await pg.evaluate("tipQ.length = 0; document.getElementById('coach').hidden = true")
    door = await pg.evaluate("(() => { const g = wGateCheck('genevault'); return { ok: g.ok, q: tipQ.slice() }; })()")
    check(not door['ok'] and 'w_door' in door['q'], 'a shut dungeon door queues its tip', door)
    # never in LAB
    lab = await pg.evaluate("""(() => { tipQ.length = 0; TIPS_SEEN.length = 0; document.getElementById('coach').hidden = true; LAB = true;
      WG.blackouts = 1; WG.cup = { id: 'moss', round: 0 }; wFeelTips(); wGateCheck('genevault'); tip('w_walk'); const q = tipQ.slice(); LAB = false; WG.cup = null; WG.blackouts = 0; return q; })()""")
    check(lab == [], 'no tips in LAB', lab)
    await pg.evaluate(NOTIPS)

async def ach_checks(pg):
    a0 = await pg.evaluate("JSON.parse(JSON.stringify(ACHS.stats))")
    ids = await pg.evaluate("ACH.map(a => a.id)")
    check(all(i in ids for i in ['cups', 'bosses', 'potg']) and all(i in ids for i in ['w_cups', 'w_alphas', 'w_crown', 'w_scout', 'w_renown', 'w_regions']), 'realm ladders join Sudden Death\'s medals, which stay', ids)
    # regions visited: counted as you walk
    for r in ['plains', 'bloom', 'tide']:
        await pg.evaluate(f"__go('{r}', 12)")
        await pg.wait_for_function(f"(ACHS.sets.realmRegions || []).includes('{r}')", timeout=T)
    check(True, 'regions visited are counted as you walk')
    # a cup won, an alpha beaten, a player signed
    await pg.evaluate("RUN.gold = 500; wCupWon('moss'); __closeAll()")
    await pg.evaluate("wDispatchEnd({ kind: 'alpha', ref: { alpha: 'hatchmother' }, tier: 2, name: 'The Hatch-Mother' }, 'win'); __closeAll()")
    await pg.evaluate("wAddPlayer(wMakePlayer({ kind: 'goblin' }, 'tavern')); __closeAll()")
    a1 = await pg.evaluate("({ s: ACHS.stats, got: ACHS.got, renown: wRenown() })")
    s, g = a1['s'], a1['got']
    check(s.get('realmCups', 0) == a0.get('realmCups', 0) + 1 and g.get('w_cups') == 0, 'a cup won counts, and earns bronze Silverware', [s.get('realmCups'), g.get('w_cups')])
    check(s.get('realmAlphas', 0) == a0.get('realmAlphas', 0) + 1 and g.get('w_alphas') == 0, 'an alpha beaten counts, and earns bronze Alpha Hunter', [s.get('realmAlphas'), g.get('w_alphas')])
    check(s.get('realmRecruits', 0) == a0.get('realmRecruits', 0) + 1, 'a signed player counts', s.get('realmRecruits'))
    check(s.get('realmRenown', 0) >= a1['renown'] == 2, 'the best renown is kept', [s.get('realmRenown'), a1['renown']])
    # a blackout
    await pg.evaluate("wBlackout({ kind: 'wild', tier: 1, act0: 0 }, 'lose'); __closeAll()")
    check(await pg.evaluate("ACHS.stats.realmBlackouts") == a0.get('realmBlackouts', 0) + 1, 'getting up after a blackout counts')
    # LAB counts nothing
    lab = await pg.evaluate("(() => { const b = JSON.stringify(ACHS.stats); LAB = true; wAchRenown(); achAdd('realmCups', 1); LAB = false; return b === JSON.stringify(ACHS.stats); })()")
    check(lab, 'achievements count nothing in LAB')

async def crown_checks(pg):
    r0 = await pg.evaluate("loadRecords().runs.length")
    c0 = await pg.evaluate("ACHS.stats.realmCrowns || 0")
    await pg.evaluate("__closeAll(); WG.cup = { id: 'crown', round: 2, clubs: [] }; wCupWon('crown'); wReturnToWorld()")
    await pg.wait_for_function("!document.getElementById('scr-end').hidden", timeout=T)
    st = await pg.evaluate("""({ runs: loadRecords().runs.length, top: loadRecords().runs[0], over: RUN.over || null, save: !!localStorage.getItem(wSaveKey()), load: !!wLoadSave(),
      crowns: ACHS.stats.realmCrowns || 0, got: ACHS.got.w_crown, h2: document.querySelector('#scr-end h2').textContent })""")
    top = st['top'] or {}
    check(st['runs'] == r0 + 1 and top.get('result') == 'win' and (top.get('realm') or {}).get('kind') == 'crown', 'the Crown win goes in the record book', {'runs': [r0, st['runs']], 'realm': top.get('realm')})
    check(st['over'] is None and st['save'] and st['load'], 'and the save survives it (RUN not over, the realm save loads)', st)
    check(st['crowns'] == c0 + 1 and st['got'] == 0 and st['h2'] == 'Champions of the realm', 'the Crown counts for Champions of the Realm', st)
    await pg.screenshot(path='/tmp/realm-feel-crown.png')
    await pg.click('#bAgain')
    await pg.wait_for_function("UI.view === 'world' && WG && WG.flags.champion", timeout=T)
    await pg.evaluate("showPage('rec')")
    rec = await pg.evaluate("document.querySelector('#pg-rec .tablewrap table tbody tr').textContent")
    check('Champions of the realm' in rec and 'The realm: year' in rec, 'the record book shows the Crown in realm words', rec[:200])
    await pg.screenshot(path='/tmp/realm-feel-records.png')
    await pg.evaluate("showPage('play')")
    # the journey carries on after a reload
    await pg.evaluate("wSave()")
    await pg.reload()
    await pg.wait_for_function("typeof wStart === 'function' && !!document.getElementById('bResume')", timeout=T)
    await pg.add_script_tag(content=HELP); await pg.evaluate(NOTIPS)
    await pg.click('#bResume')
    await pg.wait_for_function("WG && UI.view === 'world' && WG.flags.champion", timeout=T)
    check(True, 'after the Crown, the journey resumes from the title')
    await pg.evaluate("__closeAll()")

async def bag_checks(pg):
    d = await pg.evaluate("({ salve: DB.items.salve, ration: DB.items.ration, shops: Object.values(DB.shops).map(s => [s.salve, s.ration]) })")
    check('30%' in d['salve']['desc'] and '10 minutes' in d['salve']['desc'] and 'chimera' not in d['salve']['desc'].lower(), 'the salve says what it does', d['salve']['desc'])
    check(d['ration']['name'] == 'Trail Ration' and '15%' in d['ration']['desc'] and '2 hours' in d['ration']['desc'] and 'drill' not in d['ration']['desc'].lower(), 'the trail ration says what it does', d['ration'])
    r = await pg.evaluate("""(() => { const g = MAPS.graftonbury; wEnterMap('world', ...__wspot('plains', true)); WG.min = 12 * 60; RUN.hp = Math.max(1, RUN.maxhp - 200); WG.items.salve = 1; WG.items.ration = 1;
      const t = () => WG.dayAbs * 1440 + WG.min, o = { max: RUN.maxhp };
      let a = { hp: RUN.hp, t: t() }; o.salve = wUseItem('salve'); o.sHeal = RUN.hp - a.hp; o.sMin = t() - a.t; o.sLeft = WG.items.salve || 0;
      a = { hp: RUN.hp, t: t() }; o.ration = wUseItem('ration'); o.rHeal = RUN.hp - a.hp; o.rMin = t() - a.t; o.rLeft = WG.items.ration || 0;
      o.none = wUseItem('salve'); WG.items.salve = 1; const hp = RUN.hp; RUN.hp = RUN.maxhp; o.full = wUseItem('salve'); RUN.hp = hp;
      o.saved = JSON.parse(localStorage.getItem(wSaveKey())).WG.items.ration || 0;
      return o; })()""")
    check(r['salve'] == '' and r['sHeal'] == -(-r['max'] * 3 // 10) and r['sMin'] == 10 and r['sLeft'] == 0, 'a salve heals 30% of max HP in 10 minutes, and is used up', r)
    check(r['ration'] == '' and r['rHeal'] == -(-r['max'] * 15 // 100) and r['rMin'] == 120 and r['rLeft'] == 0 and r['saved'] == 0, 'a trail ration rests 2 hours and heals 15% of max HP, and is used up (and saved)', r)
    check('no Salve' in r['none'] and 'full health' in r['full'], 'with none, or at full health, it says why not', r)
    # what they cost: the shop takes the listed price
    buy = await pg.evaluate("(() => { RUN.gold = 100; const g0 = RUN.gold, n0 = WG.items.ration || 0; const e = wBuy('general', 'ration'); return { e, paid: g0 - RUN.gold, got: (WG.items.ration || 0) - n0, price: DB.shops.general.ration }; })()")
    check(buy['e'] == '' and buy['paid'] == buy['price'] == 12 and buy['got'] == 1, 'a trail ration costs 12 gold at the shop', buy)
    # the Bag tab
    await pg.evaluate("RUN.hp = Math.max(1, RUN.maxhp - 100); WG.items.salve = 2; wOpenCamp()")
    await pg.wait_for_selector('#modalBox [data-ctab="bag"]', timeout=T)
    await pg.click('#modalBox [data-ctab="bag"]')
    await pg.wait_for_selector('#modalBox [data-wuse="salve"]', timeout=T)
    await pg.screenshot(path='/tmp/realm-feel-bag.png')
    hp0 = await pg.evaluate("RUN.hp")
    await pg.click('#modalBox [data-wuse="salve"]')
    await pg.wait_for_function(f"RUN.hp > {hp0} && WG.items.salve === 1", timeout=T)
    check(await pg.evaluate("!!document.querySelector('#modalBox .wbag') && document.querySelector('#modalBox [data-ctab=\"bag\"]').getAttribute('aria-pressed') === 'true'"), 'the Bag tab on the Team screen uses a salve')
    await pg.evaluate("__closeAll()")
    # not during a match
    await pg.evaluate("startMatch({ type: 'normal', card: false, world: { kind: 'wild' } })")
    await pg.wait_for_function("B && !B.over && UI.view === 'fight'", timeout=T)
    check('Not during a match' in await pg.evaluate("wUseItem('salve')"), 'no salves during a match')
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; __wbot(80); consumeFx(); renderFightHUD(); finishFight()")
    await pg.wait_for_selector('#bCont', timeout=T)
    await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending", timeout=T)
    await pg.evaluate("__closeAll()")

async def help_checks(pg):
    await pg.evaluate("showPage('help')")
    h = await pg.evaluate("document.getElementById('wHelpFeel') ? document.getElementById('wHelpFeel').textContent : ''")
    check(all(s in h for s in ['Salve', 'Trail Ration', '30%', '15%', 'Music', 'Crown']) and await pg.evaluate("document.getElementById('wHelpFeel').closest('#wHelp') !== null"), 'How to play has the bag, music and medals', h[:300])
    await pg.evaluate("showPage('play')")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await boot(pg, clear=True)
        await new_journey(pg)
        await music_checks(pg)
        await tip_checks(pg)
        await ach_checks(pg)
        await bag_checks(pg)
        await help_checks(pg)
        await crown_checks(pg)
        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm feel passed')

asyncio.run(main())
