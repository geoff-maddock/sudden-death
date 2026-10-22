# Realm phase 8, the words: no Terra Chimera leftovers (chimeras, snares, handlers, companies, the gene lab) in any
# player-facing data or help, and no "later update" promises; backing out of a road event's match (Not yet, or Escape)
# brings the event card back, and the match can still be played and won; the free agents are one button away from
# every inn, and the innkeepers say so; How to play's realm sections render in journey order. Asserts; exits nonzero.
# Screenshot: /tmp/realm-polish-help.png
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

# words that belong to Terra Chimera's systems (snaring, splicing, species, companies), not to a monster sports league
BANNED = r"/terra chimera|chimera|mossprout|\bsnar(e|es|ed|ing)\b|\bhandlers?\b|specimen|gene vault|geneticist|gene lab|biologic|\bcompan(y|ies)\b|\bspecies\b|mutagen|\bsplice|later update|later phase|not drawn yet/i"

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
// every player-facing string in the realm's data, as [where, text]
window.__texts = function () {
  const out = [], walk = (v, where) => {
    if (typeof v === 'string') { out.push([where, v]); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, where + '[' + i + ']')); return; }
    if (v && typeof v === 'object') for (const k in v) walk(v[k], where + '.' + k);
  };
  for (const k of ['chars', 'items', 'events', 'sideplots', 'lore', 'towns', 'regions', 'tiles', 'locs', 'dungeons', 'cups', 'alphas', 'apex', 'crew', 'companies', 'meals', 'recipes', 'enchanter', 'cardShops', 'meta']) walk(DB[k], 'DB.' + k);
  for (const m of Object.values(MAPS)) for (const k in m.meta) { const x = m.meta[k]; if (x.text) out.push(['MAPS.' + m.id + ' sign', x.text]); if (x.look) out.push(['MAPS.' + m.id + ' look', x.look]); }
  walk(W_FAMOUS, 'W_FAMOUS'); walk(W_QUEST_MATES, 'W_QUEST_MATES'); walk(W_CUP.apexTeam, 'W_CUP.apexTeam'); walk(W_WILD_TEAM, 'W_WILD_TEAM');
  return out;
};
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_selector('#bNew')
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew')
    await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && !!RUN")

async def words(pg):
    bad = await pg.evaluate(f"(() => {{ const re = {BANNED}; return __texts().filter(([w, t]) => re.test(t)).map(([w, t]) => w + ': ' + t.slice(0, 90)); }})()")
    n = await pg.evaluate("__texts().length")
    check(n > 800 and not bad, f'no Terra Chimera leftovers or "later update" in {n} player-facing strings', bad[:12])
    # every NPC's greeting and every topic, as wSay returns them (later parts rewrite some at load)
    said = await pg.evaluate(f"""(() => {{ const re = {BANNED}, P = [];
      for (const id in DB.chars) {{ const ch = wChar(id); if (re.test(ch.name) || re.test(ch.greet || '')) P.push(id + ' greet');
        for (const k in ch.topics) {{ const t = ch.topics[k]; for (const s of [t.t, t.t2, t.needNo]) if (s && re.test(s)) P.push(id + '.' + k); }} }}
      return P; }})()""")
    check(not said, 'no NPC says it (greetings, topics, second lines, refusals)', said)
    # the keyword links still lead somewhere: every ALL-CAPS word in a line is a topic of whoever says it
    dead = await pg.evaluate(r"""(() => { const P = [], ok = new Set(['BUY', 'LEAGUE', 'NO', 'NOT', 'DO', 'FEED', 'LIT', 'THE', 'ONE', 'VESPER', 'GRAFTONBURY', 'MARIGOLD', 'ODD', 'LOTS', 'HOT', 'SPRING']);
      for (const id in DB.chars) { const ch = DB.chars[id];
        const lines = [ch.greet].concat(...Object.values(ch.topics).map(t => [t.t, t.t2, t.needNo]));
        for (const s of lines) for (const w of (s || '').match(/\b[A-Z]{3,}\b/g) || []) if (!ok.has(w) && !wFindTopic(ch, w.toLowerCase())) P.push(id + ': ' + w); }
      return [...new Set(P)]; })()""")
    check(not dead, 'every CAPITALISED word an NPC says is a topic they answer to', dead)
    # names: the apex club, the vault, its warden, the capsule player
    nm = await pg.evaluate("({ apex: DB.apex.name, team: W_CUP.apexTeam.name, vault: DB.locs.find(l => l.id === 'genevault').name, warden: DB.alphas.vaultwarden.name, crown: DB.cups.crown.name, rival: wChar('rival').name, mate: W_QUEST_MATES['pell.capsule'].n })")
    check(nm == {'apex': 'Apex Athletic', 'team': 'Apex Athletic', 'vault': 'The Sealed Vault', 'warden': 'Captain Nought', 'crown': 'The Crown', 'rival': 'A rival captain', 'mate': 'Cobble'}, 'the renamed places and people', nm)
    # the bell (the one unbuilt set piece) says nothing about updates
    bell = await pg.evaluate("""(() => { const m = MAPS.frozenchapel; let at = null; for (const k in m.meta) if (m.meta[k].ring) at = k.split(',').map(Number);
      wEnterMap('frozenchapel', at[0], at[1] + 1); WG.items.tuningrod = 1; WG.min = 23 * 60; WG.face = 'u'; const n = WLOG.length; wInteract(); const t = WLOG.slice(n).map(l => l[0]).join(' | ');
      delete WG.items.tuningrod; wEnterMap('graftonbury', 5, 11); WG.min = 12 * 60; return t; })()""")
    check(bell and 'bell' in bell and 'update' not in bell, 'striking the chapel bell makes no promises', bell)

