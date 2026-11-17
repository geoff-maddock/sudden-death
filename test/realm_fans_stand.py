"""The Supporters' Stand (issue #79, phase 4): fans spent on favours leave your total. Open training, a whip-round, a
fan favourite, a mascot, the supporters' coach and a testimonial; each says why not when it can't be had; the Stand
opens at your home ground, or with Imelda Foss until you have one; spending can drop your following a step."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:600])
    else:
        print('ok', what)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1200, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStandBuy === 'function'"); await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo'); await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        c = await pg.evaluate("""(() => { const F = W_STAND.favours; RUN.fans = 0; WG.ground = null;
          return { ids: Object.keys(F), costs: Object.values(F).map(f => f.cost), poor: wStandProblems('whip'), buy: wStandBuy('whip'), where: wStandWhere(), tm: wStandProblems('testimonial').join(' ') }; })()""")
        check(c['ids'] == ['training', 'whip', 'favourite', 'mascot', 'coach', 'testimonial'] and all(x > 0 for x in c['costs']), 'six favours, each with a price in fans', c)
        check('150 fans' in c['poor'][0] and c['buy'] != '' and c['where'] == 'office' and 'home ground' in c['tm'], 'without the fans a favour says why not; with no ground the Stand is at the League office, and a testimonial needs one', c)

        w = await pg.evaluate("""(() => { RUN.fans = 500; const g0 = RUN.gold, n0 = WLOG.length; const r = wStandBuy('whip'); const logs = WLOG.slice(n0).map(l => l[0]);
          return { r, gold: RUN.gold - g0, fans: RUN.fans, step: wFollowStep(), logs }; })()""")
        check(w['r'] == '' and w['gold'] == 50 and w['fans'] == 350 and w['step'] == 1 and any('whip-round' in t for t in w['logs']) and any('down to a few regulars' in t for t in w['logs']),
              'a whip-round pays gold, the fans leave your total, and the log says your following dropped a step', w)
        t = await pg.evaluate("""(() => { RUN.fans = 400; const cards = wStandChoices('training'), card = cards[0], sk0 = card.sk || 0; const bad = wStandBuy('training', { id: 'x' }), r = wStandBuy('training', card);
          return { n: cards.length, sk0, bad, r, sk: card.sk, fans: RUN.fans }; })()""")
        check(t['n'] > 0 and t['sk0'] == 0 and t['bad'] == 'Pick one first.' and t['r'] == '' and t['sk'] == 1 and t['fans'] == 50, 'open training practises the card you pick (and only one of yours)', t)
        f = await pg.evaluate("""(() => { RUN.fans = 460; const ch = wStandChoices('favourite'), p = wRoster().find(x => x.id === ch[0].id), l0 = p.lvl, x0 = p.xp; const r = wStandBuy('favourite', p.id);
          return { n: ch.length, r, up: p.lvl - l0, xp: [x0, p.xp], fans: RUN.fans }; })()""")
        check(f['n'] > 0 and f['r'] == '' and f['up'] == 1 and f['xp'][0] == f['xp'][1] and f['fans'] == 10, 'a fan favourite gets a level’s worth of XP', f)
        m = await pg.evaluate("""(() => { RUN.fans = 800; const n0 = RUN.relics.length; const r = wStandBuy('mascot'), id = RUN.relics[RUN.relics.length - 1]; return { r, got: RUN.relics.length - n0, rar: RELICS[id].rar, fans: RUN.fans }; })()""")
        check(m['r'] == '' and m['got'] == 1 and m['rar'] == 'u' and m['fans'] == 50, 'a mascot is an uncommon trophy', m)
        k = await pg.evaluate("""(() => { RUN.fans = 300; const none = wStandProblems('coach').join(' ');
          const towns = DB.locs.filter(L => L.map && MAPS[L.map] && MAPS[L.map].kind === 'town'); for (const L of towns.slice(0, 3)) WG.flags['seen_' + L.id] = 1;
          const ch = wStandChoices('coach'), to = ch[ch.length - 1], L = DB.locs.find(l => l.map === to.id), m0 = WG.min + WG.dayAbs * 1440; const r = wStandBuy('coach', to.id);
          return { none, n: ch.length, r, at: [WG.map, WG.x, WG.y], want: ['world', L.x, L.y + 1], mins: WG.min + WG.dayAbs * 1440 - m0, fans: RUN.fans }; })()""")
        check(k['n'] >= 1 and k['r'] == '' and k['at'] == k['want'] and k['mins'] == 180 and k['fans'] == 50, 'the supporters’ coach takes you to the gates of a city you have visited, three hours on', k)

        # ---------- a testimonial, at your home ground ----------
        g = await pg.evaluate("""(() => { RUN.fans = 1200; WG.ground = { town: 'mossgate', parts: { stands: 0, pitch: 0, kitchen: 0, scout: 0 }, drill: { n: 0, week: 0 } }; const away = [wStandWhere(), wStandProblems('testimonial').join(' ')];
          const L = DB.locs.find(l => l.map === 'mossgate'); wEnterMap('mossgate', 5, 5); const here = wStandWhere(), clubs = wStandChoices('testimonial');
          const gate = wFanGate({ kind: 'ground', region: wHomeRegion() }); const keep = wPreGame; let W = null; wPreGame = enc => { W = JSON.parse(JSON.stringify(enc.world)); }; let r; try { r = wStandBuy('testimonial', clubs[0].id); } finally { wPreGame = keep; }
          return { away, here, clubs: clubs.length, gate, r, W, fans: RUN.fans }; })()""")
        check(g['away'][0] == '' and 'at your home ground' in g['away'][1] and g['here'] == 'ground' and g['clubs'] >= 1, 'with a ground the Stand is there, and a testimonial is played there against a rival', g)
        check(g['r'] == '' and g['W'] and g['W']['kind'] == 'testimonial' and g['W']['ref']['gate'] == g['gate'] * 2 and g['gate'] == 60 and g['fans'] == 600, 'it starts a match with a full house: twice your fans’ gate at home, fixed when you called it', g)
        e = await pg.evaluate("""(() => { const g0 = RUN.gold, n0 = WLOG.length; W_ON_END.testimonial('lose', { club: 'x', gate: 120 }, {}); return { gold: RUN.gold - g0, line: WLOG.slice(n0).map(l => l[0]).join(' ') }; })()""")
        check(e['gold'] == 120 and 'full house pays 120 gold' in e['line'], 'the full house pays win or lose', e)
        await pg.evaluate(f"(() => {{ try {{ document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click()); }} catch (e) {{}} RUN.pending = null; showView && showView('world'); }})()")

        # ---------- the screens ----------
        s = await pg.evaluate("""(() => { RUN.fans = 420; wOpenStand(); const B = document.getElementById('modalBox'); const rows = [...B.querySelectorAll('[data-favour]')];
          const out = { now: (B.querySelector('#wStandNow') || {}).textContent || '', n: rows.length, off: rows.filter(b => b.disabled).map(b => b.dataset.favour), warn: B.textContent.includes('Takes you below') };
          B.querySelector('[data-favour="whip"]').click(); return Object.assign(out, { fans: RUN.fans, open: !document.getElementById('modal').hidden, again: (document.querySelector('#wStandNow') || {}).textContent || '' }); })()""")
        check("A supporters' club: 420 fans" in s['now'] and s['n'] == 6 and 'mascot' in s['off'] and 'whip' not in s['off'] and s['warn'], 'the Stand lists the favours, what you cannot have, and warns when one drops your following', s)
        check(s['fans'] == 270 and s['open'] and '270 fans' in s['again'], 'asking for one does it and shows the Stand again', s)
        await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click())")
        gr = await pg.evaluate("""(() => { wOpenGround('mossgate'); const b = document.getElementById('wGroundStand'); const has = !!b; if (b) b.click(); const t = (document.querySelector('#modalBox h3') || {}).textContent; document.querySelectorAll('#modalBox [data-close]').forEach(x => x.click());
          const topic = DB.chars.clerk.topics.supporters, greet = DB.chars.clerk.greet; return { has, t, act: topic && topic.act, greet: greet.includes('SUPPORTERS') }; })()""")
        check(gr['has'] and gr['t'] == "The Supporters' Stand" and gr['act'] == 'stand' and gr['greet'], 'your ground has the Stand’s button, and Imelda Foss answers SUPPORTERS', gr)
        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpStand'); return h ? h.textContent : ''; })()")
        check("The Supporters' Stand" in hp and 'Whip-round (150)' in hp and 'SUPPORTERS' in hp, 'How to play explains the Stand', hp)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
