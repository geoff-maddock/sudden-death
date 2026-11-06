# Realm journal: a new journey starts its journal in Graftonbury; talking records the person, where and when, every
# topic and what was said, and learns the CAPITALISED words somebody answers to; a side quest goes active when its
# giver mentions its keyword, and done when its flag is set; entering towns, dungeons and lairs and crossing regions
# records places, and places with their own rules get a Rules box; cup rounds and titles, bosses, lairs, grudge and
# rival wins go in Victories, ordinary wild wins do not; the Journal button and J open four tabs; the quest filter,
# keyword filter and search narrow them; the journal saves and reloads; an older save gets one built from its flags;
# every side quest can be activated by its giver; How to play explains it; nothing overflows on a phone.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-journal-*.png.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''window.__wbot = function (maxTurns) {
  let g = 0;
  while (B && !B.over && g++ < (maxTurns || 60)) {
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
    runSteps(endTurn());
  }
  return B && B.over;
};
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
window.__town = function (t) { const at = wInnSpot(t); wEnterMap(t, at[0], at[1]); };
window.__clear = function () { WG.cardOffer = null; WG.wprompts = []; const m = document.getElementById('modal'); m.hidden = true; m.onclick = null; };
window.__close = function () { const b = document.querySelector('#modalBox [data-close]'); if (b && !document.getElementById('modal').hidden) b.click(); };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof wOpenJournal === 'function'")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def play_win(pg):
    await pg.wait_for_function("UI.view === 'fight' && !!B")
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = 300; for (const e of alive()) e.hp = Math.min(e.hp, 6)")
    over = await pg.evaluate("__wbot(120)")
    await pg.evaluate("__wend()")
    await pg.wait_for_selector('#bCont'); await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending")
    return over

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg); await new_journey(pg)

            if tag == 'desk':
                j = await pg.evaluate("(() => ({ places: Object.keys(WG.journal.places), people: Object.keys(WG.journal.people).length, wins: WG.journal.wins.length }))()")
                check(j['places'] == ['graftonbury'] and j['people'] == 0 and j['wins'] == 0, 'a new journey starts its journal in Graftonbury', j)

                # every side quest can be started by the person who gives it
                bad = await pg.evaluate("""(() => DB.sideplots.filter(sp => { const g = wJGivers(sp), ws = wJHintWords(sp);
                  return !g.some(id => ws.some(w => wFindTopic(wChar(id), w.toLowerCase()))); }).map(sp => sp.id))()""")
                check(bad == [], 'every side quest has a giver who answers to its keyword', bad)

                # people and words
                t = await pg.evaluate("""(() => { __town('saltmere'); wSay('diver', ''); const r = wSay('diver', 'job'); wSay('diver', 'nonsense');
                  const P = WG.journal.people.diver; return { P, job: r.text, words: WG.journal.words }; })()""")
                P = t['P']
                check(P and P['n'] == 'Ysolde Wrack' and P['at']['where'] == 'Saltmere' and 'greet' in P['said'] and P['said'].get('job') == t['job'],
                      'talking records the person, where, the hello and each topic word for word', P)
                check(len(P['said']) == 2, 'a word nobody answers adds no topic', list(P['said']))
                learned = [w for w, v in t['words'].items() if v['who'] == 'diver']
                caps = await pg.evaluate("wJCaps(WG.journal.people.diver.said.job + ' ' + WG.journal.people.diver.said.greet).filter(wJAnswered)")
                check(sorted(learned) == sorted(caps), 'the CAPITALISED words somebody answers to are learned, with who said them', {'learned': learned, 'caps': caps})
                check('JOB' not in t['words'] and 'NAME' not in t['words'], 'plain words (JOB, NAME) are not keywords')

                # quests
                q = await pg.evaluate("""(() => { const before = !!WG.journal.quests.q_kelp; wSay('diver', 'kelp');
                  return { before, after: WG.journal.quests.q_kelp, log: WLOG.slice(-3).map(l => l[0]) }; })()""")
                check(not q['before'] and q['after'] and q['after']['where'] == 'Saltmere', 'asking the giver about KELP makes the side quest active', q)
                check(any('In your journal: The diver' in l for l in q['log']), 'the road log says the quest is in the journal', q['log'])
                other = await pg.evaluate("(() => { wSay('hq_inn', 'kelp'); return !!WG.journal.quests.q_tallow; })()")
                check(not other, 'someone who is not the giver does not start it')

                # places
                pl = await pg.evaluate("""(() => { __town('mossgate'); wEnterMap('hatchery', MAPS.hatchery.spawn[0], MAPS.hatchery.spawn[1]); wEnterMap('world', 20, 55);
                  wEncounterHook('bloom', 'Z', { kind: 'lair', loc: 'eldergrove', alpha: 'grove' }); __clear();
                  return Object.keys(WG.journal.places); })()""")
                check(all(k in pl for k in ['saltmere', 'mossgate', 'hatchery', 'eldergrove']) and any(k.startswith('r:') for k in pl),
                      'towns, dungeons, lairs and regions are recorded as places', pl)
                rules = await pg.evaluate("({ moss: wJRules('mossgate'), dg: wJRules('hatchery'), lair: wJRules('eldergrove'), col: wJRules('coliseum'), site: wJRules('cottage') })")
                check(len(rules['moss']) == 1 and 'Mosswold Cup' in rules['moss'][0] and '30 gold to enter' in rules['moss'][0], 'a cup town has its cup rules, from W_CUP', rules['moss'])
                check(len(rules['dg']) == 1 and 'famous team' in rules['dg'][0] and 'Hatch-Mother' in rules['dg'][0] and '1 cup won' in rules['dg'][0], 'a dungeon has rooms, boss and the way in', rules['dg'])
                check(len(rules['lair']) == 1 and 'Elder of the Grove' in rules['lair'][0], 'a lair names its boss', rules['lair'])
                check(len(rules['col']) == 1 and 'championship week' in rules['col'][0] and 'Apex' in rules['col'][0], 'the Coliseum has the Crown rules', rules['col'])
                check(rules['site'] == [], 'a plain site has no rules box')
                gr = await pg.evaluate("(() => { WG.ground = { town: 'mossgate', parts: { stands: 1, pitch: 0, kitchen: 0, scouts: 0 }, drill: { week: -1, n: 0 } }; return wJRules('mossgate'); })()")
                check(len(gr) == 2 and 'home ground' in gr[1] and '6 Block' in gr[1], 'your home ground adds its rules to its town', gr)

                # victories: a real cup final, then the other kinds by their match ends
                await pg.evaluate("(() => { __town('mossgate'); __clear(); WG.cup = { id: 'moss', round: 2, ready: 1 }; WG.grace = 99; wCupPlay({ card: false }); })()")
                await play_win(pg)
                await pg.evaluate("__clear()")
                await pg.evaluate("""(() => { wDispatchEnd({ kind: 'wild', ref: null }, 'win');
                  wDispatchEnd({ kind: 'lair', ref: { alpha: 'grove', loc: 'eldergrove' }, name: 'The Elder of the Grove' }, 'win'); __clear();
                  const c = wLeagueClubs()[0]; WG.grudge = { club: c, day: WG.dayAbs, n: 1 };
                  wDispatchEnd({ kind: 'event', ref: { rival: c, grudge: 1 } }, 'win'); __clear();
                  wDispatchEnd({ kind: 'cup', ref: { cup: 'salt', round: 0, club: null }, name: 'Dab Finch' }, 'lose'); })()""")
                w = await pg.evaluate("WG.journal.wins")
                ks = [e['k'] for e in w]
                check(ks == ['cup', 'title', 'boss', 'grudge'], 'cup round, title, lair boss and grudge go in; a wild win and a loss do not', ks)
                check(w[0]['t'] == 'Mosswold Cup, round 3 of 3' and w[0]['where'] == 'Mossgate' and w[0]['sport'] and w[0]['score'] and w[1]['t'] == 'Won the Mosswold Cup',
                      'the cup win has its round, place, sport and score', w[:2])

                # the screen
                await pg.evaluate("wInvalidate(); WUI.hudKey = ''; wRenderHud()")
                await pg.wait_for_selector('#wJournalBtn')
                await pg.click('#wJournalBtn'); await pg.wait_for_selector('#wJBody')
                tabs = await pg.evaluate("[...document.querySelectorAll('#modalBox [data-jtab]')].map(b => b.textContent.trim())")
                check([t.split(' ')[0] for t in tabs] == ['People', 'Places', 'Victories', 'Quests', 'Adventures'], 'the Journal button opens its tabs (the four, and Adventures from w66), with counts', tabs)
                await pg.screenshot(path='/tmp/realm-journal-people.png')
                await pg.click('#modalBox [data-jtab="places"]')
                pv = await pg.evaluate("({ regs: document.querySelectorAll('#wJBody .wjreg').length, rules: document.querySelectorAll('#wJBody .wjrules').length, txt: document.getElementById('wJBody').textContent })")
                check(pv['regs'] >= 2 and pv['rules'] >= 3 and 'Elder Grove' in pv['txt'], 'Places groups by region, with Rules boxes', {k: pv[k] for k in ['regs', 'rules']})
                await pg.screenshot(path='/tmp/realm-journal-places.png')
                await pg.click('#modalBox [data-jtab="wins"]')
                check(await pg.evaluate("document.querySelectorAll('#wJBody .wjwins li').length") == 4, 'Victories lists the four wins')
                await pg.click('#modalBox [data-jtab="quests"]')
                qt = await pg.evaluate("document.getElementById('wJBody').textContent")
                check("The diver's knees" in qt and 'Active' in qt, 'Quests lists the active side quest', qt[:200])
                await pg.screenshot(path='/tmp/realm-journal-quests.png')

                # filters: the quest narrows People to Ysolde and Places to nothing; the keyword shows who said it
                await pg.click('#modalBox [data-jtab="people"]')
                await pg.select_option('#wJQuest', 'q_kelp')
                fp = await pg.evaluate("[...document.querySelectorAll('#wJBody .wjp b')].map(b => b.textContent)")
                check(fp == ['Ysolde Wrack'], 'the quest filter narrows People to who it touches', fp)
                await pg.select_option('#wJQuest', '')
                word = await pg.evaluate("Object.keys(WG.journal.words).find(w => WG.journal.words[w].who === 'diver')")
                if check(bool(word), 'a word from Ysolde to filter by'):
                    await pg.select_option('#wJWord', word)
                    fw = await pg.evaluate("({ why: document.getElementById('wJWhy').textContent, on: document.querySelectorAll('#wJBody .wjkw.on').length, people: [...document.querySelectorAll('#wJBody .wjp b')].map(b => b.textContent) })")
                    check('first heard from Ysolde Wrack in Saltmere' in fw['why'] and fw['on'] >= 1 and 'Ysolde Wrack' in fw['people'],
                          'the keyword filter says who said it first, and marks it', fw)
                    await pg.click('#wJClear')
                await pg.fill('#wJFind', 'Wrack')
                fs = await pg.evaluate("[...document.querySelectorAll('#wJBody .wjp b')].map(b => b.textContent)")
                check(fs == ['Ysolde Wrack'], 'search narrows by name', fs)
                await pg.fill('#wJFind', '')
                kw = await pg.evaluate("(() => { const b = document.querySelector('#wJBody .wjkw'); if (!b) return null; b.click(); return [b.dataset.jword, WJ.word]; })()")
                check(kw and kw[0] == kw[1], 'a CAPITALISED word in the journal sets the keyword filter', kw)
                await pg.evaluate("WJ.word = ''; __close()")
                await pg.keyboard.press('j'); await pg.wait_for_selector('#wJBody')
                check(True, 'J opens the journal')
                await pg.evaluate("__close()")

                # saving, and an older save
                sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return { people: Object.keys(s.WG.journal.people), wins: s.WG.journal.wins.length }; })()")
                check('diver' in sv['people'] and sv['wins'] == 4, 'the journal is in the save', sv)
                await pg.reload(); await pg.wait_for_function("typeof wStart === 'function'"); await pg.add_script_tag(content=HELP)
                await pg.evaluate("""(() => { const s = JSON.parse(localStorage.getItem(wSaveKey())); delete s.WG.journal; s.WG.flags.seen_emberdeep = 1; s.WG.flags.alpha_aurora = 1;
                  localStorage.setItem(wSaveKey(), JSON.stringify(s)); })()""")
                await pg.click('#bResume'); await pg.wait_for_function("UI.view === 'world' && !!WG")
                old = await pg.evaluate("(() => { const J = wJ(); return { places: Object.keys(J.places), wins: J.wins.map(e => e.t), people: Object.keys(J.people).length, when: wJWhen(J.places.emberdeep.at) }; })()")
                check('emberdeep' in old['places'] and 'auroraroost' in old['places'] and 'Won the Mosswold Cup' in old['wins'] and any('Aurora' in t for t in old['wins']) and old['people'] == 0,
                      'an older save gets a journal from its flags: places seen, cups and bosses won', old)
                check(old['when'] == 'before this journal', 'and says those came before the journal', old['when'])

                help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpJournal'); return h ? h.textContent : ''; })()")
                check('Journal' in help_ and 'keyword' in help_, 'How to play has the journal', help_[:120])
            else:
                await pg.evaluate("""(() => { __town('saltmere'); wSay('diver', ''); wSay('diver', 'kelp'); wSay('diver', 'job'); __town('mossgate'); wSay('wenna', ''); wSay('wenna', 'job');
                  wDispatchEnd({ kind: 'lair', ref: { alpha: 'grove', loc: 'eldergrove' }, name: 'The Elder of the Grove' }, 'win'); __clear(); })()""")
                for t in ['people', 'places', 'wins', 'quests']:
                    await pg.evaluate(f"wOpenJournal('{t}')"); await pg.wait_for_selector('#wJBody')
                    await pg.evaluate("document.querySelectorAll('#wJBody details').forEach(d => d.open = true)")
                    ov = await pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                    wide = await pg.evaluate("[...document.querySelectorAll('#modalBox *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5)")
                    check(ov <= 0 and not wide, f'[phone] the {t} tab fits the screen', {'ov': ov, 'wide': wide})
                    await pg.screenshot(path=f'/tmp/realm-journal-phone-{t}.png')
                    await pg.evaluate("__close()")
            await ctx.close()
        check(not errs, 'no page errors', errs[:5])
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm journal passed')

asyncio.run(main())
