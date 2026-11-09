# Boxing powers, phase 4 of issue #61: a second special for every league kind, the choice of special (set on the Ring
# tab and kept), and the spirit meter. Asserts: each kind's two specials are in the book; a fighter brings the one
# picked, and each second special does what its data says; spirit starts low, fills from clean punches landed and
# from punishment taken (a blocked punch counts a little), never from powers, and gates and pays for specials and
# ultimates; the CPU still casts, ultimates less often than specials; in the Realm: the Special list on the Ring tab
# (kept, and locked during a card), the other club's picks (the same each time), the pairing, the tale of the tape,
# the stats card, the bar on the ring, and How to play. Exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox button'); if (!b) break; b.click(); } })()"""
# a bout in its first round, the two fighters d apart and idle; sp: what each brings
SETUP = """(d, kinds, sp, spirit) => { wBX.start({ fighters: kinds.map((k, i) => ({ n: 'F' + i, kind: k, sp: (sp || [])[i] })), seed: 7 });
  for (let i = 0; i < 100 && wBX.phase === 'intro'; i++) wBX.step();
  const G = wBX.G; G.F[0].x = -d / 2; G.F[1].x = d / 2; G.F[0].y = G.F[1].y = 0;
  for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.mv = [0, 0]; f.think = 99; f.r.chin = 60; if (spirit != null) f.spirit = spirit; } return G; }"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wRingSetSp === 'function'")
        await pg.evaluate(f"wBX.speed = 4; window.__setup = {SETUP}; 0")

        # ---- the book ----
        bk = await pg.evaluate("""(() => { const B = wBX.powerBook, K = wBX.kinds.filter(k => !W_STARS.some(s => s.kind === k));
          return { n: K.length, two: K.filter(k => B[k].sp2 && B[k].sp2.n && B[k].sp2.desc && B[k].sp2.n !== B[k].sp.n).length,
            stars: W_STARS.filter(s => s.kind).map(s => !!B[s.kind].sp2), names: new Set(K.flatMap(k => [B[k].sp.n, B[k].sp2.n])).size }; })()""")
        check(bk['n'] == 18 and bk['two'] == 18 and bk['names'] == 36, 'every league kind has two specials, each named and described, none the same', bk)
        check(bk['stars'] and all(bk['stars']), 'the superstars have two as well (phase 6)', bk)

        # ---- the pick, and each second special at work ----
        pk = await pg.evaluate("""(() => { let G = __setup(2, ['gorgon', 'elf'], ['sp2', null], 100); const a = wBX.powers(0), b = wBX.powers(1);
          return { mine: [a.sp.n, a.pick], theirs: [b.sp.n, b.pick], book: [wBX.powerBook.gorgon.sp2.n, wBX.powerBook.elf.sp.n] }; })()""")
        check(pk['mine'] == [pk['book'][0], 'sp2'] and pk['theirs'] == [pk['book'][1], 'sp'], 'a fighter brings the special picked (the first by default)', pk)
        each = await pg.evaluate("""(() => { const D = wBX.powerData, bad = [];
          for (const kind of wBX.kinds) { const P = D[kind].sp2; if (!P) continue; const N = P.now || {};
            const G = __setup(N.push < 0 ? 5 : 2, [kind, 'golem'], ['sp2', null], 100), f = G.F[0], o = G.F[1];
            f.hp = 50; f.sta = f.staMax - 20; const before = { fhp: f.hp, ohp: o.hp, osta: o.sta, fsta: f.sta, d: wBX.dist(), sp: f.spirit };
            if (!wBX.cast(0, 'sp')) { bad.push(kind + ': not cast'); continue; } const why = [];
            if (N.stun && o.a.k !== 'stun') why.push('no stun');
            if ((N.dmg || N.hits) && !(o.hp < before.ohp)) why.push('no damage');
            if (N.push < 0 && !(wBX.dist() < before.d - .5)) why.push('not pulled in');
            if (N.hp && !(f.hp > before.fhp)) why.push('no health back');
            if (N.sta && !(o.sta < before.osta)) why.push('no stamina off');
            if (N.mySta && !(f.sta > before.fsta - wBX.powerCost.sp)) why.push('no stamina back');
            if (Math.round(before.sp - f.spirit) !== wBX.spirit.sp) why.push('spirit ' + (before.sp - f.spirit));
            if (P.fx) { const on = P.fx.who === 'self' ? f : o; if (!on.fx.some(s => s.id === P.id)) why.push('no status on ' + P.fx.who); }
            if (why.length) bad.push(kind + ': ' + why.join(', ')); }
          return bad; })()""")
        check(not each, 'each second special does what it says at once, leaves its status, and spends its spirit', each)

        # ---- spirit ----
        sp = await pg.evaluate("""(() => { const S = wBX.spirit, out = { S };
          let G = __setup(2, ['ogre', 'ogre']); out.start = G.F.map(f => f.spirit); out.early = [wBX.powers(0).sp.ok, wBX.powers(0).sp.why];
          // a clean punch that lands: both gain, the one hit more for the damage
          G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const s0 = G.F.map(f => f.spirit), h0 = G.F[1].hp; let n = 0;
          while (G.F[1].hp === h0 && n++ < 40) wBX.land(0, 'hook'); const dmg = h0 - G.F[1].hp;
          out.clean = { dmg, a: G.F[0].spirit - s0[0], b: G.F[1].spirit - s0[1] };
          // a blocked one: only the one who blocked, a little
          G = __setup(2, ['ogre', 'ogre']); G.F[1].a = { k: 'guard', t: 0, dur: 9, id: 0 }; const b0 = G.F.map(f => f.spirit), hb = G.F[1].hp; n = 0;
          while (G.F[1].hp === hb && n++ < 60) wBX.land(0, 'jab'); out.block = { dmg: hb - G.F[1].hp, a: G.F[0].spirit - b0[0], b: G.F[1].spirit - b0[1] };
          // a power's damage gives no spirit
          G = __setup(2, ['ogre', 'elf'], null, 100); const p0 = G.F[1].spirit; wBX.cast(0, 'sp'); out.power = { hurt: G.F[1].hp < 100, b: G.F[1].spirit - p0 };
          // the ultimate needs more
          G = __setup(2, ['ogre', 'elf'], null, S.ult - 1); out.ultShort = [wBX.powers(0).ult.ok, wBX.powers(0).ult.why, wBX.powers(0).sp.ok];
          G.F[0].spirit = S.ult; out.ultOk = wBX.cast(0, 'ult'); out.after = G.F[0].spirit;
          G.F[0].spirit = 200; G.F[0].a = { k: 'idle', t: 0, dur: 0, id: 0 }; G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; for (let i = 0; i < 20; i++) wBX.land(0, 'jab'); out.cap = G.F[0].spirit;
          return out; })()""")
        S = sp['S']
        check(sp['start'] == [S['start'], S['start']] and sp['early'] == [False, 'needs spirit'], 'each fighter starts with a little spirit, too little for a special', sp)
        c = sp['clean']
        check(c['dmg'] > 0 and abs(c['a'] - c['dmg'] * S['land']) < .01 and abs(c['b'] - c['dmg'] * S['take']) < .01 and c['b'] > c['a'], 'a clean punch fills the meter for the one who landed it, and more for the one who took it', c)
        b = sp['block']
        check(b['dmg'] > 0 and b['a'] == 0 and abs(b['b'] - b['dmg'] * S['block']) < .01, 'a blocked punch fills only the one who blocked it, and a little', b)
        check(sp['power']['hurt'] and sp['power']['b'] == 0, 'a power\'s damage fills nobody\'s meter', sp['power'])
        check(sp['ultShort'] == [False, 'needs spirit', True] and sp['ultOk'] and sp['after'] == 0, 'an ultimate needs more spirit than a special, and spends it', sp)
        check(sp['cap'] <= S['max'], 'the meter stops at its top', sp['cap'])
        cpu = await pg.evaluate("""(() => { const K = wBX.kinds.slice(0, 18); let sp = 0, ult = 0, n = 0;
          for (let i = 0; i < 120; i++) { const s = wBX.simBout({ fighters: [{ n: 'A', kind: K[i % 18], sp: i % 2 ? 'sp2' : 'sp' }, { n: 'B', kind: K[(i * 7 + 3) % 18] }], seed: 400 + i, skill: [1, 1] }); n++;
            for (const l of s.log) { if (/the ultimate/.test(l.msg)) ult++; else if (/ casts /.test(l.msg)) sp++; } }
          return { sp: sp / n, ult: ult / n }; })()""")
        check(cpu['sp'] >= 2 and 0 < cpu['ult'] < cpu['sp'], 'the CPU still casts, on its spirit: specials most rounds, ultimates less often', cpu)

        # ---- in the Realm ----
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { while (wRoster().length < 4) wAddPlayer(wMakePlayer({ kind: ['gorgon', 'troll', 'elf'][wRoster().length % 3], lvl: 3 }, 'tavern')); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenCamp('ring')")
        tab = await pg.evaluate("""(() => { const sel = document.querySelector('#wCampBody select[data-rsp]'); if (!sel) return null; const pid = +sel.dataset.rsp, p = wPlayer(pid);
          sel.value = 'sp2'; sel.dispatchEvent(new Event('change')); const after = document.querySelector(`#wCampBody select[data-rsp="${pid}"]`);
          return { n: document.querySelectorAll('#wCampBody select[data-rsp]').length, pid, kept: p.bxSp, shown: after && after.value, f: wBxFighter(p).sp, desc: (after.closest('li').querySelector('.wrspd') || {}).textContent, want: wBX.powerBook[p.kind].sp2.desc }; })()""")
        check(tab and tab['n'] >= 1 and tab['kept'] == 'sp2' and tab['shown'] == 'sp2' and tab['f'] == 'sp2' and tab['desc'] == tab['want'],
              'the Ring tab\'s Special list sets the special a boxer brings, and it is kept', tab)
        lock = await pg.evaluate("""(() => { const B = wBxg(), was = B.live; B.live = { world: { club: 'local' }, card: null }; const r = wRingSetSp(%d, 'sp'); B.live = was; return { r, kept: wPlayer(%d).bxSp }; })()""" % (tab['pid'], tab['pid']))
        check(lock['r'] != '' and lock['kept'] == 'sp2', 'it can\'t change while a card is on', lock)
        card = await pg.evaluate("(() => { const p = wPlayer(%d); return (wStatsCard(p).match(/data-rspcard[^>]*>([\\s\\S]*?)<\\/p>/) || [])[1] || ''; })()" % tab['pid'])
        want = await pg.evaluate("wBX.powerBook[wPlayer(%d).kind].sp2.n" % tab['pid'])
        check(want in card, 'the stats card says which special they bring', card[:200])
        await pg.evaluate(CLOSE_ALL)
        opp = await pg.evaluate("""(() => { const club = Object.keys(CLUBS)[0]; wBxg().opp = {};
          const a = wRingOpp(club, 1, new Set()), b = wRingOpp(club, 1, new Set()), key = s => s.fighters.map(f => f.n + ':' + f.sp).sort().join();
          return { all: a.fighters.every(f => ['sp', 'sp2'].includes(f.sp)), same: key(a) === key(b), picks: a.fighters.map(f => f.sp) }; })()""")
        check(opp['all'] and opp['same'], 'a club\'s boxers bring a special each, the same one every time', opp)
        tape = await pg.evaluate("""(() => { const me = wBxFighter(wPlayer(%d)), them = { n: 'X', kind: 'troll', sp: 'sp2', r: wBX.rate('troll') };
          const h = wRingTape(me, them); return { mine: h.includes(wBX.powerBook[me.kind].sp2.n), theirs: h.includes(wBX.powerBook.troll.sp2.n), not: h.includes(wBX.powerBook.troll.sp.n) }; })()""" % tab['pid'])
        check(tape['mine'] and tape['theirs'] and not tape['not'], 'the tale of the tape shows the special each brings', tape)
        await pg.evaluate("wStartRing({ club: 'local', how: 'play' })")
        await pg.wait_for_function("!!document.getElementById('wRingPairT')", timeout=10000)
        pr = await pg.evaluate("document.querySelectorAll('#wRingPairT [data-rsppair]').length")
        check(pr == 3, 'the pairing shows the special each of theirs brings', pr)
        await pg.evaluate(CLOSE_ALL)

        # ---- the bar on the ring ----
        await pg.evaluate("W_RING_MODE = 'play'; wRingBout({ kinds: ['gorgon', 'elf'], seed: 4 })")
        await pg.wait_for_function("UI.view === 'ring' && !!wBX.wait")
        await pg.click('[data-rplan="press"]')
        await pg.wait_for_function("wBX.phase === 'round'")
        await pg.evaluate("wBX.pause(true); wRingBarNote()")
        why = await pg.evaluate("(document.querySelector('[data-rpad=\"sp\"]') || {}).title || ''")
        check('needs spirit' in why, 'the pad says when a power needs spirit', why)
        await pg.evaluate("wBX.G.F[0].spirit = 70; wBX.pause(false)"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/realm-ring-spirit.png', clip={'x': 0, 'y': 0, 'width': 1280, 'height': 300})
        await pg.evaluate("wBX.pause(true); WBX = null; wLeaveRing()")

        # ---- How to play ----
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ text: (document.getElementById('wHelpRingSpirit') || {}).textContent || '', rows: document.querySelectorAll('#wHelpRingSpirit tr').length })")
        check('spirit' in hp['text'] and 'Ring tab' in hp['text'] and hp['rows'] == 19 + len(bk['stars']), 'How to play explains spirit and the choice, with every kind\'s two specials (the superstars\' too)', hp['rows'])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print(f'\n{len(FAILS)} failed' if FAILS else '\nall passed')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
