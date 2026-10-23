/* ================= catalog (How to play) ================= */
function renderCatalog() {
  const el = document.getElementById('catalog'); if (!el) return;
  const owners = id => { const o = []; for (const t of Object.values(TEAMS)) for (const p of t.roster) if (p.bat === id || p.run === id || p.field === id) o.push(`${p.n} <span class="faint">(${esc(t.short)})</span>`); return o.join(', ') || '—'; };
  const kindOf = id => { for (const t of Object.values(TEAMS)) for (const p of t.roster) if (p.bat === id || p.run === id || p.field === id) return p.race; return ''; };
  const TIER = {
    axe: 'Sweet spot bonus +60% → +78% → +96%; power +25% → +33% → +40%.', crush: 'Power +50% → +65% → +80%.', sticky: 'Sweet spot +40% → +52% → +64%.', pact: 'Power +40% → +52% → +64%.',
    dispel: 'Sweet spot +15% → +20% → +24%.', gaze: 'Pitch slows 30% → 39% → 48%.', shriek: 'Scatter ×3 → ×3.6 → ×4.2.', seismic: 'Cost 2 → 1.', bunt: 'Tier III: no stamina cost.', eagle: 'Tier III: no stamina cost.', undying: 'Tier III: no stamina cost.',
    shadowstep: 'Cost 2 → 1.', sprint: 'Lasts 2.5 → 3.3 → 4 s.', fleet: 'Lasts 3 → 3.9 → 4.8 s.', glide: 'Lasts 3 → 3.9 → 4.8 s.', swarm: 'Lasts 2.5 → 3.3 → 4 s; cost 2 → 1.', invis: 'Lasts 3 → 3.9 → 4.8 s; cost 2 → 1.', bullrush: 'Fielder needs 11+ → 13+ → 15+ to hold the tag.', stoneskin: 'Passive; no tiers.',
    devour: 'Needs 12/16 → 10/14 → 8/12; cost 3 → 2 → 1.', pounce: 'Leap 45 → 58 → 72 ft.', boulder: 'Tier III: no stamina cost.', quake: 'Stumble 1.3 → 1.7 → 2.1 s; cost 2 → 1.', flight: 'Airborne 4 → 5.2 → 6.4 s.', haunt: 'Flees 1.2 → 1.6 → 1.9 s.',
    mesmer: 'Freeze 1.8 → 2.3 → 2.9 s; cost 2 → 1.', telek: 'Tier III: no stamina cost.', petrify: 'Needs 10+ → 8+ → 6+; stone 3 → 3.9 → 4.8 s; cost 2 → 1.', web: 'Snare 3 → 3.9 → 4.8 s.', block: 'Tier III: no stamina cost.',
  };
  const abTable = type => `<div class="tablewrap"><table class="cat"><thead><tr><th>Power</th><th>Mana</th><th>Who has it</th><th>What it does</th><th>Tier II / III</th></tr></thead><tbody>${Object.entries(AB).filter(([, A]) => A.type === type).map(([id, A]) => `<tr><td><b>${esc(A.name)}</b><div class="faint">${esc(kindOf(id))}</div></td><td class="mn">${A.cost ? '◆'.repeat(A.cost) : 'passive'}</td><td>${owners(id)}</td><td>${esc(A.desc)}</td><td class="faint">${esc(TIER[id] || '')}</td></tr>`).join('')}</tbody></table></div>`;
  const pitchRows = Object.entries(PITCHES).map(([k, q]) => { const who = Object.values(TEAMS).flatMap(t => t.roster).filter(p => p.pitches && p.pitches.includes(k)).map(p => p.n).join(', '); return `<tr><td><b>${esc(q.name)}</b></td><td class="mn">${q.cost ? '◆'.repeat(q.cost) : '—'}</td><td>${(q.T * PITCH_SCALE).toFixed(2)} s</td><td>${Math.abs(q.bx) + Math.abs(q.bh) > .5 ? 'big' : Math.abs(q.bx) + Math.abs(q.bh) > .2 ? 'some' : 'little'}</td><td>${q.ctrl <= .12 ? 'pinpoint' : q.ctrl <= .15 ? 'good' : q.ctrl <= .18 ? 'fair' : 'wild'}</td><td>${esc(who || 'free agents')}</td><td>${esc(q.desc)}</td></tr>`; }).join('');
  el.innerHTML = `
  <h3>Catalog</h3>
  <p class="lede2">Every number the game uses, where it matters, and how it grows. <span class="faint">Jump to:</span>
    ${[['cat-stats', 'Stats'], ['cat-ult', 'Ultimates'], ['cat-hp', 'Health'], ['cat-bat', 'Batting'], ['cat-run', 'Running'], ['cat-field', 'Fielding'], ['cat-skill', 'Skills'], ['cat-club', 'Club magic'], ['cat-pitch', 'Pitches'], ['cat-fat', 'Fatigue'], ['cat-hus', 'Hustle'], ['cat-items', 'Items'], ['cat-up', 'Upgrades']].map(([id, n]) => `<button class="buy" data-scroll="${id}">${n}</button>`).join(' ')}</p>

  <h4 id="cat-stats">Stats</h4>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Stat</th><th>At the plate</th><th>On the bases</th><th>In the field</th><th>On the mound</th></tr></thead><tbody>
    <tr><td><b>POW</b> power</td><td>Exit speed: power ×(0.55 + 0.06 per point). Decides homers.</td><td>—</td><td>—</td><td>+1.5 max stamina per point. Helps recovery between season games.</td></tr>
    <tr><td><b>CON</b> contact</td><td>Swing circle radius 0.3 ft + 0.022 per point; timing window 85 ms + 7 per point. Added to the Fireball scorch roll.</td><td>—</td><td>—</td><td>—</td></tr>
    <tr><td><b>SPD</b> speed</td><td>Beats out bunts and grounders.</td><td>Running speed 17 + 1.5 ft/s per point.</td><td>Range: 13 + 1.25 ft/s per point.</td><td>—</td></tr>
    <tr><td><b>ARM</b> arm</td><td>—</td><td>—</td><td>Throw speed 74 + 7 ft/s per point.</td><td>Accuracy: every point under 10 adds 4% scatter. +4 max stamina per point. Helps recovery.</td></tr>
    <tr><td><b>FLD</b> fielding</td><td>—</td><td>—</td><td>Bobble chance: 1.1% per point under 10 on fly balls, 0.6% on grounders. Out of position: −2.</td><td>—</td></tr>
    <tr><td><b>3 or less</b></td><td colspan="4">A weak spot, and the lower the worse. ${STATS.map(k => `<b>${k.toUpperCase()}</b>: ${esc(WEAK_TXT[k])}`).join(' ')}</td></tr>
    <tr><td><b>Stamina</b></td><td colspan="4">Max = 45 + 4×ARM + 1.5×POW (+25 with the Amulet). Below half, a player starts to suffer: see Fatigue.</td></tr>
  </tbody></table></div>

  <h4 id="cat-ult">Ultimates ★ (one per creature, once a game, 3 mana)</h4>
  <p class="sub">An ultimate appears where its owner acts: as a batting stance (fires when the pitch is thrown), as a pitch, in the runner's spell list, or in the fielding list. Field conditions last ${ULT_TURNS} at-bats or until the half-inning ends. They are listed under the count with the at-bats left. The CPU uses its ultimates too, and so does Auto powers.</p>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Ultimate</th><th>Creature</th><th>Used</th><th>Who has it</th><th>What it does</th></tr></thead><tbody>${Object.entries(ULT).map(([id, u]) => `<tr><td><b>${esc(AB[id].name)}</b></td><td>${esc(TEMPL[u.kind] ? TEMPL[u.kind].race : u.kind)}</td><td>${{ bat: 'Batting stance', pitch: 'Pitch', run: 'Running', field: 'Fielding' }[u.role]}</td><td>${Object.values(TEAMS).flatMap(t => t.roster).filter(p => p.ult === id).map(p => esc(p.n)).join(', ')}</td><td>${esc(u.desc)}</td></tr>`).join('')}</tbody></table></div>

  <h4 id="cat-hp">Health and injuries</h4>
  <p class="sub">Health runs 0 to 100, separately from stamina (red bar under the green one). Below 60 a player is <b>hurt</b>: up to −30% running speed, −25% fielding range, a smaller and weaker swing, and more bobbles, all growing as health drops. At 0 he's <b>knocked out</b> for 2 to 4 at-bats: a knocked-out batter is skipped in the order, a knocked-out fielder lies where he fell, and a knocked-out runner is carried off (out). A knocked-out pitcher is replaced from the bullpen, or staggers on if there's nobody left.</p>
  <div class="tablewrap"><table class="cat"><thead><tr><th>How players get hurt</th><th>Health lost</th></tr></thead><tbody>
    <tr><td>Hit by a pitch (a pitch well inside that the batter takes)</td><td>10 to 14; magic pitches 16, fireball 22, meteor 26. Can't knock out. The batter takes first.</td></tr>
    <tr><td>Trampled by Bull Rush, Barrel Through or Stampede</td><td>18</td></tr>
    <tr><td>Burned in an Inferno fire, or catching one on the fly</td><td>8 for each second or so in the flames; 12 for the catch. Kobolds are fireproof, golems take half, trolls double.</td></tr>
    <tr><td>Plague Cloud gas (infielders, each play)</td><td>Knocked out on a failed d20 + POW/2 vs 13. Undead and golems are immune.</td></tr>
    <tr><td>Swallowed by Devour</td><td>35, as well as being out</td></tr>
    <tr><td>Flattened by Block the Plate · crashing into the wall on a robbery (20%) · diving catch (12%) · crater trip (35%) · quake tumble (15%) · fireball scorch (50%) · choking on a runner</td><td>8 to 16</td></tr>
  </tbody></table></div>
  <p class="sub">Recovery: +3 health each half-inning (trolls +8; the Troll-Blood Salve adds 5). In a season, health carries between games: +40 after a game played (trolls +20 more), +60 on the bench, +30 from the shrine's recovery ritual.</p>

  <h4 id="cat-bat">Batting stances and bat spells</h4>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Stance</th><th>Mana</th><th>Effect</th><th>Stamina per swing</th></tr></thead><tbody>
    <tr><td><b>Normal</b></td><td>—</td><td>Standard swing circle and power.</td><td>3.5</td></tr>
    <tr><td><b>Power swing</b></td><td>—</td><td>Circle ×0.78, power ×1.25.</td><td>4.5</td></tr>
    <tr><td><b>Contact swing</b></td><td>—</td><td>Circle ×1.25, power ×0.8.</td><td>2.5</td></tr>
  </tbody></table></div>
  ${abTable('bat')}
  <p class="sub">Timing: swinging early pulls the ball, late pushes it the opposite way. Getting under the ball (cursor below it) lifts it; over it drives grounders.</p>

  <h4 id="cat-run">Running spells</h4>${abTable('run')}
  <h4 id="cat-field">Fielding spells</h4>${abTable('field')}
  <h4 id="cat-skill">Physical skills</h4>
  <p class="sub">Every player without magic of a kind gets a physical skill for it instead. Skills cost no mana but drain the player's stamina (shown ⚡ in yellow), so a tired player can't lean on them forever; an exhausted one can't use them at all. Batting skills appear as a stance before the pitch; running and fielding skills appear in the same spell lists (Q/E, G). Undead and constructs tire at half rate here too; the Hourglass does not make skills free.</p>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Skill</th><th>Stamina</th><th>Who gets it</th><th>Effect</th></tr></thead><tbody>
    ${[['uppercut', 'Batters without a bat spell and POW 8+'], ['choke', '…else CON 7+'], ['slap', '…else SPD 8+'], ['grip', '…anyone else'], ['burst', 'Runners without a running spell and SPD 7+'], ['barrel', '…else POW 8+'], ['hookslide', '…anyone else'], ['rocket', 'Fielders without a fielding spell and ARM 8+ (usable while holding the ball)'], ['dive', '…else FLD 8+ or SPD 8+ (while chasing)'], ['leap', '…anyone else (while chasing a ball in the air)']].map(([id, who]) => `<tr><td><b>${esc(AB[id].name)}</b></td><td class="stm">⚡${AB[id].stam}</td><td>${esc(who)}</td><td>${esc(AB[id].desc)}</td></tr>`).join('')}
  </tbody></table></div>
  <h4 id="cat-club">Club magic (every team)</h4>
  <p class="sub">Cast from the dugout by the club's shaman. Any runner or any fielding moment can use them, each once per play; they cost mana but no stamina, and the CPU uses them too.</p>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Spell</th><th>Mana</th><th>Side</th><th>What it does</th></tr></thead><tbody>${['haste', 'ghostslide', 'gust', 'roots'].map(id => `<tr><td><b>${esc(AB[id].name)}</b></td><td class="mn">${'◆'.repeat(AB[id].cost)}</td><td>${AB[id].type === 'trun' ? 'Running' : 'Fielding'}</td><td>${esc(AB[id].desc)}</td></tr>`).join('')}</tbody></table></div>

  <h4 id="cat-pitch">Pitches</h4>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Pitch</th><th>Mana</th><th>To the plate</th><th>Break</th><th>Control</th><th>Thrown by</th><th>Notes</th></tr></thead><tbody>${pitchRows}</tbody></table></div>
  <p class="sub">Magic pitch tiers: Tier II costs 1 less mana; Tier III also lands 25% more accurately and costs no stamina for the magic.</p>

  <h4 id="cat-fat">Fatigue</h4>
  <div class="tablewrap"><table class="cat"><thead><tr><th>What tires you</th><th>Stamina cost</th></tr></thead><tbody>
    <tr><td>Each pitch</td><td>1, +0.3 for a pitch under 0.6 s, +0.6 for one under 0.5 s (Heater, Fireball)</td></tr>
    <tr><td>Magic pitch</td><td>+1.6 per mana it costs</td></tr>
    <tr><td>Each swing</td><td>3.5 normal, 4.5 power, 2.5 contact</td></tr>
    <tr><td>Bat spell</td><td>4 per mana spent</td></tr>
    <tr><td>Running or fielding spell</td><td>3 per mana spent</td></tr>
  </tbody></table></div>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Below half stamina</th><th>Effect at empty (scales from half)</th></tr></thead><tbody>
    <tr><td>Pitcher</td><td>Pitches 22% slower to the plate, break −40%, scatter +180%</td></tr>
    <tr><td>Batter</td><td>Swing circle −25%, power −20%, timing window −20%</td></tr>
    <tr><td>Runner / fielder</td><td>Running speed −25% / range −20%</td></tr>
  </tbody></table></div>
  <div class="tablewrap"><table class="cat"><thead><tr><th>What helps</th><th>How</th></tr></thead><tbody>
    <tr><td>Undead and constructs</td><td>Golems, skeletons, zombies, liches and wraiths tire at half rate.</td></tr>
    <tr><td>Amulet of Endurance</td><td>+25 max stamina, 40% less fatigue from everything, faster recovery between games.</td></tr>
    <tr><td>Hourglass of the Undying</td><td>Swings and spells cost no stamina (pitches still do).</td></tr>
    <tr><td>Tier III powers</td><td>That power costs no stamina.</td></tr>
    <tr><td>The bullpen</td><td>Press C (Player 2: \\, gamepad Y) to bring in a fresh pitcher from the bench.</td></tr>
    <tr><td>Rest (season)</td><td>Stamina left at the final out carries to the next game. Benched players regain 28 more, everyone regains 12 + (POW + ARM) ÷ 5. The shrine's recovery ritual gives +35.</td></tr>
  </tbody></table></div>

  <h4 id="cat-hus">Hustle (effort)</h4>
  <p class="sub">Tap the hustle key (Player 1 <kbd>V</kbd>, Player 2 <kbd>Right Ctrl</kbd>, gamepad triggers) to pour stamina into what you're doing. Each tap adds to a charge meter (shown on the portrait, or as a gold ring on the field) and costs 0.8 stamina. The charge drains away in about 3 seconds if you stop tapping. A winded player gets less from each tap; an exhausted one gets nothing. The Hourglass does not make hustle free.</p>
  <div class="tablewrap"><table class="cat"><thead><tr><th>When</th><th>Who</th><th>At full charge</th><th>Trade-off</th></tr></thead><tbody>
    <tr><td>Before your swing</td><td>Batter</td><td>+30% power</td><td>Swing circle −12%</td></tr>
    <tr><td>Choosing and winding up</td><td>Pitcher</td><td>Pitch 13% faster to the plate</td><td>Scatter +60%</td></tr>
    <tr><td>During a play</td><td>Picked runner</td><td>+45% running speed</td><td>Stamina</td></tr>
    <tr><td>During a play</td><td>Fielder on the ball</td><td>+35% range and +30% throw speed</td><td>Stamina</td></tr>
  </tbody></table></div>
  <p class="sub">The CPU hustles too: pitchers with two strikes, runners in close races, and on Knight and Archmage the fielder chasing the ball.</p>

  <h4 id="cat-items">Magic items</h4>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Item</th><th>Price</th><th>Effect</th></tr></thead><tbody>${Object.values(ITEMS).map(it => `<tr><td><b>${esc(it.name)}</b></td><td>${it.price} gold</td><td>${esc(it.desc)}</td></tr>`).join('')}</tbody></table></div>
  <p class="sub">One item per player. Items show up three at a time in the season market.</p>

  <h4 id="cat-up">Upgrades (season mode)</h4>
  <div class="tablewrap"><table class="cat"><thead><tr><th>Upgrade</th><th>Paid with</th><th>Effect</th></tr></thead><tbody>
    <tr><td><b>Level up</b></td><td>XP</td><td>Levels at 20, 60, 120, 200… XP. Each level gives 2 stat points; stats cap at ${STAT_CAP}. XP per game: 8, +6 per hit, +10 per homer, +4 per run, +5 per strikeout, +2 per fielding out, +5 for a win.</td></tr>
    <tr><td><b>Private coaching</b></td><td>20 gold</td><td>+25 XP to one player.</td></tr>
    <tr><td><b>Enhance a power</b></td><td>3 essence (II), 6 essence (III)</td><td>Stronger effects and better dice (see the Tier columns above); 2- and 3-mana powers get cheaper; Tier III powers cost no stamina.</td></tr>
    <tr><td><b>Deepen the mana well</b></td><td>6 essence</td><td>+1 starting mana every game, up to +2.</td></tr>
    <tr><td><b>Recovery ritual</b></td><td>25 gold</td><td>Everyone regains 35 stamina. Once per week.</td></tr>
    <tr><td><b>Free agents</b></td><td>Gold (by value)</td><td>New players for the bench (max ${BENCH_MAX}). Bench pitchers form your bullpen.</td></tr>
    <tr><td><b>Trades</b></td><td>A player</td><td>Swap one of yours for one from a club you haven't played. They arrive fresh.</td></tr>
    <tr><td><b>Earning</b></td><td>—</td><td>Gold: 40 per win, 15 per loss, +3 per run, +100 for the Cup. Essence: leftover mana at the final out, +1 per game, +1 per win. Mana in a game: start at 2 (+ mana well + chalice), +1 per half-inning, +1 per hit for the batting side, +1 per strikeout for the pitcher; max 6.</td></tr>
  </tbody></table></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-scroll]'); if (!b) return; const t = document.getElementById(b.dataset.scroll); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
renderCatalog();

document.getElementById('bTips').addEventListener('click', () => setHints(!HINTS));
setHints(HINTS);
