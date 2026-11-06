# Realm adventures, phase 4 (issue #47): The Fixed Game, start to finish. Orla Vantage and Referee Dunmore stand in
# their cities on open ground; Marco Fine's rumour and the start (ODDS, no cups needed), naming the club the fixer
# pays on this journey; the thrown game (a real match against that club); the clues in any order: the marked ball
# (baseball), the Saltmere ledger (after dark only), Orla (only after the ledger), and the referee's CROOKED calls (a
# real match: the other side starts with Block, you start Weak); the evidence to Foss and the accusation, a pinnacle
# (a wrong name loses the story); the grudge final against that club in the engine it's best at (a loss is retried);
# the rewards (fans, gold, Rook Halloran, the League honour on the Team screen); and a new journey, where the
# learned lines still hold whichever clubs are drawn. Asserts; exits nonzero on failure.
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
ST = "(() => { const A = wAdvState('fixed'); return A && { st: A.st, ch: A.ch, done: A.done, items: A.items, why: A.why || '' }; })()"

async def new_journey(pg, clear=False):
    await pg.goto(REALM_URL)
    if clear: await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wFixClub === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def win_card(pg, si, look=None):
    why = await pg.evaluate(f"wAdvStartMatch('fixed', {si})")
    seen = await pg.evaluate(look) if look else None
    view = await pg.evaluate(WIN)
    if view == 'panel': await pg.click('#bCont')
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
        await pg.evaluate("(() => { while (wRoster().length < W_PARTY.max - 2) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 4 }, 'tavern')); })()")

        r = await pg.evaluate("""W_FIX_PEOPLE.map(P => { const M = MAPS[P.city], n = M.npcs.find(x => x.id === P.id), ch = M.t[P.at[1]][P.at[0]];
          return { id: P.id, ok: !!n && n.x === P.at[0] && n.y === P.at[1] && !!(DB.tiles[ch] && DB.tiles[ch].walk) && M.npcs.filter(x => x.x === P.at[0] && x.y === P.at[1]).length === 1 }; })""")
        check(all(x['ok'] for x in r), 'Orla Vantage and Referee Dunmore stand in their cities on open ground of their own', r)

        # ---------- the start ----------
        club = await pg.evaluate("CLUBS[wFixClub()].name")
        r = await pg.evaluate("(() => { const n0 = WLOG.length; wRunAct('advrumour', 'hq_inn'); wRunAct('advrumour', 'hq_inn'); const t = wSay('bookie', 'odds').text; return { t, s: " + ST + ", learned: wAdvState('fixed').learned.map(l => l.t).join(' '), long: wSay('bookie', 'long').text }; })()")
        check(club in r['t'] and r['s']['st'] == 'active', 'asking Marco about the ODDS starts it (no cups needed), naming the club they\'re paying on this journey', r)
        check(club not in r['learned'] and ('Three cups' not in r['long'] or 'not got three cups' in r['long']), 'the journal\'s line doesn\'t name the club; Marco\'s LONG shot is unchanged', r)
        r = await pg.evaluate("W_ADV.flatMap(D => [D.starter && D.starter.learn].concat(D.chapters.flatMap(C => C.steps.map(s => s.learn)))).filter(t => t && t.includes('@'))")
        check(r == [], 'no adventure\'s journal line uses an @token (they stay true on any journey)', r)

        # ---------- 1. long odds ----------
        card = await pg.evaluate("(() => { wRunAct(wSay('bookie', 'watch').act, 'bookie'); const t = document.getElementById('modalBox').textContent; return t; })()")
        await pg.evaluate(CLOSE_ALL)
        why, seen = await win_card(pg, 0, "({ lead: B.enemies[0].n, type: B.type, cap: wClubCaptain(wFixClub()) })")
        r = await pg.evaluate(ST)
        check(club in card, 'the game card names the club', card[:200])
        check(why == '' and seen['type'] == 'rival' and seen['lead'] == seen['cap'] and r['ch'] == 1, 'the thrown game is against that club\'s own side, led by its captain, and winning it moves on', {'seen': seen, 's': r})

        # ---------- 2. the clues ----------
        r = await pg.evaluate("""(() => { wSay('gk_ballpark', 'marked'); const act = wSay('gk_ballpark', 'diamond').act; let tries = 0;
          for (; tries < 12 && !wAdvState('fixed').items.fx_ball; tries++) { if (WG.ball) { WG.ball.met = {}; WG.ball.live = null; } wAdvStartMatch('fixed', 1, 'sim');
            for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox button'); if (b) b.click(); } }
          return { act, got: !!wAdvState('fixed').items.fx_ball }; })()""")
        check(r['act'] == 'adv:fixed:1' and r['got'], 'the ballpark keeper\'s marked ball, won at baseball', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const before = wSay('adv_orla', 'league').text, n0 = wIsNight, M = MAPS.saltmere; wIsNight = () => false; wEnterMap('saltmere', M.spawn[0], M.spawn[1]); const day = !!wAdvState('fixed').items.fx_ledger;
          wIsNight = () => true; wEnterMap('saltmere', M.spawn[0], M.spawn[1]); const night = !!wAdvState('fixed').items.fx_ledger; wIsNight = n0; const after = wSay('adv_orla', 'league').text; return { before, day, night, after }; })()""")
        check(not r['day'] and r['night'], 'the ledger page turns up on the Saltmere docks only after dark', r)
        check('O.V.' not in r['before'] and 'O.V.' in r['after'], 'Orla Vantage only gives herself away once you have the ledger', r)
        r = await pg.evaluate("(() => { wSay('adv_ref', 'calls'); wRunAct(wSay('adv_ref', 'crooked').act, 'adv_ref'); return document.getElementById('modalBox').textContent; })()")
        check('Crooked calls' in r, 'the referee\'s game card warns of crooked calls', r[:300])
        await pg.evaluate(CLOSE_ALL)
        why, seen = await win_card(pg, 5, "({ block: alive().map(e => e.block), weak: B.P.st.weak || 0 })")
        r = await pg.evaluate(ST)
        check(why == '' and all(b >= 8 for b in seen['block']) and seen['weak'] >= 1, 'under crooked calls every opponent starts with 8 Block, and you start Weak', seen)
        check(r['ch'] == 2, 'winning through the calls, with the other clues, finishes the chapter', r)

        # ---------- 3. the accusation ----------
        r = await pg.evaluate("(() => { const t = wSay('clerk', 'fixing').text; wRunAct(wSay('clerk', 'accuse').act, 'clerk'); return { t, n: document.querySelectorAll('[data-advopt]').length, warn: (document.getElementById('wAdvWarn') || {}).textContent, s: " + ST + " }; })()")
        check('ACCUSE' in r['t'] and r['s']['items'] == {} and r['n'] == 4 and r['warn'] == "This can't be retried.", 'Foss takes the evidence; the accusation has four names and warns it can\'t be retried', r)
        snap = await pg.evaluate("localStorage.getItem(wAdvKey())")
        r = await pg.evaluate("(() => { document.querySelector('[data-advopt=\"0\"]').click(); wOpenJournal('adv'); return { s: " + ST + ", j: document.getElementById('wJBody').textContent }; })()")
        check(r['s']['st'] == 'lost' and 'Ended badly' in r['j'] and 'night coach' in r['j'], 'naming the wrong one loses the story for good', r)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(s) => localStorage.setItem(wAdvKey(), s)", snap)
        r = await pg.evaluate("(() => { wRunAct(wSay('clerk', 'accuse').act, 'clerk'); document.querySelector('[data-advopt=\"1\"]').click(); return " + ST + "; })()")
        check(r['ch'] == 3 and r['st'] == 'active', 'naming Orla Vantage moves on to the grudge final', r)
        await pg.evaluate(CLOSE_ALL)

        # ---------- 4. the grudge final ----------
        r = await pg.evaluate("""(() => { const s = wAdvStep('fixed', 0); wRunAct(wSay('herald', 'final').act, 'herald'); const card = document.getElementById('modalBox').textContent;
          return { engine: s.engine, club: s.club, want: [W_FXG.best[wFixClub()], wFixClub()], name: wClubName(wFixClub()), game: W_ADV_CFG.engines[wFixEngine()], card }; })()""")
        check([r['engine'], r['club']] == r['want'] and r['game'] in r['card'] and r['name'] in r['card'], 'the grudge final is against that club, in its best game', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("(() => { W_ON_END.adv('lose', 'fixed:3:0', { kind: 'adv', us: 1, them: 3 }); return " + ST + "; })()")
        check(r['st'] == 'active' and r['ch'] == 3, 'losing the grudge final can be tried again', r)
        r = await pg.evaluate("""(() => { const f0 = RUN.fans || 0, g0 = RUN.gold, lv = wStarLvl(); W_ON_END.adv('win', 'fixed:3:0', { kind: 'adv', us: 4, them: 1 }); const rook = wRoster().find(p => p.n === 'Rook Halloran');
          wOpenCamp('team'); const h = (document.getElementById('wAdvHonour') || {}).textContent || '';
          return { s: """ + ST + """, fans: (RUN.fans || 0) - f0, gold: RUN.gold - g0, rook: rook ? [rook.kind, rook.lvl] : null, lv, h }; })()""")
        check(r['s']['st'] == 'won' and r['fans'] >= 80 and r['gold'] >= 150, 'winning it finishes the story: 80 fans and 150 gold', r)
        check(r['rook'] == ['werewolf', r['lv']], 'Rook Halloran joins at the team\'s level', r)
        check('League honour' in r['h'], 'the Team screen shows the League honour', r['h'])
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wSave()")

        # ---------- a new journey ----------
        await new_journey(pg)
        r = await pg.evaluate("""(() => { const had = wRoster().some(p => p.n === 'Rook Halloran'); const t = wSay('herald', 'rook').text; const now = wRoster().some(p => p.n === 'Rook Halloran');
          wOpenCamp('team'); const h = !!document.getElementById('wAdvHonour'); return { had, t, now, h }; })()""")
        check(not r['had'] and r['now'] and r['h'], 'on a new journey Rook joins again at the Crown (ask Pim about ROOK), and the honour is still there', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const S = wAdvAll(), keep = S.a.fixed; S.a.fixed = { st: 'active', ch: 3, done: [], items: {}, learned: keep.learned, since: keep.since }; wAdvSave(S);
          const name = wAdvStep('fixed', 0).club, want = wFixClub(), names = Object.values(CLUBS).map(c => c.name), learned = keep.learned.map(l => l.t).join(' ');
          S.a.fixed = keep; wAdvSave(S); return { name, want, named: names.filter(n => learned.includes(n)) }; })()""")
        check(r['name'] == r['want'] and r['named'] == [], 'carried to a new journey, the story names this journey\'s club, and the journal names none', r)
        r = await pg.evaluate("(() => { renderHelp(); const t = id => (document.getElementById(id) || {}).textContent || ''; return { c: t('wHelpCrooked'), a: t('wHelpAdventures') }; })()")
        check('8 Block' in r['c'] and 'Fixed' not in r['a'], 'How to play explains crooked calls, and still names no adventure', r)
        # ---------- a story game is on even after meeting that club in the same engine today (its own profile: a simulated win pays out) ----------
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const eng = wFixEngine(); if (eng === 'card') return { eng, skip: 1 };
          while (wRoster().length < W_PARTY.max - 1) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 4 }, 'tavern'));
          PROFILES.cur = 'fixSim'; const S = wAdvAll(); S.a.fixed = { st: 'active', ch: 3, done: [], items: {}, learned: [], since: '2026-11-06' }; wAdvSave(S);
          const St = { ball: wBall, grid: wGfg, ring: wBxg }[eng](); St.met[wFixClub()] = WG.dayAbs; St.live = null;
          const why = wAdvStartMatch('fixed', 0, 'sim'); for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox button'); if (b) b.click(); }
          PROFILES.cur = 'guest'; return { eng, why }; })()""")
        check(r.get('skip') or r['why'] == '', 'a story game is on even after meeting that club in the same engine today', r)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
