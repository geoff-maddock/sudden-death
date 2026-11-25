# Realm lists (issue #117, phase 0): the Tilting Lists, the jousting engine, builds in its own scope (wJT) behind
# W_ENGINES, and its rules are pure functions.
# The order: two heats of three courses (five by option), each side's first rider against the other's first, then the
# seconds. Scoring a course: 1 for a lance broken on the shield or body, 2 on the helm, nothing for a glance or a miss,
# 3 for an unhorsing (in place of the break), a point off for a foul (the mount, the barrier, below the belt); both
# riders can score in one course. An unhorsing ends the heat: its courses not ridden stay empty. Level after both
# heats: the tilt for the crown, one course at a time between each side's best rider, until a course leaves them
# apart; a match can't end level. A refused course says why and changes nothing. The match is plain JSON. None of
# the engine's names reach the page. Asserts; exits nonzero on failure.
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
// a strike: 'helm', or 'helm!' for one that unhorses
window.__st = a => ({ at: a.replace('!', ''), unhorse: a.endsWith('!') });
// ride courses: each is [side 0's strike, side 1's]; returns every course's result
window.__ride = cs => cs.map(([a, b]) => wJT.course([__st(a), __st(b)]));
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate(HELP)

        # ---------- the seam ----------
        sc = await pg.evaluate("""(() => ({ engine: !!W_ENGINES.lists && W_ENGINES.lists.api === wJT && W_ENGINES.lists.sport === 'jousting' && W_ENGINES.lists.view === 'lists',
          leak: ['jtNewMatch', 'jtCourse', 'JT_RULES', 'JT_AT', 'jtTotal', 'jtBoard'].filter(n => typeof window[n] !== 'undefined'), on: wJT.on,
          before: [wJT.riders(), wJT.board(), wJT.total(0), wJT.matchText(0), wJT.left(), wJT.inTilt(), wJT.course([__st('helm'), __st('miss')]).why] }))()""")
        check(sc['before'] == [None, None, 0, '', 0, False, 'No match.'], 'before any match, its calls answer without an error, and a course is refused', sc['before'])
        check(sc['engine'] and not sc['leak'] and sc['on'] is False, 'the Tilting Lists is W_ENGINES.lists (jousting), in its own scope: none of its names on the page, and never on yet', sc)

        # ---------- the order of heats and courses ----------
        o = await pg.evaluate("""(() => { wJT.newMatch({ riders: [[2, 0], [1, 3]], roster: [5, 4] }); const seq = [], left = [];
          for (let i = 0; i < 6; i++) { seq.push(wJT.riders()); left.push(wJT.left()); wJT.course([__st(i < 3 ? 'shield' : 'miss'), __st('miss')]); }
          const five = wJT.newMatch({ courses: 5 }).courses, odd = wJT.newMatch({ courses: 4, riders: [[1, 1], [0, 9]] });
          return { seq, left, five, odd: [odd.courses, odd.riders], rules: [wJT.rules.heats, wJT.rules.courses, wJT.rules.coursesAt] }; })()""")
        check(o['seq'] == [[2, 1]] * 3 + [[0, 3]] * 3 and o['left'] == [3, 2, 1, 3, 2, 1], 'two heats of three courses: each side\'s first rider meets the other\'s first, then the seconds', o)
        check(o['five'] == 5 and o['odd'] == [3, [[0, 1], [0, 1]]] and o['rules'] == [2, 3, [3, 5]], 'five courses a heat by option; anything else is three, and riders that aren\'t two of the roster fall back to the first two', o)

        # ---------- scoring a course ----------
        s = await pg.evaluate("""(() => { wJT.newMatch({}); const r = __ride([['shield', 'body'], ['helm', 'glance'], ['miss', 'helm']]);
          return { pts: r.map(x => x.pts), heat0: wJT.board().sc.map(h => h[0]), tot: [wJT.total(0), wJT.total(1)], over: r[2].heatOver, next: wJT.riders(),
            text: wJT.matchText(0), words: [wJT.atText(__st('helm')), wJT.atText(__st('body!'))],
            each: ['shield', 'body', 'helm', 'glance', 'miss', 'mount', 'barrier', 'low'].map(a => wJT.strikePts(__st(a))) }; })()""")
        check(s['pts'] == [[1, 1], [2, 0], [0, 2]], 'both riders break in one course and both score; a helm break is two; a glance or a miss is nothing', s['pts'])
        check(s['each'] == [1, 1, 2, 0, 0, -1, -1, -1], 'the table: shield 1, body 1, helm 2, glance 0, miss 0, and a point off for each foul', s['each'])
        check(s['heat0'] == [[1, 2, 0], [1, 0, 2]] and s['tot'] == [3, 3] and s['over'] == {'heat': 0, 'tot': [3, 3], 'by': 'courses'} and s['next'] == [1, 1],
              'the heat ends after its last course, the board keeps every course, and the second riders are up', s)
        check(s['text'] == 'Level, 3 to 3, heat 2, course 1 of 3' and s['words'] == ['a lance broken on the helm', 'a lance broken on the body, and unhorsed'], 'the match and a strike in words', s)

        # ---------- an unhorsing mid-heat ----------
        u = await pg.evaluate("""(() => { wJT.newMatch({}); const r = __ride([['shield', 'miss'], ['helm!', 'shield']]);
          const out = { pts: r[1].pts, unhorsed: r[1].unhorsed, over: r[1].heatOver, sc: wJT.board().sc.map(h => h[0]), ended: wJT.G.ended, next: wJT.riders(), heat: wJT.G.heat };
          wJT.newMatch({}); const b = __ride([['miss', 'miss'], ['miss', 'miss'], ['body!', 'shield!']])[2];
          out.both = [b.pts, b.unhorsed, b.heatOver && b.heatOver.by];
          wJT.newMatch({ courses: 5 }); __ride([['shield!', 'miss']]); out.early = [wJT.G.sc[0][0], wJT.G.sc[1][0], wJT.G.heat, wJT.left()];
          return out; })()""")
        check(u['pts'] == [3, 1] and u['unhorsed'] == [1], 'an unhorsing scores three in place of the break, and the rider unhorsed still scores the strike they landed', u)
        check(u['over'] == {'heat': 0, 'tot': [4, 1], 'by': 'unhorse'} and u['sc'] == [[1, 3, None], [0, 1, None]] and u['ended'][0] == {'course': 2, 'unhorsed': [1]} and u['next'] == [1, 1] and u['heat'] == 1,
              'the unhorsing ends the heat: its last course isn\'t ridden and scores nothing, and the second heat begins', u)
        check(u['both'] == [[3, 3], [0, 1], 'unhorse'], 'both riders can be unhorsed in the same course, and both score three', u['both'])
        check(u['early'] == [[3, None, None, None, None], [0, None, None, None, None], 1, 5], 'unhorsed in the first course of five: the four left score nothing', u['early'])

        # ---------- fouls ----------
        f = await pg.evaluate("""(() => { wJT.newMatch({}); const r = __ride([['mount', 'shield'], ['low', 'barrier']]);
          const bad = wJT.course([__st('low!'), __st('miss')]), k = wJT.G.log.length;
          const worse = [wJT.course([__st('helm')]), wJT.course([__st('helm'), { at: 'tail' }]), wJT.course('helm')];
          return { pts: r.map(x => x.pts), tot: [wJT.total(0), wJT.total(1)], bad: [bad.ok, bad.why], worse: worse.map(x => [x.ok, !!x.why]), same: [k, wJT.G.log.length, wJT.G.course] }; })()""")
        check(f['pts'] == [[-1, 1], [-1, -1]] and f['tot'] == [-2, 0], 'a foul (the mount, below the belt, the barrier) takes a point off and breaks nothing; the totals can go below nothing', f)
        check(f['bad'][0] is False and 'fair' in f['bad'][1] and all(w == [False, True] for w in f['worse']) and f['same'] == [2, 2, 2],
              'a foul can\'t unhorse, and a course that isn\'t two strikes is refused: each says why and changes nothing', f)
        # (a strike's place is one of the table's own keys: nothing inherited, such as toString, gets through)
        ih = await pg.evaluate("""(() => { wJT.newMatch({}); const keys = ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf'];
          const r = keys.map(k => wJT.course([{ at: k }, { at: 'miss' }])), un = wJT.course([{ at: 'miss' }, { at: 'toString', unhorse: true }]);
          return { ok: r.map(x => x.ok).concat(un.ok), why: r.every(x => !!x.why), pts: keys.map(k => wJT.strikePts({ at: k })), text: keys.map(k => wJT.atText({ at: k })),
            fair: keys.map(k => wJT.fair(k) || wJT.foul(k)), n: wJT.G.log.length, tot: [wJT.total(0), wJT.total(1)], json: JSON.stringify(wJT.G) === JSON.stringify(JSON.parse(JSON.stringify(wJT.G))) }; })()""")
        check(ih['ok'] == [False] * 6 and ih['why'] and ih['pts'] == [0] * 5 and ih['text'] == [''] * 5 and ih['fair'] == [False] * 5 and ih['n'] == 0 and ih['tot'] == [0, 0] and ih['json'],
              'a strike on an inherited name (toString, __proto__, constructor) is refused and scores nothing; the match stays plain JSON with number totals', ih)

        # ---------- a level match settled by the tilt ----------
        t = await pg.evaluate("""(() => { wJT.newMatch({ riders: [[0, 2], [3, 1]] });
          const h = __ride([['shield', 'miss'], ['miss', 'shield'], ['miss', 'miss'], ['helm', 'body'], ['miss', 'body'], ['glance', 'miss']]);
          const out = { tiltNow: h[5].tiltNow, tot: [wJT.total(0), wJT.total(1)], crown: wJT.riders(), inTilt: wJT.inTilt(), left: wJT.left(), over0: wJT.G.over, text0: wJT.matchText(1) };
          const a = wJT.course([__st('shield'), __st('body')]); out.still = [a.pts, a.over, wJT.inTilt(), wJT.matchText(0)];
          const b = wJT.course([__st('miss'), __st('helm')]); out.won = [b.pts, b.over, wJT.G.tilt];
          out.text = [wJT.matchText(0), wJT.matchText(1)]; out.done = [wJT.riders(), wJT.course([__st('helm'), __st('miss')]).why];
          out.board = wJT.board(); out.json = JSON.stringify(wJT.G) === JSON.stringify(JSON.parse(JSON.stringify(wJT.G)));
          wJT.newMatch({ best: [1, 0] }); __ride([['shield', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'shield'], ['miss', 'miss'], ['miss', 'miss']]); out.named = wJT.riders();
          wJT.newMatch({}); __ride([['miss', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'miss']]); out.tie = wJT.riders();
          const fl = wJT.course([__st('miss'), __st('barrier')]); out.foulWins = fl.over && [fl.over.win, fl.over.tot];
          wJT.newMatch({}); const w = __ride([['helm', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'miss'], ['miss', 'shield']]); out.plain = [w[5].tiltNow, w[5].over];
          return out; })()""")
        check(t['tiltNow'] is True and t['tot'] == [3, 3] and t['over0'] is None and t['inTilt'] and t['left'] == 0, 'level after both heats (3 to 3): the tilt for the crown, not a draw', t)
        check(t['crown'] == [2, 1], 'the tilt is between each side\'s best rider: the one who scored more in their heat', t['crown'])
        check(t['text0'] == 'Level, 3 to 3, in the tilt for the crown, course 1', 'the match says it is in the tilt', t['text0'])
        check(t['still'][0] == [1, 1] and t['still'][1] is None and t['still'][2] and t['still'][3] == 'Level, 4 to 4, in the tilt for the crown, course 2',
              'a tilt course where both break alike leaves them level, so they ride again', t['still'])
        check(t['won'][1] and t['won'][1]['win'] == 1 and t['won'][1]['tot'] == [4, 6] and t['won'][1]['tilt'] == 2 and t['won'][2] == [[1, 0], [1, 2]],
              'a course that leaves them apart wins the tilt and the match', t['won'])
        check(t['text'] == ['Lost 4 to 6 after the tilt for the crown', 'Won 6 to 4 after the tilt for the crown'] and t['done'] == [None, 'The match is over.'], 'the match says how it ended, and takes no more courses', t)
        check(t['board']['tot'] == [4, 6] and t['board']['tilt'] == [[1, 0], [1, 2]] and t['board']['sc'][0] == [[1, 0, 0], [2, 0, 0]] and t['json'], 'the board keeps the heats and the tilt, and the match is plain JSON', t['board'])
        check(t['named'] == [1, 0], 'the best rider can be named for the tilt, whatever they scored', t['named'])
        check(t['tie'] == [0, 0] and t['foulWins'] == [0, [0, -1]], 'level riders: the first heat\'s rides the tilt; a foul alone in a tilt course decides it', t)
        check(t['plain'] == [False, {'win': 0, 'tot': [2, 1], 'tilt': 0, 'text': '2 to 1'}], 'a match apart after both heats is decided there, with no tilt', t['plain'])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
