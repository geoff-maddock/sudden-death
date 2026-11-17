# Realm links: ratings, roles, focus and nerve (issue #92, phase 3). Every kind has golf ratings (power, accuracy,
# touch, putting, nerve, scrambling, 1 to 12), and the ratings decide games: a side of elves beats a side of zombies.
# A team's roles (tee, approach, short game, green) give the caddie its hitter when the rule allows, and are picked
# from the ratings when not given (the best putter on the green). Focus: a shot costs the hitter some (a hard one more),
# the others get some back, a new hole gives a little to everyone, and a tired player's mark is smaller. Pressure: a
# stroke that wins or halves the hole, more on the last hole; nothing when it decides nothing; for a nervy hitter the
# meter runs quicker and the mark shakes, for a steady one not at all.
# In the Realm: every player has p.gl, seeded within a point of their kind and grown a point a level, an older save's
# players get theirs on load; the four (your players first, call-ups at your level to fill it) and a role each; role
# changes swap; a reserve into a role takes it; the caddie's pick; your four go to the engine with their roles; the
# Links tab, the practice round, the Stats tab's Golf view and a Golf block on a player's card, and How to play.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---------- the engine ----------
        k = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(x => x.kind || x.id)), kinds = Object.keys(FA_NAMES).filter(k => !stars.has(k)), missing = kinds.filter(k => wGL.stats.some(s => wGL.rate(k)[s] === 6.5));
          const lich = wGL.rate('lich'), ogre = wGL.rate('ogre'), spider = wGL.rate('spider'), elf = wGL.rate('elf');
          return { stats: wGL.stats, missing, n: kinds.length, notes: [lich.nrv === 12, ogre.pow > ogre.acc + 6, spider.put >= 10, elf.acc >= 9] }; })()""")
        check(k['stats'] == ['pow', 'acc', 'tch', 'put', 'nrv', 'scr'] and not k['missing'] and all(k['notes']), 'every league kind has golf ratings (the superstars\' come with phase 8): an ogre hits it a mile and nowhere near, a spider putts, an elf is accurate, a lich has no nerves', k)
        w = await pg.evaluate("""(() => { let a = 0; for (let i = 0; i < 60; i++) if (wGL.simGame({ seed: 40 + i, teams: [{ kinds: ['elf', 'elf', 'elf', 'elf'] }, { kinds: ['zombie', 'zombie', 'zombie', 'zombie'] }] }).win === 0) a++;
          let e = 0; for (let i = 0; i < 100; i++) if (wGL.simGame({ seed: 140 + i, teams: [{ kinds: ['dwarf', 'wraith', 'vampire', 'goblin'] }, { kinds: ['dwarf', 'wraith', 'vampire', 'goblin'] }] }).win === 0) e++;
          return { elves: a / 60, even: e / 100 }; })()""")
        check(w['elves'] > 0.9 and 0.35 < w['even'] < 0.65, 'the ratings decide games: elves beat zombies, and two sides alike split them', w)
        ro = await pg.evaluate("""(() => { const G = wGL.start({ seed: 3, teams: [{ kinds: ['ogre', 'elf', 'witch', 'spider'], roles: { tee: 2, approach: 1, short: 0, putt: 3 } }, { kinds: ['ogre', 'elf', 'witch', 'spider'] }] });
          const mine = Object.assign({}, G.teams[0].roles), auto = Object.assign({}, G.teams[1].roles); const first = wGL.turn();
          return { mine, auto, first: first.ri, side: first.side }; })()""")
        check(ro['mine'] == {'tee': 2, 'approach': 1, 'short': 0, 'putt': 3} and ro['first'] == 2 and ro['side'] == 0, 'a team\'s roles are its own, and the tee shot goes to the tee\'s player', ro)
        check(ro['auto']['putt'] == 3 and ro['auto']['tee'] == 0, 'left out, the roles come from the ratings: the spider on the green, the ogre on the tee', ro['auto'])
        fo = await pg.evaluate("""(() => { const G = wGL.start({ seed: 3 }), F = wGL.focusRules; const e = wGL.turn(), f = wGL.focus[e.side];
          const hit = f[e.ri], others = f.filter((v, i) => i !== e.ri);
          G.focus[0] = [.5, .5, .5, .5]; G.focus[1] = [.5, .5, .5, .5]; let n = 0; const h0 = G.res.length; while (G.res.length === h0 && n++ < 60) wGL.turn();
          const after = wGL.focus; const r = { acc: .5 }, w1 = wGL.win(r, 1, 1), w5 = wGL.win(r, 1, .4);
          return { hit, others, F, newHole: after.every(s => s.some(v => v > .5)), win: [w1, w5] }; })()""")
        check(abs(fo['hit'] - (1 - fo['F']['shot'])) < 1e-9 and all(v == 1 for v in fo['others']), 'a shot costs the hitter focus (the others are full, and stay so)', fo)
        check(fo['newHole'] and fo['win'][1] < fo['win'][0], 'focus comes back (while the others hit, and at a new hole); a tired player\'s mark is smaller', fo)
        pr = await pg.evaluate("""(() => { const G = wGL.start({ seed: 9 }), H = G.hole;
          H.done[1] = true; H.st = [3, 4]; const halve = wGL.pressure(0); H.st = [2, 4]; const win = wGL.pressure(0); H.st = [4, 4]; const none = wGL.pressure(0);
          H.done[1] = false; H.st = [2, 3]; const open = wGL.pressure(0);
          G.res = [0, 1, -1, 0, 1, -1, 0, 1]; G.won = [3, 3]; H.done[1] = true; H.st = [3, 4]; const last = wGL.pressure(0);
          return { halve, win, none, open, last }; })()""")
        check(pr == {'halve': 1, 'win': 1, 'none': 0, 'open': 0, 'last': 1.5}, 'pressure: a stroke to win or halve the hole (more on the last), and nothing when it decides nothing', pr)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        r = await pg.evaluate("""(() => { const R = wRoster(), st = wGL.stats;
          const ok = R.every(p => p.gl && st.every(s => p.gl[s] >= 1 && p.gl[s] <= 12) && p.gl.lv === (p.lvl || 1));
          const near = R.every(p => { const k = wGL.rate(p.kind); return st.every(s => Math.abs(p.gl[s] - (p.gl.got[s] || 0) - k[s]) <= 1.5); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.gl[s], 0), lv0 = p.lvl, s0 = sum();
          p.lvl = lv0 + 3; wGlOf(p); const grew = sum() - s0, lv = p.gl.lv; p.lvl = lv0;
          return { n: R.length, ok, near, grew, lv, want: lv0 + 3 }; })()""")
        check(r['ok'] and r['near'], 'every player has golf ratings, 1 to 12, seeded within a point of their kind', r)
        check(r['grew'] == 3 and r['lv'] == r['want'], 'each level adds a point', r)
        o = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.gl; delete save.WG.links;
          wStart(save); return { all: wRoster().every(p => p.gl && p.gl.lv === (p.lvl || 1)), hk: wRoster().every(p => !!p.hk) }; })()""")
        check(o['all'] and o['hk'], 'an older save\'s players get their golf ratings when it loads', o)
        f = await pg.evaluate("""(() => { const C = wFourSync(), R = wRoster(), keys = wGL.roles.map(r => C.four[r]);
          const own = keys.filter(k => typeof k !== 'string').length, cus = keys.filter(k => typeof k === 'string').length;
          return { roster: R.length, own, cus, cu: C.cu.length, distinct: new Set(keys).size === 4, cuRated: C.cu.every(c => c.gl && c.lvl === wNineTier()), json: JSON.stringify(JSON.parse(JSON.stringify(WG.links))) === JSON.stringify(WG.links) }; })()""")
        check(f['own'] == min(4, f['roster']) and f['cus'] == 4 - f['own'] == f['cu'] and f['distinct'] and f['cuRated'] and f['json'], 'the four: your players first, call-ups at your level fill it, a role each, plain JSON', f)
        a = await pg.evaluate("""(() => { const kinds = ['ogre', 'spider', 'elf', 'lich', 'dwarf', 'gorgon', 'witch']; let i = 0;
          while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          wFourAuto(); const C = WG.links, keys = wGL.roles.map(r => C.four[r]), fit = (k, role) => wGL.fit(wGlOf(wFourWho(k)), role);
          const res = wFourReserves(C), best = role => Math.max(fit(C.four[role], role), ...res.map(k => fit(k, role)));
          return { roster: wRoster().length, cu: C.cu.length, own: keys.every(k => typeof k !== 'string'), res: res.length, putt: fit(C.four.putt, 'putt') === best('putt'), mine: !!C.mine }; })()""")
        check(a['cu'] == 0 and a['own'] and a['res'] == a['roster'] - 4 and a['putt'] and not a['mine'], 'with a full roster the four are yours, the rest reserves, and the caddie puts the best putter on the green', a)
        ch = await pg.evaluate("""(() => { const C = wFourSync(), t0 = C.four.tee, p0 = C.four.putt, res = wFourReserves(C)[0];
          const r1 = wFourSetRole(t0, 'putt'), swap = C.four.putt === t0 && C.four.tee === p0;
          const app = C.four.approach; const r2 = wFourSetRole(res, 'approach'), inn = C.four.approach === res && wFourReserves(C).includes(app);
          const sh = C.four.short; const r3 = wFourSetRole(sh, 'reserve'), out = wFourReserves(C).includes(sh) && C.four.short !== sh;
          const T = wFourMine();
          return { r: [r1, r2, r3], swap, inn, out, mine: !!C.mine, team: { n: T.roster.length, roles: T.roles, first: T.roster[0].n === wFourWho(C.four.tee).n, r: Object.keys(T.roster[0].r), scale: T.roster.every(m => Object.values(m.r).every(v => v >= 1 && v <= 12)) } }; })()""")
        check(ch['r'] == ['', '', ''] and ch['swap'] and ch['inn'] and ch['out'] and ch['mine'], 'a role change swaps; a reserve into a role takes it; to the reserves, the best reserve for that role steps in', ch)
        check(ch['team'] == {'n': 4, 'roles': {'tee': 0, 'approach': 1, 'short': 2, 'putt': 3}, 'first': True, 'r': ['pow', 'acc', 'tch', 'put', 'nrv', 'scr'], 'scale': True}, 'your four go to the engine in role order, with their roles and their own ratings (1 to 12)', ch['team'])

        # the Links tab, the practice round, the Stats view and the card
        await pg.evaluate("wOpenCamp('links')")
        await pg.wait_for_selector('#wCampBody .wlinksfour')
        t = await pg.evaluate("""(() => { const b = document.getElementById('wCampBody'); return { four: b.querySelectorAll('.wlinksfour [data-grole]').length, res: b.querySelectorAll('.wlinksres [data-grole]').length,
          auto: !!b.querySelector('[data-gauto]'), practice: !!b.querySelector('[data-gpractice]'), tab: !!document.querySelector('[data-ctab="links"][aria-pressed="true"]') }; })()""")
        check(t['four'] == 4 and t['res'] >= 1 and t['auto'] and t['practice'] and t['tab'], 'the Links tab: the four with a role each, the reserves, the caddie\'s pick and a practice round', t)
        sel = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody .wlinksres [data-grole]'), k = +s.closest('[data-gid]').dataset.gid; s.value = 'tee'; s.dispatchEvent(new Event('change')); return { k, tee: WG.links.four.tee }; })()""")
        check(sel['k'] == sel['tee'], 'picking a role on the tab moves the player into it', sel)
        await pg.click('#wCampBody [data-gpractice]')
        await pg.wait_for_function("UI.view === 'links' && !!wGL.G")
        pt = await pg.evaluate("(() => { const T = wGL.G.teams[0], C = WG.links; return { clash: T.roster.filter(m => wGL.G.teams[1].roster.some(o => o.n === m.n)).length, names: T.roster.map(m => m.n), want: wGL.roles.map(r => wFourWho(C.four[r]).n), roles: T.roles, title: document.getElementById('wLinksTitle').textContent }; })()")
        check(pt['clash'] == 0, 'nobody on the visiting side shares a name with your four', pt)
        check(pt['names'] == pt['want'] and pt['roles'] == {'tee': 0, 'approach': 1, 'short': 2, 'putt': 3} and 'practice' in pt['title'], 'the practice round plays your four, in their roles', pt)
        await pg.evaluate("wLeaveLinks()")
        await pg.wait_for_function("UI.view === 'world'")
        sv = await pg.evaluate("""(() => { WSTAT.view = 'golf'; const h = wCampStats(); const p = wRoster()[0]; return { btn: /data-wsview="golf"/.test(h), cols: ['Pow', 'Acc', 'Tch', 'Put', 'Nrv', 'Scr'].every(c => h.includes('>' + c + '<')), rows: (h.match(/data-wsp="/g) || []).length, card: /<h5>Golf<\\/h5>/.test(wStatsCard(p)), n: wRoster().length }; })()""")
        check(sv['btn'] and sv['cols'] and sv['rows'] == sv['n'] and sv['card'], 'the Stats tab has a Golf view (every player\'s ratings), and a player\'s card a Golf block', sv)

        # ---------- in a round: the hitter row and the meter under pressure ----------
        m = await pg.evaluate("""(() => { wLinksGame({ seed: 21, mode: 'play' }); wGL.pause(true); let i = 0; while (wGL.phase !== 'aim' && i++ < 4000) wGL.tick(0.05);
          const b = document.querySelector('#wLinksWho [data-lri]'), row = { pct: /\\d+%/.test(b.textContent), title: /Focus \\d+%/.test(b.title) };
          const G = wGL.G, H = G.hole, me = G.teams[0].roster[wGL.view.sel.ri].r; H.done[1] = true; H.st = [H.st[0], H.st[0] + 1];
          me.nrv = 0; wGL.press(); const nervy = { spd: wGL.view.meter.spd, shake: wGL.view.meter.shake, msg: wGL.msg };
          wGL.G.hole.done[1] = true; return { row, nervy }; })()""")
        check(m['row']['pct'] and m['row']['title'], 'the hitter row shows each player\'s focus', m['row'])
        check(m['nervy']['spd'] > 1.2 and m['nervy']['shake'] > 0.02, 'a stroke to halve the hole by a nervy hitter: the meter runs quicker and the mark shakes', m['nervy'])
        st = await pg.evaluate("""(() => { wLinksGame({ seed: 22, mode: 'play' }); wGL.pause(true); let i = 0; while (wGL.phase !== 'aim' && i++ < 4000) wGL.tick(0.05);
          const G = wGL.G, H = G.hole; G.teams[0].roster[wGL.view.sel.ri].r.nrv = 1; H.done[1] = true; H.st = [H.st[0], H.st[0] + 1]; wGL.press(); return { spd: wGL.view.meter.spd, shake: wGL.view.meter.shake }; })()""")
        check(st == {'spd': 1, 'shake': 0}, 'a hitter of perfect nerve feels nothing', st)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ tab: !!document.getElementById('wHelpLinksTab'), how: /Focus\\./.test((document.getElementById('wLinksHow') || {}).textContent || '') && /Nerve\\./.test(document.getElementById('wLinksHow').textContent) })")
        check(hp == {'tab': True, 'how': True}, 'How to play explains the ratings, the four and their roles, focus and nerve', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
