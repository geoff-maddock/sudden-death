# Realm soccer (issue #10): the Rimewatch Sheet is now the Hoarfrost Pitch, a soccer ground, so every ground has its
# own sport and the Frostspire plays hockey and soccer. The squad rule asks for five of your own (eleven a side, the
# call-ups fill the rest); a Friendly there is a soccer match; the training spot, notices and the city sign follow;
# an older save loses its curling record there once and keeps a home ground there; How to play names the pitch.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-soccer-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .ghost, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
KINDS = ['troll', 'harpy', 'golem', 'wraith', 'spider']

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_GRD_SQUAD !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(CLOSE_ALL)

        # ---------- every ground its own sport ----------
        g = await pg.evaluate("""(() => ({ sports: W_GRDS.map(g => g.sport), pitch: wGrd('g_sheet') && [wGrd('g_sheet').sport, wGrd('g_sheet').name],
          rime: DB.regions.rime.sports.map(s => s[0]), squad: W_GRD_SQUAD.soccer, why: W_GRD_WHY.soccer,
          topic: !!DB.chars.gk_sheet.topics.soccer, curling: W_GRDS.filter(g => g.sport === 'curling').map(g => g.id) }))()""")
        check(len(set(g['sports'])) == len(g['sports']) == 10, 'ten grounds, ten different sports', g['sports'])
        check(g['pitch'] == ['soccer', 'The Hoarfrost Pitch'], 'the Rimewatch Sheet is now the Hoarfrost Pitch, a soccer ground', g['pitch'])
        check(g['curling'] == ['g_shed'], 'curling is played only at the Curling Shed in Saltmere', g['curling'])
        check(g['rime'] == ['hockey', 'soccer'], 'the Frostspire plays hockey and soccer', g['rime'])
        check(g['squad'] == 5 and 'eleven' in g['why'] and 'five of your own' in g['why'], 'soccer is eleven a side: five of your own, and call-ups fill the rest', [g['squad'], g['why']])
        check(g['topic'], 'Sister Hogline explains how SOCCER scores')

        # ---------- the squad rule ----------
        short = await pg.evaluate("wGrdProblems('g_sheet')")
        check(short and 'Recruit' in short[0] and '2' in short[0], 'with the three founders, the pitch says to recruit 2 more', short)
        await pg.evaluate(f"(() => {{ const K = {json.dumps(KINDS)}; let i = 0; while (wRoster().length < 5 && i < 10) wRecruit({{ kind: K[i++ % K.length], lvl: 2 }}, 'tavern'); }})()")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("!wGrdProblems('g_sheet').length"), 'with five of your own, the pitch hosts you')

        # ---------- a Friendly at the pitch ----------
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'g_sheet'); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); })()")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("WG.map === 'g_sheet' && wCurMap().field && wCurMap().field.sport === 'soccer'"), 'walking in shows the snow pitch', await pg.evaluate("WG.map"))
        await pg.wait_for_timeout(600)
        await pg.screenshot(path='/tmp/realm-soccer-pitch.png')
        await pg.evaluate("(() => { const r = wSay('gk_sheet', 'game'); wRunAct(r.act, 'gk_sheet'); })()")
        await pg.click('[data-gplay="friendly"]')
        await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("document.getElementById('modalBox').textContent")
        check('Hoarfrost Pitch' in pre and 'soccer only' in pre.lower(), 'the pre-game card: a Friendly at the Hoarfrost Pitch, soccer only', pre[:300])
        await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        f = await pg.evaluate("({ sport: B.sport, kind: RUN.pending.world.kind, g: RUN.pending.world.ref.g })")
        check(f == {'sport': 'soccer', 'kind': 'ground', 'g': 'g_sheet'}, 'the match is soccer, at the pitch', f)
        await pg.screenshot(path='/tmp/realm-soccer-match.png')
        await pg.evaluate("(() => { if (typeof wConcede === 'function') wConcede(); })()")
        await pg.wait_for_timeout(300)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the spot, the notices, the sign ----------
        o = await pg.evaluate("""(() => ({ spot: (W_SPOTS.find(s => s.id === 'sp_maker') || {}).sport, margin: W_NOTICE.margin.soccer,
          sign: JSON.stringify(W_CITIES.rimewatch || DB.towns.find(t => t.id === 'rimewatch')).includes('Hoarfrost Pitch') }))()""")
        check(o == {'spot': 'soccer', 'margin': 2, 'sign': True}, "Rimewatch's second training spot is soccer's, notices know soccer, and the sign names the pitch", o)

        # ---------- an older save ----------
        old = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); B = null; RUN.pending = null; save.RUN.pending = null; save.RUN.battle = null;
          delete save.WG.soccer; save.WG.grd = save.WG.grd || { met: {}, rec: {} }; save.WG.grd.rec = Object.assign({}, save.WG.grd.rec, { g_sheet: { w: 2, l: 1, last: null }, g_shed: { w: 1, l: 0, last: null } });
          save.WG.ground = { town: 'rimewatch', grd: 'g_sheet', up: [] };
          save.WG.notice = { boards: { rimewatch: { week: 0, list: [{ id: 'nb1', city: 'rimewatch', region: 'rime', t: 'sport', sport: 'curling' }, { id: 'nb2', city: 'rimewatch', region: 'rime', t: 'sport', sport: 'hockey' }] } },
            taken: [{ id: 'nt1', city: 'rimewatch', region: 'rime', t: 'margin', sport: 'curling', n: 2 }, { id: 'nt2', city: 'saltmere', region: 'tide', t: 'margin', sport: 'curling', n: 2 }], done: 0, lapsed: 0 };
          wStart(save); return { taken: WG.notice.taken.map(c => c.id), board: WG.notice.boards.rimewatch.list.map(c => c.id), rec: !!WG.grd.rec.g_sheet, shed: !!WG.grd.rec.g_shed, home: WG.ground && WG.ground.grd, flag: WG.soccer,
            log: WLOG.some(l => String(l[0]).includes('Hoarfrost Pitch')) }; })()""")
        check(old['rec'] is False and old['shed'] is True and old['flag'] == 1, 'an older save loses its curling record at the pitch, once, and keeps the rest', old)
        check(old['home'] == 'g_sheet' and old['log'], 'a home ground there stays yours, and the log says what changed', old)
        check(old['taken'] == ['nt2'] and old['board'] == ['nb2'], 'curling contracts in the Frostspire come down (taken and on the board); Saltmere\'s stay', old)
        again = await pg.evaluate("(() => { WG.grd.rec.g_sheet = { w: 1, l: 0, last: null }; wStart(JSON.parse(JSON.stringify({ WG, RUN }))); return !!WG.grd.rec.g_sheet; })()")
        check(again, 'after that, a soccer record there is kept')

        cb = await pg.evaluate("[W_COMBOS.includes('wb_wallpass'), CARDS.wb_wallpass && CARDS.wb_wallpass.sport]")
        check(cb == [True, 'soccer'], 'a bond can bring a soccer combo card, Wall Pass', cb)

        # ---------- How to play ----------
        h = await pg.evaluate("(() => { renderHelp(); const a = document.getElementById('wHelpGrounds'), b = document.getElementById('wHelpSpots'); return [a ? a.textContent : '', b ? b.textContent : '']; })()")
        check('snow pitch for soccer at Rimewatch' in h[0] and 'kick-about wall' in h[1], 'How to play names the pitch and the kick-about wall', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
