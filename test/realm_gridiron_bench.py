# Realm gridiron bench: each side brings a bench (yours: your players who sit out, then call-ups); between plays a bench
# player comes on for a tired one, in every place the tired one had, and the bench rests; potions (a Stamina Draught
# for one player, a Second Wind for the seven) give stamina back, one a play, from your bag; a few powers give stamina
# back; the coaches swap by skill; every swap, potion and power goes in the play log; only those who played count as
# the seven at the end. Shops, How to play, the audit. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1400, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wGridSquad === 'function'")
        await pg.evaluate("SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        # eight of your own: one sits out of the seven
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy', 'elf', 'witch', 'vampire']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)

        # ---------- items and shops ----------
        check(await pg.evaluate("DB.items.draught.price === 20 && DB.items.secondwind.price === 45 && Object.values(DB.shops).every(s => s.draught && s.secondwind)"),
              'the Stamina Draught and the Second Wind are sold in every store')
        check(await pg.evaluate("Object.values(DB.chests).some(c => c.items && (c.items.draught || c.items.secondwind))"), 'and found in chests')

        # ---------- the squads ----------
        sq = await pg.evaluate("(() => { const s = wGridSquad(), S = WG.seven; return { n: s.team.roster.length, ids: s.ids, seven: S.ids.slice(), out: wRoster().filter(p => !S.ids.includes(p.id)).map(p => p.id) }; })()")
        check(sq['n'] == 10 and sq['ids'][:7] == sq['seven'], 'your squad is the seven and a bench of three', sq)
        check(len(sq['out']) >= 1 and all(i in sq['ids'][7:] for i in sq['out']), 'your players sitting out are on the bench first, then call-ups', sq)
        opp = await pg.evaluate("wGridOpp('local', 1).roster.length")
        check(opp == 10, 'their squad has a bench of three too', opp)
        nums = await pg.evaluate("""(() => { const out = []; for (let i = 0; i < 20; i++) { const o = wGridOpp(pick(['local', ...Object.keys(CLUBS)]), 1 + i % 3), s = wGridSquad(o);
          for (const t of [o, s.team]) out.push(new Set(t.roster.map(p => p.num)).size === t.roster.length); } return out.every(Boolean); })()""")
        check(nums, 'no two players on a side wear the same number')
        kept = await pg.evaluate("""(() => { const club = Object.keys(CLUBS)[0], B = wGfg(); B.opp = {};
          const full = wGridOpp(club, 2), seven = JSON.parse(JSON.stringify(B.opp[club])); seven.team.roster = seven.team.roster.slice(0, 7); B.opp[club] = seven;
          const again = wGridOpp(club, 2); return { n: again.roster.length, same: again.roster.slice(0, 7).map(p => p.n).join() === full.roster.slice(0, 7).map(p => p.n).join(), cached: B.opp[club].team.roster.length }; })()""")
        check(kept['n'] == 10 and kept['same'] and kept['cached'] == 10, "a rival's seven saved before benches keeps its players, and gains a bench", kept)

        # ---------- a game: swaps ----------
        await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        b = await pg.evaluate("wGF.bench()")
        check(len(b['on']) == 7 and len(b['bench']) == 3 and b['between'], 'in a game: seven on, three on the bench, and swaps open between plays', b)
        check(await pg.evaluate("!!document.querySelector('#wGridBench select[data-gin]')"), 'the panel shows your bench with a swap list')
        sw = await pg.evaluate("""(() => { const b = wGF.bench(), out = b.on[0], inn = b.bench[0]; wGF.G.stam[wGF.G.teams.indexOf(wGF.G.teams[0])][out.ri] = 20;
          const msg = wGridSwap(out.ri, inn.ri), a = wGF.bench(), now = a.on.find(p => p.ri === inn.ri);
          return { msg, out, inn, now, offBench: a.bench.some(p => p.ri === out.ri), notes: wGF.notes() }; })()""")
        check(sw['msg'] == '' and sw['now'] and sw['offBench'], 'a bench player comes on for a tired one, who goes to the bench', sw)
        check(sw['now'] and sw['now']['off'] == sw['out']['off'] and sw['now']['def'] == sw['out']['def'], 'they take every place the tired one had, offense and defense', sw)
        check(any(n['k'] == 'swap' and sw['inn']['n'] in n['msg'] for n in sw['notes']), 'the swap waits for the next play\'s log line', sw['notes'])

        # ---------- potions ----------
        await pg.evaluate("WG.items.draught = 2; WG.items.secondwind = 1")
        pot = await pg.evaluate("""(() => { const b = wGF.bench(), p = b.on[1], s0 = wGF.G.stam[0][p.ri]; wGF.G.stam[0][p.ri] = 30;
          const msg = wGridPotion('draught', p.ri); return { msg, st: wGF.G.stam[0][p.ri], left: WG.items.draught,
          again: wGridPotion('secondwind', null), wind: WG.items.secondwind }; })()""")
        check(pot['msg'] == '' and pot['st'] == 70 and pot['left'] == 1, 'a Stamina Draught gives one player 40 stamina back, and leaves the bag', pot)
        check(pot['again'] == 'One potion a play.' and pot['wind'] == 1, 'one potion a play', pot)
        check(await pg.evaluate("wGridPotion('draught', 99)") != '', 'not to someone off the field')

        # ---------- a play: the log, and the bench resting ----------
        rest0 = await pg.evaluate("wGF.G.stam[0][%d]" % sw['out']['ri'])
        await pg.evaluate("wGF.setMode('watch')")
        await pg.wait_for_function("wGF.G.drive && (wGF.G.drives || []).concat([wGF.G.drive]).some(d => d.plays.some(e => e.notes))", timeout=60000)
        e = await pg.evaluate("(wGF.G.drives || []).concat([wGF.G.drive]).flatMap(d => d.plays).find(e => e.notes)")
        ks = [n['k'] for n in e['notes']]
        check('swap' in ks and 'rest' in ks, 'the next play\'s log line carries the swap and the potion', e['notes'])
        log = await pg.evaluate("document.getElementById('wGridLog').innerHTML")
        check('Stamina Draught' in log and 'comes on for' in log, 'and the log shows them', log[:400])
        await pg.wait_for_function("wGF.phase === 'call' || wGF.phase === 'post'", timeout=30000)
        rest1 = await pg.evaluate("wGF.G.stam[0][%d]" % sw['out']['ri'])
        check(rest1 > rest0, 'the bench rests', [rest0, rest1])

        # ---------- one potion between two plays, in the pause after a play and at the call both ----------
        await pg.evaluate("WG.items.draught = 9; WG.items.secondwind = 9")
        # (a kickoff or the half between the two starts it over: a new drive may have a potion of its own)
        # (each beat of the game is heard as it comes, through wGF.onPhase: the pause after a play is short, and a timer
        # looking every few milliseconds can miss it on a busy machine)
        await pg.evaluate("""(() => { const prev = wGF.onPhase; window.__phl = [];
          wGF.onPhase = ph => { if (prev) prev(ph); for (const f of __phl.slice()) if (f()) __phl.splice(__phl.indexOf(f), 1); };
          window.__beats = f => new Promise(res => { const g = () => { const r = f(); if (r) res(r); return r; }; if (!g()) __phl.push(g); }); })()""")
        one = await pg.evaluate("""(() => { let out = {}; return __beats(() => {
          const ph = wGF.phase;
          if ('post' in out && !('call' in out) && (ph === 'kickoff' || ph === 'half')) out = {};
          if (!('post' in out) && ph === 'post' && wGF.bench().between) out.post = wGridPotion('draught', wGF.bench().on[0].ri);
          else if ('post' in out && !('call' in out) && ph === 'call') { wGF.pause(true); out.call = wGridPotion('secondwind', null); out.msg = WGB.msg; wGF.pause(false); }
          else if ('call' in out && !('next' in out) && ph === 'post') { out.next = wGridPotion('secondwind', null); out.cleared = WGB.msg; }
          return 'next' in out ? out : null; }); })()""")
        check(one['post'] == '' and one['call'] == 'One potion a play.', 'a potion in the pause after a play, and none again at the call before the next one', one)
        check(one['next'] == '', 'after that play, one more may be given', one)
        await pg.wait_for_function("wGF.phase === 'call'", timeout=60000)
        try: await pg.wait_for_function("WGB.msg === ''", timeout=5000)
        except Exception: pass
        check(await pg.evaluate("WGB.msg") == '' and 'One potion a play' not in await pg.evaluate("document.getElementById('wGridBench').textContent"),
              'the refusal under the bench is gone by the next call')

        # ---------- Overgrowth gives stamina back on every play it lasts ----------
        await pg.wait_for_function("wGF.phase === 'call'", timeout=60000)
        og = await pg.evaluate("""new Promise(res => { const G = wGF.G; wGF.pause(true);
          G.zones = (G.zones || []).filter(z => z.id !== 'overgrowth').concat([{ id: 'overgrowth', n: 'Overgrowth', side: 0, left: 3 }]);
          const d0 = (G.drives || []).length, p0 = G.drive.plays.length, drive = G.drive; wGF.pause(false);
          const t = setInterval(() => { if (G.zones.some(z => z.id === 'overgrowth')) return; clearInterval(t);
            const plays = drive.plays.slice(p0), later = (G.drives || []).slice(d0).concat([G.drive]).filter(d => d !== drive).flatMap(d => d.plays);
            const notes = plays.concat(later).flatMap(e => e.notes || []).concat(wGF.notes()).filter(n => /Overgrowth/.test(n.msg));
            res({ plays: plays.length, rests: notes.length }); }, 20); })""")
        check(og['rests'] == og['plays'] and og['plays'] >= 1, 'Overgrowth gives stamina back on every play it is on the field, the last one too', og)

        # ---------- powers in the log; a power that gives stamina back ----------
        await pg.wait_for_function("(wGF.G.drives || []).concat([wGF.G.drive]).some(d => d.plays.some(e => e.pw))", timeout=120000)
        log = await pg.evaluate("document.getElementById('wGridLog').innerHTML")
        check('wgnotepow' in log, 'every power cast shows in the play log, with its team', log[:300])
        pw = await pg.evaluate("""(() => { const B = wGF.powerBook; return { boulder: B.troll.def.desc, mesmer: B.vampire.def.desc, hex: B.witch.off.desc, grass: B.elf.ult.desc }; })()""")
        check(all('stamina back' in v for v in pw.values()), 'the troll, vampire, witch and elf powers give stamina back', pw)
        await pg.evaluate("wGF.pause(true)")
        got = await pg.evaluate("""(() => { const G = wGF.G, T = G.teams[0];
          // a witch in the seven, on offense, with mana: cast Hex with the call
          const w = T.roster.findIndex(p => p.kind === 'witch'), on = wGF.bench().on.map(p => p.ri);
          if (!on.includes(w)) { const out = on.find(i => i !== T.off.QB); const b = wGF.bench(); if (b.between) wGF.swap(out, w); }
          return { w, on: wGF.bench().on.map(p => p.ri).includes(w) }; })()""")
        check(got['on'], 'a witch can be put on the field', got)
        await pg.evaluate("wGF.pause(false); wGF.setMode('call')")
        cast = await pg.evaluate("""new Promise(res => { let n = 0; const t = setInterval(() => {
          const G = wGF.G; if (!G || ++n > 4000) { clearInterval(t); return res(null); }
          if (wGF.phase !== 'call') return;
          if (wGF.yourBall) { G.mana[0] = 6; for (let i = 0; i < G.stam[0].length; i++) G.stam[0][i] = Math.min(G.stam[0][i], 60);
            const o = wGF.powers().list.find(x => x.id === 'hex' && x.ok); if (o) { const before = G.stam[0].slice(); wGF.pickPower(o.key); wGF.call('short') || wGF.call(Object.keys(wGF.plays)[0]);
              clearInterval(t); const w = setInterval(() => { if (wGF.phase === 'call') return; clearInterval(w); res({ before, cast: wGF.powers().cast, notes: wGF.notes() }); }, 20); return; } }
          if (wGF.yourBall) wGF.call(Object.keys(wGF.plays)[0]); else wGF.call(Object.keys(wGF.defs)[0]);
        }, 50); })""")
        check(cast and any(n['k'] == 'rest' and 'Hex' in n['msg'] for n in cast['notes']), 'the witch\'s Hex gives the seven stamina back, and it is in the notes', cast and cast['notes'])

        # ---------- a stale swap says what's wrong; nothing after the last play ----------
        stale = await pg.evaluate("""new Promise(res => { const t = setInterval(() => { if (wGF.phase !== 'call' && wGF.phase !== 'post') return; clearInterval(t);
          const b = wGF.bench(); res({ off: wGridSwap(b.bench[0].ri, b.bench[1].ri), on: wGridSwap(b.on[0].ri, b.on[1].ri) }); }, 20); })""")
        check(stale['off'] == 'That player is already off the field.' and stale['on'] == 'That player is already on the field.', 'a swap with a player who has moved says so', stale)
        await pg.evaluate("WG.items.secondwind = 1; (() => { const G = wGF.G; G.half = 2; G.clock = 1; G.score = [28, 0]; })(); wGF.setMode('watch')")
        last = await pg.evaluate("""__beats(() => wGF.phase !== 'post' || wGF.G.clock > 0 ? null
          : { msg: wGridPotion('secondwind', null), left: WG.items.secondwind, between: wGF.bench().between })""")
        check(last['msg'] == 'Potions are given between plays, and not after the last one.' and last['left'] == 1 and not last['between'],
              'after the last play of the game, no potion is given, and none is lost', last)
        await pg.wait_for_function("wGF.phase === 'over'", timeout=60000)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the coaches swap ----------
        cpu = await pg.evaluate("""(() => { const teams = [wGridSquad().team, wGridOpp('local', 1)]; let swaps = [0, 0], played = [0, 0];
          for (let i = 0; i < 4; i++) { const g = wGF.simGame({ teams: JSON.parse(JSON.stringify(teams)), skill: [2, 2] });
            for (const b of g.box) if (b.ri >= 7 && b.played) played[b.side]++; }
          return { played }; })()""")
        check(cpu['played'][0] > 0 and cpu['played'][1] > 0, 'the coaches bring players off the bench for both sides', cpu)

        # ---------- who played is paid as the seven ----------
        await pg.evaluate("wGridConcede ? 0 : 0")
        pay = await pg.evaluate("""(() => { const B = wGfg(), out = wRoster().find(p => !WG.seven.ids.includes(p.id)), ids = WG.seven.ids.slice().concat([out.id, null, null]);
          B.live = { world: { kind: 'gfgame', club: 'local', tier: 1, how: 'sim', day: WG.dayAbs, name: 'X', ids, cup: false }, snap: null };
          const box = ids.map((id, ri) => ({ side: 0, ri, n: '', kind: '', line: ri === 0 ? { ry: 10 } : {}, played: ri < 7 })), x0 = out.xp, g0 = (WG.gfstats || {})[out.id];
          WGF = null; const msg = wGridSettle('win', 7, 0, box, 2);
          return { msg, sat: (WG.gfstats || {})[out.id] || null, g0: g0 || null, xp: out.xp - x0 }; })()""")
        check(pay['sat'] == pay['g0'] and 'everyone who played' in pay['msg'], 'a bench player who never came on gets no game in their stats, and the bench share of XP', pay)
        await pg.evaluate(CLOSE_ALL)

        # ---------- How to play, the audit ----------
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGfBench'); return h ? h.textContent : ''; })()")
        check('bench' in help_ and 'Stamina Draught' in help_ and 'Second Wind' in help_, 'How to play explains the bench and the potions', help_)
        how = await pg.evaluate("(renderHelp(), document.getElementById('wGridHow').textContent)")
        check('Tired players' in how, 'and How it works, under the field')
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
