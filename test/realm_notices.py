# Realm notice boards (epic 2, phase 4): every city's inn posts contracts for its region each week (ask the innkeeper
# about the NOTICES, or the inn's Notice board button). Take up to three; each runs seven days. A won match that meets
# one finishes it at once and pays gold and fans (some add a pick of cards). Checks the board, taking and dropping, a
# real night match that meets a contract, every contract type's rule, counting, lapsing, the save, the journal, How to
# play, and a clean audit.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-notices-*.png.
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
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 600); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 120) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .5)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_NOTICE !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the boards ----------
        boards = await pg.evaluate("""Object.keys(W_NOTICE_CITY).map(c => { const b = wBoard(c), k = W_NOTICE_CITY[c], t = wSay(k, 'notices');
          return { c, n: b.list.length, types: b.list.map(x => x.t), texts: b.list.map(wNoticeText), region: b.list.every(x => x.region === W_GRD_REG[c]),
            greet: DB.chars[k].greet.includes('NOTICES'), act: t.act, pay: b.list.every(x => x.pay.gold > 0 && x.pay.fans > 0) }; })""")
        check(all(b['n'] == 3 and len(set(b['types'])) == 3 and b['region'] and b['pay'] for b in boards), 'every city\'s board posts three different contracts for its region, each paying', boards)
        check(all(b['greet'] and b['act'] == 'board' for b in boards), 'every innkeeper mentions the NOTICES and opens the board', boards)
        check(all('undefined' not in t and 'null' not in t for b in boards for t in b['texts']), 'every contract reads properly', [t for b in boards for t in b['texts']])
        same = await pg.evaluate("(() => { const a = wBoard('saltmere').list.map(c => c.id).join(); return a === wBoard('saltmere').list.map(c => c.id).join(); })()")
        check(same, 'the board stays the same all week')
        # every type can be made in every city that has it
        mk = await pg.evaluate("""Object.keys(W_NOTICE_CITY).flatMap(c => Object.keys(W_NOTICE.gold).map(t => { const n = wMakeNotice(c, t); return [c, t, n ? wNoticeText(n) : null]; }))""")
        check(all(m[2] for m in mk), 'every contract type can be drawn up in every city', [m for m in mk if not m[2]])

        # ---------- the inn's button, taking and dropping ----------
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.map === 'rimewatch'); wEnterMap('rimewatch', MAPS.rimewatch.spawn[0], MAPS.rimewatch.spawn[1]); wOpenInn(12, 'The innkeeper'); })()")
        check(await pg.evaluate("!!document.getElementById('wInnBoard')"), 'the inn has a Notice board button')
        await pg.click('#wInnBoard'); await pg.wait_for_selector('[data-ntake]')
        await pg.wait_for_timeout(400); await pg.screenshot(path='/tmp/realm-notices-board.png')
        # put a night contract on the board, then take it by its button
        nid = await pg.evaluate("""(() => { const b = wBoard('rimewatch'), c = wMakeNotice('rimewatch', 'night'); b.list.unshift(c); return c.id; })()""")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wOpenBoard('rimewatch')")
        await pg.click(f'[data-ntake="{nid}"]'); await pg.wait_for_selector('[data-ndrop]')
        tk = await pg.evaluate(f"({{ n: wNotices().taken.length, c: wNoticeTaken('{nid}'), board: wBoard('rimewatch').list.some(c => c.id === '{nid}'), day: WG.dayAbs }})")
        check(tk['n'] == 1 and tk['c'] and tk['c']['until'] == tk['day'] + 7 and not tk['board'], 'a taken contract leaves the board and runs seven days', tk)
        more = await pg.evaluate("""(() => { const b = wBoard('rimewatch'); const ids = b.list.map(c => c.id); const r = ids.map(id => wTakeNotice('rimewatch', id)); return { r, n: wNotices().taken.length }; })()""")
        check(more['n'] == 3 and more['r'][-1] != '' and 'at a time' in more['r'][-1], 'three contracts at a time', more)
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wOpenBoard('rimewatch')")
        await pg.screenshot(path='/tmp/realm-notices-taken.png')
        drop = await pg.evaluate("(() => { const id = wNotices().taken.find(c => c.t !== 'night').id; document.querySelector(`[data-ndrop=\"${id}\"]`).click(); return { n: wNotices().taken.length, gone: !wNoticeTaken(id) }; })()")
        check(drop['n'] == 2 and drop['gone'], 'drop a contract', drop)
        await pg.evaluate(CLOSE_ALL)

        # ---------- a real match: a night game in the Frostspire meets the night contract ----------
        await pg.evaluate("""(() => { const L = DB.locs.find(l => l.map === 'rimewatch'); WG.notice.taken = WG.notice.taken.filter(c => c.id === '""" + nid + """');
          wEnterMap('world', L.x, L.y + 1); WG.min = 23 * 60; wWildMatch('rime'); })()""")
        await pg.wait_for_selector('#wPlay'); await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        st = await pg.evaluate(f"(() => {{ const c = wNoticeTaken('{nid}'); c.sport = B.sport; return {{ night: RUN.pending.world.night, region: RUN.pending.world.region, sport: B.sport, gold: RUN.gold, fans: RUN.fans || 0, pay: c.pay }}; }})()")
        check(st['night'] == 1 and st['region'] == 'rime', 'a night game in the Frostspire', st)
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the match is won', view)
        g0 = await pg.evaluate("RUN.gold")
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        dn = await pg.evaluate(f"({{ gold: RUN.gold, fans: RUN.fans || 0, taken: !!wNoticeTaken('{nid}'), done: wNotices().done, log: WLOG.slice(-6).map(l => l[0]).join(' ') }})")
        check(not dn['taken'] and dn['done'] == 1 and dn['gold'] - g0 >= st['pay']['gold'] and dn['fans'] - st['fans'] >= st['pay']['fans'] and f"{st['pay']['gold']} gold and {st['pay']['fans']} fans" in dn['log'], 'the win finishes the contract and pays its gold at once', [st, g0, dn])
        await pg.evaluate(CLOSE_ALL)

        # ---------- every type's rule ----------
        rules = await pg.evaluate("""(() => {
          const club = wNoticeClub('tide'), gs = wGrdsOf('saltmere')[0].id;
          const C = t => Object.assign(wMakeNotice('saltmere', t), t === 'margin' ? { sport: 'curling', n: 2 } : t === 'sport' ? { sport: 'bowling' } : {});
          const M = o => Object.assign({ region: 'tide', sport: 'bowling', night: false, us: 0, them: 0, won: true, club: null, g: null, type: 'normal' }, o);
          return {
            sport: [wNoticeMet(C('sport'), M({})), wNoticeMet(C('sport'), M({ sport: 'curling' })), wNoticeMet(C('sport'), M({ region: 'rime' }))],
            margin: [wNoticeMet(C('margin'), M({ sport: 'curling', us: 4, them: 2 })), wNoticeMet(C('margin'), M({ sport: 'curling', us: 3, them: 2 })), wNoticeMet(C('margin'), M({ sport: 'curling', us: 5, them: 1, won: false }))],
            club: [wNoticeMet(C('club'), M({ club, region: 'plains' })), wNoticeMet(C('club'), M({ club: 'apex' }))],
            ground: [wNoticeMet(Object.assign(C('ground'), { g: gs }), M({ g: gs })), wNoticeMet(Object.assign(C('ground'), { g: gs }), M({}))],
            seeded: [wNoticeMet(C('seeded'), M({ type: 'elite' })), wNoticeMet(C('seeded'), M({}))],
            apex: wNoticeClub('plains'), rival: club, gb: wMakeNotice('graftonbury', 'ground').g };
        })()""")
        check(rules['sport'] == [True, False, False], 'a sport contract wants that sport, in that region', rules['sport'])
        check(rules['margin'] == [True, False, False], 'a margin contract wants a scoreboard win by enough', rules['margin'])
        check(rules['club'] == [True, False] and rules['rival'] and rules['apex'] == 'apex', 'a club contract wants that club, anywhere; the Charter Plains\' is Apex Athletic', rules)
        check(rules['ground'] == [True, False] and rules['gb'] != 'g_ballpark', 'a ground contract wants that ground, never the Ballpark', rules)
        check(rules['seeded'] == [True, False], 'a seeded contract wants a team with a scouting report', rules['seeded'])

        # ---------- counting, a card pick, lapsing ----------
        cnt = await pg.evaluate("""(() => { const N = wNotices(); N.taken = []; const c = wMakeNotice('mossgate', 'count'); c.until = WG.dayAbs + 7; N.taken.push(c);
          const win = () => { RUN.games.push({ sport: 'golf', us: 0, them: 0, won: true, type: 'normal' }); wDispatchEnd({ kind: 'wild', region: 'bloom', ref: null, tier: 2 }, 'win'); };
          win(); const a = c.prog; win(); const b = c.prog; WG.cardOffer = null; win();
          return { a, b, left: !!wNoticeTaken(c.id), offer: !!WG.cardOffer, card: c.pay.card }; })()""")
        check(cnt['a'] == 1 and cnt['b'] == 2 and not cnt['left'], 'a count contract counts wins in its region, and is done at three', cnt)
        check(cnt['offer'] and cnt['card'] == 1, 'it pays a pick of cards too', cnt)
        await pg.evaluate(CLOSE_ALL)
        lap = await pg.evaluate("""(() => { const N = wNotices(), c = wMakeNotice('cinderhold', 'sport'); c.until = WG.dayAbs + 1; N.taken = [c]; const l0 = N.lapsed;
          wAdvance(24 * 60); const one = !!wNoticeTaken(c.id); wAdvance(24 * 60); return { one, two: !!wNoticeTaken(c.id), lapsed: N.lapsed - l0, log: WLOG.slice(-8).map(l => l[0]).join(' ') }; })()""")
        check(lap['one'] and not lap['two'] and lap['lapsed'] == 1 and 'lapses' in lap['log'], 'a contract lapses when its days run out', lap)
        nw = await pg.evaluate("(() => { const a = wBoard('cinderhold').list.map(c => c.id).join(); WG.dayAbs += 7; WG.day += 7; return a !== wBoard('cinderhold').list.map(c => c.id).join() && wBoard('cinderhold').list.length === 3; })()")
        check(nw, 'a new week, a new board')

        # ---------- the save, the journal, How to play ----------
        await pg.evaluate("(() => { const c = wMakeNotice('graftonbury', 'club'); c.until = WG.dayAbs + 7; wNotices().taken = [c]; wSave(); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        sv = await pg.evaluate("({ n: wNotices().taken.length, t: wNotices().taken[0] && wNotices().taken[0].t, done: wNotices().done })")
        check(sv['n'] == 1 and sv['t'] == 'club' and sv['done'] == 2, 'the save keeps your contracts and the count', sv)
        await pg.evaluate("wOpenJournal('quests')"); await pg.wait_for_timeout(300)
        jt = await pg.evaluate("document.getElementById('modalBox').textContent")
        check('Contract: Beat Apex Athletic' in jt, 'the journal lists your contracts', jt[:400])
        await pg.screenshot(path='/tmp/realm-notices-journal.png')
        await pg.evaluate(CLOSE_ALL)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpNotices'); return h ? h.textContent : ''; })()")
        check('Notice boards' in help_ and 'NOTICES' in help_, 'How to play explains the notice boards', help_)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm notices passed')

asyncio.run(main())
