# Realm: the Umbral world (issue #99, phase 2). The six dark towns are built, mirrored left for right, their signs gone
# wrong, their people dark doubles (misspelt, every line with a word wrong, nothing given, taken or set). You walk in
# from the dark world and out again. A dark shop takes fans or XP, never gold; a dark innkeeper turns you away. Five
# lanterns, one a region: rest by one and you are whole, and a blackout on this side wakes you there (before any, by
# the portal). The dark world has its own fog and map, and the dark towns their own lines. The audit walks it all.
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
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbShop === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        # (open, the scene already seen: this check is about the world)
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; wSave()")

        tw = await pg.evaluate("""(() => { const out = { names: W_UMB2.towns.map(id => (MAPS['u:' + id] || {}).name) };
          const L = MAPS.graftonbury, D = MAPS['u:graftonbury']; let sign = null;
          for (const k in L.meta) { const t = L.meta[k].text; if (t && t.length <= 24 && t === t.toUpperCase() && L.t[+k.split(',')[1]][+k.split(',')[0]] === 'S') { sign = k; break; } }
          const [x, y] = sign.split(','), mk = (L.w - 1 - x) + ',' + y;
          out.sign = [L.meta[sign].text, (D.meta[mk] || {}).text, D.t[y][L.w - 1 - x]];
          out.mirror = L.t.every((row, yy) => row.every((c, xx) => DB.tiles[c] && DB.tiles[c].use && !W_UMB2.keep.includes(DB.tiles[c].use) ? true : D.t[yy][L.w - 1 - xx] === c));
          out.style = wStyleOf(D).id;
          out.fronts = !!D.fac && Object.keys(D.fac).every(k => { const [fx, fy] = k.split(',').map(Number); return L.fac[(L.w - 1 - fx) + ',' + fy]; }) && Object.keys(D.fac).length === Object.keys(L.fac).length && D.bldK.length === L.bldK.length;
          out.people = W_UMB2.towns.flatMap(id => Object.values(MAPS['u:' + id].meta).map(mt => mt.text).filter(Boolean)).filter(t => W_UMB2.after.some(a => t.endsWith(a)));
          return out; })()""")
        check(tw['names'] == ['Gravesbury', 'Mossgrave', 'Saltmourn', 'Cindergrave', 'Rimewake', 'The Hollow Coliseum'], 'the six dark towns are built, with their dark names', tw)
        check(tw['fronts'] and tw['people'] == [], 'the buildings keep their fronts, mirrored with them; no sign gets a line meant for a person', tw)
        check(tw['mirror'] and tw['sign'][2] == 'S' and tw['sign'][1] == ' '.join(w[::-1] for w in tw['sign'][0].split(' ')) and tw['style'] == 'ubrick', 'a dark town is its light town mirrored, its signs spelt backwards, in its stone darkened', tw)

        dd = await pg.evaluate("""(() => { const bad = [], D = MAPS['u:graftonbury'], L = MAPS.graftonbury;
          for (const n of D.npcs) { const c = DB.chars[n.id], l = DB.chars[c.double];
            if (!n.id.startsWith('u_') || !l || c.name === l.name) bad.push('not a double: ' + n.id);
            for (const k in c.topics) { const t = c.topics[k]; if (['give', 'take', 'set', 'once', 'recruit', 'gold', 'giveEn', 'takeEn', 'cards', 'pick'].some(f => f in t) || (t.act && t.act !== 'ushop')) bad.push(n.id + '.' + k); } }
          return { bad, n: D.npcs.length, light: L.npcs.length, greet: DB.chars.u_clerk ? [DB.chars.clerk.greet, DB.chars.u_clerk.greet] : null }; })()""")
        check(dd['bad'] == [] and dd['n'] == dd['light'] and dd['greet'] and dd['greet'][0] != dd['greet'][1], 'every person is their dark double: misspelt, a word wrong, and nothing they say gives, takes, sets or opens anything', dd)

        wk = await pg.evaluate("""(() => { const out = {}, L = DB.locs.find(l => l.id === 'graftonbury');
          wEnterMap('u:world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); out.in = [WG.map, WG.x === MAPS['u:graftonbury'].spawn[0] && WG.y === MAPS['u:graftonbury'].spawn[1], wRegionName()];
          wLeaveToWorld(); wDrain(); out.out = [WG.map, WG.x, WG.y, L.x, L.y + 1];
          return out; })()""")
        check(wk['in'] == ['u:graftonbury', True, 'The Severed Plains'] and wk['out'][0] == 'u:world' and wk['out'][1:3] == wk['out'][3:5], 'you walk into a dark town from the dark world, and out again', wk)

        sh = await pg.evaluate("""(async () => { const out = {}, g0 = RUN.gold; RUN.fans = 200; const p = wRoster()[0]; p.xp = 300;
          const id = Object.keys(DB.chars).find(k => k.startsWith('u_') && Object.values(DB.chars[k].topics).some(t => t.act === 'ushop'));
          wRunAct('ushop', id); const fb = document.querySelector('#modalBox [data-how="fans"]:not([disabled])'), k = fb.dataset.ubuy, n0 = WG.items[k] || 0; fb.click();
          out.fans = { item: (WG.items[k] || 0) - n0, fans: 200 - RUN.fans };
          const xb = document.querySelector('#modalBox [data-ubuy="' + k + '"][data-how="xp"]'); const x0 = wUmbXpPlayer().xp, who = wUmbXpPlayer(); xb.click();
          out.xp = { item: (WG.items[k] || 0) - n0, xp: x0 - who.xp, lvl: who.lvl };
          out.gold = RUN.gold === g0; out.want = [wUmbFans(DB.shops[DB.chars[id].shop || 'general'][k]), wUmbXp(DB.shops[DB.chars[id].shop || 'general'][k])];
          document.querySelector('#modalBox [data-close]').click();
          out.inn = wSay(Object.keys(DB.chars).find(k => k.startsWith('u_') && DB.chars[k].topics.room), 'room');
          return out; })()""")
        check(sh['fans']['item'] == 1 and sh['fans']['fans'] == sh['want'][0] and sh['xp']['item'] == 2 and sh['xp']['xp'] == sh['want'][1] and sh['gold'], 'a dark shop sells for fans or a player\'s XP, never gold', sh)
        check('LANTERN' in sh['inn']['text'] and not sh['inn'].get('act'), 'a dark innkeeper turns you away, to the lanterns', sh)

        ln = await pg.evaluate("""(() => { const out = {}, w = MAPS['u:world'], keys = Object.keys(w.meta).filter(k => w.meta[k].lantern);
          out.n = keys.length; out.rgs = keys.map(k => w.meta[k].lantern).sort();
          const [x, y] = keys.find(k => w.meta[k].lantern === 'plains').split(',').map(Number), side = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => { const c = wTileAt(w, x + dx, y + dy); return c && DB.tiles[c].walk && !DB.tiles[c].enter; });
          wEnterMap('u:world', x + side[0], y + side[1]); RUN.hp = 5; for (const q of wRoster()) q.legs = 6; WG.grace = 0; wTryMove(-side[0], -side[1]); wDrain();
          out.modal = !!document.getElementById('wUmbRest'); document.getElementById('wUmbRest').click();
          out.legs = wRoster().map(q => q.legs); out.grace = WG.grace;
          out.rest = { hp: RUN.hp === RUN.maxhp, hour: Math.floor(WG.min / 60), lantern: WG.umbral.lantern && WG.umbral.lantern.rg, at: [WG.umbral.lantern.x, WG.umbral.lantern.y, WG.x, WG.y] };
          return out; })()""")
        check(ln['n'] == 5 and ln['rgs'] == ['bloom', 'ember', 'plains', 'rime', 'tide'], 'there is a lantern in each of the five regions', ln)
        check(all(l == 6 - 4 for l in ln['legs']) and ln['grace'] > 0, 'it rests tired legs as a bed does, and the dark lets you be for a few steps', ln)
        check(ln['modal'] and ln['rest']['hp'] and ln['rest']['hour'] == 7 and ln['rest']['lantern'] == 'plains' and ln['rest']['at'][:2] == ln['rest']['at'][2:], 'resting by one passes the night, makes your team whole, and remembers it', ln)

        bo = await pg.evaluate("""(() => { const out = {}, U = WG.umbral, here = [U.lantern.map, U.lantern.x, U.lantern.y];
          const L = DB.locs.find(l => l.id === 'rimewatch'); wEnterMap('u:world', L.x, L.y + 1); RUN.hp = 1;
          wBlackout({ kind: 'wild', region: 'rime' }, 'lose'); out.lantern = [WG.map, WG.x, WG.y]; out.want = here; out.hp = RUN.hp >= Math.ceil(RUN.maxhp * .5); out.modal = !!document.getElementById('wWake');
          document.getElementById('wWake').click();
          delete U.lantern; wEnterMap('u:world', L.x, L.y + 1); wBlackout({ kind: 'wild', region: 'rime' }, 'lose'); out.portal = [WG.map, Math.abs(WG.x - W_UMB.portal.umbralden[0]) + Math.abs(WG.y - W_UMB.portal.umbralden[1])];
          document.getElementById('wWake').click();
          // (a blackout on the light side still wakes you at an inn there)
          wEnterMap('graftonbury', 5, 11); wBlackout({ kind: 'wild', region: 'plains' }, 'lose'); out.light = WG.map; document.getElementById('wWake').click();
          return out; })()""")
        check(bo['lantern'] == bo['want'] and bo['hp'] and bo['modal'], 'a blackout on this side wakes you by the last lantern you rested at', bo)
        check(bo['portal'] == ['u:umbralden', 1] and not bo['light'].startswith('u:'), 'before any lantern, by the portal on the dark road; a blackout in the light still wakes you in the light', bo)

        mp = await pg.evaluate("""(() => { const out = {}, f0 = WG.fog; const L = DB.locs.find(l => l.id === 'mossgate'); wEnterMap('u:world', L.x, L.y + 2); wTryMove(0, 1); wDrain();
          out.dark = !!(WG.fogs && WG.fogs['u:world']) && wMapSeenCount('u:world') > 0; out.lightSame = WG.fog === f0; out.count = wMapSeenCount() === wMapSeenCount('u:world');
          wOpenMap('world'); out.cv = (document.getElementById('wMapCv') || {}).width > 0; document.querySelector('#modalBox [data-close]').click();
          const n0 = WLOG.length, rnd = Math.random; Math.random = () => 0; WG.step = 9; wAmbient(MAPS['u:mossgate']); Math.random = rnd; out.amb = WLOG.slice(n0).map(l => l[0]);
          wEnterMap('u:mossgate', MAPS['u:mossgate'].spawn[0], MAPS['u:mossgate'].spawn[1]); out.camp = wCanCamp();
          WG.npc['u:mossgate'] = [[0, 0]]; wApplyNpcs('u:mossgate'); out.stale = !WG.npc['u:mossgate'];
          out.audit = wAudit(); return out; })()""")
        check(mp['dark'] and mp['lightSame'] and mp['count'] and mp['cv'], 'the dark world has its own fog and its own map, and leaves the light one\'s alone', mp)
        check('lantern' in mp['camp'] and 'inn' in mp['camp'] and mp['stale'], 'camping in a dark town points you to a lantern; saved places that no longer fit a dark town are dropped', mp)
        check(len(mp['amb']) == 1 and mp['audit'] == [], 'a dark town has its own lines; the audit walks every dark map clean', mp)
        await pg.screenshot(path='/tmp/umbral_town.png')
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
