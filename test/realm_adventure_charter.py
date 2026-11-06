# Realm adventures, phase 2 (issue #47): The Lost Charter, start to finish. The rumour and Foss's hint, the start
# (only once the First Bracket is home), Vesper's basketball game at the Charter Court (a real card match), the four
# pieces in any order: Hermit Oak's game under the old rules (a real match: no gear, no set plays, no Hall of Fame
# cards, the trophies set aside and given back), the Marigold's hold at low tide after dark, Ma Gristle's bout (the
# ring engine), Halvard's game in a blizzard (not offered in clear weather) and the chapel; then the five pieces to
# Foss and the exhibition, a pinnacle: the losing path, and the winning one, which pays the Founder's Charm and The
# Founding Rule, handed over again on a new journey. Also the tide, the chapel bell's flag, and How to play.
# Asserts; exits nonzero on failure.
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
ST = "(() => { const A = wAdvState('charter'); return A && { st: A.st, ch: A.ch, done: A.done, items: A.items, why: A.why || '' }; })()"
PIECES = ['ch_vesper', 'ch_moss', 'ch_tide', 'ch_ember', 'ch_rime']

async def new_journey(pg, clear=False):
    await pg.goto(REALM_URL)
    if clear: await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wTide === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def play_card(pg, si, check_fn=None):
    """start the step's card match, optionally inspect the fight, then win it and come back to the world"""
    why = await pg.evaluate(f"wAdvStartMatch('charter', {si})")
    seen = await pg.evaluate(check_fn) if check_fn else None
    view = await pg.evaluate(WIN)
    if view == 'panel':
        await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world'")
    await pg.evaluate(CLOSE_ALL)
    return why, seen

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg, clear=True)
        await pg.evaluate("(() => { while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); })()")

        # ---------- finding it ----------
        r = await pg.evaluate("(() => { const n0 = WLOG.length; wRunAct('advrumour', 'hq_inn'); return WLOG.slice(n0).map(l => l[0]).join(' '); })()")
        check('CHARTER' in r, 'an innkeeper\'s rumour points at the charter', r)
        r = await pg.evaluate("(() => { const a = wSay('clerk', 'charter').text, before = wAdvState('charter'); wSetFlag('q_bracket'); const b = wSay('clerk', 'bracket').text; const c = wSay('clerk', 'charter').text; return { a, before, b, c, s: " + ST + " }; })()")
        check(r['before'] is None, 'it doesn\'t start before the First Bracket is home', r)
        check('CHARTER' in r['b'], 'Foss notices the frame once the First Bracket is home', r['b'])
        check('Vesper was there' in r['c'] and r['s']['st'] == 'active', 'then asking Foss about the CHARTER starts it', r)

        # ---------- 1. Vesper ----------
        r = await pg.evaluate("(() => { const a = wSay('gk_court', 'vesper').act || ''; const t = wSay('vesper', 'charter').text; const b = wSay('gk_court', 'vesper').act; return { a, t, b }; })()")
        check(not r['a'].startswith('adv:') and 'Charter Court' in r['t'] and r['b'] == 'adv:charter:1', 'Vesper sends you to the Charter Court, whose keeper then offers the game', r)
        g0 = await pg.evaluate("RUN.gold")
        why, seen = await play_card(pg, 1, "({ sport: B.sport, lead: B.enemies[0].n })")
        r = await pg.evaluate(ST)
        check(why == '' and seen['sport'] == 'basketball' and seen['lead'] == 'Gant Vesper', 'it\'s basketball, against Gant Vesper himself', seen)
        check(r['ch'] == 1 and r['items'] == {'ch_vesper': 1} and await pg.evaluate("RUN.gold") - g0 >= 40, 'winning it gives his piece, and the chapter pays', r)

        # ---------- 2. four pieces ----------
        r = await pg.evaluate("(() => { const a = wSay('hermit', 'charter').text; const t = wSay('clerk', 'pieces').text; return { a, t, flags: ['clue_shrine', 'clue_marigold', 'clue_chapel'].map(wFlag) }; })()")
        check('Hermit Oak' in r['t'] and all(r['flags']), 'Foss names the four and marks the old places on the map', r)
        # Mosswold: old rules
        await pg.evaluate("(() => { RUN.relics.push('boots'); wGainCard('gr_helmet', 'test'); wGainCard('tour_showstop', 'test'); wGainCard('gob_smoke', 'test'); wSay('hermit', 'charter'); })()")
        r = await pg.evaluate("(() => { wRunAct(wSay('hermit', 'rules').act, 'hermit'); return document.getElementById('modalBox').textContent; })()")
        check('Old rules' in r, 'the hermit\'s game card says it\'s under the old rules', r[:300])
        await pg.evaluate(CLOSE_ALL)
        why, seen = await play_card(pg, 2, """(() => { const all = B.draw.concat(B.hand, B.discard); return { gear: all.filter(c => ['gear', 'play'].includes(def(c).type) || def(c).rar === 'l').map(c => c.id), n: all.length,
          relics: RUN.relics.slice(), held: (RUN.oldRelics || []).slice(), rules: RUN.pending.world.rules, uncommon: all.some(c => c.id === 'gob_smoke') }; })()""")
        check(why == '' and seen['rules'] == 'old' and seen['gear'] == [] and seen['n'] >= 5, 'under the old rules there\'s no gear, no set plays and no Hall of Fame cards', seen)
        check(seen['uncommon'], 'and nothing else is taken out (an uncommon card still plays)', seen)
        check(seen['relics'] == [] and 'boots' in seen['held'], 'and the trophies are set aside for the game', seen)
        r = await pg.evaluate("({ relics: RUN.relics.includes('boots'), helmet: RUN.deck.some(c => c.id === 'gr_helmet'), s: " + ST + " })")
        check(r['relics'] and r['helmet'], 'after the game the trophies and the whole deck are back', r)
        check(r['s']['items'].get('ch_moss') == 1, 'the hermit gives the Mosswold piece', r)
        # Brinefen: the tide
        r = await pg.evaluate("(() => { wSay('marrowbone', 'charter'); return { t: wSay('marrowbone', 'tide').text, tide: wTide(), times: wTideTimes() }; })()")
        check('Low water today about' in r['t'] and r['tide'] in ('low', 'rising', 'high', 'falling') and all(len(x) == 5 for x in r['times']), 'Marrowbone tells you the tide', r)
        r = await pg.evaluate("""(() => { const t0 = wTide, n0 = wNightTalk, M = MAPS.marigold; wTide = () => 'high'; wNightTalk = () => true; wEnterMap('marigold', M.spawn[0], M.spawn[1]); const high = !!wAdvState('charter').items.ch_tide;
          wTide = () => 'low'; wNightTalk = () => false; wEnterMap('marigold', M.spawn[0], M.spawn[1]); const day = !!wAdvState('charter').items.ch_tide;
          wTide = () => 'low'; wNightTalk = () => true; wEnterMap('marigold', M.spawn[0], M.spawn[1]); const ok = !!wAdvState('charter').items.ch_tide; wTide = t0; wNightTalk = n0; return { high, day, ok }; })()""")
        check(r == {'high': False, 'day': False, 'ok': True}, 'the Marigold\'s hold gives its piece only at low tide after dark', r)
        # Cindermaw: the ring
        r = await pg.evaluate("""(() => { wSay('gk_ring', 'charter'); const act = wSay('gk_ring', 'bout').act; let tries = 0;
          for (; tries < 10 && !wAdvState('charter').items.ch_ember; tries++) { if (WG.bxg) WG.bxg.met = {}; const o = { club: 'local', how: 'sim', tier: 2, kind: 'adv', ref: 'charter:1:6' }, mine = wRingSide(new Set()), theirs = wRingOpp('local', 2, new Set());
            wRingGo(o, mine, theirs, wBX.cardAuto(mine.fighters, theirs.fighters)); for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox button'); if (b) b.click(); } }
          return { act, tries, got: !!wAdvState('charter').items.ch_ember }; })()""")
        check(r['act'] == 'adv:charter:6' and r['got'], 'Ma Gristle\'s bout is a boxing card, and winning it gives the Cindermaw piece', r)
        await pg.evaluate(CLOSE_ALL)
        # Frostspire: the snow, then the chapel
        r = await pg.evaluate("""(() => { const w0 = wWeather; wWeather = () => null; wSay('halvard', 'charter'); wRunAct(wSay('halvard', 'snow').act, 'halvard');
          const why = (document.getElementById('wAdvWhy') || {}).textContent || '', off = document.getElementById('wAdvPlay').disabled; wWeather = w0; return { why, off }; })()""")
        check('blizzard' in r['why'] and r['off'], 'Halvard\'s game isn\'t offered in clear weather', r)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { window.__w0 = wWeather; wWeather = () => 'blizzard'; })()")
        why, _ = await play_card(pg, 8)
        await pg.evaluate("(() => { wWeather = window.__w0; })()")
        r = await pg.evaluate("(() => { const a = !!wAdvState('charter').items.ch_rime, M = MAPS.frozenchapel; wEnterMap('frozenchapel', M.spawn[0], M.spawn[1]); return { before: a, s: " + ST + " }; })()")
        check(why == '' and not r['before'] and r['s']['ch'] == 2 and sorted(r['s']['items']) == sorted(PIECES), 'winning in the blizzard, then the chapel, gives the last piece and finishes the chapter', r)

        # ---------- 3. the founding rule ----------
        r = await pg.evaluate("(() => { const t = wSay('clerk', 'pieces').text; const s = " + ST + "; wRunAct(wSay('herald', 'exhibition').act, 'herald'); const b = document.getElementById('modalBox').textContent, w = (document.getElementById('wAdvWarn') || {}).textContent; return { t, s, b, w }; })()")
        check('three clear points' in r['t'] and r['s']['items'] == {}, 'Foss takes the five pieces and reads out the lost rule', r)
        check(r['w'] == "This can't be retried." and 'Win by at least 3.' in r['b'] and 'Old rules' in r['b'], 'the exhibition says it can\'t be retried, and states the founders\' rule', r['b'][:400])
        await pg.evaluate(CLOSE_ALL)
        snap = await pg.evaluate("localStorage.getItem(wAdvKey())")
        r = await pg.evaluate("(() => { W_ON_END.adv('lose', 'charter:2:1', { kind: 'adv' }); wOpenJournal('adv'); const j = document.getElementById('wJBody').textContent; return { s: " + ST + ", j }; })()")
        check(r['s']['st'] == 'lost' and 'Ended badly' in r['j'] and 'back in a drawer' in r['j'], 'losing the exhibition ends the story badly, and the journal says so', r)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(s) => localStorage.setItem(wAdvKey(), s)", snap)
        r = await pg.evaluate("""(() => { const g0 = RUN.gold; RUN.games.push({ us: 6, them: 2, sport: 'soccer' }); W_ON_END.adv('win', 'charter:2:1', { kind: 'adv' });
          const s = """ + ST + """; const again = wSay('clerk', 'founders').text;
          return { s, gold: RUN.gold - g0, relic: RUN.relics.includes('founders'), card: RUN.deck.some(c => c.id === 'adv_founding'), again }; })()""")
        check(r['s']['st'] == 'won' and r['gold'] >= 200 and r['relic'] and r['card'], 'winning it finishes the charter: gold, the Founder\'s Charm and The Founding Rule', r)
        check(r['again'] == 'You have them already.', 'asking Foss again on the same journey gives nothing more', r)
        r = await pg.evaluate("(() => { wOpenJournal('adv'); const j = document.getElementById('wJBody').textContent; return { j, charter: wSay('clerk', 'charter').text, bracket: wSay('clerk', 'bracket').text }; })()")
        check('Finished' in r['j'] and 'FOUNDERS' in r['j'] and "Founder's Charm" in r['j'], 'the journal shows it finished, and where Foss keeps the reward', r['j'][:300])
        check('Framed' in r['charter'] and 'torn page' not in r['bracket'], 'Foss\'s lines about the charter follow the story once it\'s done', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("(() => { const p = new Set(); for (let i = 0; i < 40; i++) relicPool().forEach(k => p.add(k)); return { pool: p.has('founders'), hof: !!CARDS.adv_founding && CARDS.adv_founding.rar === 'l' }; })()")
        check(not r['pool'] and r['hof'], 'no trophy pool offers the Founder\'s Charm; The Founding Rule is a Hall of Fame card', r)
        r = await pg.evaluate("(() => { startMatch({ type: 'normal', tier: 1, card: false, ids: ['cheer', 'cheer'], world: { kind: 'wild' } }); const st = { str: B.P.st.str || 0, dex: B.P.st.dex || 0 }; B.forfeit = 1; B.over = 'lose'; finishFight(); RUN.hp = RUN.maxhp; return st; })()")
        check(r['str'] >= 1 and r['dex'] >= 1, 'the Founder\'s Charm works: 1 Strength and 1 Footwork at the start of a fight', r)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wSave()")

        # ---------- a new journey ----------
        await new_journey(pg)
        r = await pg.evaluate("""(() => { const s = """ + ST + """, had = RUN.relics.includes('founders'); const L = DB.locs.find(l => l.id === 'saltmere'), M = MAPS.saltmere; wEnterMap('saltmere', M.spawn[0], M.spawn[1]);
          const flags = ['clue_shrine', 'clue_marigold', 'clue_chapel'].map(wFlag); const t = wSay('clerk', 'founders').text;
          return { s, had, flags, t, relic: RUN.relics.includes('founders'), card: RUN.deck.some(c => c.id === 'adv_founding') }; })()""")
        check(r['s']['st'] == 'won' and not r['had'] and r['relic'] and r['card'], 'on a new journey Foss hands over the Founder\'s Charm and The Founding Rule again', r)
        check(all(r['flags']), 'and the places the charter showed you are still on the map', r)

        # ---------- the bell, How to play ----------
        r = await pg.evaluate("""(() => { const ring = { kind: 'bell', ring: { item: 'tuningrod', night: 1, set: 'rq_aur2' } }; wEncounterHook('rime', '&', ring); const early = wFlag('rq_aur2');
          wSetFlag('rq_aur1'); wEncounterHook('rime', '&', ring); return { early, b: wFlag('rq_aur2') }; })()""")
        check(not r['early'] and r['b'], 'striking the Frozen Chapel bell sets its quest flag, once Halvard has sent you', r)
        r = await pg.evaluate("(() => { const d = WG.dayAbs * 24 + 24, a = wTidePhase(d - 1 / 60), b = wTidePhase(d); return { a, b, step: ((b - a) + 12.4) % 12.4, times: wTideTimes() }; })()")
        check(abs(r['step'] - 1 / 60) < 1e-6 and 1 <= len(r['times']) <= 2, 'the tide runs on without a jump at midnight, with one or two low waters a day', r)
        r = await pg.evaluate("(() => { renderHelp(); const t = id => (document.getElementById(id) || {}).textContent || ''; return { tide: t('wHelpTide'), old: t('wHelpOldRules'), adv: t('wHelpAdventures') }; })()")
        check('TIDE' in r['tide'] and 'Hall of Fame' in r['old'] and 'Charter' not in r['adv'], 'How to play explains the tide and old rules, and still names no adventure', r)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
