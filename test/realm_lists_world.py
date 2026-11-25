# Realm lists (issue #117, phase 5): the Lists' people and the tilting yard.
# Sir Ruddock: his job names MATCH, MATCH opens the match card, JOUST stays the exhibition. The tilting yard (sp_tilt):
# its card has a run at the straw targets; the runs are the Lists' engine with a straw target that never strikes back
# (no seat to keep, no rules scored), ridden by hand (the spur, the couch, the aim), the herald saying how each went;
# after the last, the summary; nothing at stake (no gold, fans, XP, time or box lines) and Ride again; Manage isn't
# offered; Watch rides a run with your rider's own hands. Fenna Moss: her line from the rail after every course with a
# lance broken (the biggest moment: an unhorsing, a helm break, both lances, a break), none for glances and misses, none
# in the yard; her topics; PLAY before a win says no, after one she joins once (an elf, her lance at the cap). How to
# play explains the matches, the yard and Fenna. Asserts; exits nonzero on failure.
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

HELP = r"""
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 20000)) wJT.tick(0.05); return !!f(); };
// one run by hand: spur on the beat, couch at the right moment, hold the hand still
window.__run = () => { __to(() => wJT.phase === 'plan' || !!wJT.G.over); if (wJT.G.over) return null; wJT.press(); const P = wJT.playRules; let n = 0, k = 1;
  while (wJT.phase === 'charge' && n++ < 4000) { const v = wJT.view.charge, t = v.p * P.charge, b = P.spur.beat[v.pace];
    if (v.p < P.spur.until && Math.abs(t - k * b) < .02) { wJT.spur(); k++; } else if (v.p < P.spur.until && t > k * b + .03) k++;
    if (v.p >= P.couch.ideal && !v.down) wJT.couch(true); wJT.tick(.01); }
  return wJT.call; };
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
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'golem']) if (wRoster().length < 4) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")

        # ---------- Sir Ruddock ----------
        rd = await pg.evaluate("""(() => { const K = DB.chars.gk_lists; return { job: /MATCH/.test(K.topics.job.t) && /JOUST/.test(K.topics.job.t), match: K.topics.match.act, joust: K.topics.joust.act, say: wSay('gk_lists', 'match').key }; })()""")
        check(rd == {'job': True, 'match': 'jtcard', 'joust': 'listsjoust', 'say': 'match'}, 'Sir Ruddock: his job names MATCH and JOUST; MATCH opens the match card, JOUST stays the exhibition', rd)

        # ---------- the tilting yard ----------
        y0 = await pg.evaluate("""(() => { wOpenSpot('sp_tilt'); const b = $('wSpotYard'); const rows = /straw targets/.test(b.closest('li').textContent) && b.closest('.wbclubs') === document.querySelector('#modalBox .wbclubs');
          window.__before = JSON.stringify({ gold: RUN.gold, fans: RUN.fans || 0, xp: wRoster().map(p => [p.lvl, p.xp]), day: WG.dayAbs, min: WG.min, st: WG.jtstats || null });
          b.click(); wJT.pause(true);
          return { rows, view: UI.view, yard: !!(WJT && WJT.yard), runs: wJT.G.yard.runs, straw: wJT.G.teams[1].name, mgr: $('wListsModes').querySelector('[data-jmode="manage"]').hidden,
            guard: $('wListsGuard').closest('.wccrow').hidden, title: $('wListsTitle').textContent }; })()""")
        check(y0['rows'] is True and y0['view'] == 'lists' and y0['yard'] and y0['runs'] == 5 and y0['straw'] == 'The straw targets', 'the tilting yard\'s card has a run at the straw targets: five runs on the Lists\' engine', y0)
        check(y0['mgr'] and 'tilting yard' in y0['title'], 'the yard offers You ride and Watch, not Manage', y0)
        runs = await pg.evaluate("""(() => { const calls = []; for (let i = 0; i < 4; i++) calls.push(__run()); __to(() => ['after', 'over'].includes(wJT.phase));
          const Y = wJT.yard; return { calls, runs: Y.runs.map(r => ({ hand: r.hand, hits: r.hits, beats: r.beats, couch: r.couch, at: r.at })), log: wJT.G.log.length, seat: wJT.G.st[0].rocked + wJT.G.st[1].courses, guard: !$('wListsGuard').closest('.wccrow').hidden }; })()""")
        R = runs['runs']
        check(len(R) == 4 and all(r['hand'] for r in R) and all(r['hits'] == r['beats'] for r in R) and all(abs(r['couch']) <= .35 for r in R), 'runs by hand: the spur on the beat and the couch on time are read as such', R)
        check(all(('Spur: ' in c and 'couched just right' in c) for c in runs['calls']), 'after each run the herald says where the lance went and how you spurred, couched and aimed', runs['calls'])
        check(runs['log'] == 0 and runs['seat'] == 0 and not runs['guard'], 'the straw target never strikes back: no seat to keep, no rules scored, and no guard to pick', runs)
        wa = await pg.evaluate("""(() => { $('wListsModes').querySelector('[data-jmode="watch"]').click(); __to(() => wJT.G.yard.done.length >= 5 || !!wJT.G.over); __to(() => !!wJT.G.over);
          const Y = wJT.yard, last = Y.runs[4]; return { n: Y.n, last: last.hand, over: !!(WJT && WJT.over), note: $('wListsNote').textContent, again: !$('wListsYardAgain').hidden, board: /Run 5/.test($('wListsBoard').textContent), rail: (WJT.rail || []).length,
            after: JSON.stringify({ gold: RUN.gold, fans: RUN.fans || 0, xp: wRoster().map(p => [p.lvl, p.xp]), day: WG.dayAbs, min: WG.min, st: WG.jtstats || null }) }; })()""")
        check(wa['n'] == 5 and wa['last'] is False and wa['over'] and 'runs at the straw target' in wa['note'] and wa['again'] and wa['board'], 'Watch rides a run with your rider\'s own hands; after the last, the yard\'s summary, the runs on the board, and Ride again', wa)
        before = await pg.evaluate("window.__before")
        check(wa['after'] == before and wa['rail'] == 0, 'nothing at stake in the yard: no gold, fans, XP, time or box lines, and Fenna isn\'t there', [before, wa['after']])
        await pg.evaluate("$('wListsYardAgain').click()")
        ag = await pg.evaluate("({ runs: wJT.G.yard.done.length, over: !!wJT.G.over, view: UI.view })")
        check(ag == {'runs': 0, 'over': False, 'view': 'lists'}, 'Ride again starts five fresh runs', ag)
        await pg.evaluate("wLeaveLists()")

        # ---------- Fenna Moss ----------
        fr = await pg.evaluate("""(() => { const R = W_FENNA_RAIL, one = (k, L) => R[k].includes(wFennaRail(L));
          return { un: one('unhorse', { broke: [true, false], zone: ['shield', 'glance'], unhorsed: [1] }), helm: one('helm', { broke: [false, true], zone: ['miss', 'helm'], unhorsed: [] }),
            both: one('both', { broke: [true, true], zone: ['shield', 'body'], unhorsed: [] }), brk: one('brk', { broke: [false, true], zone: ['glance', 'body'], unhorsed: [] }),
            none: wFennaRail({ broke: [false, false], zone: ['glance', 'miss'], unhorsed: [] }) }; })()""")
        check(fr == {'un': True, 'helm': True, 'both': True, 'brk': True, 'none': ''}, 'Fenna\'s line is for the biggest moment of a course: an unhorsing, a helm break, both lances, a break; nothing for glances and misses', fr)
        ex = await pg.evaluate("""(() => { W_LISTS_MODE = 'watch'; wListsGame({ seed: 4 }); wJT.pause(true); const seen = []; let k = 0, n = 0;
          while (!wJT.G.over && n++ < 80000) { wJT.tick(.05); if (wJT.G.n > k) { k = wJT.G.n; const e = wJT.G.log[k - 1]; seen.push(e.at.some(a => ['shield', 'body', 'helm'].includes(a))); } }
          return { courses: k, breaks: seen.filter(Boolean).length, rail: (WJT.rail || []).length, shown: !$('wListsRail').hidden && /Fenna Moss/.test($('wListsRail').textContent) }; })()""")
        check(ex['courses'] >= 4 and ex['breaks'] >= 1 and ex['rail'] == ex['breaks'] and ex['shown'], 'Fenna cheers from the rail after every course with a lance broken, and only those', ex)
        await pg.evaluate("wLeaveLists(); W_LISTS_MODE = 'play'")
        ft = await pg.evaluate("""(() => { const F = DB.chars.gf_lists, g = wSay('gf_lists', ''); const out = { topics: ['sound', 'rail', 'play', 'job'].every(k => F.topics[k]), greet: /SOUND/.test(g.text) && /PLAY/.test(g.text) };
          out.no = wSay('gf_lists', 'play').text; out.st0 = wFennaState(); wJtg().w = 1; out.st1 = wFennaState(); const n0 = wRoster().length; wRunAct('fennaplay', 'gf_lists');
          const q = wRoster().find(p => p.n === W_FENNA.n); out.joined = !!q && wRoster().length === n0 + 1 && q.kind === 'elf' && wJtOf(q).lance === wJtCap() && wFlag('fenna_joined');
          out.st2 = wFennaState(); out.team = wSay('gf_lists', '').text; return out; })()""")
        check(ft['topics'] and ft['greet'] and 'Win a jousting match here first' in ft['no'] and ft['st0'] == 'no', 'Fenna\'s topics (the SOUND, the RAIL, PLAY), and before a win she doesn\'t believe you have a side', ft)
        check(ft['st1'] == 'ready' and ft['joined'] and ft['st2'] == 'team' and 'make it' in ft['team'], 'after a win at the Lists she joins your team once: an elf, her lance at the cap', ft)

        # ---------- How to play ----------
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("""(() => { const t = id => ($(id) || {}).textContent || ''; return { how: ['Matches.', 'The tilting yard.', 'Fenna Moss'].every(w => t('wListsHow').includes(w)),
          game: /Manage/.test(t('wHelpListsGame')) && /Fenna Moss/.test(t('wHelpListsGame')), spots: /straw targets/.test(t('wHelpSpots')) }; })()""")
        check(hp == {'how': True, 'game': True, 'spots': True}, 'How to play explains matches from the world, the tilting yard and Fenna Moss', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
