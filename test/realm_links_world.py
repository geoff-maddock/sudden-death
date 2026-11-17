# Realm links: golf from the world (issue #92, phase 5). Agatha Divot's MATCH opens the match card (ROUND and GAME stay
# as they were): the clubs at your tier with Play, Manage and Simulate, today's weather, a Wild nine box and the round.
# Simulate settles at once: a win or a loss, XP to the four (a share to the rest), gold and fans on a win, the head to
# head, every player's line, and once a day each club. Play: the Links view in a real match, Save and leave and Concede
# on the bar; the match is kept between shots, Save and leave keeps it, Resume brings it back as it was (and after a
# reload, a prompt asks), and played out it settles. Concede is a loss. Manage: your caddie plays your side on your
# line, and the next hitter you pick. A wild nine is the club's course for today. The wood: the day's weather (the same
# all day, varied over days), a drizzle's soft greens and a haze's short reads, a hive by every fairway (a ball by it
# stings its hitter), the Gloomcap's stump (a ball by it is nudged, never into the water). The Stats tab's Golf view has
# the lines, the card says them, and How to play explains it.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

HELP = r"""
window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 4000)) wGL.tick(0.05); return wGL.phase === ph; };
window.__out = n => { let i = 0; while (wLinksLive() && i++ < (n || 60000)) wGL.tick(0.05); return !wLinksLive(); };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon']; let i = 0; while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); wFourAuto(); })()")

        # ---------- Agatha and the card ----------
        t = await pg.evaluate("(() => { const K = DB.chars.gk_links; return { match: K.topics.match && K.topics.match.act, round: K.topics.round && K.topics.round.act, game: K.topics.game && K.topics.game.act, job: /MATCH/.test(K.topics.job.t) }; })()")
        check(t == {'match': 'lkcard', 'round': 'linksround', 'game': 'gmatch', 'job': True}, 'Agatha Divot offers a MATCH (ROUND and GAME stay as they were)', t)
        await pg.evaluate("wRunAct('lkcard')")
        await pg.wait_for_selector('#modalBox [data-lkclub]')
        c = await pg.evaluate("""(() => { const b = document.getElementById('modalBox'), clubs = [...new Set([...b.querySelectorAll('[data-lkclub]')].map(x => x.dataset.lkclub))];
          return { clubs: clubs.length, hows: [...b.querySelectorAll('[data-lkclub="' + clubs[0] + '"]')].map(x => x.dataset.lkhow), wild: !!document.getElementById('wLkWild'), ex: !!document.getElementById('wLkExhib'), wood: /Today in the wood/.test(b.textContent), local: clubs[0] }; })()""")
        check(c['clubs'] >= 1 and c['hows'] == ['play', 'manage', 'sim'] and c['wild'] and c['ex'] and c['wood'], 'the match card: the clubs, each with Play, Manage and Simulate, today\'s weather, Wild nine, and the round', c)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")

        # ---------- Simulate ----------
        s = await pg.evaluate("""(() => { const xp0 = Object.fromEntries(wRoster().map(p => [p.id, p.xp || 0])), gold0 = RUN.gold, B = wLkg(), w0 = B.w + B.l;
          const r = wStartLinks({ club: 'local', how: 'sim' }); document.getElementById('modal').hidden = true; const g = B.games[0], C = WG.links, four = wGL.roles.map(k => C.four[k]).filter(k => typeof k === 'number');
          const xpUp = wRoster().every(p => (p.xp || 0) > xp0[p.id] || (p.lvl || 1) > 1), lines = four.every(id => WG.lkstats[id] && WG.lkstats[id].rd === 1);
          const again = wStartLinks({ club: 'local', how: 'sim' });
          return { r, played: B.w + B.l - w0, g: { r: g.r, text: g.text, mvp: g.mvp != null }, live: !!B.live, met: B.met.local === WG.dayAbs, xpUp, lines, gold: g.r === 'win' ? RUN.gold > gold0 : RUN.gold === gold0, again, weather: g.weather }; })()""")
        check(s['r'] == '' and s['played'] == 1 and s['g']['r'] in ('win', 'lose') and not s['live'] and s['met'], 'Simulate settles at once: a win or a loss, and the local side is met for today', s)
        check(s['xpUp'] and s['lines'] and s['gold'], 'everyone gets XP, the four get a line each, and gold comes only with a win', s)
        check('already played you at golf today' in s['again'] and s['weather'] in ('still', 'breeze', 'drizzle', 'haze'), 'each club plays you once a day; the match had the day\'s weather', s)

        # ---------- Play: kept between shots, Save and leave, Resume, played out ----------
        await pg.evaluate("WG.lkg.met = {}")
        pl = await pg.evaluate("""(() => { const r = wStartLinks({ club: 'local', how: 'play' }); wGL.pause(true); __to('aim');
          const bar = { save: !document.getElementById('wLinksSave').hidden, give: !document.getElementById('wLinksGive').hidden, again: document.getElementById('wLinksAgain').hidden, back: document.getElementById('wLinksBack').hidden };
          wGL.drag(.9, 0); __to('next'); const snap = !!WG.lkg.live.snap; __to('aim'); const at = JSON.stringify(WG.lkg.live.snap.G.hole.st);
          return { r, world: !!WGL.world, view: UI.view, weather: wGL.weather, wood: wGL.G.wood, bar, snap, at }; })()""")
        check(pl['r'] == '' and pl['world'] and pl['view'] == 'links' and pl['weather'] and pl['wood'], 'Play: a real match on the Links, with the day\'s weather and the wood', pl)
        check(pl['bar'] == {'save': True, 'give': True, 'again': True, 'back': True} and pl['snap'], 'Save and leave and Concede on the bar (not Another game), and the match is kept between shots', pl)
        lv = await pg.evaluate("""(() => { const sn = WG.lkg.live.snap, want = JSON.stringify(sn.G); document.getElementById('wLinksSave').click();
          const away = { view: UI.view, live: !!WG.lkg.live, same: JSON.stringify(WG.lkg.live.snap.G) === want };
          WLKG.asked = false; const asked = wNextPrompt(), text = document.getElementById('modalBox').textContent; document.getElementById('wLkRes').click();
          const back = { view: UI.view, same: JSON.stringify(wGL.G) === want, world: !!WGL.world };
          return { away, asked, waiting: /A golf match is waiting/.test(text), back }; })()""")
        check(lv['away'] == {'view': 'world', 'live': True, 'same': True}, 'Save and leave: back in the world, the match kept as it was', lv)
        check(lv['asked'] and lv['waiting'] and lv['back'] == {'view': 'links', 'same': True, 'world': True}, 'a match waiting is asked about (as after a reload), and Resume brings it back as it was', lv)
        po = await pg.evaluate("""(() => { const B = wLkg(), n0 = B.games.length; wGL.setMode('watch'); wGL.pause(true); const done = __out(); return { done, n: B.games.length - n0, note: document.getElementById('wLinksNote').textContent, card: !!document.getElementById('modal').hidden }; })()""")
        check(po['done'] and po['n'] == 1 and 'Final:' in po['note'], 'played out, the match settles and the bar says the final', po)
        await pg.evaluate("wLeaveLinks()")
        await pg.wait_for_function("UI.view === 'world'")

        # ---------- Concede ----------
        await pg.evaluate("WG.lkg.met = {}")
        await pg.evaluate("(() => { wStartLinks({ club: 'local', how: 'manage' }); wGL.pause(true); __to('addr'); document.getElementById('wLinksGive').click(); })()")
        await pg.wait_for_function("!document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); b.click(); })()")
        cd = await pg.evaluate("({ live: wLinksLive(), last: WG.lkg.games[0].r, text: WG.lkg.games[0].text, view: UI.view })")
        check(cd == {'live': False, 'last': 'lose', 'text': 'conceded', 'view': 'world'}, 'Concede counts as a loss, and leaves the course', cd)

        # ---------- Manage ----------
        mg = await pg.evaluate("""(() => { wLinksGame({ seed: 61, mode: 'manage' }); wGL.pause(true); const rows = { call: !document.getElementById('wLinksRowMgr').hidden, next: !document.getElementById('wLinksRowNext').hidden };
          wGL.manage({ line: 'go', ri: 2 }); let n = 0, plan = null; while (n++ < 4000) { wGL.tick(0.05); const v = wGL.view; if (v.ph === 'addr' && v.cpu && v.cpu.side === 0) { plan = v.cpu.plan; break; } }
          return { rows, line: plan && plan.line, ri: plan && plan.ri, after: wGL.mgr.ri }; })()""")
        check(mg['rows'] == {'call': True, 'next': True} and mg['line'] == 'go' and mg['ri'] == 2 and mg['after'] is None, 'Manage: your caddie plays your side on your line, and the next hitter you picked (once)', mg)

        # ---------- wild nines and the wood ----------
        await pg.evaluate("WG.lkg.met = {}")
        wd = await pg.evaluate("""(() => { wStartLinks({ club: 'local', how: 'sim', wild: true }); document.getElementById('modal').hidden = true; const g = WG.lkg.games[0];
          const days = new Set(); const d0 = WG.dayAbs; for (let d = 0; d < 20; d++) { WG.dayAbs = d0 + d; days.add(wLinksWeather()); } WG.dayAbs = d0; const same = wLinksWeather() === wLinksWeather();
          return { wild: g.wild, seed: wLinksWildSeed('local') === wLinksWildSeed('local'), kinds: [...days].sort(), same }; })()""")
        check(wd['wild'] and wd['seed'] and wd['same'] and len(wd['kinds']) >= 3, 'a wild nine plays a new course (the club\'s for today); the weather is the same all day and varies over days', wd)
        we = await pg.evaluate("""(() => { const out = {}; const wet = w => { wGL.start({ seed: 3, weather: w }); return wGL.wetK(); }; out.wet = [wet('still'), wet('drizzle')];
          const hz = w => { wGL.start({ seed: 3, weather: w }); return wGL.hazeK(); }; out.haze = [hz('breeze'), hz('haze')];
          wGL.start({ seed: 4, weather: 'still' }); out.still = wGL.G.wind.s <= 3; wGL.start({ seed: 4, weather: 'breeze' }); out.breeze = wGL.G.wind.s >= 6;
          const H = wGL.course(0), W = wGL.wood(H); out.hive = ['r', 'R'].includes(wGL.lie(H, W.bees.x, W.bees.y));
          wGL.start({ seed: 5, wood: true }); const G = wGL.G; G.ball[0] = { x: W.bees.x + 3, y: W.bees.y, lie: 'r' }; const f0 = G.focus[0][1]; const st = wGL.woodAfter(0, 1); out.sting = [st.ev.bees, +(f0 - G.focus[0][1]).toFixed(2), /sting/.test(st.t)];
          let cap = null; for (let i = 0; i < 9 && !cap; i++) { const Hi = wGL.course(i), Wi = wGL.wood(Hi); if (Wi.cap) cap = { i, Wi }; }
          if (cap) { G.h = cap.i; const b0 = { x: cap.Wi.cap.x + 2, y: cap.Wi.cap.y, lie: 'r' }; G.ball[0] = Object.assign({}, b0); const c2 = wGL.woodAfter(0, 1); const b = G.ball[0], Hc = wGL.course(cap.i);
            out.cap = [c2.ev.cap, Math.hypot(b.x - b0.x, b.y - b0.y) >= 3, wGL.lie(Hc, b.x, b.y) !== 'W', /Gloomcap/.test(c2.t)]; }
          wGL.start({ seed: 5 }); wGL.G.ball[0] = { x: W.bees.x + 3, y: W.bees.y, lie: 'r' }; out.off = wGL.woodAfter(0, 1).t;
          return out; })()""")
        check(we['wet'][1] > we['wet'][0] == 1 and we['haze'][1] < we['haze'][0] == 1 and we['still'] and we['breeze'], 'the weather: a drizzle softens the greens, a haze shortens the reads, a still morning barely blows and a breeze does', we)
        check(we['hive'] and we['sting'] == [True, 0.2, True], 'a hive in the rough by every fairway: a ball by it stings its hitter (a fifth of their focus)', we)
        check(we.get('cap') == [True, True, True, True] and we['off'] == '', 'the Gloomcap moves a ball by its stump (never into the water); a game without the wood has neither', we)

        # ---------- the Stats tab, the card, How to play ----------
        sv = await pg.evaluate("""(() => { WSTAT.view = 'golf'; const h = wCampStats(), id = Object.keys(WG.lkstats)[0], p = wPlayer(+id);
          return { cols: ['Rds', 'Shots', 'Putts', 'In'].every(c => h.includes('>' + c + '<')), card: /golf match/.test(wStatsCard(p)), tab: /Last golf matches/.test(wCampLinks(wFourSync())) }; })()""")
        check(sv == {'cols': True, 'card': True, 'tab': True}, 'the Golf view has every player\'s line, a player\'s card says it, and the Links tab lists the last matches', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLinksGame') || {}).textContent || ''; return ['MATCH', 'Manage', 'Save and leave', 'weather of the wood', 'bees', 'Gloomcap', 'Wild nine'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains matches, Manage, Save and leave, the weather, the bees, the Gloomcap and wild nines', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
