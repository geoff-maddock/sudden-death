# Realm ring, the tale of the tape (issue #62): before a card, each bout's pairing shows the two fighters side by side.
# Every rating and their breath (most stamina) for both, with the better of each pair marked and ties left alone; the
# points levels added (+n) for your players; both powers, the nature and the natural style; the record for yours, a dash
# for theirs. A new pick redraws the tape. The ring's intro shows the same ratings, powers and record. It fits a phone
# with the columns side by side, and How to play explains it. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-ring-tape-*.png.
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

R = lambda v: {s: v for s in ['reach', 'pow', 'spd', 'chin', 'sta', 'gui']}
# what a tape on the page says, read back from its cells
READ = """el => { const t = el.querySelector('.wtape'), t2 = el.querySelector('.wtape2'), side = c => [...t.querySelectorAll('.wtv.' + c)];
  const one = c => ({ name: t.querySelector('.wtn.' + c + ' b').textContent, sub: t.querySelector('.wtn.' + c + ' small').textContent,
    v: Object.fromEntries(side(c).map(x => [x.dataset.tv, +x.querySelector('b').textContent])), best: side(c).filter(x => x.classList.contains('wbest')).map(x => x.dataset.tv),
    plus: Object.fromEntries(side(c).filter(x => x.querySelector('small')).map(x => [x.dataset.tv, x.querySelector('small').textContent])),
    rec: Object.fromEntries([...t.querySelectorAll('.wtr.' + c)].map(x => [x.dataset.tr, x.textContent])),
    words: Object.fromEntries([...t2.querySelectorAll('.wtt.' + c)].map(x => [x.dataset.tt, x.textContent])) });
  return [one('wa'), one('wb')]; }"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'")
        await pg.evaluate(f"window.__read = {READ}; 0")

        # ---------- the tape on its own: the better of each pair marked, ties not ----------
        u = await pg.evaluate("""([a, b]) => { const d = document.createElement('div');
          d.innerHTML = wRingTape({ n: 'Ann', kind: 'elf', r: a }, { n: 'Bo', kind: 'elf', r: b }); const x = __read(d);
          d.innerHTML = wRingTape({ n: 'Ann', kind: 'elf', r: a }, { n: 'Bo', kind: 'elf', r: a }); const y = __read(d); return { x, y }; }""",
            [dict(R(5), reach=9, sta=8), dict(R(5), pow=7, sta=3)])
        a, b = u['x']
        check(sorted(a['best']) == ['reach', 'sta', 'stamax'] and sorted(b['best']) == ['pow'], 'the better value of each pair is marked on its side, and only there', u['x'])
        check(u['y'][0]['best'] == [] and u['y'][1]['best'] == [], 'equal values are not marked', u['y'])
        check(a['v']['stamax'] == int(68 + 8 * 4.5 + .5) and b['v']['stamax'] == int(68 + 3 * 4.5 + .5), 'breath is the most stamina, from the stamina rating', [a['v'], b['v']])

        # ---------- a world card's pairing ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        me = await pg.evaluate("""(() => { const P = wRoster(); P[0].lvl = 6; wBxOf(P[0]);
          WG.bxstats = { [P[0].id]: { bb: 3, w: 2, l: 1, d: 0, ko: 1, kd: 2, down: 1, landed: 60, thrown: 140, pw: 4 } };
          return P.map(p => { const b = wBxOf(p); return { id: p.id, n: p.n, kind: p.kind, r: Object.fromEntries(wBX.stats.map(s => [s, b[s]])), got: b.got }; }); })()""")
        await pg.evaluate("W_RING_MODE = 'watch'; wStartRing({ club: 'local', how: 'play' })")
        await pg.wait_for_selector('[data-tape="2"] .wtape', state='attached')
        # bout 1 gets the player with a record and level points
        await pg.evaluate(f"""(() => {{ const S = [...document.querySelectorAll('[data-rslot]')], i = wRoster().findIndex(p => p.id === {me[0]['id']});
          const j = +S[0].value; S.forEach(s => {{ if (+s.value === i) s.value = j; }}); S[0].value = i; S[0].dispatchEvent(new Event('change', {{ bubbles: true }})); }})()""")
        open_ = await pg.evaluate("[...document.querySelectorAll('[data-tapeat]')].map(d => d.open)")
        check(open_ == [True, False, False], 'every bout has a tale of the tape, the first one open', open_)
        tapes = await pg.evaluate("[...document.querySelectorAll('[data-tape]')].map(__read)")
        info = await pg.evaluate("""(() => ({ kinds: Object.fromEntries(wBX.kinds.map(k => [wKindName(k), k])), traits: wBX.traits, book: wBX.powerBook,
          plans: wBX.plans, cost: wBX.powerCost, styles: null }))()""")
        stats = ['reach', 'pow', 'spd', 'chin', 'sta', 'gui']
        bad = []
        for i, (A, B) in enumerate(tapes):
            for side, X in (('yours', A), ('theirs', B)):
                kind = info['kinds'][X['sub'].split(',')[0]]
                if sorted(X['v']) != sorted(stats + ['stamax']) or not all(1 <= X['v'][s] <= 12 for s in stats): bad.append((i, side, 'ratings', X['v']))
                if X['v']['stamax'] != int(68 + X['v']['sta'] * 4.5 + .5): bad.append((i, side, 'breath'))
                P = info['book'][kind]
                SP = next((P[k] for k in ('sp', 'sp2') if k in P and X['words']['sp'].startswith(P[k]['n'])), P['sp'])  # (the special they bring: issue #61, phase 4)
                if not (X['words']['sp'].startswith(SP['n']) and SP['desc'] in X['words']['sp'] and X['words']['ult'].startswith(P['ult']['n']) and P['ult']['desc'] in X['words']['ult']): bad.append((i, side, 'powers', X['words']))
                T = info['traits'].get(kind)
                if (T and not X['words']['nature'].startswith(T['n'] + '. ' + T['desc'])) or (not T and not X['words']['nature'].startswith('None')): bad.append((i, side, 'nature', X['words']['nature']))
                st = await pg.evaluate("r => wBX.plans[wBX.styleOf(r)].n", {s: X['v'][s] for s in stats})
                if not X['words']['style'].startswith(st): bad.append((i, side, 'style', X['words']['style'], st))
            for s in stats + ['stamax']:
                want_a, want_b = A['v'][s] > B['v'][s], B['v'][s] > A['v'][s]
                if (s in A['best']) != want_a or (s in B['best']) != want_b: bad.append((i, 'mark', s))
        check(not bad, 'every rating, breath, both powers (with what they do), the nature and the style, for both fighters of every bout; the better of each pair marked', bad)
        A, B = tapes[0]
        check(A['name'] == me[0]['n'] and {s: A['v'][s] for s in stats} == me[0]['r'], "your fighter's tape has their own ratings", [A, me[0]])
        check(A['plus'] == {s: f'+{n}' for s, n in me[0]['got'].items()} and len(A['plus']) > 0, 'the points their levels added show as +n', [A['plus'], me[0]['got']])
        check(A['rec'] == {'bouts': '3: 2–1', 'ko': '1', 'kd': '2 / 1', 'landed': '60 of 140 (43%)'}, 'your fighter\'s record: bouts, knockouts, knockdowns and the land rate', A['rec'])
        check(all(v == '–' for v in B['rec'].values()) and len(B['rec']) == 4, "a club's fighter's record is a dash", B['rec'])
        check('level' in B['sub'], "their fighter's level is shown", B['sub'])
        await pg.screenshot(path='/tmp/realm-ring-tape-pair.png')
        # a new pick redraws that bout's tape
        rp = await pg.evaluate("""(() => { const S = document.querySelector('[data-rslot="0"]'), was = document.querySelector('[data-tape="0"] .wtn.wa b').textContent;
          const k = [...S.options].findIndex(o => +o.value !== +S.value); const S2 = [...document.querySelectorAll('[data-rslot]')].find(s => +s.value === k);
          if (S2) S2.value = S.value; S.value = k; S.dispatchEvent(new Event('change', { bubbles: true }));
          return { was, now: document.querySelector('[data-tape="0"] .wtn.wa b').textContent, want: wRoster()[k] ? wRoster()[k].n : '' }; })()""")
        check(rp['now'] != rp['was'] and rp['now'] == rp['want'], 'picking another fighter redraws the tape', rp)
        await pg.evaluate(f"""(() => {{ const S = [...document.querySelectorAll('[data-rslot]')], i = wRoster().findIndex(p => p.id === {me[0]['id']});
          const j = +S[0].value; S.forEach(s => {{ if (+s.value === i) s.value = j; }}); S[0].value = i; S[0].dispatchEvent(new Event('change', {{ bubbles: true }})); }})()""")

        # ---------- at phone width ----------
        await pg.set_viewport_size({'width': 360, 'height': 800})
        await pg.evaluate("document.querySelectorAll('[data-tapeat]').forEach(d => d.open = true)")
        ph = await pg.evaluate("""(() => { const box = document.getElementById('modalBox'), t = document.querySelector('[data-tape="0"] .wtape');
          const a = t.querySelector('.wtn.wa').getBoundingClientRect(), b = t.querySelector('.wtn.wb').getBoundingClientRect();
          const va = t.querySelector('.wtv.wa').getBoundingClientRect(), vb = t.querySelector('.wtv.wb').getBoundingClientRect(), tb = t.getBoundingClientRect();
          const w2 = [...document.querySelectorAll('[data-tape="0"] .wtt')].map(x => x.getBoundingClientRect());
          return { page: document.documentElement.scrollWidth, box: box.scrollWidth - box.clientWidth, side: a.right <= b.left && va.right <= vb.left && Math.abs(va.top - vb.top) < 4,
            inside: va.left >= tb.left - 1 && vb.right <= tb.right + 1, words: w2.length === 8 && w2[0].right <= w2[1].left }; })()""")
        await pg.screenshot(path='/tmp/realm-ring-tape-phone.png', full_page=True)
        check(ph['page'] <= 360 and ph['box'] <= 1 and ph['side'] and ph['inside'] and ph['words'], 'at phone width the two columns stay side by side and nothing runs off', ph)
        await pg.set_viewport_size({'width': 1200, 'height': 1000})

        # ---------- the ring's intro ----------
        await pg.click('#wRingCardGo')
        await pg.wait_for_function("wBX.G && wBX.G.F && wBX.intro()")
        await pg.evaluate("wBX.pause(true)")
        it = await pg.evaluate("wBX.intro()")
        I, J = it
        check(I['n'] == A['name'] and {s: I['r'][s] for s in stats} == {s: A['v'][s] for s in stats}, "the intro has your fighter's name and ratings, as on the tape", [I, A['v']])
        check(J['n'] == B['name'] and {s: J['r'][s] for s in stats} == {s: B['v'][s] for s in stats}, "the intro has their fighter's name and ratings, as on the tape", [J, B['v']])
        check(I['pow'] == A['words']['sp'].split('.')[0] + ' / ' + A['words']['ult'].split('.')[0] and J['pow'] == B['words']['sp'].split('.')[0] + ' / ' + B['words']['ult'].split('.')[0], 'the intro has both powers', [I['pow'], J['pow']])
        check(I['rec'] == '2-1, 1 KO' and J['rec'] == 'no record' and 'level' in I['sub'] and 'level' in J['sub'], 'the intro has the records and levels', it)
        await pg.screenshot(path='/tmp/realm-ring-tape-intro.png')
        await pg.evaluate("wBX.pause(false)")

        # ---------- during the bout: each fighter's card and the judges' running totals ----------
        lv = await pg.evaluate("""(() => { wBX.pause(true);
          wBX.start({ fighters: [{ n: 'Vexa', kind: 'werewolf' }, { n: 'Smolder', kind: 'kobold' }], mode: 'watch', seed: 5 });
          const intro = wBX.live();
          for (let i = 0; i < 20000 && !(wBX.G.round === 2 && wBX.phase === 'round' && wBX.G.clock < 20); i++) { wBX.step(); wBX.render(); }
          const G = wBX.G, L = wBX.live(), T = wBX.totals();
          const work = G.F.map(f => { const s = Object.assign({}, f.bs); for (const k in f.rs) s[k] += f.rs[k]; return s; });
          const fOk = L.F.every((X, i) => JSON.stringify(X.r) === JSON.stringify(G.F[i].r) && X.landed === work[i].landed && X.thrown === work[i].thrown && X.power === work[i].power
            && X.slips === work[i].slips && X.blocks === work[i].blocks && X.kd === G.kd[1 - i]);
          const jOk = L.judges.length === 3 && L.judges.every((J, j) => J.round && J.round.includes(10) && J.total[0] === T[j][0] + J.round[0] && J.total[1] === T[j][1] + J.round[1]);
          for (let i = 0; i < 20000 && wBX.phase !== 'corner'; i++) wBX.step();
          const C = wBX.live(), T2 = wBX.totals(), cOk = C.judges.every((J, j) => J.round === null && J.total.join() === T2[j].join());
          wBX.pause(false); return { fOk, jOk, cOk, L, done: T[0][0] > 0, intro: !!intro }; })()""")
        check(lv['fOk'], "during a bout each fighter's card has their ratings and their work so far (rounds done and the round on)", lv['L']['F'])
        check(lv['done'] and lv['jOk'], "the judges' running totals are the rounds done plus the round on as it stands", lv['L']['judges'])
        check(lv['cOk'], 'between rounds the totals are the cards as scored, and no round on', None)
        sd = await pg.evaluate("""(() => { wBX.pause(true); const go = draw => { wBX.start({ fighters: [{ n: 'A', kind: 'lich' }, { n: 'B', kind: 'ogre' }], mode: 'watch', seed: 11 });
            for (let i = 0; i < 40000 && wBX.phase !== 'over'; i++) { wBX.step(); if (draw) wBX.render(); } return JSON.stringify(wBX.summary()); };
          const a = go(false), b = go(true); wBX.pause(false); return a === b; })()""")
        check(sd, 'drawing the cards and the judges never changes how a seeded bout goes', None)
        await pg.evaluate("""(() => { wBX.pause(true); wBX.start({ fighters: [{ n: 'Vexa', kind: 'werewolf' }, { n: 'Smolder', kind: 'kobold' }], mode: 'watch', seed: 5 });
          for (let i = 0; i < 20000 && !(wBX.G.round === 2 && wBX.phase === 'round' && wBX.G.clock < 20); i++) wBX.step(); wBX.render(); })()""")
        await pg.screenshot(path='/tmp/realm-ring-tape-live.png')
        await pg.evaluate("wBX.pause(false)")

        # ---------- How to play ----------
        await pg.evaluate("renderHelp()")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wRingHowTape'); return h ? h.textContent : ''; })()")
        check('tale of the tape' in hp and 'breath' in hp and 'powers' in hp and 'record' in hp, 'How to play explains the tale of the tape', hp[:200])
        hl = await pg.evaluate("(() => { const h = document.getElementById('wRingHowLive'); return h ? h.textContent : ''; })()")
        check('ratings' in hl and 'judges' in hl and 'landed' in hl, 'How to play explains the cards and the judges during a bout', hl[:200])
        check(not errs, 'no page errors', errs[:3])
        await br.close()

asyncio.run(main())
if FAILS:
    print('errors:', FAILS); sys.exit(1)
print('all ring tape checks passed')
