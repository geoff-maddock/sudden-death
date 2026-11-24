# Realm (issue #115, phase 5): one league of powers. Every engine sport has the shared set: a pick of powers per role,
# kept on the player and brought into the game; a team resource; a crowd meter; one ultimate a kind; situation powers;
# gear (W_GEAR pieces for the sport, worn as p.gear.<key>, reaching the engine through the player); potions (W_POTIONS
# for the sport, each in the engine's own table); Auto powers; the ground's own ways; and How to play for each.
# The table SPORTS below has one row per engine sport, naming where each part lives. Every engine in W_ENGINES must
# have a row, and every row must name every part in PARTS, so a ninth sport can't ship without them: add its row.
# Each part is checked as it is (the table or function exists and isn't empty) and, where cheap, as it behaves: a
# player's pick and gear go into the engine's player, and a game started through the Realm has its powers, meter,
# situations, bags and ground on. Failures name the sport and the part. Asserts; exits nonzero on failure.
# docs/realm/CONTRACT.md ("The shared set and each sport's own") lists the same table in words.
import asyncio, json, re, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

# The parts every row must name. Each is a dict; 'help' is (the How to play element id, [regexes its text must match]).
#   picks:      field (the player's key), roles, opt ((kind, role) => the options for that role), set (p => sets the
#               second of every pair on a roster player), got (m => the engine's player m carries it), every_kind
#               (every kind has a pair in every role; False only where the issue says a kind keeps a lone power)
#   resource:   have (the rules or the priced powers), live (in a Realm game: the resource is there and powers are on)
#   meter:      have (its rules), pays (the key in them that is what it buys: amp for a lift, ult for the ultimate), live
#   ultimate:   of (kind => the kind's ultimate; every kind has one), live
#   situations: have (the table: at least three, each named and described), live
#   gear:       got ((m, id) => the engine's player m wears piece id); the pieces come from W_GEAR by the row's key
#   potions:    table (the engine's potion table), fn (the engine's function for the bag), live
#   auto:       have, live
#   ground:     have (its rules), live (on in a Realm game at that ground)
PARTS = ('picks', 'resource', 'meter', 'ultimate', 'situations', 'gear', 'potions', 'auto', 'ground')

