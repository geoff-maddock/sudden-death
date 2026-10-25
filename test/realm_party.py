# Realm phase 3, the party is the team: the new-journey draft (club and founders), the roster and lineup, benched
# players' cards sitting out of a match and coming back, XP and level-ups (a card of the player's kind, +2 max HP),
# a tavern signing, the full-roster release flow, a post-game recruit, a quest companion, careers, save and reload,
# and a mid-match save and restore with a benched player. Asserts every step and exits nonzero on any failure.
# Screenshots: /tmp/realm-party-*.png (draft, camp desktop and phone, deck, tavern, level-up, recruit, release).
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)))
    if not ok: FAILS.append(what)
    return ok

BOT = r'''window.__wbot = function (maxTurns) {
  RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < (maxTurns || 80)) {
    let guard = 0;
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = -1, bs = -1;
      B.hand.forEach((c, i) => { if (!canPlay(c)) return; const d = def(c); if (d.type === 'junk' || d.type === 'curse') return; const s = d.type === 'atk' ? 3 : d.type === 'pow' ? 2 : 1; if (s > bs) { bs = s; best = i; } });
      if (best < 0) break;
      playCard(best, B.enemies.indexOf(tgt));
    }
    if (B.over) break;
    RUN.hp = Math.max(RUN.hp, 30);
    runSteps(endTurn());
  }
  return B && B.over;
};
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
window.__wlose = function () { let g = 0; while (B && !B.over && g++ < 40) { RUN.hp = 1; runSteps(endTurn()); } return B && B.over; };
window.__uids = function (cards) { return cards.map(c => c.uid).sort((a, b) => a - b).join(); };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"
FIGHT = """JSON.stringify({ turn: B.turn, energy: B.energy, sport: B.sport, hand: B.hand.map(c => c.uid + ':' + c.id), draw: B.draw.map(c => c.uid), disc: B.discard.map(c => c.uid),
  foes: B.enemies.map(e => [e.id, e.hp, e.block, e.intent, JSON.stringify(e.st)]), sc: [B.sc.us, B.sc.them], hp: RUN.hp, deck: __uids(RUN.deck), bench: __uids(RUN.wbench), party: RUN.party.map(p => p.n) })"""
ERRS = []

async def page(ctx, url=True):
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: ERRS.append(str(e)))
    pg.on('console', lambda m: ERRS.append('console: ' + m.text) if m.type == 'error' else None)
    await pg.goto(REALM_URL); await pg.wait_for_timeout(900)
    await pg.add_script_tag(content=BOT); await pg.evaluate(NOTIPS)
    return pg

async def modal_open(pg):
    return await pg.evaluate("!document.getElementById('modal').hidden")

async def win_and_continue(pg, before_continue=None):
    over = await pg.evaluate('__wbot(80)')
    await pg.evaluate('__wend()'); await pg.wait_for_timeout(300)
    if before_continue: await before_continue()
    await pg.evaluate("document.querySelector('[data-ci]') && document.querySelector('[data-ci]').click()")
    await pg.wait_for_timeout(150)
    await pg.click('#bCont'); await pg.wait_for_timeout(500)
    return over

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await page(ctx)
        await pg.evaluate('localStorage.clear()')
        await pg.reload(); await pg.wait_for_timeout(900)
        await pg.add_script_tag(content=BOT); await pg.evaluate(NOTIPS)

        # ---------- a new journey: club and founders on the draft screen ----------
        await pg.click('#bNew'); await pg.wait_for_timeout(300)
        check(await pg.evaluate("UI.screen === 'draft' && !!document.getElementById('wGo') && !!document.getElementById('wHard')"), 'Walk the realm opens the draft, with Set out and Hardcore')
        await pg.click('[data-club="frostfang"]'); await pg.wait_for_timeout(150)
        for i in (0, 2, 4):
            await pg.click(f'[data-pi="{i}"]'); await pg.wait_for_timeout(80)
        await pg.screenshot(path='/tmp/realm-party-draft.png')
        await pg.click('#wGo'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("({ view: UI.view, club: RUN.club, relics: RUN.relics, roster: WG.roster.map(p => [p.n, p.kind, p.lvl, p.from]), party: RUN.party.map(p => p.n), rivals: WG.rivals, want: [0, 2, 4].map(i => CLUBS.frostfang.roster[i][0]), relic: CLUBS.frostfang.relic, sig: WG.roster.every(p => RUN.deck.some(c => c.id === SIG[p.kind] && c.wp === p.id)) })")
        check(st['view'] == 'world' and st['club'] == 'frostfang' and st['relic'] in st['relics'], 'Set out starts the journey with the club and its trophy', st)
        check([r[0] for r in st['roster']] == st['want'] and all(r[2] == 1 and r[3] == 'founder' for r in st['roster']) and st['party'] == st['want'], 'the three founders are the roster and the party, level 1', st['roster'])
        check(st['sig'], 'each founder owns their signature card')
        rv = st['rivals']
        check(sorted(rv.keys()) == ['cauldron', 'helix', 'thaumagen', 'wildgraft'] and 'frostfang' not in rv.values() and len(set(rv.values())) == 4, 'the four companies map to four other SD clubs', rv)

        # ---------- a tavern: free agents from the region, a signing fee ----------
        await pg.evaluate("wEnterMap('graftonbury', 5, 11); RUN.gold = 900; wDrain()")
        await pg.evaluate("(() => { const r = wSay('hq_inn', 'agents'); wRunAct(r.act, 'hq_inn'); })()"); await pg.wait_for_timeout(250)
        tav = await pg.evaluate("({ n: document.querySelectorAll('#wTavBody [data-sign]').length, list: WG.tavern.graftonbury.list.map(a => [a.n, a.kind, a.lvl, a.fee]), kinds: DB.regions.plains.kinds })")
        check(1 <= tav['n'] <= 3 and all(a[1] in tav['kinds'] for a in tav['list']), 'the Graftonbury inn has 1-3 free agents, all plains kinds', tav)
        await pg.screenshot(path='/tmp/realm-party-tavern.png')
        a0 = tav['list'][0]
        await pg.click('#wTavBody [data-sign="0"]'); await pg.wait_for_timeout(250)
        sg = await pg.evaluate(f"(() => {{ const p = WG.roster.find(p => p.n === {json.dumps(a0[0])}); return {{ gold: RUN.gold, n: WG.roster.length, from: p && p.from, bench: p && !wIsStarter(p.id), sig: p && RUN.deck.some(c => c.id === SIG[p.kind] && c.wp === p.id), own: p && wCardsOf(p.id).length, left: WG.tavern.graftonbury.list.length }}; }})()")
        check(sg['gold'] == 900 - a0[3] and sg['n'] == 4 and sg['from'] == 'tavern', 'signing costs the fee and adds the player', sg)
        check(sg['sig'] and 2 <= sg['own'] <= 3 and sg['bench'], 'they join on the bench with their signature card and 1-2 kind cards', sg)
        check(sg['left'] == len(tav['list']) - 1, 'and leave the tavern list')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        same = await pg.evaluate("(() => { const a = JSON.stringify(wTavern('graftonbury')); return a === JSON.stringify(WG.tavern.graftonbury); })()")
        nxt = await pg.evaluate("(() => { const w = wWeek(); WG.dayAbs += 7; const t = wTavern('graftonbury'); WG.dayAbs -= 7; return t.week === w + 1; })()")
        check(same and nxt, 'the list holds for the week and refreshes the next')

        # ---------- the camp: lineup, swap a bench player in ----------
        await pg.evaluate("wEnterMap('world', 26, 30); WG.min = 12 * 60; wDrain()")
        await pg.click('#wCampBtn'); await pg.wait_for_timeout(300)
        check(await pg.evaluate("document.querySelectorAll('#wCampBody li.wpr').length") == 4, 'the camp lists all four players')
        await pg.screenshot(path='/tmp/realm-party-camp-desk.png')
        new_id = await pg.evaluate(f"WG.roster.find(p => p.n === {json.dumps(a0[0])}).id")
        out_id = await pg.evaluate("WG.roster[1].id")
        out_cards = await pg.evaluate(f"__uids(wCardsOf({out_id}))")
        await pg.click(f'li[data-pid="{new_id}"] [data-swap]'); await pg.wait_for_timeout(150)
        await pg.click(f'li[data-pid="{new_id}"] [data-with="{out_id}"]'); await pg.wait_for_timeout(200)
        ln = await pg.evaluate(f"({{ st: wStarters().map(p => p.id), party: RUN.party.map(p => p.n), nm: WG.roster.find(p => p.id === {new_id}).n }})")
        check(new_id in ln['st'] and out_id not in ln['st'] and ln['nm'] in ln['party'], 'Start / swap puts the bench player in the lineup and RUN.party', ln)
        await pg.click('[data-ctab="deck"]'); await pg.wait_for_timeout(200)
        check(await pg.evaluate("document.querySelectorAll('#wCampBody .wdk').length") == 5 and await pg.evaluate("document.querySelectorAll('#wCampBody .wdk.wout').length") == 1, 'the deck view groups cards by player, the benched one dimmed')
        await pg.screenshot(path='/tmp/realm-party-deck-desk.png')
        await pg.click('[data-ctab="team"]'); await pg.wait_for_timeout(150)
        # keyboard: move with the arrow buttons, and refuse two of a kind
        i0 = await pg.evaluate(f"WG.roster.findIndex(p => p.id === {new_id})")
        await pg.focus(f'li[data-pid="{new_id}"] [data-dn]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        check(await pg.evaluate(f"WG.roster.findIndex(p => p.id === {new_id})") == i0 + 1, 'the arrow buttons move a player (keyboard)')
        await pg.focus(f'li[data-pid="{new_id}"] [data-up]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        dup = await pg.evaluate("(() => { const w = wRecruit({ kind: WG.roster[0].kind, n: 'Twin' }, 'tavern'); const why = wSwap(w.id, WG.roster[1].id); const st = wStarters().map(p => p.kind); const ok = !!why && new Set(st).size === 3; wRelease(w.id); return { why, ok }; })()")
        check(dup['ok'], 'two of a kind cannot start together', dup)
        await pg.click('#modalBox [data-close]'); await pg.wait_for_timeout(150)

        # ---------- a match with a benched player: their cards sit out, then come back ----------
        # (against a goblin: only kinds with a signature card and free-agent names ask to join, so a slime or ghoul team
        # never would, and the recruit below would not come)
        all0 = await pg.evaluate("__uids(wAllCards())")
        await pg.evaluate("WG.roster.forEach(p => { p.xp = 0; p.lvl = 1; }); WG.roster[0].xp = 19; startMatch({ type: 'normal', tier: 1, card: false, ids: ['thief'], world: { kind: 'wild' } })")
        await pg.wait_for_timeout(1200)
        mt = await pg.evaluate(f"({{ deck: __uids(RUN.deck), bench: __uids(RUN.wbench), ok: RUN.deck.every(c => c.wp == null || wIsStarter(c.wp)), party: RUN.party.map(p => p.n) }})")
        check(mt['bench'] == out_cards and mt['ok'], "the benched player's cards are out of the match deck", mt)
        check(await pg.evaluate("__uids(RUN.deck.concat(RUN.wbench))") == all0, 'nothing lost: match deck + bench = the collection')
        lead = await pg.evaluate("({ id: WG.roster[0].id, n: WG.roster[0].n, kind: WG.roster[0].kind, max: RUN.maxhp })")
        W_FORCE = "W_PARTY.force = true"
        await pg.evaluate(W_FORCE)
        mx = {}
        async def before():
            mx['max'] = await pg.evaluate('RUN.maxhp')
            mx['xp'] = await pg.evaluate('WG.roster.map(p => [p.id, p.lvl, p.xp])')
        over = await win_and_continue(pg, before)
        check(over == 'win', 'the bot wins the match', over)
        af = await pg.evaluate(f"({{ view: UI.view, all: __uids(wAllCards()), bench: RUN.wbench.length, out: __uids(wCardsOf({out_id})), roster: WG.roster.map(p => [p.id, p.lvl, p.xp]), max: RUN.maxhp, prompts: WG.wprompts.map(x => x.t), offer: !!WG.cardOffer }})")
        check(af['bench'] == 0 and af['out'] == out_cards and set(all0.split(',')) <= set(af['all'].split(',')), 'after the match the benched cards are back in the collection', af)
        check(len(af['all'].split(',')) == len(all0.split(',')) + 1, 'the card won in the match landed in the collection')
        won = await pg.evaluate("(() => { const c = RUN.deck.reduce((a, c) => c.uid > a.uid ? c : a); return { k: CARDS[c.id].kind, wp: c.wp, st: wStarters().map(p => [p.id, p.kind]) }; })()")
        check(won['k'] == 'any' and won['wp'] is None or any(won['wp'] == s[0] and won['k'] == s[1] for s in won['st']), 'a won kind card belongs to the starter of its kind', won)
        lv = {r[0]: r for r in af['roster']}
        check(lv[lead['id']][1] == 2 and af['max'] == mx['max'] + 2, 'the starter over the line levels up, +2 team max HP', {'lv': lv[lead['id']], 'max': [mx['max'], af['max']]})
        bench_xp = await pg.evaluate(f"WG.roster.find(p => p.id === {out_id}).xp")
        check(bench_xp == 5, 'the bench earns half XP', bench_xp)
        car = await pg.evaluate(f"(() => {{ const c = loadCareers()[RUN.club + ':' + {json.dumps(lead['n'])}]; return c && c.games; }})()")
        check(car == 1, 'careers count the match for the starters (club:name)', car)
        await pg.wait_for_timeout(400)
        lu = await pg.evaluate(f"({{ offer: WG.cardOffer && WG.cardOffer.list.map(c => CARDS[c.id].kind), pid: WG.cardOffer && WG.cardOffer.pid, banner: !!document.querySelector('#modalBox .wlvl'), n: document.querySelectorAll('#modalBox [data-wco]').length }})")
        check(lu['offer'] and all(k == lead['kind'] for k in lu['offer']) and lu['pid'] == lead['id'] and lu['banner'] and lu['n'] == 3, "the level-up offers three cards of the player's kind", lu)
        await pg.screenshot(path='/tmp/realm-party-levelup.png')
        pid0 = await pg.evaluate("WG.cardOffer.list[0].id")
        await pg.click('#modalBox [data-wco="0"]')
        # wait for the pick to land rather than a fixed sleep (slow machines)
        try: await pg.wait_for_function("!WG.cardOffer", timeout=5000)
        except Exception: pass
        got = await pg.evaluate(f"RUN.deck.some(c => c.id === {json.dumps(pid0)} && c.wp === {lead['id']})")
        check(got, 'the picked card belongs to the player who levelled up')

        # ---------- post-game recruit (forced roll) ----------
        # another starter may have levelled up in the same match: their pick comes first
        # (the next pick surfaces from the prompt queue a moment after the last one closes, so keep looking until the
        # recruit box itself is up)
        for _ in range(6):
            # (a closed box keeps its buttons, hidden: only an open box counts)
            up = "!document.getElementById('modal').hidden && "
            try: await pg.wait_for_function(f"{up}(!!document.getElementById('wSign') || !!document.querySelector('#modalBox [data-wco]'))", timeout=5000)
            except Exception: break
            if await pg.evaluate("!!document.getElementById('wSign')"): break
            await pg.click('#modalBox [data-wco="0"]')
            try: await pg.wait_for_function(f"document.getElementById('modal').hidden || !!document.getElementById('wSign') || !document.querySelector('#modalBox [data-wco]')", timeout=5000)
            except Exception: pass
        rc = await pg.evaluate("({ open: !!document.getElementById('wSign'), sig: !!document.querySelector('#modalBox .wrecsig .card'), img: !!document.querySelector('#modalBox .wrecport'), text: document.getElementById('modalBox').textContent.slice(0, 160), hidden: document.getElementById('modal').hidden, prompts: WG.wprompts, offer: !!WG.cardOffer, view: UI.view, recruit: WG.recruit || null, active: wActive() })")
        check(rc['open'] and rc['sig'] and rc['img'], 'after the win, a beaten player asks to join (portrait, signature card)', rc)
        await pg.screenshot(path='/tmp/realm-party-recruit.png')
        n0 = await pg.evaluate('WG.roster.length')
        await pg.click('#wSign'); await pg.wait_for_timeout(250)
        pr = await pg.evaluate("(() => { const p = WG.roster[WG.roster.length - 1]; return { n: WG.roster.length, from: p.from, sig: RUN.deck.some(c => c.id === SIG[p.kind] && c.wp === p.id) }; })()")
        check(pr['n'] == n0 + 1 and pr['from'] == 'postgame' and pr['sig'], 'signing them adds a post-game player with their signature card', pr)
        await pg.evaluate("W_PARTY.force = false")

        # ---------- a full roster: release someone to make room ----------
        await pg.evaluate("['elf', 'ogre', 'minotaur', 'dwarf', 'goblin', 'kobold'].forEach(k => { if (WG.roster.length < 8) wRecruit({ kind: k }, 'tavern'); })")
        check(await pg.evaluate('WG.roster.length') == 8, 'the roster fills to eight')
        await pg.evaluate("wRecruit({ kind: 'spider', n: 'Newcomer' }, 'tavern')"); await pg.wait_for_timeout(200)
        check(await pg.evaluate("document.querySelectorAll('#modalBox [data-rel]').length") == 8, 'a ninth asks who to release')
        await pg.screenshot(path='/tmp/realm-party-release.png')
        rel = await pg.evaluate("(() => { const p = WG.roster[7]; return { id: p.id, n: p.n, cards: wCardsOf(p.id).map(c => c.uid), heir: WG.roster.some(q => q !== p && q.kind === p.kind) }; })()")
        await pg.click(f'#modalBox [data-rel="{rel["id"]}"]'); await pg.wait_for_timeout(150)
        await pg.click('#cfYes'); await pg.wait_for_timeout(250)
        rl = await pg.evaluate(f"({{ n: WG.roster.length, gone: !WG.roster.some(p => p.id === {rel['id']}), newc: WG.roster.some(p => p.n === 'Newcomer'), cards: wAllCards().filter(c => {json.dumps(rel['cards'])}.includes(c.uid)).length }})")
        check(rl['n'] == 8 and rl['gone'] and rl['newc'], 'releasing one makes room for the newcomer', rl)
        check(rl['cards'] == (len(rel['cards']) if rel['heir'] else 0), 'the released player takes their cards with them', rl)
        # let a ninth go
        await pg.evaluate("wRecruit({ kind: 'zombie', n: 'Passer' }, 'tavern')"); await pg.wait_for_timeout(150)
        await pg.click('#wRelNo'); await pg.wait_for_timeout(150)
        check(await pg.evaluate("WG.roster.length === 8 && !WG.roster.some(p => p.n === 'Passer')"), 'Let them go keeps the roster as it was')

        # ---------- a quest companion through a topic ----------
        await pg.evaluate("wRelease(WG.roster[7].id); WG.flags.rq_lumi2 = 1; WG.min = 23 * 60; wEnterMap('graftonbury', 5, 11); wDrain()")
        q = await pg.evaluate("(() => { const r = wSay('tallow', 'trap'); const p = WG.roster.find(p => p.n === 'Lumen'); return { text: r.text, p: p && [p.kind, p.lvl, p.from], sig: p && RUN.deck.some(c => c.id === SIG[p.kind] && c.wp === p.id), flag: wFlag('rq_lumi3') }; })()")
        check(q['p'] == ['harpy', 3, 'quest'] and q['sig'] and q['flag'] and 'Lumen' in q['text'], 'the lamp-moth quest pays a companion: Lumen joins', q)
        again = await pg.evaluate("(() => { wSay('tallow', 'trap'); return WG.roster.filter(p => p.n === 'Lumen').length; })()")
        check(again == 1, 'asking again does not recruit twice')
        check(await pg.evaluate("new Set(wStarters().map(p => p.kind)).size === 3"), 'a second harpy does not start alongside the first')
        await pg.evaluate("WG.min = 12 * 60")

        # ---------- save and reload: roster, levels, collection ----------
        await pg.evaluate("WG.wprompts.length = 0; wSave()")
        keep = await pg.evaluate("JSON.stringify({ r: WG.roster, d: RUN.deck.map(c => [c.uid, c.id, c.wp == null ? null : c.wp]), max: RUN.maxhp, rv: WG.rivals })")
        await pg.reload(); await pg.wait_for_timeout(900)
        await pg.add_script_tag(content=BOT); await pg.evaluate(NOTIPS)
        await pg.click('#bResume'); await pg.wait_for_timeout(500)
        back = await pg.evaluate("JSON.stringify({ r: WG.roster, d: RUN.deck.map(c => [c.uid, c.id, c.wp == null ? null : c.wp]), max: RUN.maxhp, rv: WG.rivals })")
        check(back == keep, 'save and reload keep the roster, levels, the collection and its owners')

        # ---------- phone width camp ----------
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(300)
        await pg.evaluate("wOpenCamp('team')"); await pg.wait_for_timeout(300)
        ov = await pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('modalBox').scrollWidth <= document.getElementById('modalBox').clientWidth + 1")
        check(ov, 'the camp fits a phone with no sideways scroll')
        await pg.screenshot(path='/tmp/realm-party-camp-phone.png')
        await pg.evaluate("wOpenCamp('deck')"); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/realm-party-deck-phone.png')
        await pg.click('#modalBox [data-close]'); await pg.wait_for_timeout(150)
        await pg.set_viewport_size({'width': 1280, 'height': 800}); await pg.wait_for_timeout(200)

        # ---------- mid-match save and restore with a benched player ----------
        benched = await pg.evaluate("wBenchList().filter(p => wCardsOf(p.id).length).length")
        check(benched >= 1, 'someone with cards is on the bench', benched)
        await pg.evaluate("startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } })"); await pg.wait_for_timeout(1200)
        await pg.evaluate("(() => { const i = B.hand.findIndex(c => canPlay(c)); if (i >= 0) playCard(i, B.enemies.indexOf(alive()[0])); consumeFx(); renderFightHUD(); })()"); await pg.wait_for_timeout(300)
        check(await pg.evaluate('snapBattle()'), 'snapBattle saves the fight')
        f1 = json.loads(await pg.evaluate(FIGHT))
        check(f1['bench'] != '', 'the save carries the benched cards aside', f1['bench'])
        await pg.close()
        pg = await page(ctx)
        await pg.click('#bResume'); await pg.wait_for_timeout(1200)
        f2 = json.loads(await pg.evaluate(FIGHT))
        diff = {k: [f1[k], f2[k]] for k in f1 if f1[k] != f2[k]}
        check(not diff, 'the restored match is identical: piles, enemies, score, match deck and bench', diff)
        all1 = await pg.evaluate("__uids(RUN.deck.concat(RUN.wbench))")
        over = await win_and_continue(pg)
        await pg.evaluate("WG.wprompts.length = 0; if (WG.cardOffer) { WG.cardOffer = null; document.querySelector('#modalBox [data-close]') && document.querySelector('#modalBox [data-close]').click(); }")
        fin = await pg.evaluate("({ bench: RUN.wbench.length, all: __uids(wAllCards()) })")
        check(over == 'win' and fin['bench'] == 0 and set(all1.split(',')) <= set(fin['all'].split(',')), 'after the restored match the bench cards come back', fin)

        # ---------- help, profile delete, the Hardcore ending ----------
        await pg.evaluate("showPage('help')")
        check(await pg.evaluate("!!document.getElementById('wHelpTeam') && document.getElementById('wHelpTeam').textContent.includes('bench')"), 'How to play explains the team')
        await pg.evaluate("showPage('play')")
        dl = await pg.evaluate("(() => { const id = createProfile('Tester'); localStorage.setItem('sd-realm@' + id, '{}'); deleteProfile(id); return localStorage.getItem('sd-realm@' + id); })()")
        check(dl is None, "deleting a profile deletes its realm save")
        await pg.evaluate("WG.hardcore = true; WG.wprompts.length = 0; startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } })"); await pg.wait_for_timeout(600)
        await pg.evaluate('__wlose()'); await pg.evaluate('__wend()'); await pg.wait_for_timeout(400)
        end = await pg.evaluate("({ hint: document.querySelector('#scr-end .panel > p.hint').textContent, stats: document.querySelector('#scr-end .endstats').textContent, h2: document.querySelector('#scr-end h2').textContent })")
        check('Contender' not in end['hint'] and 'journey' in end['hint'] and 'days on the road' in end['stats'] and 'bosses' not in end['stats'] and 'score' not in end['stats'], 'the Hardcore ending is about the journey, not a dungeon run', end)
        await pg.screenshot(path='/tmp/realm-party-hardcore-end.png')

        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        await ctx.close()
        check(not ERRS, 'no page errors', ERRS)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm party passed')

asyncio.run(main())
