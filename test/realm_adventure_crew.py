# Realm adventures, phase 3 (issue #47): The Marigold's Crew, start to finish, in every engine. The four crew members
# stand in their cities on open ground; Marrowbone's hint and the start (only once the ship's log is home); Bosun
# Gale's baseball game, Kestrel Ashby's boxing card, Liss Varo's soccer in a blizzard (a real card match, not offered
# in clear weather), Coach Horne's football game, Dusty Rowe and Pip's cairn; then the reunion at the Crown, which
# counts win or lose (no pinnacle, so the story can't be lost): both endings, Bosun Gale joining at the team's level
# with Drop Anchor and the Marigold's Flag, and recruiting him again on a new journey. Asserts; exits nonzero.
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
  const b = document.getElementById('wAdvNo') || document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox button'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 900); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 160) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .4)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''
ST = "(() => { const A = wAdvState('crew'); return A && { st: A.st, ch: A.ch, done: A.done, marks: A.marks || {} }; })()"
# keep playing a simulated engine step until it's done (the sim can lose: those are retried)
SIM = """((si, eng) => { let tries = 0; const done = () => { const A = wAdvState('crew'); return A.ch > 0 || A.done.includes(si); };
  for (; tries < 12 && !done(); tries++) {
    for (const k of ['ball', 'gfg', 'bxg']) if (WG[k]) { WG[k].met = {}; WG[k].live = null; }
    if (eng === 'ring') { const o = { club: 'local', how: 'sim', tier: 2, kind: 'adv', ref: 'crew:0:' + si }, mine = wRingSide(new Set()), theirs = wRingOpp('local', 2, new Set()); wRingGo(o, mine, theirs, wBX.cardAuto(mine.fighters, theirs.fighters)); }
    else { const why = wAdvStartMatch('crew', si, 'sim'); if (why) return { why, tries }; }
    for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox button'); if (b) b.click(); } }
  return { tries, done: done() }; })"""