SPORTS = [
    dict(sport='baseball', engine='diamond', scope='wBD', key='diamond', home='Graftonbury Ballpark: the mound grass, the flickering floodlight',
         start="wStartBall({ club: 'local', how: 'manage' })",
         kinds="[...new Set(wBD.positions.flatMap(p => wBD.kindsAt(p)))]",
         player="p => wNineBdPlayer(p, 'CF')",
         # a kind's own abilities split into pairs (no new ones): a role where the kind has no magic keeps its physical skill
         picks=dict(field='bdPw', roles=['bat', 'run', 'field', 'pitch'], every_kind=False,
                    opt="(k, r) => wBdPair(wBD.rate(k), r) || []",
                    set="p => { p.bdPw = { bat: 1, run: 1, field: 1, pitch: 1 }; }",
                    got="m => !!m.bdPw && m.bdPw.bat === 1 && m.bdPw.pitch === 1",
                    help=('wHelpBallPow', [r'pick'])),
         resource=dict(have="Object.values(wBD.names().ab).filter(a => a.cost > 0)",
                       live="wBD.G.teams.every(t => typeof t.mana === 'number') && wBD.bdp.on.every(Boolean)",
                       help=('wHelpBallPow', [r'mana'])),
         meter=dict(have="wBD.crowdRules", pays='amp', live="wBD.bdp.crowdOn === true && wBD.bdp.crowd.length === 2",
                    help=('wHelpBallPow', [r'crowd'])),
         ultimate=dict(of="k => wBD.names().ult[wBD.rate(k).ult]", live="wBD.G.teams.every(t => t.def.roster.some(p => p.ult))",
                       help=('wHelpBallPow', [r'ultimate'])),
         situations=dict(have="wBD.sit", live="wBD.bdp.sitOn === true && wBD.bdp.used.length === 2",
                         help=('wHelpBallPow', [r'situation'])),
         gear=dict(got="(m, id) => m.gid === id", help=('wHelpBallKit', [r'gear'])),
         potions=dict(table="wBD.potions", fn='potionWhy', live="!!wBD.kit && wBD.kit.bags.length === 2",
                      help=('wHelpBallKit', [r'potion'])),
         auto=dict(have="W_BALL_HOW.manage", live="wBD.G.rules.auto === true", help=('wHelpBallPow', [r'Auto powers'])),
         ground=dict(have="wBD.ground", live="!!wBD.gd && wBD.gd.grassOn === true",
                     help=('wHelpBallGround', [r'mound', r'floodlight']))),

    dict(sport='football', engine='gridiron', scope='wGF', key='grid', home='the Ash Bowl: ashfall, the heat shimmer',
         start="wGridironGame({ mode: 'call', seed: 9 })",
         kinds="Object.keys(wGF.powerBook)",
         player="p => wSevenPlayer(p)",
         picks=dict(field='gfPw', roles=['off', 'def'], every_kind=True,
                    opt="(k, r) => [wGF.powerBook[k][r], wGF.powerBook[k][r + '2']].filter(Boolean)",
                    set="p => { p.gfPw = { off: 1, def: 1 }; }",
                    got="m => !!m.pw && m.pw.off === 1 && m.pw.def === 1",
                    help=('wHelpGfPow2', [r'pick'])),
         resource=dict(have="wGF.mana", live="wGF.G.mana.length === 2", help=('wHelpGfPowers', [r'mana'])),
         meter=dict(have="wGF.roarRules", pays='amp', live="!!wGF.G.roar && wGF.G.roar.on.every(Boolean) && wGF.G.roar.v.length === 2",
                    help=('wHelpGfRoar', [r'roar'])),
         ultimate=dict(of="k => wGF.powerBook[k].ult", live="wGF.G.ultUsed.length === 2", help=('wHelpGfPowers', [r'ultimate'])),
         situations=dict(have="wGF.situations", live="wGF.G.sitUsed.length === 2", help=('wHelpGfPow2', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpGridKit', [r'gear'])),
         potions=dict(table="wGF.potions", fn='potionWhy', live="wGF.G.bags.length === 2", help=('wHelpGridKit', [r'potion'])),
         auto=dict(have="wGF.setAuto", live="(() => { const on = wGF.setAuto(true), seen = wGF.powers().auto; wGF.setAuto(false); return on === true && seen === true; })()",
                   help=('wHelpGfPowers', [r'Auto powers'])),
         ground=dict(have="wGF.ashRules", live="!!wGF.G.ash", help=('wHelpGfAsh', [r'ash', r'heat']))),

    dict(sport='boxing', engine='ring', scope='wBX', key='ring', home='the Anvil Ring: the forge corner, the slack ropes',
         start="wRingBout({ kinds: ['gorgon', 'elf'], seed: 4 })",
         kinds="Object.keys(wBX.powerBook)",
         player="p => wBxFighter(p)",
         # one role (the special): sp or sp2, kept as p.bxSp
         picks=dict(field='bxSp', roles=['sp'], every_kind=True,
                    opt="(k, r) => [wBX.powerBook[k].sp, wBX.powerBook[k].sp2].filter(Boolean)",
                    set="p => { p.bxSp = 'sp2'; }",
                    got="m => m.sp === 'sp2'",
                    help=('wHelpRingSpirit', [r'choice of special'])),
         # stamina pays (boxing is about legs), and spirit as well (BX_SPIRIT)
         resource=dict(have="wBX.powerCost", live="wBX.G.powers === true && wBX.G.F.every(f => typeof f.sta === 'number' && f.staMax > 0)",
                       help=('wRingHow', [r'stamina'])),
         meter=dict(have="wBX.spirit", pays='ult', live="wBX.G.F.every(f => typeof f.spirit === 'number')", help=('wHelpRingSpirit', [r'spirit'])),
         ultimate=dict(of="k => wBX.powerBook[k].ult", live="wBX.G.F.every(f => 'ultUsed' in f)", help=('wHelpRingSpirit', [r'ultimate'])),
         situations=dict(have="wBX.sits", live="!!wBX.G.bxp && wBX.G.bxp.sit === true && wBX.G.bxp.used.length === 2",
                         help=('wHelpRingMore', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpRingKit', [r'gear'])),
         potions=dict(table="wBX.potions", fn='potionOk', live="wBX.G.bags.length === 2", help=('wHelpRingKit', [r'potion'])),
         # boxing's Auto powers is You corner: your fighter casts as the CPU would
         auto=dict(have="W_RING_MODES.call", live="(() => { const was = wBX.mode; wBX.setMode('call'); const ok = wBX.mode === 'call'; wBX.setMode(was); return ok; })()",
                   help=('wRingHow', [r'You corner'])),
         ground=dict(have="wBX.anvilRules", live="!!wBX.G.anvil", help=('wHelpRingAnvil', [r'forge', r'rope']))),

    dict(sport='basketball', engine='court', scope='wBK', key='court', home='the Charter Court: the waxed boards, the bent rim',
         start="wCourtGame({ seed: 7, mode: 'watch' })",
         kinds="Object.keys(wBK.powerBook)",
         player="p => wCourtPlayer(p)",
         picks=dict(field='bkPw', roles=['off', 'def'], every_kind=True,
                    opt="(k, r) => [wBK.powerBook[k][r], wBK.powerBook[k][r + '2']].filter(Boolean)",
                    set="p => { p.bkPw = { off: 1, def: 1 }; }",
                    got="m => !!m.pw && m.pw.off === 1 && m.pw.def === 1",
                    help=('wHelpCourtPow', [r'pick'])),
         resource=dict(have="wBK.powerRules.mana", live="wBK.G.mana.length === 2 && !!wBK.G.powers", help=('wHelpCourtPow', [r'mana'])),
         meter=dict(have="wBK.powerRules.spirit", pays='ult', live="wBK.G.spirit.length === 2", help=('wCourtPowHow', [r'spirit'])),
         ultimate=dict(of="k => wBK.powerBook[k].ult", live="wBK.G.ultUsed.length === 2", help=('wCourtPowHow', [r'ultimate'])),
         situations=dict(have="wBK.sits", live="wBK.G.sitUsed.length === 2", help=('wCourtPowHow', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpCourtKit', [r'gear'])),
         potions=dict(table="wBK.potions", fn='potionWhy', live="wBK.G.bags.length === 2", help=('wHelpCourtKit', [r'potion'])),
         auto=dict(have="'auto' in wBK", live="(() => { const was = wBK.auto; wBK.auto = true; const ok = wBK.auto === true; wBK.auto = was; return ok; })()",
                   help=('wCourtPowHow', [r'Auto powers'])),
         ground=dict(have="wBK.courtRules", live="!!wBK.G.court", help=('wHelpCourtGame', [r'waxed', r'rim']))),

    dict(sport='hockey', engine='rink', scope='wHK', key='rink', home='the Pond Rink: the pond ice, the old boards',
         start="wRinkGame({ seed: 7, mode: 'watch' })",
         kinds="Object.keys(wHK.pows)",
         player="p => wRinkPlayer(p)",
         picks=dict(field='hkPw', roles=['puck', 'chk'], every_kind=True,
                    opt="(k, r) => [wHK.pows[k].one, wHK.pows[k].two].map(a => a && a[r === 'puck' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.hkPw = { puck: 1, chk: 1 }; }",
                    got="m => !!m.pw && m.pw.puck === 1 && m.pw.chk === 1",
                    help=('wHelpRinkTab', [r'pick'])),
         resource=dict(have="wHK.powRules.mana", live="wHK.G.mana.length === 2 && wHK.powersOn === true", help=('wRinkHowPow', [r'mana'])),
         meter=dict(have="wHK.powRules.spirit", pays='ult', live="wHK.G.spirit.length === 2", help=('wRinkHowPow', [r'roar'])),
         ultimate=dict(of="k => wHK.pows[k].ult", live="wHK.G.ultUsed.length === 2", help=('wRinkHowPow', [r'ultimate'])),
         situations=dict(have="wHK.sits", live="wHK.G.sitUsed.length === 2", help=('wRinkHowPow', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpRinkKit', [r'gear'])),
         potions=dict(table="wHK.potions", fn='potionWhy', live="wHK.G.bags.length === 2", help=('wHelpRinkKit', [r'potion'])),
         # on unless you turn it off
         auto=dict(have="'autoPow' in wHK", live="wHK.autoPow === true", help=('wRinkHowPow', [r'Auto powers'])),
         ground=dict(have="wHK.pondRules", live="!!wHK.G.pond", help=('wHelpRinkGame', [r'snow', r'boards']))),

    dict(sport='golf', engine='links', scope='wGL', key='links', home='Mossgate Links: the wood, the enchanted course',
         start="wLinksGame({ seed: 11, mode: 'watch', holes: 9 })",
         kinds="Object.keys(wGL.pow)",
         player="p => wLinksPlayer(p)",
         picks=dict(field='glPw', roles=['long', 'short'], every_kind=True,
                    opt="(k, r) => [wGL.pow[k], wGL.pow2[k]].map(a => a && a[r === 'long' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.glPw = { long: 1, short: 1 }; }",
                    got="m => !!m.pw && m.pw.long === 1 && m.pw.short === 1",
                    help=('wHelpLinksTab', [r'pick'])),
         resource=dict(have="wGL.manaRules", live="wGL.G.mana.length === 2 && !!wGL.G.powers", help=('wLinksHow', [r'mana'])),
         meter=dict(have="wGL.roarRules", pays='ult', live="wGL.G.roar.length === 2", help=('wLinksHow', [r'roar'])),
         ultimate=dict(of="k => wGL.ult[k]", live="wGL.G.ultUsed.length === 2", help=('wLinksHow', [r'ultimate'])),
         situations=dict(have="wGL.sit", live="wGL.G.sitUsed.length === 2", help=('wLinksHow', [r'situation powers'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpLinksKit', [r'gear'])),
         potions=dict(table="wGL.potions", fn='potionWhy', live="wGL.G.bags.length === 2", help=('wHelpLinksKit', [r'potion'])),
         auto=dict(have="'autoPow' in wGL", live="(() => { const was = wGL.autoPow; wGL.autoPow = true; const ok = wGL.autoPow === true; wGL.autoPow = was; return ok; })()",
                   help=('wLinksHow', [r'Auto powers'])),
         ground=dict(have="wGL.woodRules", live="!!wGL.G.wood", help=('wLinksHow', [r'old wood', r'enchanted']))),

    dict(sport='bowling', engine='lanes', scope='wBL', key='lanes', home='the Saltmere Lanes: the hall and the tide',
         start="wLanesGame({ seed: 5, mode: 'watch' })",
         kinds="Object.keys(wBL.pow)",
         player="p => wLanesPlayer(p)",
         picks=dict(field='blPw', roles=['strike', 'spare'], every_kind=True,
                    opt="(k, r) => [wBL.pow[k], wBL.pow2[k]].map(a => a && a[r === 'strike' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.blPw = { strike: 1, spare: 1 }; }",
                    got="m => !!m.pw && m.pw.strike === 1 && m.pw.spare === 1",
                    help=('wHelpLanesTab', [r'pick'])),
         resource=dict(have="wBL.manaRules", live="wBL.G.mana.length === 2 && !!wBL.G.powers", help=('wLanesHow', [r'mana'])),
         meter=dict(have="wBL.roarRules", pays='ult', live="wBL.G.roar.length === 2", help=('wLanesHow', [r'roar'])),
         ultimate=dict(of="k => wBL.ult[k]", live="wBL.G.ultUsed.length === 2", help=('wLanesHow', [r'ultimate'])),
         situations=dict(have="wBL.sit", live="wBL.G.sitUsed.length === 2", help=('wLanesHow', [r'situation powers'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpLanesKit', [r'gear'])),
         potions=dict(table="wBL.potions", fn='potionWhy', live="wBL.G.bags.length === 2", help=('wHelpLanesKit', [r'potion'])),
         auto=dict(have="'autoPow' in wBL", live="(() => { const was = wBL.autoPow; wBL.autoPow = true; const ok = wBL.autoPow === true; wBL.autoPow = was; return ok; })()",
                   help=('wLanesHow', [r'Auto powers'])),
         ground=dict(have="wBL.hallRules", live="!!wBL.G.hall", help=('wLanesHow', [r'the hall', r'tide']))),

    dict(sport='curling', engine='shed', scope='wCR', key='shed', home='the Curling Shed: the frost and the sprites (Old Grey under the ice, deep games only)',
         start="wShedGame({ seed: 7, mode: 'watch', hammer: 1 })",
         kinds="Object.keys(wCR.pow)",
         player="p => wShedPlayer(p)",
         picks=dict(field='crPw', roles=['draw', 'hit'], every_kind=True,
                    opt="(k, r) => [wCR.pow[k], wCR.pow2[k]].map(a => a && a[r === 'draw' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.crPw = { draw: 1, hit: 1 }; }",
                    got="m => !!m.pw && m.pw.draw === 1 && m.pw.hit === 1",
                    help=('wHelpShedTab', [r'pick'])),
         resource=dict(have="wCR.manaRules", live="wCR.G.mana.length === 2 && !!wCR.G.powers", help=('wShedHow', [r'mana'])),
         meter=dict(have="wCR.roarRules", pays='ult', live="wCR.G.roar.length === 2", help=('wShedHow', [r'roar'])),
         ultimate=dict(of="k => wCR.ult[k]", live="wCR.G.ultUsed.length === 2", help=('wHelpShedPowers', [r'ultimate'])),
         situations=dict(have="wCR.sit", live="wCR.G.sitUsed.length === 2", help=('wShedHow', [r'situation powers'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpShedKit', [r'gear'])),
         potions=dict(table="wCR.potions", fn='potionWhy', live="wCR.G.bags.length === 2", help=('wHelpShedKit', [r'potion'])),
         auto=dict(have="'autoPow' in wCR", live="(() => { const was = wCR.autoPow; wCR.autoPow = true; const ok = wCR.autoPow === true; wCR.autoPow = was; return ok; })()",
                   help=('wShedHow', [r'Auto powers'])),
         ground=dict(have="wCR.hallRules", live="!!wCR.G.hall", help=('wShedHow', [r'frost', r'sprite']))),
]
# the parts whose state a Realm game must have on (the others are checked on the player or in the tables)
LIVE = ('resource', 'meter', 'ultimate', 'situations', 'potions', 'auto', 'ground')
MIN_KINDS = 18          # the league's kinds; the later sports add the six superstars
MIN_SITS = 3
MIN_GEAR = 3
MIN_POTIONS = 3

# non-empty: an array or object with something in it, a function, a finite number, a non-empty string, true
HELP = r"""
window.__ne = v => v == null ? false : Array.isArray(v) ? v.length > 0 : typeof v === 'function' ? true
  : typeof v === 'object' ? Object.keys(v).length > 0 : typeof v === 'number' ? isFinite(v) && v !== 0 : typeof v === 'string' ? v.length > 0 : !!v;
window.__peek = v => { try { return typeof v === 'function' ? 'function' : JSON.stringify(v).slice(0, 300); } catch (e) { return String(v).slice(0, 300); } };
window.__id = x => x && typeof x === 'object' ? (x.id || x.n) : x;
0"""

async def ev(pg, js):
    """evaluate js; (value, None) or (None, the error)"""
    try: return await pg.evaluate(js), None
    except Exception as e: return None, str(e).split('\n')[0][:300]

async def have(pg, label, expr):
    r, err = await ev(pg, f"(() => {{ const v = ({expr}); return {{ ok: __ne(v), peek: __peek(v) }}; }})()")
    return check(err is None and r['ok'], f'{label} is there and not empty ({expr})', err or r['peek'])

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the table itself: a row for every engine, every part in every row ----------
        engines = await pg.evaluate("Object.fromEntries(Object.entries(W_ENGINES).map(([k, e]) => [k, e.sport]))")
        rows = {r['engine']: r for r in SPORTS}
        for k, sport in engines.items():
            check(k in rows, f'{sport} ({k}) is in W_ENGINES, so it has a row in SPORTS naming where each part of the shared set lives')
        for r in SPORTS:
            check(r['engine'] in engines, f"{r['sport']}: its row's engine '{r['engine']}' is in W_ENGINES")
            gaps = []
            for part in PARTS:
                d = r.get(part)
                if not isinstance(d, dict): gaps.append(f'{part}: not in the row'); continue
                if not (isinstance(d.get('help'), tuple) and len(d['help']) == 2 and d['help'][1]): gaps.append(f'{part}: no How to play text named')
                if part in LIVE and not d.get('live'): gaps.append(f'{part}: no live check (how a Realm game shows it on)')
            if gaps:
                for g in gaps: check(False, f"{r['sport']}: the row is missing a part of the shared set: {g}")
            else: check(True, f"{r['sport']}: the row names every part of the shared set ({', '.join(PARTS)}) and its How to play")
            ok, err = await ev(pg, f"W_ENGINES['{r['engine']}'] && W_ENGINES['{r['engine']}'].api === {r['scope']}")
            check(ok is True, f"{r['sport']}: {r['scope']} is the engine W_ENGINES plays", err)

        # ---------- the tables: each part exists and isn't empty ----------
        for r in [r for r in SPORTS if all(isinstance(r.get(k), dict) for k in PARTS)]:
            s, sc = r['sport'], r['scope']
            kinds, err = await ev(pg, r['kinds'])
            check(err is None and isinstance(kinds, list) and len(kinds) >= MIN_KINDS, f'{s}: the engine knows the league\'s kinds ({MIN_KINDS} or more)', err or kinds)
            kinds = kinds if isinstance(kinds, list) else []

            # picks: per role, a pair a kind
            pk = r['picks']
            res, err = await ev(pg, f"""(() => {{ const opt = {pk['opt']}, out = {{}};
              for (const role of {json.dumps(pk['roles'])}) {{ const c = {{ two: [], one: [], none: [] }};
                for (const k of {json.dumps(kinds)}) {{ const L = opt(k, role) || []; const n = new Set(L.map(__id)).size; (n >= 2 ? c.two : n === 1 ? c.one : c.none).push(k); }}
                out[role] = c; }}
              return out; }})()""")
            if check(err is None, f'{s}: picks: the options for each role can be read', err):
                for role, c in res.items():
                    if pk['every_kind']:
                        check(not c['one'] and not c['none'], f'{s}: picks: every kind has two {role} powers to pick between', {'one': c['one'], 'none': c['none']})
                    else:
                        check(len(c['two']) >= 1 and not c['one'], f'{s}: picks: in {role}, a kind has a pair to pick between or keeps what it has (never half a pair)', {'two': len(c['two']), 'one': c['one']})

            await have(pg, f'{s}: resource', r['resource']['have'])
            mr, err = await ev(pg, f"(() => {{ const m = {r['meter']['have']}; return m && m[{json.dumps(r['meter']['pays'])}]; }})()")
            check(err is None and isinstance(mr, (int, float)) and mr > 0, f"{s}: meter: its rules say what it buys ({r['meter']['pays']})", err or mr)

            # one ultimate a kind
            res, err = await ev(pg, f"(() => {{ const of = {r['ultimate']['of']}; return {json.dumps(kinds)}.filter(k => {{ try {{ const u = of(k); return !(u && (u.n || u.name)); }} catch (e) {{ return true; }} }}); }})()")
            check(err is None and res == [], f'{s}: ultimate: every kind has one, with a name', err or res)

            # situation powers: at least three, each named and described
            res, err = await ev(pg, f"(() => {{ const t = {r['situations']['have']}; return {{ n: Object.keys(t || {{}}).length, bad: Object.entries(t || {{}}).filter(([k, v]) => !(v && v.n && v.desc)).map(([k]) => k) }}; }})()")
            check(err is None and res['n'] >= MIN_SITS and not res['bad'], f'{s}: situations: {MIN_SITS} or more, each named and described ({r["situations"]["have"]})', err or res)

            # gear: W_GEAR pieces for the sport key, each named, described, with effects, and an item
            res, err = await ev(pg, f"""(() => {{ const ids = Object.keys(W_GEAR).filter(id => W_GEAR[id].sport === {json.dumps(r['key'])});
              return {{ ids, bad: ids.filter(id => {{ const g = W_GEAR[id]; return !(g.name && g.desc && __ne(g.fx) && DB.items[id]); }}) }}; }})()""")
            check(err is None and len(res['ids']) >= MIN_GEAR and not res['bad'], f"{s}: gear: {MIN_GEAR} or more pieces in W_GEAR for '{r['key']}', each named, described, with effects and an item", err or res)

            # potions: W_POTIONS for the sport, each in the engine's table and an item; the engine's table and bag function
            pt = r['potions']
            res, err = await ev(pg, f"""(() => {{ const T = {pt['table']} || {{}}, ids = Object.keys(W_POTIONS).filter(id => wPotionSports(id).includes({json.dumps(r['key'])}));
              return {{ ids, notInEngine: ids.filter(id => !T[id]), notItem: ids.filter(id => !DB.items[id]), engine: Object.keys(T).length, fn: typeof {sc}[{json.dumps(pt['fn'])}] }}; }})()""")
            check(err is None and len(res['ids']) >= MIN_POTIONS and not res['notInEngine'] and not res['notItem'] and res['fn'] == 'function',
                  f"{s}: potions: {MIN_POTIONS} or more in W_POTIONS for '{r['key']}', each in the engine's table ({pt['table']}) and an item, and {sc}.{pt['fn']} for the bag", err or res)

            await have(pg, f'{s}: auto', r['auto']['have'])
            await have(pg, f'{s}: ground ({r["home"]})', r['ground']['have'])

        # ---------- a journey: the player brings the pick and the gear; a Realm game has the set on ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon', 'troll', 'witch', 'golem', 'harpy']) if (wRoster().length < 9) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        check(await pg.evaluate("wRoster().length") >= 9, 'a journey with nine players of your own')

        for r in [r for r in SPORTS if all(isinstance(r.get(k), dict) for k in PARTS)]:
            s, sc, pk = r['sport'], r['scope'], r['picks']
            res, err = await ev(pg, f"""(() => {{ const p = wRoster()[0], keep = JSON.stringify({{ pick: p[{json.dumps(pk['field'])}], gear: p.gear }});
              const gid = Object.keys(W_GEAR).find(id => W_GEAR[id].sport === {json.dumps(r['key'])}), player = {r['player']};
              try {{
                const before = player(p); ({pk['set']})(p); p.gear = Object.assign({{}}, p.gear, {{ [{json.dumps(r['key'])}]: gid }});
                const m = player(p); return {{ picked: !!({pk['got']})(m), plain: !({pk['got']})(before), worn: !!({r['gear']['got']})(m, gid), field: {json.dumps(pk['field'])} in p }};
              }} finally {{ const k = JSON.parse(keep); if (k.pick === undefined) delete p[{json.dumps(pk['field'])}]; else p[{json.dumps(pk['field'])}] = k.pick; if (k.gear === undefined) delete p.gear; else p.gear = k.gear; }} }})()""")
            if check(err is None, f'{s}: a roster player goes into the engine', err):
                check(res['field'] and res['picked'] and res['plain'], f"{s}: picks: kept on the player as p.{pk['field']}, and the engine's player brings the pick", res)
                check(res['worn'], f"{s}: gear: a piece worn as p.gear.{r['key']} reaches the engine through the player", res)

            # a game started through the Realm, as at the ground
            res, err = await ev(pg, f"(() => {{ const why = {r['start']}; return {{ why: typeof why === 'string' ? why : '', view: UI.view, G: !!{sc}.G }}; }})()")
            if not check(err is None and res['G'] and not res['why'] and res['view'] == r['engine'], f"{s}: a game starts through the Realm ({r['start']})", err or res): continue
            for part in LIVE:
                ok, err = await ev(pg, f"!!({r[part]['live']})")
                check(ok is True, f"{s}: {part}: on in a game the Realm plays ({r[part]['live']})", err)
            await ev(pg, f"(() => {{ try {{ {sc}.pause(true); }} catch (e) {{ }} }})()")

        # ---------- How to play: every part, in each sport's own words ----------
        await pg.evaluate("renderHelp()")
        for r in SPORTS:
            for part in PARTS:
                d = r.get(part)
                if not isinstance(d, dict) or not isinstance(d.get('help'), tuple): continue
                hid, words = d['help']
                txt, err = await ev(pg, f"(() => {{ const e = document.getElementById({json.dumps(hid)}); return e ? e.textContent : null; }})()")
                miss = [w for w in words if not txt or not re.search(w, txt, re.I)]
                check(err is None and txt and not miss, f"{r['sport']}: {part}: How to play explains it (#{hid}: {', '.join(words)})", err or {'there': bool(txt), 'missing': miss})

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print(f'\n{len(FAILS)} failed' if FAILS else '\nall passed')
    if FAILS:
        for f in FAILS: print('  -', f)
        sys.exit(1)

asyncio.run(main())
