# Realm touring team (epic 2, phase 9): the Barnstormers tour the realm, a few days a region, tracked by rumour
# (innkeepers' BARNSTORMERS, the notice board's poster; a day behind after a move). In their region's open country
# they turn up for a hard match; beat them for Showstopper (a Hall of Fame card no pool offers), gold and fans, and
# they go home for the year. Lose and they move on. Checks the tour, the rumours, a real match, the card, the save
# and How to play.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-tour-*.png.
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
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 900); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 160) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .4)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_TOUR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the tour and the rumours ----------
        t0 = await pg.evaluate("({ T: JSON.parse(JSON.stringify(wTour())), on: wTourOn(), r: wTourRumour(), day: WG.dayAbs })")
        check(t0['T']['region'] != 'plains' and t0['T']['since'] == 3 and not t0['on'] and 'coming' in t0['r'], 'the tour starts on day 3, away from the Charter Plains; before then the rumour says they are coming', t0)
        on = await pg.evaluate("(() => { wAdvance((3 - WG.dayAbs) * 1440); return { on: wTourOn(), r: wTourRumour(), where: wRegThe(wTour().region) }; })()")
        check(on['on'] and on['where'] in on['r'], 'once they start, rumours say where they are', on)
        mv = await pg.evaluate("""(() => { const T = wTour(), a = T.region; wAdvance(W_TOUR.stay * 1440); const b = T.region, r1 = wTourRumour(); wAdvance(1440); const r2 = wTourRumour();
          return { a, b, prev: T.prev, r1, r2, wa: wRegThe(a), wb: wRegThe(b) }; })()""")
        check(mv['a'] != mv['b'] and mv['prev'] == mv['a'], 'after their stay they move to another region', mv)
        check(mv['wa'] in mv['r1'] and 'last anybody heard' in mv['r1'] and mv['wb'] in mv['r2'], 'for a day the rumour is behind; then it catches up', mv)
        talk = await pg.evaluate("(() => { const t = wSay('hq_inn', 'barnstormers'); const n0 = WLOG.length; wRunAct(t.act, 'hq_inn'); return { act: t.act, log: WLOG.slice(n0).map(l => l[0]).join(' ') }; })()")
        check(talk['act'] == 'tour' and 'Barnstormers' in talk['log'], 'innkeepers pass on the rumour (BARNSTORMERS)', talk)
        await pg.evaluate("(() => { wEnterMap('graftonbury', MAPS.graftonbury.spawn[0], MAPS.graftonbury.spawn[1]); wOpenBoard('graftonbury'); })()")
        poster = await pg.evaluate("(() => { const e = document.querySelector('#modalBox .wtour'); return e ? e.textContent : ''; })()")
        check('Barnstormers' in poster, 'the notice boards carry their poster', poster)
        await pg.evaluate(CLOSE_ALL)

        # ---------- they turn up in their region's open country ----------
        none = await pg.evaluate("""(() => { const T = wTour(), p0 = W_TOUR.p; W_TOUR.p = 1; WG.grace = 0; const other = Object.keys(DB.regions).find(r => r !== T.region);
          RUN.pending = null; const enc = wEncounterHook(other, '.', null); W_TOUR.p = p0; return !!(RUN.pending && RUN.pending.world && RUN.pending.world.kind === 'tour') || (enc && enc.world && enc.world.kind === 'tour'); })()""")
        check(not none, 'they do not turn up outside their region')
        nocup = await pg.evaluate("(() => { const T = wTour(), p0 = W_TOUR.p; W_TOUR.p = 1; WG.grace = 0; RUN.pending = null; T.region = 'rime'; wEncounterHook('rime', '.', null); W_TOUR.p = p0; return !!(RUN.pending && RUN.pending.world && RUN.pending.world.kind === 'tour') || !!document.querySelector('#modalBox .wtaunt'); })()")
        check(not nocup, 'nor before you hold a cup')
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wSetFlag(DB.cups.moss.flag)")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("""(() => { const T = wTour(); T.region = 'rime'; const L = DB.locs.find(l => l.map === 'rimewatch'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60;
          WG.wx = { day: WG.dayAbs, by: {} }; WG.grace = 0; const p0 = W_TOUR.p; W_TOUR.p = 1; wEncounterHook('rime', '.', null); W_TOUR.p = p0; })()""")
        await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("({ t: document.querySelector('#modalBox .wtaunt') ? document.querySelector('#modalBox .wtaunt').textContent : '', title: document.querySelector('#modalBox h3').textContent, W: RUN.pending ? null : 'card' })")
        check('Barnstormers' in pre['t'] and 'Showstopper' in pre['t'] and 'Ringmaster' in pre['title'], 'the Barnstormers turn up; the card says what is on offer', pre)
        await pg.screenshot(path='/tmp/realm-tour-pregame.png')
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        m = await pg.evaluate("({ type: B.type, tier: RUN.pending.world.tier, kind: RUN.pending.world.kind, team: B.enemies.map(e => e.team && e.team.name) })")
        check(m['type'] == 'boss' and m['tier'] == 3 and m['kind'] == 'tour' and all(t == 'The Barnstormers' for t in m['team']), 'a boss match, in their colours', m)
        await pg.wait_for_timeout(500); await pg.screenshot(path='/tmp/realm-tour-match.png')
        g0 = await pg.evaluate("({ gold: RUN.gold, fans: RUN.fans || 0 })")
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the match is won', view)
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        won = await pg.evaluate("({ card: RUN.deck.some(c => c.id === 'tour_showstop'), gold: RUN.gold, fans: RUN.fans || 0, beat: wTour().beat, year: WG.year, on: wTourOn(), r: wTourRumour() })")
        check(won['card'] and won['fans'] - g0['fans'] >= 40 and won['gold'] - g0['gold'] >= 150, 'beating them pays Showstopper, 150 gold and 40 fans', [g0, won])
        check(won['beat'] == [won['year']] and not won['on'] and 'home' in won['r'], 'then they go home for the year', won)
        await pg.evaluate(CLOSE_ALL)
        card = await pg.evaluate("({ pools: ['c', 'u', 'r', 'l'].some(r => cardPool(r).some(c => c.id === 'tour_showstop')), rar: CARDS.tour_showstop.rar, text: cardText(mkCard('tour_showstop'), {}) })")
        check(not card['pools'] and card['rar'] == 'l' and 'ALL' in card['text'].upper(), 'Showstopper is a Hall of Fame card no reward pool offers', card)

        # ---------- a loss: they move on; next year, a purse only ----------
        lose = await pg.evaluate("""(() => { const T = wTour(); T.beat = []; const a = T.region; W_ON_END.tour('lose', {}, {}); return { moved: T.region !== a, since: T.since, day: WG.dayAbs }; })()""")
        check(lose['moved'] and lose['since'] == lose['day'] + 1, 'lose, and they move on', lose)
        again = await pg.evaluate("""(() => { const T = wTour(); T.beat = [WG.year - 1]; const n0 = RUN.deck.filter(c => c.id === 'tour_showstop').length, g0 = RUN.gold;
          W_ON_END.tour('win', {}, {}); return { cards: RUN.deck.filter(c => c.id === 'tour_showstop').length - n0, gold: RUN.gold - g0 }; })()""")
        check(again == {'cards': 0, 'gold': 80}, 'beaten in a later year: a purse, no second card', again)

        # ---------- the save, How to play ----------
        st = await pg.evaluate("(() => { wSave(); return JSON.stringify(WG.tour); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("JSON.stringify(WG.tour)") == st, 'the save keeps the tour')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpTour'); return h ? h.textContent : ''; })()")
        check('Barnstormers' in help_ and 'BARNSTORMERS' in help_ and 'Showstopper' in help_, 'How to play explains the touring team', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm tour passed')

asyncio.run(main())
