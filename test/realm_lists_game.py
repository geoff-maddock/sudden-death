# Realm lists (issue #117, phase 5): jousting from the world.
# The engine: Manage waits at your plan beat (the plan and your squires' jobs yours), sends your rider on their own
# ratings (not your hands), does the jobs you set, and rides the plan you set; left to your squires it rides to the end
# without waiting; You ride takes the reins from Manage's plan beat. A snapshot between courses is plain JSON, resumes
# as it was and plays on to the end; a course left mid-charge is ridden out, never taken back; the yard has none.
# The Realm: Sir Ruddock's MATCH opens the match card (the clubs, each with Play, Manage and Simulate); Simulate settles
# a match at once (the result, the box lines, gold on a win; each club once a day); Play puts it on the lists with Save
# and leave and Concede; Save and leave mid-charge rides the course out and keeps the match; after a reload the match is
# waiting and Resume puts it back; Concede is a loss; a match played out to a win pays, and your mode comes back; Manage
# has its row and its plan rows; their skill by tier; a league fixture at the Lists is jousted on the engine (the fixture
# done, the result in the table), and the clubs' own fixtures there too; the Lists tab and the Stats tab. Asserts.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

# level-up card offers in the way of a prompt: skipped
SKIP = "(() => { let i = 0; while (!document.getElementById('modal').hidden && !document.getElementById('wJtRes') && i++ < 20) { const b = [...document.querySelectorAll('#modalBox button')].find(x => /^(Skip|Done|Later|Not now)$/.test(x.textContent.trim())); if (!b) break; b.click(); } })()"
HELP = r"""
window.__T = ks => ({ name: ks.join(''), short: ks[0].slice(0, 3), roster: ks.map((k, i) => ({ n: k + i, kind: k })) });
window.__A = () => __T(['elf', 'golem', 'spider', 'kobold']); window.__B = () => __T(['ogre', 'ogre', 'ogre', 'ogre']);
window.__xp = f => { const got = {}, keep = wGiveXp; wGiveXp = (p, n) => { got[p.id] = (got[p.id] || 0) + n; return keep(p, n); }; try { f(); } finally { wGiveXp = keep; } return wRoster().map(p => got[p.id] || 0); };
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 20000)) wJT.tick(0.05); return !!f(); };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- Manage ----------
        m = await pg.evaluate("""(() => { const out = {};
          wJT.start({ seed: 5, mode: 'manage', teams: [__A(), __B()] }); wJT.pause(true);
          out.modes = wJT.modes; __to(() => wJT.phase === 'plan'); out.plan = wJT.phase;
          for (let i = 0; i < 50; i++) wJT.tick(.05); out.waits = wJT.phase === 'plan';
          out.sel = wJT.select({ aim: 'helm', pace: 'gallop' }); wJT.press(); out.mine = wJT.view.charge ? wJT.view.charge.mine : null;
          __to(() => wJT.phase === 'after'); const P = wJT.G.plans[0]; out.rode = [P[0].aim, P[0].pace];
          // between courses: the jobs are yours
          __to(() => wJT.phase === 'plan'); out.jobs = wJT.view.jobs; const want = ['girth', 'tend']; wJT.select({ jobs: want }); wJT.press();
          const C = wJT.G.corners[0]; out.corner = C.length ? [C[C.length - 1].jobs, C[C.length - 1].why] : null;
          // left to your squires: no more waits, to the end
          wJT.manage({ auto: true }); let plans = 0, n = 0; while (!wJT.G.over && n++ < 60000) { if (wJT.phase === 'plan') plans++; wJT.tick(.05); }
          out.auto = [!!wJT.G.over, plans, wJT.mgrAuto];
          // You ride takes the reins at Manage's plan beat
          wJT.start({ seed: 6, mode: 'manage', teams: [__A(), __B()] }); __to(() => wJT.phase === 'plan'); wJT.setMode('play'); out.reins = [wJT.phase, wJT.mode]; wJT.press(); out.hand = !!(wJT.view.charge && wJT.view.charge.mine);
          return out; })()""")
        check(m['modes'] == ['watch', 'manage', 'play'] and m['plan'] == 'plan' and m['waits'] and m['sel'] == '', 'Manage: a third mode; it waits at your plan beat, and the plan is yours to set', m)
        check(m['mine'] is False and m['rode'] == ['helm', 'gallop'], 'Manage sends your rider on their own ratings (not your hands), on the plan you set', m)
        check(m['jobs'] is not None and m['corner'] is not None and m['corner'][0] == ['girth', 'tend'] and 'managing' in m['corner'][1], 'Manage: between courses your squires do the jobs you set', m)
        check(m['auto'][0] and m['auto'][1] == 0 and m['auto'][2], 'left to your squires, Manage rides to the end without waiting', m['auto'])
        check(m['reins'] == ['plan', 'play'] and m['hand'], 'You ride takes the reins from Manage\'s plan beat: the course is yours by hand', m)

        # ---------- kept between courses ----------
        sn = await pg.evaluate("""(() => { const out = {};
          wJT.start({ seed: 8, mode: 'watch', teams: [__A(), __B()] }); wJT.pause(true); __to(() => wJT.G.n >= 2 && wJT.phase === 'next' || wJT.G.n >= 2 && ['plan', 'herald'].includes(wJT.phase));
          const S = wJT.snapshot(); out.json = JSON.stringify(S) === JSON.stringify(JSON.parse(JSON.stringify(S))); const want = JSON.stringify(S.G);
          wJT.start({ seed: 99, teams: [__B(), __A()] }); wJT.resume(S); out.same = JSON.stringify(wJT.G) === want; out.mode = wJT.mode;
          __to(() => !!wJT.G.over, 60000); out.over = !!wJT.G.over;
          // a course left mid-charge is ridden out
          wJT.start({ seed: 9, mode: 'play', teams: [__A(), __B()] }); __to(() => wJT.phase === 'plan'); wJT.press(); for (let i = 0; i < 10; i++) wJT.tick(.05);
          const n0 = wJT.G.n, ph0 = wJT.phase; out.done = wJT.finishCourse(); out.mid = [ph0, n0, wJT.G.n, wJT.phase];
          wJT.start({ yard: { runs: 2 }, teams: [__A()], mode: 'play' }); out.yard = wJT.snapshot();
          return out; })()""")
        check(sn['json'] and sn['same'] and sn['mode'] == 'watch' and sn['over'], 'a snapshot between courses is plain JSON, resumes as it was (in its mode) and plays on to the end', sn)
        check(sn['done'] and sn['mid'][0] == 'charge' and sn['mid'][2] == sn['mid'][1] + 1 and sn['mid'][3] in ('after', 'over'), 'a course left mid-charge is ridden out, never taken back', sn['mid'])
        check(sn['yard'] is None, 'the tilting yard is never kept', sn)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'golem']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); SET.listsCourses = 3; })()")
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_lists, r = wSay('gk_lists', 'match'); wRunAct(r.act, 'gk_lists'); const box = document.getElementById('modalBox');
          const rows = [...box.querySelectorAll('.wbclubs li')].map(li => [...li.querySelectorAll('[data-jthow]')].map(b => b.dataset.jthow).join(','));
          return { act: K.topics.match.act, job: /MATCH/.test(K.topics.job.t), joust: K.topics.joust.act, rows, title: box.querySelector('h3').textContent }; })()""")
        check(k['act'] == 'jtcard' and k['job'] and k['joust'] == 'listsjoust' and len(k['rows']) >= 3 and all(r == 'play,manage,sim' for r in k['rows']) and k['title'] == 'Joust a match',
              'Sir Ruddock\'s MATCH opens the match card: the clubs, each with Play, Manage and Simulate (JOUST stays the exhibition)', k)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        sk = await pg.evaluate("""(() => { const club = wBallClubs()[0], out = []; for (const t of [1, 2, 3]) { const o = wListsOpts(wListsMine(), wListsOpp(club, t), t); out.push(o.skill); } return out; })()""")
        check(sk == [[1, 0], [1, 1], [1, 2]], 'their riders by tier: a Squire, a Knight, an Archmage (your side\'s hands a Knight\'s)', sk)
        sm = await pg.evaluate("""(() => { const g0 = RUN.gold; let r = '', tries = 0, G = null; const B = wJtg();
          while (tries++ < 8) { B.met = {}; const gold = RUN.gold; r = wStartLists({ club: 'local', how: 'sim' }); G = B.games[0]; G.gold = RUN.gold - gold; if (G.r === 'win') break; }
          for (let i = 0; i < 9 && !document.getElementById('modal').hidden; i++) document.querySelector('#modalBox .btn, #modalBox button').click();
          const lines = Object.values(WG.jtstats || {}), again = wStartLists({ club: 'local', how: 'sim' });
          return { r, res: G.r, gold: G.gold, text: G.text, lines: lines.length, courses: lines.reduce((a, L) => a + L.c, 0), m: lines.every(L => L.m >= 1), live: wListsLive(), again, mvp: G.mvp }; })()""")
        check(sm['r'] == '' and sm['res'] in ('win', 'lose') and sm['lines'] >= 2 and sm['courses'] > 0 and sm['m'] and not sm['live'], 'Simulate settles a match at once: the result, and your four\'s box lines', sm)
        check(sm['res'] != 'win' or sm['gold'] > 0, 'a win pays gold', sm)
        check('already jousted you today' in sm['again'], 'each club jousts you once a day', sm['again'])
        rw = await pg.evaluate("""(() => { const B = wJtg(); B.met = {}; const xp0 = Object.fromEntries(wRoster().map(p => [p.id, p.xp])), g0 = RUN.gold, f0 = RUN.fans || 0, h0 = JSON.stringify(wH2h());
          const s = { win: 1, tot: [2, 5], pst: [[], []], text: '5 to 2' }; B.live = { world: { kind: 'jtgame', club: 'local', tier: 2, how: 'sim', day: WG.dayAbs, name: 'x', ids: wListsSync().four.map(k => typeof k === 'number' ? k : null) }, snap: null };
          const lxp = __xp(() => wListsSettle(s)), lost = { gold: RUN.gold - g0, fans: (RUN.fans || 0) - f0, xp: lxp };
          B.live = { world: { kind: 'jtgame', club: 'local', tier: 2, how: 'sim', day: WG.dayAbs, name: 'x', ids: wListsSync().four.map(k => typeof k === 'number' ? k : null) }, snap: null };
          const g1 = RUN.gold, f1 = RUN.fans || 0, xp1 = Object.fromEntries(wRoster().map(p => [p.id, p.xp])); const wxp = __xp(() => wListsSettle({ win: 0, tot: [5, 2], pst: [[], []], text: '5 to 2' }));
          return { lost, won: { gold: RUN.gold - g1, fans: (RUN.fans || 0) - f1, xp: wxp }, W: W_JTG }; })()""")
        L, Wn, J = rw['lost'], rw['won'], rw['W']
        check(L['gold'] == 0 and L['fans'] == 0 and Wn['gold'] == J['gold'] * 2 and Wn['fans'] == J['fans'] * 2, 'rewards by tier: a win pays gold and fans times the tier, a loss pays none', rw)
        check(min(Wn['xp']) > 0 and max(L['xp']) > 0 and max(L['xp']) < max(Wn['xp']), 'a win pays XP to everyone (the bench a share), a loss a share of it', rw)

        pl = await pg.evaluate("""(() => { wJtg().met = {}; const keep = W_LISTS_MODE; const r = wStartLists({ club: 'local', how: 'play' }); wJT.pause(true); __to(() => wJT.phase === 'plan');
          return { r, view: UI.view, save: !$('wListsSave').hidden, give: !$('wListsGive').hidden, back: $('wListsBack').hidden, again: $('wListsAgain').hidden, live: wListsLive(), mode: wJT.mode, rows: !$('wListsRows').hidden, keep }; })()""")
        check(pl['r'] == '' and pl['view'] == 'lists' and pl['save'] and pl['give'] and pl['back'] and pl['again'] and pl['live'] and pl['mode'] == 'play' and pl['rows'],
              'Play puts the match on the lists in You ride, with Save and leave and Concede on the bar', pl)
        lv = await pg.evaluate("""(() => { wJT.press(); for (let i = 0; i < 10; i++) wJT.tick(.05); const ph = wJT.phase, n0 = wJT.G.n; $('wListsSave').click();
          const L = WG.jtg.live; return { ph, view: UI.view, kept: !!(L && L.snap), n0, n: L && L.snap ? L.snap.G.n : -1 }; })()""")
        check(lv['ph'] == 'charge' and lv['view'] == 'world' and lv['kept'] and lv['n'] == lv['n0'] + 1, 'Save and leave mid-charge rides the course out and keeps the match after it', lv)
        await pg.evaluate(SKIP)
        await pg.evaluate("(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); WJTG.asked = false; wStart(save); })()")
        await pg.wait_for_function("!!document.getElementById('wJtRes') || !document.getElementById('modal').hidden")
        await pg.evaluate("document.getElementById('wJtRes').click()")
        rs = await pg.evaluate("({ view: UI.view, n: wJT.G ? wJT.G.n : -1, live: wListsLive(), world: !!(WJT && WJT.world), title: $('wListsTitle').textContent })")
        check(rs['view'] == 'lists' and rs['n'] == lv['n'] and rs['live'] and rs['world'], 'after a reload the match is waiting: Resume puts it back as it was', rs)
        await pg.evaluate("(() => { wJT.pause(true); $('wListsGive').click(); })()")
        await pg.wait_for_function("!document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); b.click(); })()")
        cd = await pg.evaluate("({ live: wListsLive(), last: WG.jtg.games[0].r, text: WG.jtg.games[0].text, view: UI.view })")
        check(cd == {'live': False, 'last': 'lose', 'text': 'conceded', 'view': 'world'}, 'Concede counts as a loss, and leaves the Lists', cd)

        pw = await pg.evaluate("""(() => { wJtg().met = {}; W_LISTS_MODE = 'play'; const g0 = RUN.gold, w0 = WG.jtg.w; wStartLists({ club: 'local', how: 'manage' }); wJT.pause(true);
          const mgr = { mode: wJT.mode, row: (__to(() => wJT.phase === 'plan'), !$('wListsMgrRow').hidden), plan: !$('wListsRows').hidden, send: $('wListsRideBtn') ? $('wListsRideBtn').textContent : '' };
          const G = wJT.G; G.sc[0][0] = [3, 3, 3]; G.heat = 1; G.course = G.courses - 1;
          $('wListsModes').querySelector('[data-jmode="watch"]').click(); let i = 0; while (wListsLive() && i++ < 40000) wJT.tick(.05);
          const r = { mgr, live: wListsLive(), last: WG.jtg.games[0].r, wins: WG.jtg.w - w0, gold: RUN.gold - g0, mode: W_LISTS_MODE }; wLeaveLists(); r.view = UI.view; return r; })()""")
        check(pw['mgr'] == {'mode': 'manage', 'row': True, 'plan': True, 'send': 'Send them'}, 'Manage from the world: your calls\' row, the plan rows and Send them', pw['mgr'])
        check(pw['live'] is False and pw['last'] == 'win' and pw['wins'] == 1 and pw['gold'] > 0 and pw['mode'] == 'play' and pw['view'] == 'world',
              'a match played out to a win is settled as a win, with its gold; your own mode comes back', pw)

        # ---------- league fixtures ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); if (!f) return { none: true };
          f.g = 'g_lists'; f.done = 0; const club = f.a === 'me' ? f.b : f.a;
          wOpenGrdCard('g_lists'); const btns = [...document.querySelectorAll('#modalBox [data-jtfixhow]')].map(b => b.dataset.jtfixhow); document.querySelector('#modalBox [data-close]').click();
          const L = wLeague(), n0 = L.results.length, r = wJtfixPlay('sim'); for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.querySelector('#modalBox .btn, #modalBox button').click();
          const res = L.results[0];
          const others = Object.keys(L.table).filter(c => c !== 'me' && c !== club).slice(0, 2), w0 = others.map(c => L.table[c].w + L.table[c].l), sim = wSimAt(others[0], others[1], 'g_lists');
          return { btns, r, done: f.done, kind: WG.jtg.games[0] && WG.jtg.games[0].name, res: { sport: res.sport, g: res.g, me: res.a === 'me' || res.b === 'me' }, added: L.results.length > n0,
            sim: { sport: sim.sport, apart: sim.sa > sim.sb, played: others.map((c, i) => L.table[c].w + L.table[c].l - w0[i]) }, again: wJtfixPlay('sim') }; })()""")
        check(not fx.get('none') and fx['btns'] == ['play', 'manage', 'sim'] and fx['r'] == '' and fx['done'] == 1, 'a league fixture at the Lists: Play, Manage and Simulate on the ground\'s card, jousted on the engine, and the fixture is done', fx)
        check(fx['res'] == {'sport': 'jousting', 'g': 'g_lists', 'me': True} and fx['added'] and 'not at the Tilting Lists' in fx['again'], 'the fixture\'s result goes in the league\'s results, and it can\'t be played twice', fx)
        check(fx['sim']['sport'] == 'jousting' and fx['sim']['apart'] and fx['sim']['played'] == [1, 1], 'the clubs\' own fixtures at the Lists are jousted on the engine, never level', fx['sim'])

        # ---------- the Lists tab, the Stats tab ----------
        await pg.evaluate("wOpenCamp('lists')")
        await pg.wait_for_selector('#wCampBody .wlistsfour')
        tb = await pg.evaluate("(() => { const b = $('wCampBody'); return { play: !!b.querySelector('[data-jtplay]'), practice: !!b.querySelector('[data-jpractice]'), recent: /Last jousting matches/.test(b.textContent) }; })()")
        check(tb == {'play': True, 'practice': True, 'recent': True}, 'the Lists tab: Joust a match, the practice match, and the last matches', tb)
        await pg.evaluate("$('wCampBody').querySelector('[data-jtplay]').click()")
        cardup = await pg.evaluate("({ open: !document.getElementById('modal').hidden, title: (document.querySelector('#modalBox h3') || {}).textContent })")
        check(cardup == {'open': True, 'title': 'Joust a match'}, 'Joust a match on the Lists tab opens the match card', cardup)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        sv = await pg.evaluate("""(() => { WSTAT.view = 'jousting'; const h = wCampStats(), id = Object.keys(WG.jtstats)[0], L = WG.jtstats[id];
          return { cols: ['>M<', '>Crs<', '>Brk<', '>Kept<'].every(c => h.includes(c)), m: L.m }; })()""")
        check(sv['cols'] and sv['m'] >= 2, 'the Stats tab\'s Jousting view has each player\'s lines from the matches', sv)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
