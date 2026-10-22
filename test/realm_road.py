# Realm phase 4, the road: tiers and levels (region, distance, cups, night), region-flavoured wild teams, the easy
# pool per tier, season goals off, a forced night ambush (on the pre-game card, and the other team really starts
# ahead), energy for a win, every kept road event opened with every choice resolved and its effect applied, an event
# that leads to a match and comes back, and an event rolled from the encounter hook. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-road-*.png at 1280x800 and 390x844.
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
window.__wspot = function (rg, far) { const m = MAPS.world, hq = DB.locs.find(l => l.id === 'graftonbury'); let best = null, bd = far ? -1 : 1e9;
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== rg) continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (!(td && td.walk && !td.enter && c !== "=" && c !== "b")) continue;
    const d = Math.hypot(x - hq.x, y - hq.y); if (far ? d > bd : d < bd) { bd = d; best = [x, y]; } } return best; };
window.__go = function (rg, far, hour) { const p = __wspot(rg, far); wEnterMap('world', p[0], p[1]); WG.min = (hour == null ? 12 : hour) * 60; WG.grace = 0; wDrain(); return p; };
window.__snap = function () { return { gold: RUN.gold, fans: RUN.fans || 0, items: Object.assign({}, WG.items), en: Object.values(WG.energy).reduce((a, b) => a + b, 0),
  pantry: Object.assign({}, WG.pantry || {}), charm: WG.charm || null, hp: RUN.hp, min: WG.dayAbs * 1440 + WG.min, sk: RUN.deck.filter(c => c.sk).length, up: RUN.deck.filter(c => c.up).length }; };
// did a choice do what its data says? returns a list of problems
window.__effOk = function (c, a, b) { const P = [], k = c.cost || {};
  const gain = Array.isArray(c.gold) ? c.gold : c.gold ? [c.gold, c.gold] : [0, 0], dg = b.gold - a.gold;
  if (!(dg >= gain[0] - (k.gold || 0) && dg <= gain[1] - (k.gold || 0))) P.push('gold ' + dg);
  if ((b.fans - a.fans) !== (c.fans || 0)) P.push('fans ' + (b.fans - a.fans));
  for (const i in c.items || {}) if ((b.items[i] || 0) - (a.items[i] || 0) !== c.items[i] - ((k.items || {})[i] || 0)) P.push('item ' + i);
  for (const i in k.items || {}) if (!(c.items || {})[i] && (a.items[i] || 0) - (b.items[i] || 0) !== k.items[i]) P.push('cost item ' + i);
  if (c.energy && !(b.en > a.en)) P.push('energy');
  if (c.snack && (b.pantry[c.snack] || 0) !== (a.pantry[c.snack] || 0) + 1) P.push('snack');
  if (c.charm && b.charm !== c.charm) P.push('charm');
  if (c.healPct && !(b.hp > a.hp)) P.push('heal');
  if (c.time && !(b.min - a.min >= c.time)) P.push('time');
  if (c.practice && b.sk !== a.sk + 1) P.push('practice');
  if (c.upgrade && b.up !== a.up + 1) P.push('upgrade');
  return P; };
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

async def modal_text(pg):
    return await pg.evaluate("document.getElementById('modal').hidden ? null : document.getElementById('modalBox').textContent")

async def close_modal(pg):
    await pg.evaluate("document.getElementById('modal').hidden || (document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox #wNotYet') || document.querySelector('#modalBox #wEvDone') || document.querySelector('#modalBox #wEvWalk') || document.getElementById('modal')).click()")
    await pg.wait_for_timeout(150)

async def win(pg):
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp")
    over = await pg.evaluate('__wbot(80)')
    await pg.evaluate('__wend()'); await pg.wait_for_timeout(300)
    return over

