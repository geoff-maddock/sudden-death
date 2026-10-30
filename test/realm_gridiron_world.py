# Realm gridiron world (issue #9, phase 5): football games from the world. Your seven plays the local side or a rival
# club: Play, Manage or Simulate. A game needs five players of your own; each club plays you once a day. A win pays XP,
# gold and fans by tier, a loss a quarter of the XP and nothing else (question 5), and every game records box lines
# for your players, the head to head and the league table. Save and leave keeps a game at its last call, through a
# reload; Resume puts it back on the field; Concede is a loss. The Seven tab, Clinker Dunn's GRIDIRON, the Stats tab's
# Football view and How to play. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-gridiron-world.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #wGridOk, #wEvWalk, #wEvDone, #wGfLater'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- who can play ----------
        g0 = await pg.evaluate("(() => { const n = wRoster().length; return { n, probs: wGridProblems(), start: n < 5 ? wStartGrid({ club: 'local', how: 'sim' }) : '' }; })()")
        check(g0['n'] >= 5 or ('Recruit' in g0['start'] and g0['probs']), 'a football game needs five players of your own', g0)
        await pg.evaluate("(() => { for (const kind of ['elf', 'harpy', 'troll', 'goblin', 'dwarf']) if (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind, lvl: 1 }, 'tavern')); })()")
        await pg.evaluate(CLOSE)

        # ---------- Simulate: the result at once, paid in the world ----------
        s = await pg.evaluate("""(() => { const xp0 = Object.fromEntries(wRoster().map(p => [p.id, p.xp + (p.lvl - 1) * 1000])), gold0 = RUN.gold, day = WG.dayAbs, min0 = WG.min;
          const r = wStartGrid({ club: 'local', how: 'sim' }); const B = WG.gfg, g = B.games[0];
          const seven = WG.seven.ids.filter(k => typeof k === 'number');
          const got = seven.every(id => wPlayer(id).xp + (wPlayer(id).lvl - 1) * 1000 > xp0[id]);
          const lines = seven.every(id => WG.gfstats[id] && WG.gfstats[id].gg === 1);
          const again = wStartGrid({ club: 'local', how: 'sim' });
          return { r, live: B.live, res: g && g.r, us: g && g.us, them: g && g.them, gold: RUN.gold - gold0, got, lines, again, card: !!document.getElementById('wGridOk'),
            tier: g && g.tier, time: WG.dayAbs > day || WG.min !== min0 }; })()""")
        paid = s['gold'] == (15 * s['tier'] if s['res'] == 'win' else 0)
        check(s['r'] == '' and s['live'] is None and s['res'] in ('win', 'lose', 'tie') and s['got'] and s['lines'] and paid and s['card'] and s['time'],
              'Simulate: a result at once, XP for the seven, gold on a win only, box lines for your players, time passes, and a Final card', s)
        check('already played you' in s['again'], 'each club plays you once a day', s['again'])
        await pg.evaluate(CLOSE)
        # (one at a time, closing the Final and any level-up card pick between them, as a player would)
        lg = []
        for _ in range(6):
            lg.append(await pg.evaluate("(() => { WG.gfg.met = {}; wStartGrid({ club: 'local', how: 'sim' }); const g = WG.gfg.games[0]; return [g.r, g.tier]; })()"))
            await pg.evaluate(CLOSE)
        check(len(lg) == 6, 'six more simulated games settle in a row', lg)

        # ---------- a rival: Manage on the field, Save and leave, a reload, Resume ----------
        rival = await pg.evaluate("wBallClubs().find(c => c !== 'local') || null")
        club = rival or 'local'
        await pg.evaluate("WG.gfg.met = {}")
        check(await pg.evaluate("document.getElementById('modal').hidden"), 'nothing is left open in the world before the next game')
        m = await pg.evaluate(f"wStartGrid({{ club: '{club}', how: 'manage' }})")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.isGame", timeout=8000)
        bar = await pg.evaluate("""({ save: !document.getElementById('wGridSave').hidden, give: !document.getElementById('wGridGive').hidden, again: document.getElementById('wGridAgain').hidden,
          back: document.getElementById('wGridBack').hidden, mode: document.querySelector('#wGridModes .on').dataset.gmode, title: document.getElementById('wGridTitle').textContent, world: WGF.world })""")
        check(m == '' and bar['save'] and bar['give'] and bar['again'] and bar['back'] and bar['mode'] == 'call' and bar['world'] and 'against' in bar['title'],
              'Manage: the game is on the field, your calls, with Save and leave and Concede on the bar (no Start over, no plain Back)', bar)
        await pg.wait_for_function("wGF.phase === 'call' && !!WG.gfg.live.snap", timeout=30000)
        await pg.screenshot(path='/tmp/realm-gridiron-world.png')
        await pg.click('#wGridSave')
        lv = await pg.evaluate("({ view: UI.view, on: wGF.on, snap: !!(WG.gfg.live && WG.gfg.live.snap), log: WLOG.map(l => l.t || l[0] || '').join(' | ').slice(-400) })")
        check(lv['view'] == 'world' and not lv['on'] and lv['snap'], 'Save and leave: back in the world, the game kept at its last call', lv)
        # a reload: the save comes back, and the game is offered once
        rl = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); const sn = save.WG.gfg.live.snap; wStart(save); WGFG.asked = false;
          const asked = wNextPrompt(), card = !!document.getElementById('wGfRes'); return { asked, card, score: sn.G.score, clock: sn.G.clock }; })()""")
        check(rl['asked'] and rl['card'], 'after a reload, a waiting football game is offered once', rl)
        await pg.click('#wGfRes')
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.isGame && WGF.world", timeout=8000)
        rs = await pg.evaluate("({ score: wGF.G.score, clock: wGF.G.clock, ph: wGF.phase, save: !document.getElementById('wGridSave').hidden })")
        check(rs['score'] == rl['score'] and rs['clock'] == rl['clock'] and rs['save'], 'Resume puts the game back on the field where it was', [rl, rs])
        # finish it: a big lead and the clock all but out in the second half; the next play ends it
        await pg.evaluate("(() => { const G = wGF.G; G.half = 2; G.clock = 1; G.score = [28, 0]; wGF.setMode('watch'); })()")
        await pg.wait_for_function("wGF.phase === 'over' && !WG.gfg.live", timeout=60000)
        f = await pg.evaluate("""({ note: document.getElementById('wGridNote').textContent, back: !document.getElementById('wGridBack').hidden, save: document.getElementById('wGridSave').hidden,
          modes: document.getElementById('wGridModes').hidden, g: WG.gfg.games[0], h2h: (WG.h2h['""" + club + """'] || {}).last || null })""")
        check(f['g']['r'] == 'win' and 'you win' in f['note'] and f['back'] and f['save'] and f['modes'], 'a game played out on the field settles in the world: the Final on the bar, Back to the world, no more mode switching', f)
        check(club == 'local' or (f['h2h'] and f['h2h']['sport'] == 'football' and f['h2h']['r'] == 'win'), 'a rival game goes in the head to head', f['h2h'])
        await pg.click('#wGridBack')
        await pg.evaluate(CLOSE)

        # ---------- Concede ----------
        await pg.evaluate("WG.gfg.met = {}")
        await pg.evaluate("wStartGrid({ club: 'local', how: 'play' })")
        await pg.wait_for_function("UI.view === 'gridiron' && WGF && WGF.world", timeout=8000)
        mode = await pg.evaluate("document.querySelector('#wGridModes .on').dataset.gmode")
        await pg.click('#wGridGive')
        title = await pg.evaluate("(document.querySelector('#modal h3') || {}).textContent")
        await pg.click('#cfYes')
        c = await pg.evaluate("({ view: UI.view, live: WG.gfg.live, r: WG.gfg.games[0].r })")
        check(mode == 'play' and title == 'Concede this game?' and c == {'view': 'world', 'live': None, 'r': 'lose'}, 'Play opens on You play; Concede asks, then counts it as a loss', [mode, title, c])
        await pg.evaluate(CLOSE)

        # ---------- around the Realm ----------
        await pg.evaluate("wOpenCamp('seven')"); await pg.wait_for_selector('#modalBox .wseven')
        sv = await pg.evaluate("({ play: !!document.querySelector('[data-gfplay]'), recent: (document.querySelector('#modalBox .wbrh') || {}).textContent || '' })")
        check(sv['play'] and 'Last football games' in sv['recent'], 'the Seven tab has Play a game and the last football games', sv)
        await pg.evaluate(CLOSE)
        k = await pg.evaluate("(() => { const r = wSay('gk_bowl', 'gridiron'); wRunAct(r.act, 'gk_bowl'); return { rows: document.querySelectorAll('#modalBox .wbclubs > li').length, exhib: !!document.getElementById('wGfExhib') }; })()")
        check(k['rows'] >= 1 and k['exhib'], 'Clinker Dunn\'s GRIDIRON opens the game card, with an exhibition to watch', k)
        await pg.evaluate(CLOSE)
        st = await pg.evaluate("(() => { WSTAT.view = 'football'; const h = wCampStats(); const p = wRoster().find(x => (WG.gfstats || {})[x.id]); return { cols: h.includes('PYd') && h.includes('Tkl'), card: p ? wStatsCard(p).includes('football game') : false }; })()")
        check(st == {'cols': True, 'card': True}, 'the Stats tab has a Football view, and each player\'s stats their football line', st)
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpGfGame'); return e ? e.textContent : ''; })()")
        check('Simulate' in h and 'quarter of the XP' in h, 'How to play explains football games', h)
        j = await pg.evaluate("(() => { const s = JSON.stringify({ g: WG.gfg, s: WG.gfstats }); return JSON.stringify(JSON.parse(s)) === s; })()")
        check(j, 'WG.gfg and WG.gfstats are plain JSON')
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