async def event_backout(pg):
    await pg.evaluate("""(() => { const m = MAPS.world, hq = DB.locs.find(l => l.id === 'graftonbury'); let best = null, bd = 1e9;
      for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== 'plains') continue; const c = wTileAt(m, x, y), td = DB.tiles[c];
        if (!(td && td.walk && !td.enter && c !== '=' && c !== 'b')) continue; const d = Math.hypot(x - hq.x, y - hq.y); if (d < bd && d > 3) { bd = d; best = [x, y]; } }
      wEnterMap('world', best[0], best[1]); WG.min = 12 * 60; WG.grace = 0; RUN.gold = 100; RUN.fans = 0; WG.wprompts = []; WG.cardOffer = null; wDrain(); wRoadEvent('rival'); })()""")
    await pg.wait_for_selector('#modalBox [data-wev="0"]')
    at = await pg.evaluate("[WG.map, WG.x, WG.y, RUN.gold]")
    # Not yet
    await pg.click('#modalBox [data-wev="0"]'); await pg.wait_for_selector('#wNotYet')
    st = await pg.evaluate("({ ev: WG.event && WG.event.id, pending: !!RUN.pending })")
    check(st == {'ev': 'rival', 'pending': False}, 'choosing the match shows its pre-game card, and the event is still open behind it', st)
    await pg.click('#wNotYet'); await pg.wait_for_selector('#modalBox [data-wev="0"]')
    st = await pg.evaluate("({ ev: WG.event && WG.event.id, pending: !!RUN.pending, view: UI.view, gold: RUN.gold, walk: !!document.getElementById('wEvWalk'), log: WLOG.slice(-2).map(l => l[0]).join(' | ') })")
    check(st['ev'] == 'rival' and not st['pending'] and st['view'] == 'world' and st['gold'] == at[3] and st['walk'], 'Not yet brings the event card back, nothing paid, Walk on still there', st)
    # Escape on the pre-game card does the same
    await pg.click('#modalBox [data-wev="0"]'); await pg.wait_for_selector('#wPlay')
    await pg.keyboard.press('Escape'); await pg.wait_for_selector('#modalBox [data-wev="0"]')
    check(await pg.evaluate("WG.event && WG.event.id === 'rival' && !RUN.pending"), 'closing the pre-game card with Escape brings the event back too')
    # a reload with the event open keeps it
    await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
    await pg.wait_for_selector('#modalBox [data-wev="0"]')
    await pg.add_script_tag(content=HELP); await pg.evaluate(NOTIPS)
    check(await pg.evaluate("WG.event && WG.event.id === 'rival'"), 'the event is still open after a reload')
    # and it can still be played and won
    await pg.click('#modalBox [data-wev="0"]'); await pg.wait_for_selector('#wPlay'); await pg.click('#wPlay')
    await pg.wait_for_function("UI.view === 'fight' && !!B && !!RUN.pending")
    st = await pg.evaluate("({ ev: WG.event, kind: RUN.pending.world.kind, ref: RUN.pending.world.ref.ev })")
    check(st == {'ev': None, 'kind': 'event', 'ref': 'rival'}, 'Play kicks off the event match, and the event closes', st)
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp")
    over = await pg.evaluate('__wbot(80)')
    await pg.evaluate("consumeFx(); renderFightHUD(); finishFight()")
    await pg.wait_for_selector('#bCont'); await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world'")
    back = await pg.evaluate("({ at: [WG.map, WG.x, WG.y], fans: RUN.fans, last: WG.lastMatch && WG.lastMatch.kind, ev: WG.event })")
    check(over == 'win' and back['at'] == at[:3] and back['fans'] >= 20 and back['last'] == 'event' and back['ev'] is None, 'the event match, won, pays and comes back to the same tile', [over, back])
    # settle whatever the win queued (level-up picks, a recruit) so the next checks start clean
    await pg.evaluate("WG.wprompts = []; WG.cardOffer = null; document.getElementById('modal').hidden || document.getElementById('modal').click()")