async def new_journey(pg, clear=False):
    await pg.goto(REALM_URL)
    if clear: await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof W_CREW !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg, clear=True)
        await pg.evaluate("(() => { while (wRoster().length < W_PARTY.max - 1) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 4 }, 'tavern')); })()")

        # ---------- the four, in their cities ----------
        r = await pg.evaluate("""W_CREW.map(C => { const M = MAPS[C.city], n = M.npcs.find(x => x.id === C.id), ch = M.t[C.at[1]][C.at[0]];
          return { id: C.id, placed: !!n && n.x === C.at[0] && n.y === C.at[1] && !!n.fixed, walk: !!(DB.tiles[ch] && DB.tiles[ch].walk), alone: M.npcs.filter(x => x.x === C.at[0] && x.y === C.at[1]).length === 1, named: !!DB.chars[C.id] }; })""")
        check(all(c['placed'] and c['walk'] and c['alone'] and c['named'] for c in r), 'the four crew members stand in their cities, each on open ground of their own', r)
        check(await pg.evaluate("!wAdv('crew').chapters.some(C => C.steps.some(s => s.pinnacle))"), 'nothing in the story is a pinnacle: it can\'t be lost')

        # ---------- the start ----------
        r = await pg.evaluate("(() => { const a = wSay('marrowbone', 'crew').text, before = wAdvState('crew'); wSetFlag('q_shiplog'); const log = wSay('marrowbone', 'log').text; const c = wSay('marrowbone', 'crew').text; return { a, before, log, c, s: " + ST + " }; })()")
        check(r['before'] is None and 'CREW' in r['log'], 'it doesn\'t start before the log is home; then Marrowbone talks about the CREW', r)
        check('Bosun' not in r['a'] and 'Gale' in r['c'] and r['s']['st'] == 'active', 'asking about the CREW then starts it, with the five names', r)

        # ---------- 1. the four, and Pip ----------
        r = await pg.evaluate("(() => { const before = wSay('adv_gale', 'baseball').act || ''; const t = wSay('adv_gale', 'marigold').text; return { before, t, act: wSay('adv_gale', 'baseball').act }; })()")
        check(not r['before'].startswith('adv:') and 'BASEBALL' in r['t'] and r['act'] == 'adv:crew:1', 'Bosun Gale wants a BASEBALL game, once asked about the Marigold', r)
        r = await pg.evaluate(f"{SIM}(1, 'ball')")
        check(r.get('done'), 'the baseball game (the diamond engine) counts for the story', r)
        await pg.evaluate("wSay('adv_kestrel', 'marigold')")
        r = await pg.evaluate(f"{SIM}(3, 'ring')")
        check(r.get('done') and await pg.evaluate("wSay('adv_kestrel', 'bouts').act || ''") == '', 'Kestrel Ashby\'s three bouts (the ring) count, and aren\'t offered again', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const w0 = wWeather; wWeather = () => null; wSay('adv_liss', 'marigold'); wRunAct(wSay('adv_liss', 'soccer').act, 'adv_liss');
          const off = document.getElementById('wAdvPlay').disabled; wWeather = w0; return { off }; })()""")
        check(r['off'], 'Liss Varo\'s soccer game isn\'t offered without a blizzard', r)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { window.__w0 = wWeather; wWeather = () => 'blizzard'; })()")
        why = await pg.evaluate("wAdvStartMatch('crew', 5)")
        sport = await pg.evaluate("B && B.sport")
        view = await pg.evaluate(WIN)
        if view == 'panel': await pg.click('#bCont')
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("(() => { wWeather = window.__w0; })()")
        r = await pg.evaluate(ST)
        check(why == '' and sport == 'soccer' and 5 in r['done'], 'in a blizzard it\'s a real soccer match (the card game), and winning counts', {'why': why, 'sport': sport, 's': r})
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wSay('adv_horne', 'marigold')")
        r = await pg.evaluate(f"{SIM}(7, 'grid')")
        check(r.get('done'), 'Coach Horne\'s football game (the gridiron engine) counts', r)
        await pg.evaluate(CLOSE_ALL)
        g0 = await pg.evaluate("RUN.gold")
        r = await pg.evaluate("(() => { const t = wSay('rowe', 'pip').text, M = MAPS.marigold; wEnterMap('marigold', M.spawn[0], M.spawn[1]); return { t, s: " + ST + ", j: wAdvState('crew').learned.map(l => l.t).join(' ') }; })()")
        check('dunes' in r['t'] and r['s']['ch'] == 1 and 'cairn' in r['j'], 'Dusty Rowe sends you to Pip\'s cairn by the wreck, and the chapter is done', r)
        check(await pg.evaluate("RUN.gold") - g0 >= 80, 'the chapter pays')

        # ---------- 2. one last game ----------
        r = await pg.evaluate("(() => { const t = wSay('marrowbone', 'crew').text; wRunAct(wSay('herald', 'reunion').act, 'herald'); return { t, warn: !!document.getElementById('wAdvWarn'), card: document.getElementById('modalBox').textContent }; })()")
        check('REUNION' in r['t'] and not r['warn'] and 'Win or lose' in r['card'], 'the reunion at the Crown says win or lose, with no can\'t-retry warning', r)
        await pg.evaluate(CLOSE_ALL)
        # (a won match can bring a new player along: leave room for Gale)
        await pg.evaluate("(() => { while (wRoster().length > W_PARTY.max - 2) WG.roster.pop(); })()")
        snap = await pg.evaluate("JSON.stringify({ adv: localStorage.getItem(wAdvKey()), roster: WG.roster, relics: RUN.relics, deck: RUN.deck, rec: WG.advRec || null, items: WG.advItems || null })")
        r = await pg.evaluate("""(() => { const lv = wStarLvl(); W_ON_END.adv('lose', 'crew:1:1', { kind: 'adv' }); const g = wRoster().find(p => p.n === 'Bosun Gale');
          wOpenJournal('adv'); const j = document.getElementById('wJBody').textContent;
          return { s: """ + ST + """, gale: g ? [g.kind, g.lvl] : null, lv, relic: RUN.relics.includes('marigold'), card: RUN.deck.some(c => c.id === 'adv_anchor'), j }; })()""")
        check(r['s']['st'] == 'won' and not r['s']['marks'].get('won'), 'losing the reunion still finishes the story', r['s'])
        check(r['gale'] == ['troll', r['lv']] and r['relic'] and r['card'], 'Bosun Gale joins at the team\'s level, with Drop Anchor and the Marigold\'s Flag', r)
        check('played their last game' in r['j'] and 'beat the champions' not in r['j'] and 'Bosun Gale waits in Saltmere' in r['j'], 'the journal tells the losing ending, and where Gale waits', r['j'][:400])
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("""(s) => { const o = JSON.parse(s); localStorage.setItem(wAdvKey(), o.adv); WG.roster = o.roster; RUN.relics = o.relics; RUN.deck = o.deck; WG.advRec = o.rec || {}; WG.advItems = o.items || {}; }""", snap)
        r = await pg.evaluate("""(() => { RUN.games.push({ us: 5, them: 2, sport: 'soccer' }); W_ON_END.adv('win', 'crew:1:1', { kind: 'adv' }); wOpenJournal('adv'); const j = document.getElementById('wJBody').textContent;
          return { s: """ + ST + """, j, again: wSay('adv_gale', 'join').text }; })()""")
        check(r['s']['st'] == 'won' and r['s']['marks'].get('won') == 1 and 'beat the champions' in r['j'], 'winning it gets the better ending', r)
        check('already with you' in r['again'], 'asking Gale again on the same journey adds nobody', r['again'])
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("(() => { const p = new Set(); for (let i = 0; i < 40; i++) relicPool().forEach(k => p.add(k)); return { pool: p.has('marigold'), hof: CARDS.adv_anchor.rar }; })()")
        check(not r['pool'] and r['hof'] == 'l', 'no trophy pool offers the Marigold\'s Flag; Drop Anchor is a Hall of Fame card', r)
        await pg.evaluate("wSave()")

        # ---------- a new journey ----------
        await new_journey(pg)
        r = await pg.evaluate("""(() => { while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern'));
          const full = wSay('adv_gale', 'join').text, items = RUN.relics.includes('marigold') && RUN.deck.some(c => c.id === 'adv_anchor'), gale = wRoster().some(p => p.n === 'Bosun Gale'); WG.roster.pop();
          return { full, items, gale }; })()""")
        check('team is full' in r['full'] and r['items'] and not r['gale'], 'with a full team the card and flag come at once, and Gale waits for room', r)
        r = await pg.evaluate("""(() => { const had = wRoster().some(p => p.n === 'Bosun Gale'); const t = wSay('adv_gale', 'join').text;
          return { had, t, now: wRoster().some(p => p.n === 'Bosun Gale'), relic: RUN.relics.includes('marigold'), card: RUN.deck.some(c => c.id === 'adv_anchor'), again: wSay('adv_gale', 'join').text }; })()""")
        check(not r['had'] and r['now'] and r['relic'] and r['card'] and 'already with you' in r['again'] and await pg.evaluate("RUN.deck.filter(c => c.id === 'adv_anchor').length") == 1, 'with room made, Gale joins on the quay (and the card isn\'t given twice)', r)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
