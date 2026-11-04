# Realm gridiron seven (issue #9, phase 3): every Realm player has football ratings (p.gf), seeded from their kind and
# grown a point a level, and an older save's players get them on load. The seven: who plays football and where, on
# offense and on defense, with call-ups at your level filling any gap; a new player takes a call-up's place; changing a
# position swaps; Sit out and Replace; the coaches' pick. The engine plays your positions as set, and ratings matter:
# a side four levels up wins most games. In the Realm: the Seven tab, a Football block on each player's stats, a
# practice game with your seven, and How to play. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-gridiron-seven.png.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGF !== 'undefined'"); await pg.evaluate("wGF.speed = 4")  # the field at 4 steps a frame: the same game, sooner
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- ratings ----------
        r = await pg.evaluate("""(() => { const st = wGF.stats, R = wRoster();
          const ok = R.every(p => p.gf && st.every(s => Number.isInteger(p.gf[s]) && p.gf[s] >= 1 && p.gf[s] <= 12) && p.gf.lv === (p.lvl || 1));
          // seeded from the kind: each rating within 1 of the kind's (plus any points from levels)
          const near = R.every(p => { const k = wGF.rate(p.kind); return st.every(s => Math.abs(p.gf[s] - (p.gf.got[s] || 0) - k[s]) <= 1); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.gf[s], 0), lv0 = p.lvl, s0 = sum();
          p.lvl = lv0 + 3; wGfOf(p); const grew = sum() - s0, lv = p.gf.lv; p.lvl = lv0;
          return { n: R.length, ok, near, grew, lv, want: lv0 + 3 }; })()""")
        check(r['ok'] and r['near'], 'every player has football ratings, 1 to 12, seeded within a point of their kind', r)
        check(r['grew'] == 3 and r['lv'] == r['want'], 'each level adds a point', r)
        o = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.gf; delete save.WG.seven;
          wStart(save); return { all: wRoster().every(p => p.gf && p.gf.lv === (p.lvl || 1)) }; })()""")
        check(o['all'], 'an older save\'s players get their football ratings when it loads', o)

        # ---------- the seven ----------
        s = await pg.evaluate("""(() => { const S = wSevenSync(), R = wRoster();
          const own = S.ids.filter(k => typeof k !== 'string').length, cus = S.ids.filter(k => typeof k === 'string').length;
          const maps = wSevenMapOk(S.off, wGF.offPos, S.ids) && wSevenMapOk(S.def, wGF.defPos, S.ids);
          return { n: S.ids.length, own, cus, roster: R.length, cu: S.cu.length, maps, json: JSON.stringify(JSON.parse(JSON.stringify(WG.seven))) === JSON.stringify(WG.seven),
            cuRated: S.cu.every(c => c.gf && c.lvl === wNineTier()) }; })()""")
        check(s['n'] == 7 and s['own'] == min(7, s['roster']) and s['cus'] == 7 - s['own'] == s['cu'] and s['maps'] and s['json'] and s['cuRated'],
              'the seven: your players first, call-ups at your level fill the rest, a place for each on offense and defense, plain JSON', s)
        a = await pg.evaluate("""(() => { const cu0 = WG.seven.cu.length; const p = wAddPlayer(wMakePlayer({ kind: 'elf', lvl: 1 }, 'tavern')); const S = wSevenSync();
          const want = wGF.auto(S.ids.map(k => wSevenPlayer(wSevenWho(k)))), coach = wGF.offPos.every(pos => S.ids[want.off[pos]] === S.off[pos]) && wGF.defPos.every(pos => S.ids[want.def[pos]] === S.def[pos]);
          return { in: S.ids.includes(p.id), cu: S.cu.length, cu0, at: wSevenPosOf(p.id), coach }; })()""")
        check(a['in'] and (a['cu'] == a['cu0'] - 1 or a['cu0'] == 0) and a['at']['off'] and a['at']['def'] and a['coach'], "a new player goes into the seven in a call-up's place, and the coaches re-pick the positions (none set by you yet)", a)
        sw = await pg.evaluate("""(() => { const S = wSevenSync(), k = S.off.QB, j = S.off.RB; const m = wSevenSetPos(j, 'off', 'QB');
          return { m, qb: S.off.QB === j, rb: S.off.RB === k, ok: wSevenMapOk(S.off, wGF.offPos, S.ids) }; })()""")
        check(sw == {'m': '', 'qb': True, 'rb': True, 'ok': True}, 'changing a position swaps with whoever had it', sw)
        si = await pg.evaluate("""(() => { const S = wSevenSync(), k = S.ids.find(x => typeof x !== 'string'), at = wSevenPosOf(k); const m = wSevenSit(k);
          const c = S.ids.find(x => typeof x === 'string' && wSevenPosOf(x).off === at.off);
          const back = wSevenPutIn(k, c); return { m, took: !!c, back, again: S.ids.includes(k), pos: wSevenPosOf(k).off === at.off, gone: !S.cu.some(x => x.cid === c), mine: !!S.mine }; })()""")
        check('sits out' in si['m'] and si['took'] and si['back'] == '' and si['again'] and si['pos'] and si['gone'] and si['mine'], 'Sit out calls someone up in their places, and putting them back in restores them (positions you set are kept)', si)
        t = await pg.evaluate("""(() => { const T = wSevenTeam(); wGF.start({ teams: [T, null] }); const G = wGF.G;
          return { name: G.teams[0].name === wPartyTeam().name, off: JSON.stringify(G.teams[0].off) === JSON.stringify(T.off), def: JSON.stringify(G.teams[0].def) === JSON.stringify(T.def),
            r: G.teams[0].roster.every((p, i) => JSON.stringify(p.r) === JSON.stringify(T.roster[i].r)) }; })()""")
        check(t == {'name': True, 'off': True, 'def': True, 'r': True}, 'the engine plays your seven with your positions and their own ratings', t)
        # ratings matter: the same kinds four points better everywhere win most games
        m = await pg.evaluate("""(() => { const kinds = ['kobold', 'minotaur', 'golem', 'ogre', 'dwarf', 'goblin', 'troll'];
          const side = up => ({ name: up ? 'Up' : 'Base', roster: kinds.map((kind, i) => { const r = wGF.rate(kind); for (const s in r) r[s] = Math.min(12, r[s] + up); return { n: kind, kind, num: 10 + i, r }; }) });
          let w = 0, l = 0; for (let i = 0; i < 80; i++) { const g = wGF.simGame({ seed: i + 1, teams: [side(4), side(0)] }); if (g.score[0] > g.score[1]) w++; else if (g.score[0] < g.score[1]) l++; }
          return { w, l }; })()""")
        check(m['w'] >= 56, 'ratings matter: a seven four points better everywhere wins most games (70%+ of 80)', m)

        # ---------- in the Realm ----------
        await pg.evaluate("wOpenCamp('seven')"); await pg.wait_for_selector('#modalBox .wseven')
        ui = await pg.evaluate("""(() => { const rows = [...document.querySelectorAll('#modalBox .wseven > li')];
          return { rows: rows.length, sel: rows[0].querySelectorAll('select').length, tab: !!document.querySelector('#modalBox [data-ctab="seven"][aria-selected="true"]'),
            practice: !!document.querySelector('[data-gpractice]') }; })()""")
        check(ui == {'rows': 7, 'sel': 2, 'tab': True, 'practice': True}, 'the Seven tab: seven rows, an offense and a defense position each, and Practice game', ui)
        await pg.screenshot(path='/tmp/realm-gridiron-seven.png')
        ch = await pg.evaluate("""(() => { const s = document.querySelector('#modalBox .wseven > li select[data-gpos="def"]'), k = s.closest('[data-gid]').dataset.gid;
          const to = s.value === 'S' ? 'LB' : 'S'; s.value = to; s.dispatchEvent(new Event('change')); const key = /^g/.test(k) ? k : +k;
          return { now: wSevenPosOf(key).def, to, ok: wSevenMapOk(WG.seven.def, wGF.defPos, WG.seven.ids) }; })()""")
        check(ch['now'] == ch['to'] and ch['ok'], 'picking a position in the tab moves them there', ch)
        card = await pg.evaluate("(() => { const p = wRoster()[0]; return wStatsCard(p); })()")
        check('Football' in card and 'In your seven' in card, "each player's stats have a Football block that says where they play", card[-400:])
        await pg.click('[data-gpractice]')
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.isGame", timeout=8000)
        g = await pg.evaluate("({ mine: wGF.G.teams[0].name === wPartyTeam().name, them: wGF.G.teams[1].name, modal: document.getElementById('modal').hidden, lineup: document.querySelector('#wGridLineup caption').textContent })")
        check(g['mine'] and 'Cinderhold' in g['them'] and g['modal'], 'Practice game: your seven against the Cinderhold Football Club', g)
        await pg.click('#wGridBack')
        if await pg.evaluate("!document.getElementById('modal').hidden"):
            await pg.click('#cfYes')
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpSeven'); return e ? e.textContent : ''; })()")
        check('Seven tab' in h and 'tackling' in h, 'How to play explains football ratings and the seven', h)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