async def taverns(pg):
    await pg.evaluate("wEnterMap('graftonbury', 5, 11); WG.min = 12 * 60; RUN.gold = 500; wDrain()")
    await pg.wait_for_function("document.getElementById('modal').hidden")
    # the innkeeper says so when you walk up
    await pg.evaluate("wTalkTo('hq_inn'); wDrain()")
    await pg.wait_for_selector('#wTalk .wkw[data-kw="agents"]')
    check(True, "the innkeeper's greeting links AGENTS")
    for id in ['hq_inn', 'moss_inn', 'salt_inn', 'cind_inn', 'rime_inn']:
        g = await pg.evaluate(f"wSay('{id}', '').text")
        check('AGENTS' in g, f'{id} greets with AGENTS', g)
    # the inn's room menu has a Free agents button that opens the tavern
    await pg.evaluate("wTalkSay('room')")
    await pg.wait_for_selector('#wInnAgents')
    await pg.click('#wInnAgents')
    await pg.wait_for_selector('#wTavBody')
    tav = await pg.evaluate("({ h: document.querySelector('#modalBox h3').textContent, n: document.querySelectorAll('#wTavBody [data-sign]').length, list: wTavern('graftonbury').list.length })")
    check(tav['h'] == 'Free agents' and tav['n'] == tav['list'] and tav['list'] >= 1, 'Free agents on the inn menu opens the tavern, with its agents to sign', tav)
    n0 = await pg.evaluate("wRoster().length")
    await pg.click('#wTavBody [data-sign="0"]')
    await pg.wait_for_function(f"wRoster().length === {n0 + 1}")
    check(True, 'an agent signed from there joins the team')
    await pg.evaluate("document.getElementById('modal').hidden || document.querySelector('#modalBox [data-close]').click(); wCloseTalk(); WG.wprompts = []; WG.cardOffer = null")

async def help_page(pg):
    await pg.evaluate("showPage('help')")
    await pg.wait_for_selector('#wHelp')
    h = await pg.evaluate(f"""(() => {{ const s = document.getElementById('wHelp'), re = {BANNED};
      return {{ h4: [...s.querySelectorAll('h4')].map(x => x.textContent), ids: ['wHelpWorld', 'wHelpMatch', 'wHelpTeam', 'wHelp4', 'wHelpTowns', 'wHelpRoad', 'wHelp5', 'wHelpCups', 'wHelpRenown'].filter(i => !document.getElementById(i)),
        order: ['wHelpWorld', 'wHelpMatch', 'wHelpTeam', 'wHelpTowns', 'wHelpRoad', 'wHelp5', 'wHelpCups', 'wHelpRenown'].map(i => document.getElementById(i)).every((el, i, a) => !i || (a[i - 1] && a[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)),
        bad: (s.textContent.match(re) || [])[0] || null, trophy: /sometimes a trophy/i.test(document.getElementById('pg-help').textContent),
        descent: [...document.querySelectorAll('#pg-help h3')].some(x => x.textContent === 'The descent'),
        text: s.textContent, fee: W_CUP.fee, renown: Math.round(W_RENOWN.hpPer * 100), lv: W_ROAD.maxLv, hp: W_PARTY.hpPerLvl, maxLvl: W_PARTY.maxLvl }}; }})()""")
    want = ['Getting around', 'Matches', 'Your team', 'Towns', 'The road', 'Dungeons and lairs', 'Cups, rivals and the Crown', 'Renown and trophies']
    check(h['h4'] == want, 'How to play: the realm sections, in journey order', h['h4'])
    check(not h['ids'] and h['order'], 'every section keeps its id, in order', h['ids'])
    check(not h['bad'] and not h['trophy'] and not h['descent'], 'no leftovers, no "sometimes a trophy", and no act map section', [h['bad'], h['trophy'], h['descent']])
    t = h['text']
    nums = [f"{h['fee']} gold", f"{h['renown']}% more HP", f"0 to {h['lv']}", f"by {h['hp']}", f"to level {h['maxLvl']}", 'Not yet', 'Free agents', 'Apex Athletic', 'Sealed Vault']
    check(all(s in t for s in nums), 'the help quotes the current numbers and names', [s for s in nums if s not in t])
    await pg.screenshot(path='/tmp/realm-polish-help.png', full_page=True)
    await pg.evaluate("showPage('play')")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 860})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await boot(pg)
        await new_journey(pg)
        await words(pg)
        await event_backout(pg)
        await taverns(pg)
        await help_page(pg)
        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm polish passed')

asyncio.run(main())
