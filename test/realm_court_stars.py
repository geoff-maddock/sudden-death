# Realm court, superstars (issue #77, phase 8). Each of the six superstars has a court kind: ratings, two offense and
# two defense powers and an ultimate, drawn as itself. Asserts: the book (every superstar has all five, no id or name
# of theirs is anyone else's, which would silently replace a power); each power's effects reach the possession when it
# is cast, the first and the second of each pair; each ultimate leaves a zone that acts at the right end; the court
# draws all six as themselves, in a game; no superstar is far stronger than the best league kind, or weaker than the
# league, in the same five (seeded games), and neither of a pair is far better than the other. In the Realm: a
# superstar's ratings come from its own kind, one signed before this phase (seeded as a goblin) is made again when the
# journey loads, once; the Court tab's picks reach the game; no other club fields one; How to play.
# Exits nonzero on failure. Screenshot: /tmp/realm-court-stars.png.
import asyncio, base64, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

OPP = "{ name: 'B', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem', 'harpy', 'skeleton'] }"
# a live possession for `poss`, five of `kind` as side `side` bringing the pair's `two`th powers; mana full, nothing cast
LIVE = f"""(kind, side, poss, two) => {{ const S = {{ name: 'S', roster: [0, 1, 2, 3, 4].map(i => ({{ n: 'S' + i, kind, num: i + 1, pw: {{ off: two, def: two }} }})) }}, O = {OPP};
  wBK.start({{ teams: side ? [O, S] : [S, O], seed: 5, skill: [0, 0], mode: 'manage' }}); wBK.auto = false;
  const G = wBK.G; let n = 0; while (!(wBK.phase === 'live' && G.poss === poss) && n++ < 30 * 200) {{ G.mana = [0, 0]; G.spirit = [0, 0]; wBK.step(); }}
  G.cur.cast = []; G.zones = []; G.mana = [6, 6]; return G; }}"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1100})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBK !== 'undefined' && typeof wCourtStarFix === 'function'")
        await pg.evaluate(f"window.__live = {LIVE}; 0")
        stars = await pg.evaluate("W_STARS.filter(s => s.kind).map(s => s.kind)")
        check(len(stars) == 6, 'six superstars', stars)

        # ---------- the book ----------
        bk = await pg.evaluate("""(K => { const D = wBK.powerData, B = wBK.powerBook, st = wBK.stats, all = [];
          for (const k in D.pow) { for (const p of D.pow[k].concat(D.pow2[k])) all.push([k, p.id, p.n]); all.push([k, D.ult[k].id, D.ult[k].n]); }
          for (const id in wBK.sits) all.push(['', id, wBK.sits[id].n]);
          const mine = all.filter(a => K.includes(a[0]));
          return { rated: K.filter(k => wBK.kinds.includes(k) && st.every(s => wBK.rate(k)[s] >= 1 && wBK.rate(k)[s] <= 10)),
            full: K.filter(k => B[k] && ['off', 'def', 'off2', 'def2', 'ult'].every(r => B[k][r] && B[k][r].n && B[k][r].desc) && B[k].off.n !== B[k].off2.n && B[k].def.n !== B[k].def2.n),
            cost: K.every(k => D.pow[k].concat(D.pow2[k]).every(p => (p.cost === 1 || p.cost === 2) && p.fits in wBK.fits && Object.keys(p.fx).length)),
            ids: all.length, uniq: new Set(all.map(a => a[1])).size,
            sameId: mine.filter(a => all.filter(b => b[1] === a[1]).length > 1).map(a => a[1]),
            sameName: mine.filter(a => all.filter(b => b[2] === a[2]).length > 1).map(a => a[2]),
            sums: Object.fromEntries(K.map(k => [k, st.reduce((n, s) => n + wBK.rate(k)[s], 0)])) }; })""", stars)
        check(bk['rated'] == stars, 'each superstar has court ratings, 1 to 10', bk)
        check(bk['full'] == stars and bk['cost'], 'each has two offense and two defense powers (different, costing 1 or 2 mana, fitting sets, with effects) and an ultimate', bk)
        check(bk['ids'] == bk['uniq'] and not bk['sameId'] and not bk['sameName'], 'no superstar power shares an id or a name with any other power on the court', bk)

        # ---------- each power reaches the possession ----------
        bad = await pg.evaluate("""(K => { const D = wBK.powerData, bad = [], near = (a, b) => Math.abs(a - b) < 1e-9;
          for (const k of K) for (const two of [0, 1]) for (const role of ['off', 'def']) {
            const P = (two ? D.pow2 : D.pow)[k][role === 'off' ? 0 : 1], side = role === 'off' ? 0 : 1;
            const G = __live(k, side, 0, two), ri = G.on[side][0], st0 = G.stam[side][ri];
            const listed = wBK.powerList(side, role).find(o => o.ri === ri);
            if (!listed || listed.id !== P.id) { bad.push(`${k} ${role}${two ? 2 : ''}: the five bring ${listed && listed.id}, not ${P.id}`); continue; }
            if (!wBK.castNow(side, ri, P.id)) { bad.push(`${k} ${P.n}: not cast`); continue; }
            if (!near(6 - G.mana[side], P.cost)) bad.push(`${k} ${P.n}: cost ${6 - G.mana[side]}`);
            if (!(G.stam[side][ri] < st0 + (P.fx.staO || P.fx.staD || 0))) bad.push(`${k} ${P.n}: no stamina spent`);
            for (const key in P.fx) if (!near(wBK.fx(key), P.fx[key])) bad.push(`${k} ${P.n}: ${key} is ${wBK.fx(key)}, not ${P.fx[key]}`);
          }
          return bad; })""", stars)
        check(not bad, 'each superstar\'s four powers are what its five bring, cost their mana and stamina, and reach the possession', bad)
        fz = await pg.evaluate("""(() => { const G = __live('behemoth', 1, 0, 0); wBK.castNow(1, G.on[1][0], 'tremor'); return wBK.play.pl.filter(p => p.side === 0).map(p => p.stun); })()""")
        check(len(fz) == 5 and all(s >= .79 for s in fz), 'Tremor freezes their five where they stand', fz)

        # ---------- each ultimate ----------
        ub = await pg.evaluate("""(K => { const D = wBK.powerData, R = wBK.powerRules, bad = [], near = (a, b) => Math.abs(a - b) < 1e-9, fx0 = k => ['con', 'stl', 'blk', 'oSpd', 'dSpd', 'reb', 'dreb', 'cut'].includes(k) ? 1 : 0;
          for (const k of K) { const U = D.ult[k], G = __live(k, 0, 0, 0), ri = G.on[0][0];
            const dry = wBK.ult(ri); G.spirit[0] = 100; const r = wBK.ult(ri), z = G.zones[0];
            if (!dry) bad.push(`${k}: cast without spirit`);
            if (r || !z || z.id !== U.id || z.left !== R.ultPoss || !G.ultUsed[0] || G.spirit[0] !== 100 - R.spirit.ult) { bad.push(`${k} ${U.n}: ${r || 'no zone'}`); continue; }
            if (!wBK.ult(ri)) bad.push(`${k}: cast twice`);
            for (const key in U.o) if (!near(wBK.fx(key), U.o[key])) bad.push(`${k} ${U.n} on offense: ${key} is ${wBK.fx(key)}`);
            for (const key in U.d) if (!(key in U.o) && !near(wBK.fx(key), fx0(key))) bad.push(`${k} ${U.n}: ${key} acts at the wrong end`);
            let n = 0; while (!(G.cur.side === 1 && wBK.phase === 'live') && n++ < 30 * 200) { G.mana = [0, 0]; G.spirit[1] = 0; wBK.step(); }
            if (!G.zones.length) { bad.push(`${k} ${U.n}: the zone was gone before they had the ball`); continue; }
            for (const key in U.d) if (!near(wBK.fx(key), U.d[key])) bad.push(`${k} ${U.n} on defense: ${key} is ${wBK.fx(key)}`);
            if (!Object.keys(U.o).length && !Object.keys(U.d).length) bad.push(`${k} ${U.n}: does nothing`);
            if (!U.vis || !/^#/.test(U.vis[0]) || !['all', 'half', 'paint', 'arc'].includes(U.vis[1])) bad.push(`${k} ${U.n}: no look`);
          }
          return bad; })""", stars)
        check(not ub, 'each ultimate needs the crowd\'s spirit, goes once a game, and leaves a zone that acts at the right end', ub)

        # ---------- drawn as themselves ----------
        # the same game twice (the same ratings, no powers, the same seed): once as the six superstars, once as goblins
        dr = await pg.evaluate("""(K => { const figs = K.filter(k => wBK.figs.includes(k)), r = wBK.rate('elf');
          const frame = stars => { const mk = (k, i) => ({ n: 'P' + i, kind: stars ? k : 'goblin', num: i + 1, r });
            const t = [{ name: 'Stars', short: 'STR', color: '#e0742a', light: '#fff0d8', roster: K.slice(0, 5).map(mk) }, { name: 'B', short: 'BBB', color: '#3a6fb0', light: '#e2eeff', roster: [K[5], 'goblin', 'goblin', 'goblin', 'goblin'].map(mk) }];
            wBK.start({ teams: t, seed: 9, skill: [1, 1], powers: false }); let n = 0; while (wBK.phase !== 'live' && n++ < 30 * 60) wBK.step(); wBK.step(20);
            wBK.render(); const cv = document.querySelector('#v-court canvas'); return { d: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, png: cv.toDataURL('image/png'), at: wBK.play.pl.map(p => [Math.round(p.x * 10), Math.round(p.y * 10)]) }; };
          const a = frame(true), b = frame(false); let diff = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2]) > 40) diff++;
          return { figs, diff, same: JSON.stringify(a.at) === JSON.stringify(b.at), png: a.png }; })""", stars)
        open('/tmp/realm-court-stars.png', 'wb').write(base64.b64decode(dr['png'].split(',')[1]))
        check(dr['figs'] == stars and dr['same'] and dr['diff'] > 1500, 'the court draws all six as themselves: the same play drawn as goblins is a different picture', {'figs': dr['figs'], 'same': dr['same'], 'diff': dr['diff']})
        g = await pg.evaluate("""(K => { const t = [{ name: 'Stars', kinds: K.slice(0, 5) }, { name: 'B', kinds: K.slice(1).concat(K.slice(0, 1)).slice(0, 5) }];
          let pow = 0, ult = 0, pts = 0; for (let i = 0; i < 6; i++) { const s = wBK.simGame({ teams: t, seed: 300 + i, skill: [1, 2] }); pow += s.tally.pow; ult += s.tally.ult; pts += s.score[0] + s.score[1]; }
          return { pow, ult, pts: pts / 12 }; })""", stars)
        check(g['pow'] > 10 and g['ult'] > 0 and 8 < g['pts'] < 60, 'whole games between fives of superstars only: the coaches cast their powers and ultimates, and the scores are basketball\'s', g)

        # ---------- about as strong as the best of the league ----------
        # the same five, the same seeds, the fifth player a superstar or each league kind in turn (CPU both sides, a Knight)
        bal = await pg.evaluate("""(K => { const base = ['goblin', 'elf', 'werewolf', 'minotaur'], opp = """ + OPP + """, N = 40;
          const rate = (k, pw) => { let w = 0; for (let i = 0; i < N; i++) for (const sw of [0, 1]) { const A = { name: 'A', roster: base.concat([k, 'dwarf', 'zombie']).map((x, j) => ({ n: 'P' + j, kind: x, num: j + 1, pw: x === k ? pw : null })) };
            const s = wBK.simGame({ teams: sw ? [opp, A] : [A, opp], seed: 4000 + i, skill: [1, 1] }), me = sw ? 1 : 0; w += s.win === me ? 1 : s.win == null ? .5 : 0; } return Math.round(100 * w / (2 * N)); };
          const league = wBK.kinds.filter(k => !K.includes(k)).map(k => rate(k, null));
          return { lo: Math.min(...league), hi: Math.max(...league), mean: Math.round(league.reduce((a, b) => a + b, 0) / league.length), star: Object.fromEntries(K.map(k => [k, [rate(k, { off: 0, def: 0 }), rate(k, { off: 1, def: 1 })]])) }; })""", stars)
        print('     the league', bal['lo'], 'to', bal['hi'], '(mean', str(bal['mean']) + '); superstars, first and second powers:', bal['star'])
        # (80 games a cell is about 5.5 points either way, so the bounds are two of those outside the league's own range;
        # what a superstar adds in the Realm is measured over 1,000 games in test/realm_stars_lab.py)
        check(all(bal['lo'] - 11 <= v <= bal['hi'] + 11 for pair in bal['star'].values() for v in pair), 'in the same five, no superstar is far outside the league kinds\' own range (80 seeded games each)', bal)
        check(all(abs(a - b) <= 18 for a, b in bal['star'].values()), 'and each wins about as often with either pair of powers (within 18 points)', bal['star'])

        # ---------- the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        rt = await pg.evaluate("""(() => { const out = {}, st = wBK.stats;
          for (const s of W_STARS) { const p = wMakePlayer({ kind: s.kind, n: s.name, lvl: 4, num: s.num, star: s.id }, 'star'), k = wBK.rate(s.kind);
            out[s.kind] = { st: p.bk.st, lv: p.bk.lv, near: st.every(x => Math.abs(p.bk[x] - (p.bk.got[x] || 0) - k[x]) <= 1), got: st.reduce((n, x) => n + (p.bk.got[x] || 0), 0) }; }
          return out; })()""")
        check(all(v == {'st': 1, 'lv': 4, 'near': True, 'got': 3} for v in rt.values()), 'a superstar\'s basketball ratings are seeded from its own kind, and grow a point a level', rt)
        # an older save: a Kraken signed before this phase, its ratings a goblin's
        pid = await pg.evaluate("""(() => { const s = wStar('kraken'), p = wMakePlayer({ kind: 'kraken', n: s.name, lvl: 4, num: s.num, star: 'kraken' }, 'star'); wAddPlayer(p);
          while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf', lvl: 3 }, 'tavern')); return p.id; })()""")
        old = await pg.evaluate("""(pid => { const save = JSON.parse(JSON.stringify({ WG, RUN })), q = save.WG.roster.find(p => p.id === pid), g = wBK.rate('goblin');
          q.bk = Object.assign({ lv: 4, got: { hnd: 3 } }, g, { hnd: g.hnd + 3 }); const dwarf = save.WG.roster.find(p => p.kind === 'dwarf'), d0 = JSON.stringify(dwarf.bk);
          wStart(save); const p = wPlayer(pid), b = JSON.parse(JSON.stringify(p.bk)), k = wBK.rate('kraken'), st = wBK.stats;
          const fixed = { st: b.st, lv: b.lv, near: st.every(x => Math.abs(b[x] - (b.got[x] || 0) - k[x]) <= 1), got: st.reduce((n, x) => n + (b.got[x] || 0), 0), siz: b.siz };
          const again = JSON.parse(JSON.stringify({ WG, RUN })); wStart(again);
          return { fixed, once: JSON.stringify(wPlayer(pid).bk) === JSON.stringify(b), dwarf: JSON.stringify(wRoster().find(p => p.kind === 'dwarf').bk) === d0 }; })""", pid)
        check(old['fixed']['st'] == 1 and old['fixed']['lv'] == 4 and old['fixed']['near'] and old['fixed']['got'] == 3 and old['fixed']['siz'] >= 9, 'a superstar signed before this phase (rated as a goblin) is made again from its own kind when the journey loads', old)
        check(old['once'] and old['dwarf'], 'once only, and nobody else\'s ratings change', old)
        rp = await pg.evaluate("""(pid => { wCourtSync(); const save = JSON.parse(JSON.stringify({ WG, RUN })), q = save.WG.roster.find(p => p.id === pid), g = wBK.rate('goblin');
          q.bk = Object.assign({ lv: 4, got: {} }, g); delete save.WG.court.mine; const C = save.WG.court, at = wBK.pos.find(x => C.five[x] === pid), pg0 = C.five.PG;
          if (at) C.five[at] = pg0; else C.bench = C.bench.filter(k => k !== pid).concat([pg0]); C.five.PG = pid;
          wStart(save); const C2 = wCourtSync(); return { was: 'PG', now: wBK.pos.find(x => C2.five[x] === pid) || 'bench', keys: wCourtKeys(C2).length, n: wRoster().length }; })""", pid)
        check(rp['now'] in ('C', 'PF') and rp['keys'] == rp['n'], 'and the coach, still picking your five, picks again: the Kraken who played the point as a goblin moves inside', rp)
        sw = await pg.evaluate("""(() => { const mk = (k, i) => ({ n: 'P' + i, kind: k, num: i + 1 }), c = { short: 'AAA', color: '#e0742a', light: '#fff0d8' };
          const t = [Object.assign({ name: 'A', roster: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll'].map(mk) }, c), Object.assign({ name: 'W', roster: ['frostwyrm', 'frostwyrm', 'frostwyrm', 'frostwyrm', 'frostwyrm'].map(mk) }, c)];
          const seen = []; for (let i = 0; i < 12 && !seen.length; i++) { wBK.start({ teams: t, seed: 700 + i, skill: [1, 1] }); wBK.call('off', 'pick', 0); wBK.call('def', 'switch', 1);
            let n = 0; while (wBK.phase !== 'over' && n++ < 30 * 400) { wBK.step(); if (/they switch/.test(wBK.msg)) { seen.push(wBK.msg); break; } } }
          return seen; })()""")
        check(sw and 'the frost wyrm has' in sw[0] and 'frostwyrm' not in sw[0], 'a line that names a superstar\'s kind names it in words', sw)
        await pg.evaluate("wCourtAuto(); wOpenCamp('court')"); await pg.wait_for_selector(f'#modalBox [data-kid="{pid}"] [data-kpw]')
        tb = await pg.evaluate("""(pid => { const row = document.querySelector(`#modalBox [data-kid="${pid}"]`), sel = r => row.querySelector(`[data-kpw="${r}"]`), names = r => [...sel(r).options].map(o => o.textContent.replace(/ \\(\\d\\)$/, ''));
          const o = names('off'), d = names('def'); sel('def').value = '1'; sel('def').dispatchEvent(new Event('change'));
          const i = wCourtKeys(wCourtSync()).indexOf(pid), t = wCourtMine().roster[i];
          return { o, d, kept: wPlayer(pid).bkPw, pw: t.pw, kind: t.kind, siz: t.r.siz }; })""", pid)
        check(tb['o'] == ['Long Reach', 'Ink Screen'] and tb['d'] == ['Grasp', 'Tentacle Wall'] and tb['kept'] == {'off': 0, 'def': 1} and tb['pw'] == {'off': 0, 'def': 1} and tb['kind'] == 'kraken' and tb['siz'] >= 9,
              'the Court tab offers a superstar\'s two powers at each end, and the pick and its ratings go into the game', tb)
        await pg.evaluate("WCAMP.close()")
        wg = await pg.evaluate("""(K => { const club = Object.values(WG.rivals)[0], seen = [];
          for (const c of Object.values(WG.rivals).concat(['local'])) for (const t of [1, 2, 3]) for (const p of wCourtOpp(c, t).roster) if (K.includes(p.kind)) seen.push(c + ':' + p.kind);
          const opp = wCourtOpp(club, 1), sq = wCourtSquad(opp), s = wBK.simGame({ teams: [sq.team, opp], skill: [1, 1], seed: 12, court: true, ordered: [true, false] });
          const i = sq.team.roster.findIndex(p => p.kind === 'kraken'), line = s.box[0].rows[i];
          return { seen, on: i >= 0 && i < 5, sec: line && line.sec, kind: line && line.kind, score: s.score }; })""", stars)
        check(not wg['seen'], 'no other club fields a superstar', wg['seen'])
        check(wg['on'] and wg['kind'] == 'kraken' and wg['sec'] > 0, 'your superstar starts in your five and plays, in a game from the world\'s squads', wg)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("""(K => { const h = document.getElementById('wHelpCourtStars'), t = document.getElementById('wCourtPowHow'), txt = h ? h.textContent : '';
          return { names: W_STARS.filter(s => !txt.includes('The ' + s.n)).map(s => s.n), ults: K.filter(k => !txt.includes(wBK.powerBook[k].ult.n)), rows: t ? t.querySelectorAll('tr').length : 0, want: wBK.kinds.length + 1,
            after: !!h && !!h.previousElementSibling && h.previousElementSibling.id }; })""", stars)
        check(not hp['names'] and not hp['ults'] and hp['after'] == 'wHelpCourtKit', 'How to play: each superstar\'s game on the court, after the court\'s gear and potions', hp)
        check(hp['rows'] == hp['want'] == 25, 'and the table of powers has a row for each of the 24 kinds', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print(f'\n{len(FAILS)} failed: {FAILS}' if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
