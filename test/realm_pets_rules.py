# Realm pets (issue #104, phase 0): the rules. A fight without a pet has no B.pet; with one (RUN.pet) it starts with
# B.pet as plain data, kept whole through a mid-fight save. Every pet has words for its trait, powers and trick, and
# plays a whole fight without an error. The trait fires (Blinkpup's Footwork, Bog Frog's Block, Sprite's extra card on
# the first turn); powers fire on their moments, once where they say once (Blinkpup's Block on the first attack each
# turn only, the Jellycube swallowing the first debuff only, the Rustnibbler eating an enemy's Block); powers open at
# their bond level; bond makes the numbers bigger and hunger smaller; a big hit spooks the pet and its next power that
# would fire doesn't; the trick works once a fight; a pet's damage shows in the breakdown under its own name.
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

HELP = r"""
// a fight against these enemies, with this pet (or none): LAB, so nothing is drawn or saved
window.__fight = (pet, ids, sport) => { LAB = true; RUN.pet = pet || null; RUN.hp = RUN.maxhp; startCombat(ids || ['skelss', 'thief'], 'normal', sport || 'baseball'); return B; };
window.__play = () => { let g = 0; while (!B.over && g++ < 60) { REALMBOT(); if (B.over) break; runSteps(endTurn()); } return B.over; };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof PETS !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.add_script_tag(path=os.path.join(ROOT, 'test/realm_lab.js'))
        await pg.evaluate(HELP)

        # ---------- with and without ----------
        a = await pg.evaluate("""(() => { const out = {}; __fight(null); out.none = B.pet; __fight({ kind: 'blinkpup', bond: 2, name: 'Zip' });
          out.pet = JSON.parse(JSON.stringify(B.pet)); out.dex = sv(B.P, 'dex'); out.saved = JSON.stringify(JSON.parse(JSON.stringify(B)).pet) === JSON.stringify(B.pet); return out; })()""")
        check(a['none'] is None, 'a fight without a pet has none', a['none'])
        check(a['pet']['kind'] == 'blinkpup' and a['pet']['name'] == 'Zip' and a['pet']['bond'] == 2 and a['pet']['used'] is False and a['saved'], 'a pet joins the fight as plain data (its name and bond), kept whole through a mid-fight save', a)
        check(a['dex'] == 2, 'its trait fires at the start (Blinkpup: Footwork, 1 at bond 1, 2 at bond 2)', a['dex'])
        w = await pg.evaluate("""(() => { const bad = [], played = {}; for (const k of Object.keys(PETS)) { const t = petText(k, 3); if (!t || !t.trait || !t.trick.d || !t.powers.length || t.powers.some(w => !w.d)) bad.push(k);
            for (const b of [1, 3]) { try { __fight({ kind: k, bond: b }, ['skelss', 'thief']); petTrick(); played[k + b] = __play(); } catch (e) { bad.push(k + ': ' + e.message); } } }
          return { bad, n: Object.keys(PETS).length, played: Object.values(played).filter(Boolean).length }; })()""")
        check(w['bad'] == [] and w['n'] >= 15, 'every pet (15) has words for its trait, powers and trick, and plays whole fights at bond 1 and 3 without an error', w)
        check(w['played'] == w['n'] * 2, 'every one of those fights reached its end', w)

        # ---------- powers on their moments ----------
        m = await pg.evaluate("""(() => { const out = {}; const e0 = () => alive()[0];
          __fight({ kind: 'blinkpup', bond: 1 }); B.P.block = 0; const lost = () => { const h = RUN.hp; hurtPlayer(4, e0()); return h - RUN.hp; }; out.blink = [lost(), lost()];
          __fight({ kind: 'jellycube', bond: 1 }); out.jelly = [!!fire('playerDebuff', { k: 'weak', n: 2 }), !!fire('playerDebuff', { k: 'weak', n: 2 })];
          __fight({ kind: 'rustnibbler', bond: 1 }); const e = e0(); e.block = 5; e.block += 9; fire('enemyBlock', { e, n: 9 }); const after1 = e.block; e.block += 9; fire('enemyBlock', { e, n: 9 }); out.rust = [after1, e.block];
          const hand = pet => { __fight(pet); return B.hand.length; }; out.sprite = [hand(null), hand({ kind: 'sprite', bond: 1 })];
          __fight({ kind: 'bogfrog', bond: 1 }); out.frog = B.P.block;
          return out; })()""")
        check(m['blink'] == [0, 4], 'Blinkpup: the first attack aimed at you each turn gives 4 Block (a 4-damage hit costs nothing), the second none', m['blink'])
        check(m['jelly'] == [True, False], 'Jellycube: the first debuff on you is swallowed, the next lands', m['jelly'])
        check(m['rust'] == [5, 12], 'Rustnibbler: the first Block an enemy raises is eaten (not what it had), and after that it nibbles 2 of each', m['rust'])
        check(m['sprite'][1] == m['sprite'][0] + 1 and m['frog'] >= 5, 'Sprite in a Jar: one more card on the first turn; Bog Frog: Block at the start', m)

        # ---------- bond, hunger, spooking, the trick, the breakdown ----------
        b = await pg.evaluate("""(() => { const out = {};
          out.pow = [petPow(4, { bond: 1 }), petPow(4, { bond: 2 }), petPow(4, { bond: 3 }), petPow(4, { bond: 3, hungry: true })];
          out.open = [petText('blinkpup', 1).powers.map(w => w.open), petText('blinkpup', 2).powers.map(w => w.open)];
          __fight({ kind: 'blinkpup', bond: 1 }); const tc = () => { B.cardsThisTurn = 3; B.pendingDraw = 0; fire('cardPlayed', B.hand[0]); return B.pendingDraw || 0; }; out.bond1draw = tc();
          __fight({ kind: 'blinkpup', bond: 2 }); out.bond2draw = tc();
          __fight({ kind: 'blinkpup', bond: 1 }); B.P.block = 0; hurtPlayer(30, alive()[0]); out.spooked = B.pet.spooked; RUN.hp = RUN.maxhp; B.pet.t = {}; B.P.block = 0; const lost = () => { const h = RUN.hp; hurtPlayer(4, alive()[0]); return h - RUN.hp; }; out.afterSpook = [lost(), B.pet.spooked]; B.pet.t = {}; B.P.block = 0; out.next = lost();
          __fight({ kind: 'axebeak', bond: 1 }); const e = alive()[0], hp = e.hp; out.trick = [petTrick(0), e.hp < hp, petTrick(0), petTrickWhy()];
          __fight({ kind: 'hootling', bond: 2 }); RUN.hp = Math.floor(RUN.maxhp * .3); const atk = B.hand.find(c => def(c).type === 'atk') || B.draw.find(c => def(c).type === 'atk'); const W = atk && dmgWhy(atk, alive()[0]);
          out.why = W ? W.parts.map(x => x[0]) : null;
          return out; })()""")
        check(b['pow'] == [4, 6, 8, 4], 'bond makes its numbers bigger (x1, x1.5, x2), hunger halves them', b['pow'])
        check(b['open'] == [[True, False], [True, True]] and b['bond1draw'] == 0 and b['bond2draw'] == 1, 'a power opens at its bond level (Blinkpup\'s card at bond 2)', b)
        check(b['spooked'] is True and b['afterSpook'] == [4, False] and b['next'] == 0, 'a big hit spooks it: its next power that would fire doesn\'t, then it settles', b)
        check(b['trick'][:3] == [True, True, False] and b['trick'][3] != '', 'the trick works once a fight', b['trick'])
        check(b['why'] and 'Hootling' in b['why'], 'a pet\'s damage shows in the breakdown under its own name (Hootling below half HP)', b['why'])

        # ---------- round 1: the moments the review found ----------
        r1 = await pg.evaluate("""(() => { const out = {};
          __fight({ kind: 'jellycube', bond: 1 }); const e = alive()[0]; hurtPlayer(3, e); addSt(e, 'weak', -1); out.weakLeft = sv(e, 'weak');
          out.jellyAll = (() => { __fight({ kind: 'jellycube', bond: 1 }); return [debuffP('soaked', 1), debuffP('weak', 1)]; })();
          __fight({ kind: 'rustnibbler', bond: 1 }); const k = alive()[0]; blockE(k, 12); out.rustAll = k.block;
          __fight({ kind: 'axebeak', bond: 1 }, ['skelss', 'thief']); const [a1, a2] = alive(); B.lastTgt = a1.uid; const h1 = a1.hp, h2 = a2.hp; fire('attackPlayed', B.hand[0]); out.peck = [a1.hp === h1, a2.hp < h2];
          __fight({ kind: 'axebeak', bond: 1 }); const atk = { uid: 999, id: Object.keys(CARDS).find(id => CARDS[id].type === 'atk'), up: false }; const sky0 = skyAtk; skyAtk = () => 0; try { B.inCard = true; const x1 = atkDmg(5, alive()[0], atk), x2 = atkDmg(5, alive()[0], atk); B.inCard = false; fire('attackPlayed', atk); const x3 = atkDmg(5, alive()[0], atk); out.firstHit = [x1 - x3, x2 - x3]; } finally { skyAtk = sky0; B.inCard = false; }
          __fight({ kind: 'cockatrice', bond: 1 }); B.lastTgt = 'gone'; const before = alive().map(e => sv(e, 'vuln')); fire('attackPlayed', B.hand[0]); out.noFallback = JSON.stringify(alive().map(e => sv(e, 'vuln'))) === JSON.stringify(before);
          __fight({ kind: 'bogfrog', bond: 2 }); B.phase = 'enemy'; fire('enemyFalls', alive()[0]); out.drawnext = sv(B.P, 'drawnext'); B.phase = 'player';
          __fight({ kind: 'chestnut', bond: 2 }); const g0 = RUN.gold; fire('enemyFalls', { eaten: 1 }); out.eaten = RUN.gold - g0;
          __fight({ kind: 'axebeak', bond: 1 }); B.pet.kind = 'nosuch'; out.badKind = [petTrickWhy(), petTrick()];
          return out; })()""")
        check(r1['weakLeft'] >= 1, 'Jellycube: the attacker\'s Weak lasts past the end of its own turn, to its next attack', r1)
        check(r1['jellyAll'] == [False, True] and r1['rustAll'] == 0, 'every debuff on you (a boss\'s Soaked) and every enemy Block (a phase\'s) reaches the pet', r1)
        check(r1['peck'] == [True, True] and r1['firstHit'] == [3, 3], 'Axebeak: the peck lands on another enemy; its +3 is on every hit of the first attack card, and gone after it', r1)
        check(r1['noFallback'] and r1['drawnext'] == 1 and r1['eaten'] == 0, 'Cockatrice exposes only the enemy you hit; Bog Frog\'s draw waits for your turn; an ally a boss eats pays nothing', r1)
        check(r1['badKind'][0] != '' and r1['badKind'][1] is False, 'a pet whose kind is gone has no trick (no error)', r1)
        r2 = await pg.evaluate("""(() => { const out = {};
          __fight({ kind: 'cockatrice', bond: 1 }, ['skelss', 'thief']); B.lastTgt = null; fire('attackPlayed', B.hand[0]); const t = alive()[1]; B.lastTgt = t.uid; const v0 = sv(t, 'vuln'); fire('attackPlayed', B.hand[0]); out.stare = sv(t, 'vuln') - v0;
          __fight({ kind: 'axebeak', bond: 1 }); const atk = { uid: 998, id: Object.keys(CARDS).find(id => CARDS[id].type === 'atk'), up: false }; const base = (() => { const k = B.pet; B.pet = null; const n = atkDmg(5, alive()[0], atk); B.pet = k; return n; })();
          out.face = atkDmg(5, alive()[0], atk) - base; const W = dmgWhy(atk, alive()[0]); out.why = W ? W.parts.map(x => x[0]) : [];
          __fight({ kind: 'bogfrog', bond: 2 }); B.ending = true; const h = B.hand.length; fire('enemyFalls', alive()[0]); out.ending = [B.hand.length - h, sv(B.P, 'drawnext')]; delete B.ending;
          __fight({ kind: 'chestnut', bond: 2 }, ['skelss', 'thief']); const k0 = B.killsThisTurn, g0 = RUN.gold, o = alive()[0]; o.eaten = 1; hurtEnemy(o, o.hp + o.block, { raw: true }); out.eatenKill = [B.killsThisTurn - k0, RUN.gold - g0];
          return out; })()""")
        check(r2['stare'] == 1, 'Cockatrice: an attack with no standing target doesn\'t spend the turn\'s stare; the next one exposes', r2)
        check(r2['face'] == 3 and 'Axebeak Chick' in r2['why'], 'Axebeak: the card face and the breakdown both count its +3 until the first attack card resolves', r2)
        check(r2['ending'] == [0, 1] and r2['eatenKill'] == [1, 0], 'a kill as your turn ends: the Bog Frog\'s card waits for the next turn; an ally a boss eats pays a pet nothing (the base game counts it as before)', r2)
        sp = await pg.evaluate("""(() => { __fight({ kind: 'rustnibbler', bond: 1 }); const e = alive()[0]; B.pet.spooked = true; e.block = 5 + 9; fire('enemyBlock', { e, n: 9 }); return { spooked: B.pet.spooked, block: e.block }; })()""")
        check(sp == {'spooked': True, 'block': 5}, 'a spooked pet keeps its spook when a power would take nothing (the trait ate the whole gain)', sp)
        sb = await pg.evaluate("""(() => { __fight({ kind: 'bogfrog', bond: 1 }, ['skelss', 'thief']); const [a, b] = alive(); B.pet.spooked = true; const p0 = B.P.block;
          a.block = 6; fire('enemyBlock', { e: a, n: 6 }); const first = [B.pet.spooked, a.block]; b.block = 6; fire('enemyBlock', { e: b, n: 6 }); return { first, second: b.block, mine: B.P.block - p0 }; })()""")
        check(sb == {'first': [False, 6], 'second': 6, 'mine': 0}, 'a spook is spent when there is something to take, and it uses up a once-a-turn power for the turn (the Bog Frog\'s tongue doesn\'t come back on the second gain)', sb)
        pd = await pg.evaluate("""(() => { __fight({ kind: 'pseudodragon', bond: 1 }); RUN.hp = Math.floor(RUN.maxhp * .3); B.pet.spooked = true; const r0 = sv(B.P, 'regen');
          fire('turnStart'); const first = [B.pet.spooked, sv(B.P, 'regen') - r0]; fire('turnStart'); return { first, second: sv(B.P, 'regen') - r0 }; })()""")
        check(pd == {'first': [False, 0], 'second': 3}, 'a once-a-fight power the spook stops waits: the Pseudodragon\'s Regen comes the next turn', pd)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
