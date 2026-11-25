# Realm (issue #115, phase 5): one league of powers. Every engine sport has the shared set: a pick of powers per role,
# kept on the player and brought into the game; a team resource; a crowd meter; one ultimate a kind; situation powers;
# gear (W_GEAR pieces for the sport, worn as p.gear.<key>, reaching the engine through the player); potions (W_POTIONS
# for the sport, each in the engine's own table); Auto powers; the ground's own ways; and How to play for each.
# The table SPORTS below has one row per engine sport, naming where each part lives. Every engine in W_ENGINES must
# have a row, and every row must name every part in PARTS, so a ninth sport can't ship without them: add its row.
# Each part is checked as it is (the table or function exists and isn't empty) and as it behaves: a player's pick and
# gear go into the engine's player, and a club game started through the Realm (Manage, as at the ground) has each part
# on by the engine's own switch for it, not just its arrays: powers on for both sides (or the sport's own switch for
# the meter and the situations), the other club's bag the Realm's for its tier and yours the Realm's, Auto powers on in
# the game (curling's once its button is pressed) and the ground's ways. Where the game can be played on cheaply, it is:
# your side casts under Auto powers (the engine reads the flag) and the meter fills. Failures name the sport and the
# part. Asserts; exits nonzero on failure.
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
# A row may have play: adv (moves the game on a step), over (the game is done), until ({ part: (what, expr) }: played
# on until expr holds, a budget of steps at most), for the parts that are cheap to see working.
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
         ultimate=dict(of="k => wBD.names().ult[wBD.rate(k).ult]", live="wBD.bdp.on.every(Boolean) && wBD.G.teams.every(t => t.def.roster.some(p => p.ult))",
                       help=('wHelpBallPow', [r'ultimate'])),
         situations=dict(have="wBD.sit", live="wBD.bdp.sitOn === true && wBD.bdp.used.length === 2",
                         help=('wHelpBallPow', [r'situation'])),
         gear=dict(got="(m, id) => m.gid === id", help=('wHelpBallKit', [r'gear'])),
         potions=dict(table="wBD.potions", fn='potionWhy', live="!!wBD.kit && __bags(wBD.kit.bags, wBallBagTheirs(wBallTier('local')), null)",
                      help=('wHelpBallKit', [r'potion'])),
         auto=dict(have="W_BALL_HOW.manage", live="wBD.G.rules.auto === true && wBD.bdp.on[0] === true", help=('wHelpBallPow', [r'Auto powers'])),
         ground=dict(have="wBD.ground", live="!!wBD.gd && wBD.gd.grassOn === true",
                     help=('wHelpBallGround', [r'mound', r'floodlight']))),

    dict(sport='football', engine='gridiron', scope='wGF', key='grid', home='the Ash Bowl: ashfall, the heat shimmer',
         start="wStartGrid({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wGF.powerBook)",
         player="p => wSevenPlayer(p)",
         picks=dict(field='gfPw', roles=['off', 'def'], every_kind=True,
                    opt="(k, r) => [wGF.powerBook[k][r], wGF.powerBook[k][r + '2']].filter(Boolean)",
                    set="p => { p.gfPw = { off: 1, def: 1 }; }",
                    got="m => !!m.pw && m.pw.off === 1 && m.pw.def === 1",
                    help=('wHelpGfPow2', [r'pick'])),
         resource=dict(have="wGF.mana", live="Array.isArray(wGF.G.mana) && wGF.G.mana.length === 2", help=('wHelpGfPowers', [r'mana'])),
         # (the roar lifts a cast: it has its own switch, G.roar.on, and nothing to lift without the powers)
         meter=dict(have="wGF.roarRules", pays='amp', live="!!wGF.G.mana && !!wGF.G.roar && wGF.G.roar.on.every(Boolean) && wGF.G.roar.v.length === 2",
                    help=('wHelpGfRoar', [r'roar'])),
         # (the ultimates and the situation powers are on with the powers: G.mana is there only then, 14-powers.js)
         ultimate=dict(of="k => wGF.powerBook[k].ult", live="!!wGF.G.mana && Array.isArray(wGF.G.ultUsed) && wGF.G.ultUsed.length === 2 && wGF.G.ultUsed.every(u => !Object.keys(u).length)", help=('wHelpGfPowers', [r'ultimate'])),
         situations=dict(have="wGF.situations", live="!!wGF.G.mana && Array.isArray(wGF.G.sitUsed) && wGF.G.sitUsed.length === 2", help=('wHelpGfPow2', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpGridKit', [r'gear'])),
         potions=dict(table="wGF.potions", fn='potionWhy', live="__bags(wGF.G.bags, wGridBagTheirs(wBallTier('local')), null)", help=('wHelpGridKit', [r'potion'])),
         # (Manage is the engine's 'call': Auto powers is on in it, GD.auto, read through powers(), not set)
         auto=dict(have="wGF.setAuto", live="(() => { const P = wGF.powers(); return !!P && P.auto === true; })()",
                   help=('wHelpGfPowers', [r'Auto powers'])),
         ground=dict(have="wGF.ashRules", live="!!wGF.G.ash", help=('wHelpGfAsh', [r'ash', r'heat']))),

    dict(sport='boxing', engine='ring', scope='wBX', key='ring', home='the Anvil Ring: the forge corner, the slack ropes',
         # (a card from the world goes through the pairing: its Manage button starts it)
         start="(() => { const why = wStartRing({ club: 'local', how: 'manage' }); if (why) return why; const b = document.querySelector('[data-rgo=\"manage\"]'); if (!b) return 'no pairing to start from'; b.click(); return ''; })()",
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
         meter=dict(have="wBX.spirit", pays='ult', live="wBX.G.powers === true && wBX.G.F.every(f => typeof f.spirit === 'number')", help=('wHelpRingSpirit', [r'spirit'])),
         ultimate=dict(of="k => wBX.powerBook[k].ult", live="wBX.G.powers === true && [0, 1].every(s => { const P = wBX.powers(s); return !!P && !!P.ult && P.ult.used === false; })", help=('wHelpRingSpirit', [r'ultimate'])),
         # (their own switch, G.bxp, and the powers: 15-more.js casts none without both)
         situations=dict(have="wBX.sits", live="wBX.G.powers === true && !!wBX.G.bxp && wBX.G.bxp.sit === true && wBX.G.bxp.on.every(Boolean) && wBX.G.bxp.used.length === 2",
                         help=('wHelpRingMore', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpRingKit', [r'gear'])),
         potions=dict(table="wBX.potions", fn='potionOk', live="__bags(wBX.G.bags, wRingBagTheirs(wBallTier('local')), wRingBagMine())", help=('wHelpRingKit', [r'potion'])),
         # boxing's Auto powers is You corner (Manage): your fighter casts as the CPU would
         auto=dict(have="W_RING_MODES.call", live="wBX.mode === 'call' && wBX.G.powers === true",
                   help=('wRingHow', [r'You corner'])),
         ground=dict(have="wBX.anvilRules", live="!!wBX.G.anvil", help=('wHelpRingAnvil', [r'forge', r'rope'])),
         # (the whole card if need be: a bout can end early, so the next is boxed; a cast of yours is kept in __bxCast)
         play=dict(adv="(() => { if (wBX.phase === 'over' && wBX.G.card && wBX.G.card.i < wBX.G.card.n - 1) wBX.cardNext(); if (wBX.wait) wBX.call(wBX.wait.plan); for (let i = 0; i < 30 && wBX.phase !== 'over'; i++) { wBX.step(); const f = wBX.G.F[wBX.you]; if (f.spUsed > 0 || f.ultUsed === true) window.__bxCast = true; } })()",
                   over="wBX.phase === 'over' && !(wBX.G.card && wBX.G.card.i < wBX.G.card.n - 1)",
                   until={'auto': ('your fighter casts a special or the ultimate as the card goes on', "window.__bxCast === true"),
                          'meter': ('spirit rises past where it starts as the bout goes on', "wBX.G.F.some(f => f.spirit > wBX.spirit.start)")})),

    dict(sport='basketball', engine='court', scope='wBK', key='court', home='the Charter Court: the waxed boards, the bent rim',
         start="wStartCourt({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wBK.powerBook)",
         player="p => wCourtPlayer(p)",
         picks=dict(field='bkPw', roles=['off', 'def'], every_kind=True,
                    opt="(k, r) => [wBK.powerBook[k][r], wBK.powerBook[k][r + '2']].filter(Boolean)",
                    set="p => { p.bkPw = { off: 1, def: 1 }; }",
                    got="m => !!m.pw && m.pw.off === 1 && m.pw.def === 1",
                    help=('wHelpCourtPow', [r'pick'])),
         resource=dict(have="wBK.powerRules.mana", live="wBK.G.mana.length === 2 && !!wBK.G.powers", help=('wHelpCourtPow', [r'mana'])),
         meter=dict(have="wBK.powerRules.spirit", pays='ult', live="wBK.G.powers === true && wBK.G.spirit.length === 2", help=('wCourtPowHow', [r'spirit'])),
         ultimate=dict(of="k => wBK.powerBook[k].ult", live="wBK.G.powers === true && wBK.G.ultUsed.length === 2 && wBK.G.ultUsed.every(u => u === false)", help=('wCourtPowHow', [r'ultimate'])),
         situations=dict(have="wBK.sits", live="wBK.G.powers === true && wBK.G.sitUsed.length === 2", help=('wCourtPowHow', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpCourtKit', [r'gear'])),
         potions=dict(table="wBK.potions", fn='potionWhy', live="__bags(wBK.G.bags, wCourtBagTheirs(wBallTier('local')), null)", help=('wHelpCourtKit', [r'potion'])),
         auto=dict(have="'auto' in wBK", live="wBK.mode === 'manage' && wBK.auto === true && wBK.G.powers === true",
                   help=('wCourtPowHow', [r'Auto powers'])),
         ground=dict(have="wBK.courtRules", live="!!wBK.G.court", help=('wHelpCourtGame', [r'waxed', r'rim'])),
         play=dict(adv="wBK.step(30)", over="wBK.phase === 'over'",
                   until={'auto': ('your side casts as the game goes on', "!!(wBK.G.cur && wBK.G.cur.cast.some(c => c.side === wBK.you))"),
                          'meter': ('spirit fills as the game goes on', "wBK.G.spirit.some(v => v > 0)")})),

    dict(sport='hockey', engine='rink', scope='wHK', key='rink', home='the Pond Rink: the pond ice, the old boards',
         start="wStartRink({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wHK.pows)",
         player="p => wRinkPlayer(p)",
         picks=dict(field='hkPw', roles=['puck', 'chk'], every_kind=True,
                    opt="(k, r) => [wHK.pows[k].one, wHK.pows[k].two].map(a => a && a[r === 'puck' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.hkPw = { puck: 1, chk: 1 }; }",
                    got="m => !!m.pw && m.pw.puck === 1 && m.pw.chk === 1",
                    help=('wHelpRinkTab', [r'pick'])),
         resource=dict(have="wHK.powRules.mana", live="wHK.G.mana.length === 2 && wHK.powersOn === true", help=('wRinkHowPow', [r'mana'])),
         meter=dict(have="wHK.powRules.spirit", pays='ult', live="wHK.powersOn === true && wHK.G.powOn.every(Boolean) && wHK.G.spirit.length === 2", help=('wRinkHowPow', [r'roar'])),
         ultimate=dict(of="k => wHK.pows[k].ult", live="wHK.powersOn === true && wHK.G.powOn.every(Boolean) && wHK.G.ultUsed.every(u => u === false)", help=('wRinkHowPow', [r'ultimate'])),
         situations=dict(have="wHK.sits", live="wHK.powersOn === true && wHK.G.powOn.every(Boolean) && wHK.G.sitUsed.length === 2", help=('wRinkHowPow', [r'situation'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpRinkKit', [r'gear'])),
         potions=dict(table="wHK.potions", fn='potionWhy', live="__bags(wHK.G.bags, wRinkBagTheirs(wBallTier('local')), null)", help=('wHelpRinkKit', [r'potion'])),
         # on unless you turn it off
         auto=dict(have="'autoPow' in wHK", live="wHK.mode === 'manage' && wHK.autoPow === true && wHK.G.powOn[wHK.you] === true", help=('wRinkHowPow', [r'Auto powers'])),
         ground=dict(have="wHK.pondRules", live="!!wHK.G.pond", help=('wHelpRinkGame', [r'snow', r'boards'])),
         play=dict(adv="wHK.step(30)", over="wHK.phase === 'over'",
                   until={'auto': ('your side casts as the game goes on', "wHK.G.casts.some(c => c.side === wHK.you)"),
                          'meter': ('the bank\'s roar fills as the game goes on', "wHK.G.spirit.some(v => v > 0)")})),

    dict(sport='golf', engine='links', scope='wGL', key='links', home='Mossgate Links: the wood, the enchanted course',
         start="wStartLinks({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wGL.pow)",
         player="p => wLinksPlayer(p)",
         picks=dict(field='glPw', roles=['long', 'short'], every_kind=True,
                    opt="(k, r) => [wGL.pow[k], wGL.pow2[k]].map(a => a && a[r === 'long' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.glPw = { long: 1, short: 1 }; }",
                    got="m => !!m.pw && m.pw.long === 1 && m.pw.short === 1",
                    help=('wHelpLinksTab', [r'pick'])),
         resource=dict(have="wGL.manaRules", live="wGL.G.mana.length === 2 && !!wGL.G.powers", help=('wLinksHow', [r'mana'])),
         meter=dict(have="wGL.roarRules", pays='ult', live="wGL.G.powers === true && wGL.G.powSides.every(Boolean) && wGL.G.roar.length === 2", help=('wLinksHow', [r'roar'])),
         ultimate=dict(of="k => wGL.ult[k]", live="wGL.G.powers === true && wGL.G.powSides.every(Boolean) && wGL.G.ultUsed.every(u => u === false)", help=('wLinksHow', [r'ultimate'])),
         situations=dict(have="wGL.sit", live="wGL.G.powers === true && wGL.G.powSides.every(Boolean) && wGL.G.sitUsed.length === 2", help=('wLinksHow', [r'situation powers'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpLinksKit', [r'gear'])),
         potions=dict(table="wGL.potions", fn='potionWhy', live="__bags(wGL.G.bags, wLinksBagTheirs(wBallTier('local')), null)", help=('wHelpLinksKit', [r'potion'])),
         auto=dict(have="'autoPow' in wGL", live="wGL.mode === 'manage' && wGL.autoPow === true && wGL.G.powSides[wGL.you] === true",
                   help=('wLinksHow', [r'Auto powers'])),
         ground=dict(have="wGL.woodRules", live="!!wGL.G.wood", help=('wLinksHow', [r'old wood', r'enchanted'])),
         # (a full purse to start, so Auto powers' first cast comes well before nine holes are out: it isn't a race)
         play=dict(adv="wGL.tick(0.05)", over="wGL.phase === 'over'", prep="wGL.G.mana[wGL.you] = wGL.manaRules.max",
                   until={'auto': ('your side casts as the match goes on', "wGL.G.casts.some(c => c.side === wGL.you)"),
                          'meter': ('the roar fills as the match goes on', "wGL.G.roar.some(v => v > 0)")})),

    dict(sport='bowling', engine='lanes', scope='wBL', key='lanes', home='the Saltmere Lanes: the hall and the tide',
         start="wStartLanes({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wBL.pow)",
         player="p => wLanesPlayer(p)",
         picks=dict(field='blPw', roles=['strike', 'spare'], every_kind=True,
                    opt="(k, r) => [wBL.pow[k], wBL.pow2[k]].map(a => a && a[r === 'strike' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.blPw = { strike: 1, spare: 1 }; }",
                    got="m => !!m.pw && m.pw.strike === 1 && m.pw.spare === 1",
                    help=('wHelpLanesTab', [r'pick'])),
         resource=dict(have="wBL.manaRules", live="wBL.G.mana.length === 2 && !!wBL.G.powers", help=('wLanesHow', [r'mana'])),
         meter=dict(have="wBL.roarRules", pays='ult', live="wBL.G.powers === true && wBL.G.powSides.every(Boolean) && wBL.G.roar.length === 2", help=('wLanesHow', [r'roar'])),
         ultimate=dict(of="k => wBL.ult[k]", live="wBL.G.powers === true && wBL.G.powSides.every(Boolean) && wBL.G.ultUsed.every(u => u === false)", help=('wLanesHow', [r'ultimate'])),
         situations=dict(have="wBL.sit", live="wBL.G.powers === true && wBL.G.powSides.every(Boolean) && wBL.G.sitUsed.length === 2", help=('wLanesHow', [r'situation powers'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpLanesKit', [r'gear'])),
         potions=dict(table="wBL.potions", fn='potionWhy', live="__bags(wBL.G.bags, Object.assign({}, W_LANES_KIT.opp[wBallTier('local')] || {}), null)", help=('wHelpLanesKit', [r'potion'])),
         auto=dict(have="'autoPow' in wBL", live="wBL.mode === 'manage' && wBL.autoPow === true && wBL.G.powSides[0] === true",
                   help=('wLanesHow', [r'Auto powers'])),
         ground=dict(have="wBL.hallRules", live="!!wBL.G.hall", help=('wLanesHow', [r'the hall', r'tide'])),
         play=dict(adv="wBL.tick(0.05)", over="wBL.phase === 'over'",
                   until={'auto': ('your side casts as the match goes on', "wBL.G.casts.some(c => c.side === 0)"),
                          'meter': ('the roar fills as the match goes on', "wBL.G.roar.some(v => v > 0)")})),

    dict(sport='curling', engine='shed', scope='wCR', key='shed', home='the Curling Shed: the frost and the sprites (Old Grey under the ice, deep games only)',
         start="wStartShed({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wCR.pow)",
         player="p => wShedPlayer(p)",
         picks=dict(field='crPw', roles=['draw', 'hit'], every_kind=True,
                    opt="(k, r) => [wCR.pow[k], wCR.pow2[k]].map(a => a && a[r === 'draw' ? 0 : 1]).filter(Boolean)",
                    set="p => { p.crPw = { draw: 1, hit: 1 }; }",
                    got="m => !!m.pw && m.pw.draw === 1 && m.pw.hit === 1",
                    help=('wHelpShedTab', [r'pick'])),
         resource=dict(have="wCR.manaRules", live="wCR.G.mana.length === 2 && !!wCR.G.powers", help=('wShedHow', [r'mana'])),
         meter=dict(have="wCR.roarRules", pays='ult', live="wCR.G.powers === true && wCR.G.powSides.every(Boolean) && wCR.G.roar.length === 2", help=('wShedHow', [r'roar'])),
         ultimate=dict(of="k => wCR.ult[k]", live="wCR.G.powers === true && wCR.G.powSides.every(Boolean) && wCR.G.ultUsed.every(u => u === false)", help=('wHelpShedPowers', [r'ultimate'])),
         situations=dict(have="wCR.sit", live="wCR.G.powers === true && wCR.G.powSides.every(Boolean) && wCR.G.sitUsed.length === 2", help=('wShedHow', [r'situation powers'])),
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpShedKit', [r'gear'])),
         potions=dict(table="wCR.potions", fn='potionWhy', live="__bags(wCR.G.bags, Object.assign({}, W_SHED_KIT.opp[wBallTier('local')] || {}), null)", help=('wHelpShedKit', [r'potion'])),
         # (curling's Auto powers is off until you press its button in Manage: pressed here, through the page)
         auto=dict(have="'autoPow' in wCR", live="(() => { const b = document.querySelector('[data-crauto]'); if (!b || wCR.mode !== 'manage') return false; if (!wCR.autoPow) b.click(); return wCR.autoPow === true && wCR.G.powSides[0] === true; })()",
                   help=('wShedHow', [r'Auto powers'])),
         ground=dict(have="wCR.hallRules", live="!!wCR.G.hall", help=('wShedHow', [r'frost', r'sprite'])),
         play=dict(adv="wCR.tick(0.05)", over="wCR.phase === 'over'",
                   until={'auto': ('your side casts as the match goes on', "wCR.G.casts.some(c => c.side === 0)"),
                          'meter': ('the roar fills as the match goes on', "wCR.G.roar.some(v => v > 0)")})),

    # jousting (issue #117): the parts come phase by phase (powers 6, gear and potions 7, the ground 8); until every
    # one is named here and built, this row fails, naming what is missing. Never weaken the check to pass it.
    dict(sport='jousting', engine='lists', scope='wJT', key='lists', home='the Tilting Lists: the churned sand, the pennant wind',
         # (phase 5: a club game through the Realm, the league's kinds and a player as the engine takes one)
         start="wStartLists({ club: 'local', how: 'manage' })",
         kinds="Object.keys(wJT.kinds).filter(k => k !== '_')",
         player="p => wListsPlayer(p)",
         # (phase 6) a lance power and a shield power a rider, one of two each, kept as p.jtPw
         picks=dict(field='jtPw', roles=['lance', 'shield'], every_kind=True,
                    opt="(k, r) => [0, 1].map(alt => wJT.powOf(k, r, alt))",
                    set="p => { p.jtPw = { lance: 1, shield: 1 }; }",
                    got="m => !!m.pw && m.pw.lance === 1 && m.pw.shield === 1",
                    help=('wHelpListsPowers', [r'pick'])),
         resource=dict(have="wJT.manaRules", live="wJT.G.powers === true && wJT.G.powSides.every(Boolean) && wJT.G.mana.length === 2", help=('wListsHowPow', [r'mana'])),
         meter=dict(have="wJT.cheerRules", pays='ult', live="wJT.G.powers === true && wJT.G.powSides.every(Boolean) && wJT.G.cheer.length === 2", help=('wListsHowPow', [r'cheer'])),
         ultimate=dict(of="k => wJT.ult[k]", live="wJT.G.powers === true && wJT.G.powSides.every(Boolean) && wJT.G.ultUsed.every(u => u === false)", help=('wListsHowPow', [r'ultimate'])),
         situations=dict(have="wJT.sit", live="wJT.G.powers === true && wJT.G.powSides.every(Boolean) && wJT.G.sitUsed.length === 2", help=('wListsHowPow', [r'situation powers'])),
         # (off until you press its button in Manage, as curling's: pressed here, through the page)
         auto=dict(have="'autoPow' in wJT", live="(() => { const b = document.querySelector('[data-jtauto]'); if (!b || wJT.mode !== 'manage') return false; if (!wJT.autoPow) b.click(); return wJT.autoPow === true && wJT.G.powSides[0] === true; })()",
                   help=('wListsHowPow', [r'Auto powers'])),
         # (phase 7) a rider's piece reaches the engine's copy of the rider; their bag by tier, yours the page's
         gear=dict(got="(m, id) => !!m.gear && m.gear.id === id", help=('wHelpListsKit', [r'gear'])),
         potions=dict(table="wJT.potions", fn='potionWhy', live="__bags(wJT.G.bags, Object.assign({}, W_LISTS_KIT.opp[wBallTier('local')] || {}), null)", help=('wHelpListsKit', [r'potion'])),
         # (Manage waits at your plan beat for your calls: Send them, and on)
         play=dict(adv="(() => { if (wJT.phase === 'plan') wJT.press(); wJT.tick(0.05); })()", over="wJT.phase === 'over'",
                   until={'auto': ('your side casts as the match goes on', "wJT.G.casts.some(c => c.side === 0)"),
                          'meter': ('the cheer fills as the match goes on', "wJT.G.cheer.some(v => v > 0)")})),
]
# the parts whose state a Realm game must have on (the others are checked on the player or in the tables)
LIVE = ('resource', 'meter', 'ultimate', 'situations', 'potions', 'auto', 'ground')
MIN_KINDS = 18          # the league's kinds; the later sports add the six superstars
MIN_SITS = 3
MIN_GEAR = 3
MIN_POTIONS = 3
PLAY_STEPS = 20000      # the most steps a game is played on to see a part work

# non-empty: an array or object with something in it, a function, a finite number, a non-empty string, true
HELP = r"""
window.__ne = v => v == null ? false : Array.isArray(v) ? v.length > 0 : typeof v === 'function' ? true
  : typeof v === 'object' ? Object.keys(v).length > 0 : typeof v === 'number' ? isFinite(v) && v !== 0 : typeof v === 'string' ? v.length > 0 : !!v;
window.__peek = v => { try { return typeof v === 'function' ? 'function' : JSON.stringify(v).slice(0, 300); } catch (e) { return String(v).slice(0, 300); } };
window.__id = x => x && typeof x === 'object' ? (x.id || x.n) : x;
// a game's bags as the Realm sends them: yours as the Realm passed it (null: the page keeps it), theirs the Realm's for
// the club's tier, with something in it
window.__bags = (b, theirs, mine) => Array.isArray(b) && b.length === 2 && JSON.stringify(b[0]) === JSON.stringify(mine) && __ne(b[1]) && JSON.stringify(b[1]) === JSON.stringify(theirs);
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
        # (a row still missing parts has those named as failures above; the parts it has are checked here all the same)
        for r in SPORTS:
            s, sc = r['sport'], r['scope']
            kinds, err = await ev(pg, r['kinds'])
            check(err is None and isinstance(kinds, list) and len(kinds) >= MIN_KINDS, f'{s}: the engine knows the league\'s kinds ({MIN_KINDS} or more)', err or kinds)
            kinds = kinds if isinstance(kinds, list) else []

            # picks: per role, a pair a kind
            pk = r.get('picks')
            if pk: res, err = await ev(pg, f"""(() => {{ const opt = {pk['opt']}, out = {{}};
              for (const role of {json.dumps(pk['roles'])}) {{ const c = {{ two: [], one: [], none: [] }};
                for (const k of {json.dumps(kinds)}) {{ const L = opt(k, role) || []; const n = new Set(L.map(__id)).size; (n >= 2 ? c.two : n === 1 ? c.one : c.none).push(k); }}
                out[role] = c; }}
              return out; }})()""")
            if pk and check(err is None, f'{s}: picks: the options for each role can be read', err):
                for role, c in res.items():
                    if pk['every_kind']:
                        check(not c['one'] and not c['none'], f'{s}: picks: every kind has two {role} powers to pick between', {'one': c['one'], 'none': c['none']})
                    else:
                        check(len(c['two']) >= 1 and not c['one'], f'{s}: picks: in {role}, a kind has a pair to pick between or keeps what it has (never half a pair)', {'two': len(c['two']), 'one': c['one']})

            if 'resource' in r: await have(pg, f'{s}: resource', r['resource']['have'])
            if 'meter' in r:
                mr, err = await ev(pg, f"(() => {{ const m = {r['meter']['have']}; return m && m[{json.dumps(r['meter']['pays'])}]; }})()")
                check(err is None and isinstance(mr, (int, float)) and mr > 0, f"{s}: meter: its rules say what it buys ({r['meter']['pays']})", err or mr)

            # one ultimate a kind
            if 'ultimate' in r:
                res, err = await ev(pg, f"(() => {{ const of = {r['ultimate']['of']}; return {json.dumps(kinds)}.filter(k => {{ try {{ const u = of(k); return !(u && (u.n || u.name)); }} catch (e) {{ return true; }} }}); }})()")
                check(err is None and res == [], f'{s}: ultimate: every kind has one, with a name', err or res)

            # situation powers: at least three, each named and described
            if 'situations' in r:
                res, err = await ev(pg, f"(() => {{ const t = {r['situations']['have']}; return {{ n: Object.keys(t || {{}}).length, bad: Object.entries(t || {{}}).filter(([k, v]) => !(v && v.n && v.desc)).map(([k]) => k) }}; }})()")
                check(err is None and res['n'] >= MIN_SITS and not res['bad'], f'{s}: situations: {MIN_SITS} or more, each named and described ({r["situations"]["have"]})', err or res)

            # gear: W_GEAR pieces for the sport key, each named, described, with effects, and an item
            if 'gear' in r:
                res, err = await ev(pg, f"""(() => {{ const ids = Object.keys(W_GEAR).filter(id => W_GEAR[id].sport === {json.dumps(r['key'])});
                  return {{ ids, bad: ids.filter(id => {{ const g = W_GEAR[id]; return !(g.name && g.desc && __ne(g.fx) && DB.items[id]); }}) }}; }})()""")
                check(err is None and len(res['ids']) >= MIN_GEAR and not res['bad'], f"{s}: gear: {MIN_GEAR} or more pieces in W_GEAR for '{r['key']}', each named, described, with effects and an item", err or res)

            # potions: W_POTIONS for the sport, each in the engine's table and an item; the engine's table and bag function
            if 'potions' in r:
                pt = r['potions']
                res, err = await ev(pg, f"""(() => {{ const T = {pt['table']} || {{}}, ids = Object.keys(W_POTIONS).filter(id => wPotionSports(id).includes({json.dumps(r['key'])}));
                  return {{ ids, notInEngine: ids.filter(id => !T[id]), notItem: ids.filter(id => !DB.items[id]), engine: Object.keys(T).length, fn: typeof {sc}[{json.dumps(pt['fn'])}] }}; }})()""")
                check(err is None and len(res['ids']) >= MIN_POTIONS and not res['notInEngine'] and not res['notItem'] and res['fn'] == 'function',
                      f"{s}: potions: {MIN_POTIONS} or more in W_POTIONS for '{r['key']}', each in the engine's table ({pt['table']}) and an item, and {sc}.{pt['fn']} for the bag", err or res)

            if 'auto' in r: await have(pg, f'{s}: auto', r['auto']['have'])
            if 'ground' in r: await have(pg, f'{s}: ground ({r["home"]})', r['ground']['have'])

        # ---------- a journey: the player brings the pick and the gear; a Realm game has the set on ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon', 'troll', 'witch', 'golem', 'harpy']) if (wRoster().length < 9) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        check(await pg.evaluate("wRoster().length") >= 9, 'a journey with nine players of your own')

        # (a row still missing parts is played for the parts it has)
        for r in [r for r in SPORTS if r.get('start')]:
            s, sc, pk = r['sport'], r['scope'], r.get('picks')
            gd, pkx = r.get('gear'), pk or dict(field='__none', set='p => {}', got='m => false')
            worn = f"!!({gd['got']})(m, gid)" if gd else 'null'
            res, err = await ev(pg, f"""(() => {{ const p = wRoster()[0], keep = JSON.stringify({{ pick: p[{json.dumps(pkx['field'])}], gear: p.gear }});
              const gid = Object.keys(W_GEAR).find(id => W_GEAR[id].sport === {json.dumps(r['key'])}), player = {r['player']};
              try {{
                const before = player(p); ({pkx['set']})(p); p.gear = Object.assign({{}}, p.gear, {{ [{json.dumps(r['key'])}]: gid }});
                const m = player(p); return {{ picked: !!({pkx['got']})(m), plain: !({pkx['got']})(before), worn: {worn}, field: {json.dumps(pkx['field'])} in p }};
              }} finally {{ const k = JSON.parse(keep); if (k.pick === undefined) delete p[{json.dumps(pkx['field'])}]; else p[{json.dumps(pkx['field'])}] = k.pick; if (k.gear === undefined) delete p.gear; else p.gear = k.gear; }} }})()""")
            if check(err is None, f'{s}: a roster player goes into the engine', err):
                if pk: check(res['field'] and res['picked'] and res['plain'], f"{s}: picks: kept on the player as p.{pk['field']}, and the engine's player brings the pick", res)
                if gd: check(res['worn'], f"{s}: gear: a piece worn as p.gear.{r['key']} reaches the engine through the player", res)

            # a club game started through the Realm, as at the ground (Manage)
            res, err = await ev(pg, f"(() => {{ const why = {r['start']}; return {{ why: typeof why === 'string' ? why : '', view: UI.view, G: !!{sc}.G }}; }})()")
            if not check(err is None and res['G'] and not res['why'] and res['view'] == r['engine'], f"{s}: a club game starts through the Realm ({r['start']})", err or res): continue
            # (each part's own switch in the game, read before a step is played: a bag is as the Realm sent it)
            for part in [x for x in LIVE if x in r]:
                ok, err = await ev(pg, f"!!({r[part]['live']})")
                check(ok is True, f"{s}: {part}: on in a game the Realm plays ({r[part]['live']})", err)
            # where it's cheap, the game is played on until the part is seen working
            pl = r.get('play')
            if pl and pl.get('prep'): await ev(pg, f"(() => {{ {pl['prep']}; }})()")
            for part, (what, until) in (pl['until'].items() if pl else []):
                res, err = await ev(pg, f"(() => {{ let n = 0; const done = () => !!({until}); while (!done() && n < {PLAY_STEPS} && !({pl['over']})) {{ {pl['adv']}; n++; }} return {{ ok: done(), n, over: !!({pl['over']}) }}; }})()")
                if s == 'golf' and res: print(f'   (golf {part}: {res["n"]} steps)')
                check(err is None and res['ok'], f"{s}: {part}: {what}, in a game the Realm plays", err or res)
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