async def desk_checks(pg):
    # ---------- tiers and levels ----------
    t = await pg.evaluate("""(() => { const o = {};
      __go('plains', false); o.plainsNear = [wTierHere(), wLevelInfo(false).lv];
      __go('plains', true); o.plainsFar = [wTierHere(), wLevelInfo(false).lv];
      __go('bloom', false); o.bloom = wTierHere();
      for (const r of ['tide', 'ember', 'rime']) { __go(r, true); o[r] = [wTierHere(), wLevelInfo(false).lv, wLevelInfo(true).lv]; }
      wSetFlag('cup_moss'); wSetFlag('cup_salt'); o.rimeCups = wLevelInfo(false).lv; delete WG.flags.cup_moss; delete WG.flags.cup_salt;
      for (const d of ['hatchery', 'genevault']) { const m = MAPS[d]; wEnterMap(d, m.spawn[0], m.spawn[1]); o[d] = [wTierHere(), wLevelInfo(false).lv]; }
      return o; })()""")
    check(t['plainsNear'] == [1, 0], 'near Graftonbury: tier 1, level 0', t)
    check(t['plainsFar'][0] == 1 and t['plainsFar'][1] >= 1, 'far out on the plains: still tier 1, but a higher level', t)
    check(t['bloom'] == 2 and all(t[r][0] == 2 for r in ['tide', 'ember', 'rime']), 'the outer regions are tier 2', t)
    check(all(t[r][1] >= 2 and t[r][2] == min(4, t[r][1] + 1) for r in ['tide', 'ember', 'rime']), 'remote corners are level 2+, and night off the road adds one', t)
    check(t['rimeCups'] == min(4, t['rime'][1] + 1), 'two cups won add a level', t)
    check(t['hatchery'] == [2, 0] and t['genevault'][0] == 3, 'dungeons: the Hatchery tier 2, the Gene Vault tier 3, no distance levels', t)

    # ---------- the encounter roll: native kinds, easy pool per tier, goals off ----------
    r = await pg.evaluate("""(() => { const o = {}, a0 = RUN.act;
      RUN.act = 1; W9.encRegion = 'rime'; WG.tierFights = { 2: 5 }; const kinds = DB.regions.rime.kinds; let nat = 0;
      for (let i = 0; i < 200; i++) { const e = rollEncounter('normal'); if (e.ids.some(id => kinds.includes(ENEMIES[id].kind))) nat++; }
      o.nat = nat;
      RUN.act = 0; W9.encRegion = 'plains'; WG.tierFights = {}; const easy = ENCOUNTERS[0].easy.map(x => x.join());
      o.easy = [...Array(30)].every(() => easy.includes(rollEncounter('normal').ids.join()));
      WG.tierFights = { 1: 2 }; o.later = [...Array(30)].some(() => !easy.includes(rollEncounter('normal').ids.join()));
      W9.encRegion = null; RUN.act = a0; WG.tierFights = {};
      o.goals = checkGoals(); return o; })()""")
    check(r['nat'] > 110, 'wild teams lean to the region\'s own kinds (rime, 200 rolls)', r)
    check(r['easy'] and r['later'], 'the easy pool is for the first two wins of each tier, then the normal pool', r)
    check(r['goals'] == [], 'Sudden Death season goals are off in the realm')

    # ---------- levels at kickoff ----------
    lv = await pg.evaluate("""(() => { __go('plains', false); startMatch({ ids: ['cheer'], type: 'normal', tier: 1, lv: 4, card: false, world: { kind: 'wild' } });
      const e = B.enemies[0]; const o = { max: e.max, str: e.st.str || 0, log: B.log.map(l => l.t).join(' | '), team: e.team.short }; return o; })()""")
    check(lv['str'] == 2 and lv['max'] >= int(12 * 1.24 * 0.85 * 1.32) and 'Level 4' in lv['log'], 'a level 4 game: +32% HP and 2 Strength on the other team, and the log says why', lv)
    check(lv['team'] == 'CPP', 'a plains wild team wears Charter Plains colours', lv)
    await win(pg)
    await pg.evaluate("document.getElementById('bCont') && document.getElementById('bCont').click()"); await pg.wait_for_timeout(300)

    # ---------- a forced night ambush, a win, and energy ----------
    await pg.evaluate("__go('bloom', false, 23)")
    e0 = await pg.evaluate("({ en: WG.energy.bloom, tf: (WG.tierFights || {})[2] || 0 })")
    await pg.evaluate("startMatch({ type: 'normal', sport: 'golf', ambush: true, world: { kind: 'wild' } }); wDrain()")
    await pg.wait_for_timeout(300)
    txt = await modal_text(pg)
    check(txt and 'Ambush!' in txt and '1 Strength each' in txt and 'Level' in txt, 'a forced night ambush shows on the pre-game card (golf: Strength), with the level', txt and txt[:300])
    await pg.click('#wPlay'); await pg.wait_for_timeout(1200)
    st = await pg.evaluate("({ amb: B.wAmbush, strs: alive().map(e => e.st.str || 0), lv: RUN.pending.world.lv, team: B.enemies[0].team.short })")
    check(st['amb'] == 1 and all(s >= 1 for s in st['strs']), 'in golf the ambushers really start with Strength', st)
    check(st['team'] == 'MOS', 'a Mosswold wild team wears Mosswold colours', st)
    over = await win(pg)
    await pg.evaluate("document.getElementById('bCont').click()"); await pg.wait_for_timeout(300)
    e1 = await pg.evaluate("({ en: WG.energy.bloom, tf: (WG.tierFights || {})[2] || 0, log: WLOG.slice(-8).map(l => l[0]).join(' | ') })")
    check(over == 'win' and e1['en'] == e0['en'] + 2 and e1['tf'] == e0['tf'] + 1 and 'Bloom energy' in e1['log'], 'a tier 2 win in the Mosswold gives 2 Bloom energy, and counts toward the tier', [e0, e1])

    # baseball: a score ahead
    await pg.evaluate("__go('plains', true, 23); startMatch({ type: 'normal', sport: 'baseball', ambush: true, card: false, world: { kind: 'wild' } })")
    await pg.wait_for_timeout(600)
    bb = await pg.evaluate("({ them: B.sc.them, us: B.sc.us, amb: B.wAmbush, sport: B.sport })")
    check(bb['amb'] == 1 and bb['sport'] == 'baseball' and bb['them'] >= 1 and bb['us'] == 0, 'in baseball the ambushers really open a run ahead', bb)
    await win(pg)
    await pg.evaluate("document.getElementById('bCont').click()"); await pg.wait_for_timeout(300)

    # ---------- every kept road event, every choice ----------
    evs = await pg.evaluate("DB.events.map(e => ({ id: e.id, n: (e.choices || []).length, auto: !!e.auto, time: e.time || null, match: (e.choices || []).map(c => c.match ? 'match' : c.failMatch ? 'gamble' : c.practice || c.upgrade ? 'pick' : '') }))")
    check(8 <= len(evs) <= 12, f'{len(evs)} road events kept (8 to 12)', [e['id'] for e in evs])
    for ev in evs:
        hour = 23 if ev['time'] == 'night' else 12
        if ev['auto']:
            a = await pg.evaluate(f"(() => {{ __go('plains', false, {hour}); WG.items.salve = 3; RUN.gold = 500; const a = __snap(); wRoadEvent('{ev['id']}'); return a; }})()")
            await pg.wait_for_timeout(150)
            txt = await modal_text(pg); b = await pg.evaluate('__snap()')
            ok = txt is not None and await pg.evaluate("!!document.getElementById('wEvDone')")
            if ev['id'] == 'thief': ok = ok and sum(b['items'].values()) == sum(a['items'].values()) - 1
            if ev['id'] == 'shed': ok = ok and b['en'] > a['en']
            check(ok, f"event {ev['id']} (automatic) opens, applies, and offers Carry on", {'txt': txt and txt[:160]})
            await pg.click('#wEvDone'); await pg.wait_for_timeout(100)
            check(await pg.evaluate('WG.event === null && document.getElementById("modal").hidden'), f"event {ev['id']}: Carry on closes it")
            continue
        for i in range(ev['n']):
            kind = ev['match'][i]
            a = await pg.evaluate(f"(() => {{ __go('plains', false, {hour}); RUN.gold = 500; RUN.hp = Math.max(5, RUN.maxhp - 30); WG.items.grain = 4; WG.items.salt = 4; WG.items.saltfish = 2; WG.pantry = {{}}; WG.charm = null; const a = __snap(); wRoadEvent('{ev['id']}'); return a; }})()")
            await pg.wait_for_timeout(120)
            if i == 0 and ev['id'] == 'maud':
                await pg.screenshot(path='/tmp/realm-road-event-desk.png')
            btn = await pg.evaluate(f"(() => {{ const b = document.querySelector('#modalBox [data-wev=\"{i}\"]'); return b ? !b.disabled : null; }})()")
            check(btn is True, f"event {ev['id']} choice {i} is offered and affordable")
            c = await pg.evaluate(f"DB.events.find(e => e.id === '{ev['id']}').choices[{i}]")
            if kind == 'gamble':
                await pg.evaluate(f"(() => {{ document.getElementById('modal').hidden = true; }})()")
                await pg.evaluate(f"wEventChoose({i}, {{ roll: 0 }})"); await pg.wait_for_timeout(120)
                b = await pg.evaluate('__snap()')
                check(b['en'] > a['en'] and await pg.evaluate("!!document.getElementById('wEvDone')"), f"event {ev['id']} choice {i}: the gamble wins and pays", [a['en'], b['en']])
                await pg.click('#wEvDone'); await pg.wait_for_timeout(100)
                await pg.evaluate(f"(() => {{ RUN.gold = 500; wRoadEvent('{ev['id']}'); document.getElementById('modal').hidden = true; wEventChoose({i}, {{ roll: .99 }}); }})()"); await pg.wait_for_timeout(200)
                txt = await modal_text(pg)
                check(txt and 'Ambush!' in txt and await pg.evaluate("!RUN.pending && !!document.getElementById('wRun')"), f"event {ev['id']} choice {i}: the gamble lost leads to an ambush match card", txt and txt[:200])
                await pg.evaluate("window.__mr = Math.random; Math.random = () => .99")
                await close_modal(pg)
                await pg.evaluate("Math.random = window.__mr")
                check(await pg.evaluate("UI.view === 'world' && !RUN.pending"), f"event {ev['id']}: running from it works")
                continue
            await pg.click(f'#modalBox [data-wev="{i}"]'); await pg.wait_for_timeout(250)
            if kind == 'match':
                txt = await modal_text(pg)
                ok = txt is not None and await pg.evaluate("!!document.getElementById('wPlay') && !!document.getElementById('wNotYet') && WG.event === null")
                check(ok, f"event {ev['id']} choice {i} leads to a pre-game card", txt and txt[:160])
                await close_modal(pg)
                check(await pg.evaluate("UI.view === 'world' && !RUN.pending"), f"event {ev['id']}: Not yet backs away")
                continue
            if kind == 'pick':
                n = await pg.evaluate("document.querySelectorAll('#modalBox .cardgrid .card').length")
                check(n > 0, f"event {ev['id']} choice {i} opens a card picker", n)
                await pg.click('#modalBox .cardgrid .card'); await pg.wait_for_timeout(150)
            b = await pg.evaluate('__snap()')
            probs = await pg.evaluate("([c, a, b]) => __effOk(c, a, b)", [c, a, b])
            res = await pg.evaluate("document.querySelector('#modalBox .result') ? document.querySelector('#modalBox .result').textContent : null")
            check(not probs and res and await pg.evaluate("!!document.getElementById('wEvDone')"), f"event {ev['id']} choice {i} resolves and applies its effect", {'probs': probs, 'res': res})
            await pg.click('#wEvDone'); await pg.wait_for_timeout(100)
        # walking on
        if ev['n']:
            await pg.evaluate(f"(() => {{ __go('plains', false, {hour}); wRoadEvent('{ev['id']}'); }})()"); await pg.wait_for_timeout(100)
            await pg.click('#wEvWalk'); await pg.wait_for_timeout(100)
            check(await pg.evaluate("WG.event === null && document.getElementById('modal').hidden"), f"event {ev['id']}: Walk on closes it")

    # ---------- an event match, won, comes back ----------
    here = await pg.evaluate("(() => { const p = __go('ember', false, 12); RUN.gold = 100; RUN.fans = 0; wRoadEvent('rival'); return [WG.map, WG.x, WG.y]; })()")
    rival = await pg.evaluate("WG.event.rival")
    await pg.click('#modalBox [data-wev="0"]'); await pg.wait_for_timeout(250)
    await pg.click('#wPlay'); await pg.wait_for_timeout(1200)
    st = await pg.evaluate("({ kind: RUN.pending.world.kind, ref: RUN.pending.world.ref, team: B.enemies[0].team.short })")
    check(st['kind'] == 'event' and st['ref']['ev'] == 'rival' and st['team'] == await pg.evaluate(f"CLUBS['{rival}'].short"), 'the rival event plays an event match against that club', st)
    g0 = await pg.evaluate('RUN.gold')
    over = await win(pg)
    await pg.evaluate("document.getElementById('bCont').click()"); await pg.wait_for_timeout(400)
    back = await pg.evaluate("({ view: UI.view, at: [WG.map, WG.x, WG.y], fans: RUN.fans, gold: RUN.gold, last: WG.lastMatch, log: WLOG.slice(-6).map(l => l[0]).join(' | ') })")
    check(over == 'win' and back['view'] == 'world' and back['at'] == here and back['last']['kind'] == 'event', 'the event match returns to the same tile', back)
    check(back['fans'] >= 20 and 'pay up' in back['log'], 'W_ON_END.event pays the win (the purse and 20 fans)', back)

    # ---------- an event from the encounter hook ----------
    ev = await pg.evaluate("""(() => { __go('plains', false, 12); WG.event = null; const q = [0.99, 0.001]; const mr = Math.random; Math.random = () => q.length ? q.shift() : mr();
      try { wEncounterHook(wRegionHere(), '.'); } finally { Math.random = mr; } return { ev: WG.event && WG.event.id, card: !!document.querySelector('#modalBox .wev'), pending: !!RUN.pending }; })()""")
    check(ev['ev'] and ev['card'] and not ev['pending'], 'a step that rolls no match can roll a road event (TC rate)', ev)
    await close_modal(pg)
    # by day on a road, nothing that starts a match
    road = await pg.evaluate("""(() => { const m = MAPS.world; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === '=' && regionAt(x, y) === 'plains') { wEnterMap('world', x, y); WG.min = 12 * 60; return DB.events.filter(wEventOk).map(e => e.id); } })()""")
    check(road and 'rival' not in road and 'poacher' not in road, 'by day on the road, no event that leads to a match', road)
    # an event card left open comes back after a reload
    # earlier wins leave level-up picks queued; settle them so the event is the only thing open
    await pg.evaluate("WG.cardOffer = null; WG.wprompts = []"); await close_modal(pg)
    await pg.evaluate("__go('plains', false, 12); wRoadEvent('purse')")
    await pg.reload(); await pg.wait_for_timeout(800)
    await pg.click('#bResume'); await pg.wait_for_timeout(500)
    check(await pg.evaluate("!!document.querySelector('#modalBox .wev') && WG.event && WG.event.id === 'purse'"), 'an open event card comes back after a reload')
    await pg.add_script_tag(content=HELP); await pg.evaluate(NOTIPS)
    await close_modal(pg)
    # help
    await pg.evaluate("showPage('help')")
    check(await pg.evaluate("!!document.getElementById('wHelp4') && ['Road events', 'Meals', 'enchanter', 'Card shops', 'ambush'].every(s => document.getElementById('wHelp4').textContent.includes(s))"), 'How to play explains levels, road events, meals, the enchanter and card shops')
    await pg.evaluate("showPage('play')")

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
                await pg.evaluate("__go('plains', false, 12); RUN.gold = 300; wRoadEvent('poacher')"); await pg.wait_for_timeout(300)
                await pg.screenshot(path='/tmp/realm-road-event-phone.png')
                await close_modal(pg)
            await pg.evaluate("__go('rime', true, 23); startMatch({ type: 'normal', sport: 'hockey', ambush: true, world: { kind: 'wild' } }); wDrain()")
            await pg.wait_for_timeout(400)
            check('Ambush!' in (await modal_text(pg) or ''), f'[{tag}] the ambush pre-game card')
            await pg.screenshot(path=f'/tmp/realm-road-ambush-{tag}.png')
            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm road passed')

asyncio.run(main())
