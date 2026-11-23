# Realm: the corrupted legends (issue #111, phase F). Each legend stands on the dark world only from its Dread stage
# (the Kraken at 3 pieces, the Phoenix at 6, the Frost Wyrm at 8; none once sealed or beaten), on a lair that can be
# reached, in its region (the Wyrm by the Hollow Coliseum), off the hazards; walking into one opens its match card and
# you stay put. Each stage's scene names its legend. In a LAB fight each boss changes phase under half HP; the Kraken
# drowns cards from your hand (Slimed come up), the Phoenix rises once at 40%, the Wyrm freezes a card (two in its second
# phase) that can't be played. A win gives one shard and marks it beaten (no second shard). A shard set on a round of
# the Seal takes one hex off it (never below none, with a Hex Ward too), or gives 15 Block in a card round; it keeps
# through a reload and through backing out of the round's card, and is spent when the round ends. The three lineups
# field their legends, in shadow, named on their cards. An old save with no legends keys loads; the audit is clean.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbLegendMatch === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; WG.umbral.dreadSeen = 3; WG.hardcore = false; W_UMB8C.shadows = [0, 0, 0, 0]; WG.umbral.shadows = []; wSave()")

        # where they stand, and when
        wk = await pg.evaluate("""(() => { const m = MAPS['u:world'], U = WG.umbral, ps = Object.keys(W_UMB_PIECES), out = {}, den = DB.locs.find(l => l.id === 'umbralden');
          const s = bfsReach(m, den.x, den.y + 1), L = m.legends || {};
          out.placed = Object.keys(L).sort(); out.bad = [];
          for (const k in L) { const [x, y] = L[k];
            if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s[(y + dy) * m.w + x + dx])) out.bad.push(k + ' unreachable');
            if (wUmbHazardAt(m, x, y)) out.bad.push(k + ' on a hazard');
            if (W_UMB8I.legends[k].region && regionAt(x, y) !== W_UMB8I.legends[k].region) out.bad.push(k + ' out of its region');
            if (Object.keys(m.meta).some(q => m.meta[q].lantern && Math.hypot(+q.split(',')[0] - x, +q.split(',')[1] - y) <= W_UMB8C.lanternR)) out.bad.push(k + ' in a lantern light'); }
          const col = DB.locs.find(l => l.id === 'coliseum'); out.wyrmNear = Math.abs(L.wyrm[0] - col.x) + Math.abs(L.wyrm[1] - col.y);
          wEnterMap('u:world', den.x, den.y + 1);
          const at = () => Object.keys(L).filter(k => wUmbLegendAt(L[k][0], L[k][1]));
          for (const n of [0, 2, 3, 5, 6, 7, 8, 9]) { U.pieces = ps.slice(0, n); out[n] = at(); }
          U.sealed = 1; out.sealed = at(); U.sealed = 0;
          U.pieces = ps.slice(0, 3); out.npc = !!wNpcAt(L.kraken[0], L.kraken[1]); out.npcPhx = !!wNpcAt(L.phoenix[0], L.phoenix[1]);
          out.look = wLookText(L.kraken[0], L.kraken[1]);
          out.audit = wAudit(); U.pieces = []; return out; })()""")
        check(wk['placed'] == ['kraken', 'phoenix', 'wyrm'] and not wk['bad'] and wk['wyrmNear'] <= 10, 'each legend has a lair it can be reached at, in its region, off the hazards and out of the lanterns\' light; the Wyrm by the Coliseum', wk)
        check(wk['0'] == [] and wk['2'] == [] and wk['3'] == ['kraken'] and wk['5'] == ['kraken'] and wk['6'] == ['kraken', 'phoenix'] and wk['7'] == ['kraken', 'phoenix'] and wk['8'] == ['kraken', 'phoenix', 'wyrm'] and wk['9'] == ['kraken', 'phoenix', 'wyrm'] and wk['sealed'] == [],
              'a legend stands there only from its stage on: the Kraken at 3 pieces, the Phoenix at 6, the Wyrm at 8; none once sealed', wk)
        check(wk['npc'] and not wk['npcPhx'] and 'Kraken' in wk['look'], 'an awake legend stands in the way (wNpcAt) and Look names it; a sleeping one does not', wk)
        check(wk['audit'] == [], 'the audit is clean', wk['audit'])
        al = await pg.evaluate("""(() => { const m = MAPS['u:world'], den = DB.locs.find(l => l.id === 'umbralden'), s = wUmbReachLairs(m, den), sides = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
          const cut = DB.locs.filter(L => !sides.some(([dx, dy]) => s[(L.y + dy) * m.w + L.x + dx])).map(L => L.id);
          const lairs = Object.values(m.legends).map(([x, y]) => s[y * m.w + x]); return { cut, lairs }; })()""")
        check(al['cut'] == [] and al['lairs'] == [0, 0, 0], 'with all three legends standing at once, every place on the dark world can still be walked to', al)

        sc = await pg.evaluate("""(() => ({ s1: W_UMB8C.scenes[1].lines.some(l => /too many arms/.test(l)), s2: W_UMB8C.scenes[2].lines.some(l => /black flame/.test(l)), s3: W_UMB8C.scenes[3].lines.some(l => /Coliseum/.test(l)),
          d1: wUmbDreadDoes(1), d3: wUmbDreadDoes(3) }))()""")
        check(sc['s1'] and sc['s2'] and sc['s3'] and 'Kraken' in sc['d1'] and 'Frost Wyrm' in sc['d3'], 'each stage\'s scene wakes its legend', sc)

        # walking into the Kraken: its match card, and you stay where you are
        wc = await pg.evaluate("""(() => { const m = MAPS['u:world'], U = WG.umbral, [x, y] = m.legends.kraken; U.pieces = Object.keys(W_UMB_PIECES).slice(0, 3);
          let st = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wUmbFreeAt(m, x + dx, y + dy)) { st = [x + dx, y + dy, -dx, -dy]; break; }
          wEnterMap('u:world', st[0], st[1]); WG.grace = 9;
          wTryMove(st[2], st[3]); const box = document.getElementById('modalBox'), txt = box ? box.textContent : '';
          return { stayed: WG.x === st[0] && WG.y === st[1], open: !document.getElementById('modal').hidden, legend: /A corrupted legend/.test(txt), prize: /Legend's Shard/.test(txt), phases: /Maelstrom/.test(txt), notYet: !!document.getElementById('wNotYet') }; })()""")
        check(wc['stayed'] and wc['open'] and wc['legend'] and wc['prize'] and wc['phases'] and wc['notYet'], 'walking into the Kraken opens its match card (both phases, the prize, Not yet), and you stay put', wc)
        await pg.click('#wNotYet')
        await pg.wait_for_function("document.getElementById('modal').hidden")

        # the bosses, in LAB fights
        fb = await pg.evaluate("""(() => { const U = WG.umbral, ps = Object.keys(W_UMB_PIECES), out = {};
          const go = k => { U.pieces = ps.slice(0, W_UMB8C.stages[W_UMB8I.legends[k].stage]); U.legends = {}; LAB = true; RUN.pending = null; B = null; try { wUmbLegendMatch(k); } finally { LAB = false; } return B && B.enemies.find(e => e.id === W_UMB8I.legends[k].id); };
          // the Kraken: its first move set, then under half the Maelstrom; its drowning comes at the start of your turn
          let e = go('kraken'); out.kraken = { umb: B.umb, kind: e.kind, shade: e.shade, intent0: e.intent, deep: e.st.u_deep };
          e.hp = Math.floor(e.max * .5) + 3; hurtEnemy(e, 6, { raw: true }); out.kraken.phase = e.phase; out.kraken.intent1 = e.intent;
          B.uDrown = 0; e.intent = 'pull'; e.plan = planOps(e); B.phase = 'enemy'; doMove(e); out.kraken.due = B.uDrown;
          B.hand = []; B.draw = []; for (let i = 0; i < 8; i++) B.draw.push(mkCard('check')); B.discard = []; playerTurnStart();
          out.kraken.slimed = B.hand.filter(c => c.id === 'slimed').length; out.kraken.drowned = B.discard.length; out.kraken.hand = B.hand.length; out.kraken.after = B.uDrown;
          // the Phoenix: rises once at 40%, then goes down for good
          e = go('phoenix'); out.phoenix = { kind: e.kind, mark: e.st.u_rebirth };
          hurtEnemy(e, e.hp + e.block + 5, { raw: true }); out.phoenix.rose = [e.dead, e.hp, Math.round(e.max * W_UMB8I.rise), e.phase];
          hurtEnemy(e, e.hp + e.block + 5, { raw: true }); out.phoenix.down = e.dead;
          // the Wyrm: a frozen card can't be played; two under half
          e = go('wyrm'); out.wyrm = { kind: e.kind };
          B.hand = []; B.draw = []; for (let i = 0; i < 8; i++) B.draw.push(mkCard('check')); playerTurnStart();
          const fr = (B.uFrost || []).slice(), c = B.hand.find(c => fr.includes(c.uid)); B.energy = 9;
          out.wyrm.frozen = fr.length; out.wyrm.cant = c ? canPlay(c) : 'none'; out.wyrm.other = B.hand.some(c => !fr.includes(c.uid) && canPlay(c));
          out.wyrm.marked = c ? /Frozen/.test(cardHTML(c, { live: true })) : false;
          e.hp = Math.floor(e.max * .5) + 3; hurtEnemy(e, 6, { raw: true }); out.wyrm.phase = e.phase; out.wyrm.intent1 = e.intent;
          B.hand = []; B.draw = []; for (let i = 0; i < 8; i++) B.draw.push(mkCard('check')); playerTurnStart(); out.wyrm.frozen2 = (B.uFrost || []).length;
          // a snapshot of the match is plain data
          out.json = (() => { try { return JSON.parse(JSON.stringify(B)).uFrost.length; } catch (x) { return String(x); } })();
          B = null; RUN.pending = null; RUN.battle = null; showView('world'); U.legends = {}; U.pieces = []; return out; })()""")
        k, ph, wy = fb['kraken'], fb['phoenix'], fb['wyrm']
        check(k['umb'] == 1 and k['kind'] == 'kraken' and k['shade'] == 1 and ph['kind'] == 'phoenix' and wy['kind'] == 'frostwyrm', 'each legend is an Umbral match against its own kind, in shadow', fb)
        check(k['intent0'] in ('grip', 'pull', 'ink') and k['phase'] == 1 and k['intent1'] in ('whirl', 'crush', 'grip'), 'the Kraken changes phase under half HP, to its second set of moves', k)
        check(k['due'] == 2 and k['slimed'] == 2 and k['drowned'] == 2 and k['after'] == 0, 'the Kraken drowns your hand: two cards go under at the start of your turn, and two Slimed come up', k)
        check(ph['mark'] == 1 and ph['rose'][0] is False and ph['rose'][1] == ph['rose'][2] and ph['rose'][3] == 1 and ph['down'] is True, 'the Phoenix rises once at 40% of its HP (and in its second phase), and the second time goes down', ph)
        check(wy['frozen'] == 1 and wy['cant'] is False and wy['other'] and wy['marked'], 'the Wyrm\'s Blizzard freezes a card: it can\'t be played that turn, the others can, and it is marked Frozen', wy)
        check(wy['phase'] == 1 and wy['intent1'] in ('kill', 'glacier', 'hoard') and wy['frozen2'] == 2 and fb['json'] == 2, 'under half HP the Wyrm turns to its Whiteout moves and freezes two; the match stays plain data', fb)

        # the prize: one shard, once
        pz = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES).slice(0, 3); U.legends = {}; U.shards = 0; const g0 = RUN.gold, d0 = RUN.deck.length;
          W_ON_END.ulegend('win', { k: 'kraken' }); const one = { shards: U.shards, state: U.legends.kraken, gold: RUN.gold - g0 };
          W_ON_END.ulegend('win', { k: 'kraken' }); one.again = U.shards; WG.cardOffer = null;
          const [x, y] = MAPS['u:world'].legends.kraken; wEnterMap('u:world', x + 2, y); one.gone = wUmbLegendAt(x, y); one.why = wUmbLegendMatch('kraken');
          W_ON_END.ulegend('lose', { k: 'phoenix' }); one.phx = U.legends.phoenix || null;
          document.getElementById('modal').hidden = true; MODAL_NOW = null; return one; })()""")
        check(pz['shards'] == 1 and pz['state'] == 'beaten' and pz['gold'] == 120 and pz['again'] == 1, 'a win gives one Legend\'s Shard and 120 gold and marks it beaten; a second gives no second shard', pz)
        check(pz['gone'] is None and 'beat' in pz['why'] and pz['phx'] is None, 'a beaten legend is gone from its lair; a lost game leaves the legend as it was', pz)

        # the shard in the Seal
        sh = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; U.pieces = Object.keys(W_UMB_PIECES); U.finale = 0; U.tries = {}; U.finaleSports = ['card', 'football', 'bowling']; U.shards = 1; U.shardOn = null; U.ward = 0;
          out.base = wUmbHexes('finale', 2).length;
          out.set = wUmbShardUse('hex'); out.cut = wUmbHexes('finale', 2).length; out.again = wUmbShardUse('hex');
          U.ward = 1; out.both2 = wUmbHexes('finale', 2).length; out.both1 = wUmbHexes('finale', 1).length; U.ward = 0;
          out.otherRound = wUmbHexes('gate', 2).length;
          U.finale = 1; out.engineNoBlock = wUmbShardUse('block'); out.notThisRound = wUmbGfHexes('finale', 2).length; U.finale = 0;
          wSave(); return out; })()""")
        await pg.evaluate("wStart(wLoadSave())")
        sh['reload'] = await pg.evaluate("({ on: WG.umbral.shardOn, n: WG.umbral.shards })")
        check(sh['base'] == 2 and sh['set'] == '' and sh['cut'] == 1 and sh['again'] != '', 'a shard set on a round of the Seal takes one hex off it (once)', sh)
        check(sh['both2'] == 0 and sh['both1'] == 0 and sh['otherRound'] == 2, 'with a Hex Ward too, a 2-hex round draws none and a 1-hex round none, never fewer; a champion\'s game is untouched', sh)
        check(sh['engineNoBlock'] != '' and sh['notThisRound'] == 2, 'the Block is only for a card round, and a shard set on one round does nothing for another', sh)
        check(sh['reload'] == {'on': {'r': 0, 'how': 'hex'}, 'n': 1}, 'a shard set keeps through a reload', sh)

        # a round that draws no hexes now (its clean piece's one taken by a Hex Ward): a shard offers only the Block
        nr = await pg.evaluate("""(() => { const U = WG.umbral; U.shardOn = null; U.shards = 1; U.finale = 0; U.tries = {}; U.ward = 1; U.wardFor = null;
          const out = { hexes: wUmbFinaleEntry().hexes, refused: wUmbShardUse('hex'), on: U.shardOn };
          wUmbFinale(); out.hexBtn = !!document.querySelector('[data-ushard="hex"]'); out.blockBtn = !!document.querySelector('[data-ushard="block"]');
          document.getElementById('modal').hidden = true; MODAL_NOW = null; U.ward = 0; return out; })()""")
        check(nr['hexes'] == 1 and nr['refused'] != '' and nr['on'] is None and not nr['hexBtn'] and nr['blockBtn'], 'a round already down to no hexes takes no shard for a hex: only the Block is offered', nr)

        # PLAY with Aurelia: the shard's question, then back out of the round's card: the shard stays; the round ending spends it
        await pg.evaluate("(() => { const U = WG.umbral; U.shardOn = null; U.shards = 2; U.finale = 0; wUmbFinale(); })()")
        await pg.wait_for_selector('[data-ushard="block"]')
        q = await pg.evaluate("({ hex: !!document.querySelector('[data-ushard=\"hex\"]'), keep: !!document.querySelector('[data-ushard=\"\"]') })")
        await pg.click('[data-ushard="block"]')
        await pg.wait_for_selector('#wNotYet')
        await pg.click('#wNotYet')
        await pg.wait_for_function("document.getElementById('modal').hidden")
        bo = await pg.evaluate("({ on: WG.umbral.shardOn, n: WG.umbral.shards })")
        blk = await pg.evaluate("""(() => { LAB = true; RUN.pending = null; B = null; try { wNadirMatch('finale'); } finally { LAB = false; } const b = B ? B.P.block : -1; B = null; RUN.pending = null; RUN.battle = null; showView('world'); return b; })()""")
        sp = await pg.evaluate("""(() => { const U = WG.umbral; W_ON_END.nadir('lose', { id: 'finale' }); const out = { on: U.shardOn, n: U.shards, round: U.finale };
          U.shardOn = { r: 1, how: 'hex' }; W_ON_END.nadir('lose', { id: 'finale' }); out.elsewhere = [U.shards, !!U.shardOn]; U.shardOn = null; return out; })()""")
        check(q['hex'] and q['keep'], 'PLAY with two shards asks first: one hex fewer, 15 Block (a card round) or keep it', q)
        check(bo == {'on': {'r': 0, 'how': 'block'}, 'n': 2}, 'backing out of the round\'s card keeps the shard, set on the round', bo)
        check(blk >= 15, 'a card round with the shard set starts with 15 Block', blk)
        check(sp['on'] is None and sp['n'] == 1 and sp['elsewhere'] == [1, True], 'the round ending spends the shard; a round ended with the shard set on another keeps it', sp)

        # the three lineups
        lu = await pg.evaluate("""(() => { const out = {};
          const gf = wUmbGfTeam(), bk = wUmbBkTeam(), bl = wUmbBlFive();
          out.gf = [gf.roster.slice(0, 7).some(p => p.kind === 'behemoth' && p.n === 'The Corrupted Behemoth'), gf.shade, gf.roster[0].n];
          out.bk = [bk.roster.slice(0, 5).some(p => p.kind === 'hydra'), bk.shade, bk.roster[0].n];
          out.bl = [bl.roster.some(p => p.kind === 'djinn'), bl.shade];
          const txt = f => { f(); const t = document.getElementById('modalBox').textContent; document.getElementById('modal').hidden = true; MODAL_NOW = null; return t; };
          out.cards = [txt(() => wUmbGfCard(W_NADIR.gridiron, 'gridiron', [])).includes('The Corrupted Behemoth'), txt(() => wUmbBkCard(W_NADIR.court, 'court', [])).includes('The Corrupted Hydra'), txt(() => wUmbBlCard(W_NADIR.lanes, 'lanes', [])).includes('The Corrupted Djinn')];
          // (each rated in its engine as a superstar kind: its ratings are its own, not a stand-in's)
          const mk = (f, kind) => JSON.stringify(f(wMakePlayer({ kind, lvl: 5, n: 'x' }, 'opp')).r);
          out.stars = [mk(wSevenPlayer, 'behemoth') !== mk(wSevenPlayer, 'goblin'), mk(wCourtPlayer, 'hydra') !== mk(wCourtPlayer, 'goblin'), JSON.stringify(wLanesPlayer(wMakePlayer({ kind: 'djinn', lvl: 5, n: 'x' }, 'opp'))) !== JSON.stringify(wLanesPlayer(wMakePlayer({ kind: 'goblin', lvl: 5, n: 'x' }, 'opp')))];
          return out; })()""")
        check(lu['gf'][0] and lu['gf'][1] == 1 and lu['gf'][2] == 'Ossian Pyre', 'the Cinder Pit\'s seven field the Corrupted Behemoth, in shadow, the captain kept', lu)
        check(lu['bk'][0] and lu['bk'][1] == 1 and lu['bk'][2] == 'Vesper Gloam', 'the Black Court\'s five field the Corrupted Hydra, in shadow', lu)
        check(lu['bl'][0] and lu['bl'][1] == 1, 'the Drowned Lanes\' five field the Corrupted Djinn, in shadow', lu)
        check(all(lu['cards']) and all(lu['stars']), 'each of the three game cards names its legend, and each is rated in its engine', lu)

        # an old save with no legends keys, the journal, How to play
        old = await pg.evaluate("""(() => { const U = WG.umbral; delete U.legends; delete U.shards; delete U.shardOn; U.pieces = Object.keys(W_UMB_PIECES).slice(0, 6); U.sealed = 0; wSave(); return 1; })()""")
        await pg.evaluate("wStart(wLoadSave())")
        old = await pg.evaluate("""(() => { const U = WG.umbral, j = wUmbJournal();
          return { legends: U.legends, awake: ['kraken', 'phoenix', 'wyrm'].map(wUmbLegendAwake), journal: /Corrupted Kraken/.test(j[1]) && /Shards held: 0/.test(j[1]), cut: wUmbHexCut('finale') }; })()""")
        check(old['legends'] == {'kraken': 'awake', 'phoenix': 'awake'} and old['awake'] == [True, True, False] and old['journal'] and old['cut'] == 0, 'an old save with no legends keys loads: the legends past their stage wake, the journal lists them', old)
        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpUmbLegends'); return h ? h.textContent : ''; })()")
        check('Legend\'s Shard' in hp and 'Frost Wyrm' in hp and 'Behemoth' in hp, 'How to play explains the legends and the shards', hp[:200])
        check(await pg.evaluate("wAudit()") == [], 'the audit is still clean')
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nall ok' if not FAILS else f'\n{len(FAILS)} FAILED'); sys.exit(1 if FAILS else 0)

asyncio.run(main())
