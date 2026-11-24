# Realm diamond (issue #115, phase 2): baseball's picks, situation powers and the crowd that lifts a cast.
# The picks: on the Nine tab each player with a pair in a role picks one (batting, running, fielding: the kind's own
# magic or the physical skill it would have without it; a pitcher with two magic pitches of a pair, one of them); a kind
# without that magic, or with a passive one, has nothing to pick there; the pick is kept on the player and saved, and
# the nine takes the field with it (the magic left off for the skill, one pitch of the pair). The other nine picks by
# name, the same each time, and the play-by-play names each side's picks. The Umbral's champion keeps her Dead Ball.
# The powers are on in a game the Realm plays and off in LAB mode (a seeded lab game plays as before, picks and all).
# Situation powers: Bases Loaded (a field condition for the at-bat), Full Count (the pitch scatters half as much),
# Extra Innings (the last batter up starts on second) and Last Licks (a condition for three at-bats), each once a game,
# for mana, only when the moment fits; the CPU casts them by its skill with a reason in the play-by-play.
# The crowd: the stands count every run, home run, strikeout, double play and stolen base; at 3 it lifts a cast (an
# ability with a strength half again as strong, an ultimate's zone an at-bat longer), when you call for it (Crowd)
# and only then, or by the CPU's skill; it is kept with the save point. The Powers row shows it all; How to play
# explains it. Asserts; exits nonzero on failure.
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
window.__club = (id, mod) => { const d = wBD.club(id, 3); if (mod) mod(d); return d; };
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 60000)) wBD.step(1); return !!f(); };
window.__sel = () => wBD.G.phase === 'plate' && wBD.G.P && wBD.G.P.stage === 'select';
window.__thrown = () => wBD.G.phase === 'play' || (wBD.G.phase === 'plate' && !!wBD.G.P && !!wBD.G.P.pitch);
window.__game = o => { wBD.start(Object.assign({ innings: 3, diff: 1, rules: W_BALL.rules }, o)); wBD.pause(false); };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBD !== 'undefined' && typeof wStartBall === 'function' && typeof wBdPickDef === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- a journey with the kinds to pick from ----------
        await pg.evaluate("""(() => { wStart(null, { club: CLUB_IDS[0] });
          for (const kind of ['harpy', 'witch', 'golem', 'dwarf']) wRecruit({ kind, lvl: 3 }, 'tavern');
          WG.nine = null; wNineSync(); const w = wRoster().find(p => p.kind === 'witch'); wNineSetPos(w.id, 'P'); wDrain(); })()""")
        await pg.evaluate("wOpenCamp('nine')"); await pg.wait_for_selector('#wCampBody [data-nwatch]')
        tab = await pg.evaluate("""(() => { const row = k => { const p = wRoster().find(q => q.kind === k); const li = document.querySelector(`#wCampBody [data-nid="${p.id}"]`);
            return [...li.querySelectorAll('[data-bdpw]')].map(s => [s.dataset.bdpw, [...s.options].map(o => o.textContent)]); };
          return { harpy: row('harpy'), witch: row('witch'), golem: row('golem'), dwarf: row('dwarf') }; })()""")
        h = dict(tab['harpy'])
        check(sorted(h) == ['bat', 'field', 'run'] and h['bat'][0].startswith('Shriek (1 mana)') and 'stamina' in h['bat'][1] and h['run'][0].startswith('Glide') and h['field'][0].startswith('Take Flight'),
              'the Nine tab: a harpy picks its Shriek, Glide and Take Flight or the physical skill in each role (mana or stamina)', tab['harpy'])
        check([r[0] for r in tab['golem']] == ['field'] and [r[0] for r in tab['dwarf']] == ['bat'], 'a passive Stone Skin and a missing magic have nothing to pick: the golem picks only in the field, the dwarf only at bat', tab)
        check(dict(tab['witch']).get('pitch') and [o.split(' (')[0] for o in dict(tab['witch'])['pitch']] == ['Hex Knuckler', 'Phantom'], 'a witch on the mound picks the Hex Knuckler or the Phantom', tab['witch'])
        await pg.select_option('#wCampBody [data-nid="%d"] [data-bdpw="bat"]' % await pg.evaluate("wRoster().find(q => q.kind === 'harpy').id"), '1')
        await pg.select_option('#wCampBody [data-nid="%d"] [data-bdpw="pitch"]' % await pg.evaluate("wRoster().find(q => q.kind === 'witch').id"), '1')
        kept = await pg.evaluate("""(() => { const h = wRoster().find(q => q.kind === 'harpy'), w = wRoster().find(q => q.kind === 'witch');
          const saved = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /realm/.test(k) && localStorage.getItem(k).includes('"bdPw"')) || 'null') || 'null');
          const def = wBdPickDef(wNineDef()), gh = def.roster.find(g => g.rid === h.id), gw = def.roster.find(g => g.rid === w.id);
          return { h: h.bdPw, w: w.bdPw, saved: !!saved, bat: gh.bat, phys: wBD.physOf(gh, 'bat'), run: gh.run, field: gh.field, pitches: gw.pitches, took: gh.bdPick,
            sel: document.querySelector(`#wCampBody [data-nid="${h.id}"] [data-bdpw="bat"]`).value }; })()""")
        check(kept['h']['bat'] == 1 and kept['w']['pitch'] == 1 and kept['sel'] == '1' and kept['saved'], 'the pick is kept on the player and saved', kept)
        check(kept['bat'] is None and kept['phys'] in ('choke', 'uppercut', 'slap', 'grip') and kept['run'] == 'glide' and kept['field'] == 'flight', 'the harpy takes the field with its physical swing for Shriek, and keeps Glide and Take Flight', kept)
        check('phantom' in kept['pitches'] and 'hex' not in kept['pitches'] and 'frost' in kept['pitches'], 'the witch brings the Phantom (not the Hex Knuckler) and keeps her Frost Orb', kept['pitches'])
        card = await pg.evaluate("(() => wBdCard(wRoster().find(q => q.kind === 'harpy')))()")
        check('Brings to the diamond' in card and 'Glide' in card, 'the stats card names what they bring', card[-300:])
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")

        # ---------- the other nine, by name; the Umbral's champion ----------
        cpu = await pg.evaluate("""(() => { const club = Object.values(WG.rivals)[0], a = wBdPickDef(wBallOpp(club, 2)), b = wBdPickDef(wBallOpp(club, 2));
          const sig = d => d.roster.map(g => [g.n, g.bat, g.run, g.field, (g.pitches || []).join()].join('|'));
          const champ = wBdPickDef(wUmb4aNine(4, 'diamond')).roster.find(g => g.pos === 'P');
          const all = []; for (const id of ['ironmaw', 'mirewood']) all.push(...wBdPickDef(wBD.club(id, 3)).roster.map(g => g.bdPick.length));
          const name = ['bat', 'run', 'field', 'pitch'].map(r => [0, 1].includes(wBdPickByName('Snikt')[r]));
          return { same: JSON.stringify(sig(a)) === JSON.stringify(sig(b)), picked: a.roster.every(g => Array.isArray(g.bdPick)), champ: champ.pitches, all, name,
            spread: new Set(['Snikt', 'Vexa', 'Kreel', 'Wisp', 'Silk', 'Sethra'].map(n => JSON.stringify(wBdPickByName(n)))).size }; })()""")
        check(cpu['same'] and cpu['picked'] and all(cpu['name']) and cpu['spread'] > 1, 'the other nine picks by name: the same nine picks the same each time, and names differ', cpu)
        check('deadball' in cpu['champ'], 'the Umbral champion keeps her Dead Ball through the picks', cpu['champ'])

        # ---------- on in the Realm, off in a lab ----------
        lab = await pg.evaluate("""(() => { LAB = true; const o = wBdPowNext({ defs: [wNineDef()], rules: W_BALL.rules });
          wBD.sim({ defs: [wNineDef(), wBallOpp(Object.values(WG.rivals)[0], 1)], innings: 3, diff: 1, rules: W_BALL.rules });
          const off = { rules: !!(o.rules || {}).bdpow, bdp: wBD.G.bdp, meteor: wBD.G.teams[1].def.roster.find(g => g.pos === 'P').pitches };
          W_BDPOW.lab = { on: [true, true], sit: true, crowd: true }; const on = !!wBdPowNext({ rules: {} }).rules.bdpow; W_BDPOW.lab = null; LAB = false;
          const real = wBdPowNext({ defs: [wNineDef()], rules: W_BALL.rules }); return { off, on, real: real.rules.bdpow, picked: !!real.defs[0].bdPicked }; })()""")
        check(lab['off']['rules'] is False and lab['off']['bdp'] is None, 'in LAB mode the powers are off (the lab sets W_BDPOW.lab to play them)', lab['off'])
        check(lab['on'] and lab['real'] and lab['real']['sit'] and lab['real']['crowd'] and lab['picked'], 'and on in a game the Realm plays, picks and all', lab)

        # ---------- situation powers ----------
        sit = await pg.evaluate("""(() => { const out = {};
          __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0 }); const G = wBD.G, R0 = G.teams[0].def.roster;
          __to(__sel); out.bdp = !!G.bdp; G.teams[0].mana = 6;
          out.early = wBD.sitWhy(0, 'loaded'); out.fit0 = wBD.sitFit(0, 'loaded');
          G.bases = [null, R0[5], R0[6], R0[7]];
          out.fit = wBD.sitFit(0, 'loaded'); out.why = wBD.sitWhy(0, 'loaded'); out.cast = wBD.castSit('loaded');
          const z = G.zones.find(z => z.id === 'sit:loaded'); out.zone = z && [z.turns, z.fx.swing, z.fx.rSpd]; out.mana = G.teams[0].mana;
          out.again = wBD.castSit('loaded'); out.field = wBD.sitWhy(1, 'loaded');
          out.log = G.log.slice(0, 3).map(l => l.text || l);
          // extra innings: the last batter up starts on second
          G.bases = [null, null, null, null]; G.inning = 4; G.outs = 0; out.xwhy = wBD.sitWhy(0, 'extra'); out.xcast = wBD.castSit('extra');
          const up = R0[G.teams[0].idx]; out.ghost = G.bases[2] && G.bases[2].n; out.notBatter = G.bases[2] !== up; out.prev = R0[(G.teams[0].idx + 8) % 9].n;
          // last licks: only the home side, in the bottom of the last or later, behind or level
          out.llAway = wBD.sitWhy(0, 'lastlicks');
          G.inning = 1; G.bases = [null, null, null, null]; G.zones = []; return out; })()""")
        check(sit['bdp'] and sit['early'] == 'Only with the bases loaded.' and sit['fit0'] is False, 'a situation power waits for its moment', sit)
        check(sit['fit'] and sit['why'] == '' and sit['cast'] == '' and sit['zone'] == [1, 1.2, 1.2] and sit['mana'] == 4, 'Bases Loaded: 2 mana, a field condition for this at-bat (a fifth more swing and speed)', sit)
        check(sit['again'] == 'Once a game.' and sit['field'] == 'Only at bat.', 'once a game, and only for the side at bat', sit)
        check(any('Bases Loaded' in l for l in sit['log']), 'the play-by-play names it', sit['log'])
        check(sit['xwhy'] == '' and sit['xcast'] == '' and sit['ghost'] == sit['prev'] and sit['notBatter'], 'Extra Innings: the last batter up starts on second', sit)
        check('home side' in sit['llAway'], 'Last Licks is the home side\'s', sit['llAway'])
        ll = await pg.evaluate("""(() => { __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 1 }); const G = wBD.G; __to(__sel);
          G.teams[1].mana = 6; const out = { top: wBD.sitWhy(1, 'lastlicks') };
          // full count: in the field, on three balls and two strikes; the pitch scatters half as much
          G.balls = 3; G.strikes = 1; out.fc0 = wBD.sitWhy(1, 'fullcount'); G.strikes = 2; out.fc = wBD.castSit('fullcount');
          G.P.stage = 'windup'; G.P.t = 0; __to(__thrown); out.flag = !!G.P.pitch.bdpFc; out.after = wBD.bdp.fc;
          return out; })()""")
        check(ll['top'] == 'Only at bat.' and ll['fc0'] == 'Only on a full count.' and ll['fc'] == '' and ll['flag'] and ll['after'] is None, 'Full Count: only on three balls and two strikes, and that pitch scatters half as much', ll)
        ll2 = await pg.evaluate("""(() => { __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 1 }); const G = wBD.G; __to(__sel);
          G.teams[1].mana = 6; G.half = 1; G.inning = 3; G.teams[0].R = 2; G.teams[1].R = 1; const out = { why: wBD.sitWhy(1, 'lastlicks'), cast: wBD.castSit('lastlicks') };
          const z = G.zones.find(z => z.id === 'sit:lastlicks'); out.zone = z && [z.turns, z.fx.carry, z.fx.swing]; G.teams[1].R = 3; return out; })()""")
        check(ll2['why'] == '' and ll2['cast'] == '' and ll2['zone'] == [3, 1.08, 1.1], 'Last Licks: the home side behind in the bottom of the last, a condition for three at-bats', ll2)

        # ---------- the CPU casts by its skill, with reasons; the stands count every moment ----------
        cpu2 = await pg.evaluate("""(() => { const out = { sit: {}, amp: 0, ult: 0, why: [], tally: [], ok: [] };
          for (let i = 0; i < 40; i++) {
            wBD.sim({ defs: [__club('ironmaw'), __club('mirewood')], innings: 3, diff: 1 + i % 3, rules: W_BALL.rules });
            const G = wBD.G, B = G.bdp, P = [...G.pstats.values()], sum = k => P.reduce((a, s) => a + (s[k] || 0), 0);
            for (const c of B.casts) { if (c.k === 'sit') out.sit[c.id] = (out.sit[c.id] || 0) + 1; else if (c.k === 'amp') out.amp++; else out.ult++; if (!c.why) out.why.push(c); }
            out.ok.push(B.tally.k === sum('so') && B.tally.hr === sum('hr') && B.tally.sb === sum('sb') && B.tally.run === G.teams[0].R + G.teams[1].R && B.crowd.every(v => v >= 0 && v <= 6));
            if (i === 0) out.tally = [B.tally, sum('so'), sum('hr'), sum('sb'), G.teams[0].R + G.teams[1].R];
          }
          const L = wBD.G.full.map(l => l.text || l); out.lines = L.filter(t => /^(✦|♪)/.test(t)).slice(0, 4); return out; })()""")
        check(all(cpu2['ok']), 'the stands count every strikeout, home run, stolen base and run, and the crowd stays between 0 and 6', cpu2['tally'])
        neg = await pg.evaluate("""(() => { for (let i = 0; i < 600; i++) {
            wBD.sim({ defs: [__club('ironmaw'), __club('mirewood')], innings: 3, diff: 1 + i % 3, rules: W_BALL.rules });
            const G = wBD.G; if (G.full.some(l => /doesn't count on the force/.test(l.text || l))) return { found: i + 1, run: G.bdp.tally.run, R: G.teams[0].R + G.teams[1].R };
          } return { found: 0 }; })()""")
        check(neg['found'] and neg['run'] == neg['R'], 'a run taken back on a force for the third out is taken back from the stands too', neg)
        check(len(cpu2['sit']) >= 3 and cpu2['amp'] > 0 and cpu2['ult'] > 0 and not cpu2['why'], 'the CPU casts situation powers and spends the crowd on abilities and ultimates, each with its reason', cpu2)

        # ---------- the crowd lifts a cast ----------
        amp = await pg.evaluate("""(() => { const out = {};
          __game({ mode: '1p', defs: [__club('ironmaw', d => { d.roster[0].bat = 'axe'; }), __club('mirewood')], humanSide: 0 }); const G = wBD.G, B = wBD.bdp; __to(__sel);
          const b = G.teams[0].def.roster[0]; B.amp = { id: 'axe', n: b.n }; out.k = wBD.abPow(b, 'axe') / (B.amp = null, wBD.abPow(b, 'axe'));
          out.low = wBD.arm(true); B.crowd[0] = 3; out.arm = wBD.arm(true); out.armed = B.arm[0];
          G.teams[0].mana = 6; G.P.si = G.P.stances.findIndex(s => s.k === 'ab'); __to(__thrown);
          out.casts = B.casts.map(c => [c.k, c.id, c.why]); out.crowd = B.crowd[0]; out.after = B.arm[0];
          // not called for: your crowd stays put
          __game({ mode: '1p', defs: [__club('ironmaw', d => { d.roster[0].bat = 'axe'; }), __club('mirewood')], humanSide: 0 }); __to(__sel);
          wBD.bdp.crowd[0] = 3; wBD.G.teams[0].mana = 6; wBD.G.P.si = wBD.G.P.stances.findIndex(s => s.k === 'ab'); __to(__thrown); out.idle = [wBD.bdp.crowd[0], wBD.bdp.casts.filter(c => c.side === 0).length];
          // a magic steal, called for: its bonus lifted, the crowd spent once
          __game({ mode: '1p', defs: [__club('ironmaw'), __club('mirewood')], humanSide: 0 }); __to(__sel);
          { const G = wBD.G, B = wBD.bdp, r = G.teams[0].def.roster[8];
            r.run = 'fleet'; G.bases = [null, r, null, null]; G.teams[0].mana = 6; B.crowd[0] = 3; wBD.arm(true); G.P.si = 0;
            const S0 = G.run; S0.sig = G.bases.map(p => p ? p.n + '#' + p.num : '-').join('|'); S0.steal = 2; __to(() => !!(G.run && G.run.go) || __thrown());
            const go = G.run && G.run.go; out.steal = { bonus: go && go.magic && go.magic.bonus, id: go && go.magic && go.magic.id, casts: B.casts.map(c => [c.k, c.id, c.why]), crowd: B.crowd[0], arm: B.arm[0] }; }
          // an ultimate's zone an at-bat longer
          wBD.bdp.crowd[0] = 3; wBD.bdp.ultAmp = [{ id: 'howl', s: 0, why: 'called for' }]; wBD.powProbe.zone('howl');
          const z = wBD.G.zones.find(z => z.id === 'howl'); out.ult = [z && z.turns, wBD.bdp.crowd[0]];
          return out; })()""")
        check(abs(amp['k'] - 1.5) < 1e-9, 'a lifted ability works half again as strongly', amp)
        check(amp['low'] != '' and amp['arm'] == '' and amp['armed'], 'Crowd needs 3 to call for, then it waits for your next cast', amp)
        check(amp['casts'] == [['amp', 'axe', 'called for']] and amp['crowd'] == 0 and amp['after'] is False, 'your Battle Axe takes it: 3 crowd spent, logged', amp)
        check(amp['idle'] == [3, 0], 'not called for, your crowd stays put', amp['idle'])
        check(amp['steal'] == {'bonus': 6, 'id': 'fleet', 'casts': [['amp', 'fleet', 'called for']], 'crowd': 0, 'arm': False}, 'a magic steal, called for: Fleet Foot\'s bonus half again (4 to 6), the crowd spent once', amp['steal'])
        check(amp['ult'] == [4, 0], 'an ultimate\'s zone lasts an at-bat more (4) for 3 crowd', amp['ult'])

        # ---------- in a game you play: the Powers row, the save point ----------
        await pg.evaluate("""(() => { wRoster().forEach(p => { p.lvl = 3; }); WG.ball = null; const club = Object.values(WG.rivals)[0]; window.__club0 = club; return wStartBall({ club, how: 'play' }); })()""")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.live && !!wBD.bdp")
        await pg.evaluate("wBD.pause(true)")
        await pg.evaluate("__to(__sel)")
        row = await pg.evaluate("""(() => { const r = document.getElementById('wBallPowRow'); wBallPowRows(true);
          const L = wBD.G.log.map(l => l.text || l); return { shown: !r.hidden, text: r.textContent, arm: !!r.querySelector('[data-bdarm]') && r.querySelector('[data-bdarm]').disabled, bring: L.filter(t => / bring: /.test(t)).length }; })()""")
        check(row['shown'] and 'Crowd' in row['text'] and 'Mana' in row['text'] and row['arm'], 'the Powers row: mana, the crowd, and Crowd off until it reaches 3', row)
        check(row['bring'] >= 1, 'the play-by-play names the picks', row)
        await pg.evaluate("wBD.bdp.crowd[0] = 3; wBD.G.teams[0].mana = 6; { const R0 = wBD.G.teams[0].def.roster; wBD.G.bases = [null, R0[5], R0[6], R0[7]]; } wBallPowRows(true)")
        await pg.wait_for_selector('#wBallPowRow [data-bdsit="loaded"]:not([disabled])')
        await pg.click('#wBallPowRow [data-bdarm]')
        armsnap = await pg.evaluate("(() => { const sn = WG.ball.live.snap; return !!(sn && sn.bdp && sn.bdp.arm[0]); })()")
        check(armsnap, 'pressing Crowd is in the save point at once', armsnap)
        await pg.click('#wBallPowRow [data-bdsit="loaded"]')
        ui = await pg.evaluate("""(() => ({ arm: wBD.bdp.arm[0], used: !!wBD.bdp.used[0].loaded, mana: wBD.G.teams[0].mana, snap: WG.ball.live.snap && WG.ball.live.snap.bdp,
          gone: !document.querySelector('#wBallPowRow [data-bdsit="loaded"]') }))()""")
        check(ui['arm'] and ui['used'] and ui['mana'] == 4 and ui['gone'], 'Crowd and Bases Loaded from the row: called for, cast, and gone from the row', ui)
        check(ui['snap'] and ui['snap']['used'][0].get('loaded') and ui['snap']['crowd'][0] == 3 and ui['snap']['arm'][0] and any(z['id'] == 'sit:loaded' for z in ui['snap']['zones']), 'the save point keeps the crowd, the call, the cast and its condition', ui['snap'])
        await pg.evaluate("wBallLeave()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("wResumeBall()")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.live && !!wBD.bdp")
        res = await pg.evaluate("({ used: !!wBD.bdp.used[0].loaded, crowd: wBD.bdp.crowd[0], arm: wBD.bdp.arm[0], zone: wBD.G.zones.some(z => z.id === 'sit:loaded') })")
        check(res == {'used': True, 'crowd': 3, 'arm': True, 'zone': True}, 'Save and leave, then Resume: all of it comes back', res)
        await pg.evaluate("wBallConcede()"); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("!wBallLive()")

        # ---------- How to play ----------
        hp = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpBallPow'); return e ? e.textContent : ''; })()")
        check('Nine tab' in hp and 'Bases Loaded' in hp and 'Extra Innings' in hp and 'Full Count' in hp and 'Last Licks' in hp and 'half again' in hp, 'How to play explains the picks, the situation powers and the crowd', hp[:200])

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILED: %d' % len(FAILS) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
