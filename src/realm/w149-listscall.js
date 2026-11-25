/* w149: the plan and the read at the Tilting Lists (issue #117, phase 4). Before each of your courses in You ride, the
   herald's card under the lists: the rider you're about to meet (their kind, their skill and their mount), what their
   side has ridden this match (the counts of each guard, aim and pace, and their last courses with where each lance
   went), and how they usually ride (the mix their rider would ride by the odds). Your squire's word, in the Ride row
   and the note, now says what they have ridden and what it makes each of your three choices (wJT's jtWordWhy).
   Wraps: wListsRows (wW149ListsRows: the card), wListsHowHTML (wW149ListsHow: the plan's three choices, the card and
   reading the other rider), renderHelp (wW149RenderHelp: #wHelpListsCall). */

const W_JT_CARD = {
  aim: { shield: 'the shield', body: 'the body', helm: 'the helm' },
  at: { shield: 'broke on the shield', body: 'broke on the body', helm: 'broke on the helm', glance: 'glanced', miss: 'missed', mount: 'struck the mount', barrier: 'struck the barrier', low: 'struck low' },
};
$('wListsRowUp').insertAdjacentHTML('beforebegin', '<div class="wccrow" id="wListsRowCard"><span class="wccl" title="The herald\'s card: the rider you\'re about to meet, and how their side has ridden">Herald</span><span id="wListsCard" class="wjtcard"></span></div>');
// the card for side s, as HTML
function wListsCardHTML(s) {
  const K = wJT.card(s); if (!K) return '';
  const C = K.counts, U = K.usual, pct = v => Math.round(100 * v);
  const usualAim = Object.entries(U.aim).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= .15).map(([a]) => W_JT_CARD.aim[a]).join(' or ');
  const usual = `${U.angled >= .6 ? 'mostly angled' : U.angled <= .4 ? 'mostly square' : 'either guard'}, at ${usualAim || 'anything'}, ${U.gallop >= .6 ? 'mostly at a gallop' : U.gallop <= .4 ? 'mostly at a canter' : 'either pace'}`;
  const last = K.last.length ? K.last.slice().reverse().map(p => `<li><small>${p.tilt ? 'Tilt' : `H${p.heat + 1}·${p.course + 1}`}${p.n && p.n !== 'this rider' ? ` (${esc(p.n)})` : ''}</small> ${esc(W_JT_CARD.aim[p.aim])}, ${esc(p.guard)}, ${p.pace === 'gallop' ? 'a gallop' : 'a canter'}: ${esc(W_JT_CARD.at[p.at] || p.at)}</li>`).join('') : '';
  return `<b>${esc(K.name)}</b> <small>${esc(wKindName(K.kind) || '')}${K.kind ? ', ' : ''}${esc(K.skill)}, on a ${esc(K.mount)}</small>
    <span class="wjtcl" title="What their side has ridden this match">${esc(K.text)}</span>
    ${last ? `<ol class="wjtlast">${last}</ol>` : ''}
    <small class="hint" title="The mix their rider would ride by the odds now${K.skill === 'Squire' ? ' (a Squire picks anything)' : ''}">Their usual: ${esc(usual)} (angled ${pct(U.angled)}%, a gallop ${pct(U.gallop)}%).</small>`;
}
const wW149ListsRows = wListsRows;
wListsRows = function () {
  wW149ListsRows();
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null, on = !!(V && V.mode !== 'watch' && !V.yard && V.ph === 'plan' && V.sel);
  $('wListsRowCard').hidden = !on;
  if (on) $('wListsCard').innerHTML = wListsCardHTML(V.you);
};

/* ---------- How to play ---------- */
const wW149ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW149ListsHow() + `<p class="hint" id="wListsHowRead"><b>How the plan plays off itself.</b> An <b>angled</b> shield turns a lance on it into a glance, but leaves the body beside it open and the helm a bigger mark; a <b>square</b> shield takes the hit and keeps you on. Against an angled shield, aim for the <b>body</b>; against a square one, the <b>shield</b> breaks clean. The <b>helm</b> is two points on a small mark, and a lance that misses it leaves you reaching, so their lance rocks you more. A <b>gallop</b> hits harder and rocks them more, but your tip sways more and the mount tires; a <b>canter</b> aims steadier.</p>
  <p class="hint"><b>The herald's card</b> (under the lists before each of your courses): the rider you're about to meet, their kind, skill and mount; what their side has ridden this match (how often the shield was angled, where they aimed, how often they galloped) with their last courses and where each lance went; and how they usually ride.</p>
  <p class="hint"><b>Reading the other rider.</b> Your squire reads the card for you: the plan they suggest is the best by the odds against how the other side has ridden, and they say why ("they've had the shield angled both times, so aim for the body"). The other side reads you too, by skill: a <b>Squire</b> reads nothing; a <b>Knight</b> mixes its plans so it can't be read, and reads the score and the heat; an <b>Archmage</b> reads how you've ridden this match and rides against it. Ride the same plan every course and an Archmage will make you pay for it.</p>`;
};
const wW149RenderHelp = renderHelp;
renderHelp = function () {
  wW149RenderHelp();
  const after = $('wHelpListsTab') || $('wHelpLists'); if (!after || $('wHelpListsCall')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsCall"><b>The plan and the read.</b> Before each of your courses the herald's card shows the rider you're about to meet and how their side has ridden this match. Your squire's plan reads it and says why. An Archmage reads how you ride, so mix your plans against one; a Knight mixes its own so it can't be read.</p>`);
};
