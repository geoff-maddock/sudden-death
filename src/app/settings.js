/* ---------- the settings panel ---------- */
function showSettings() {
  const draw = () => {
    const T = MUS.theme ? THEMES[MUS.theme] : null;
    $('modalBox').innerHTML = `<header><h3>Settings</h3><button class="ghost" data-close>Close</button></header>
      <div class="setgrid">
        <label class="tog"><input type="checkbox" id="sMusic" ${SET.music ? 'checked' : ''}><span><b>Music</b><small>A theme for each act, plus a title theme. In a fight it speeds up when either side is near elimination.</small></span></label>
        <label class="rng"><span>Music volume</span><input type="range" id="sMvol" min="0" max="1" step=".05" value="${SET.mvol}" ${SET.music ? '' : 'disabled'}></label>
        <label class="tog"><input type="checkbox" id="sSfx" ${SET.sfx ? 'checked' : ''}><span><b>Sound effects</b><small>Hits, cards, dice, whistles, the crowd.</small></span></label>
        <label class="rng"><span>Difficulty for new runs</span><select id="sDiff">${DIFFS.map((D, k) => `<option value="${k}" ${SET.diff === k ? 'selected' : ''}>${D.n}</option>`).join('')}</select></label>
        <p class="hint" style="margin:-6px 12px 0;font-size:14px">${esc(DIFFS[SET.diff].desc)} You can also change it on the draft screen. A run keeps the difficulty it started on.</p>
        <label class="tog"><input type="checkbox" id="sTips" ${SET.tips ? 'checked' : ''}><span><b>Coach’s notes</b><small>One-time tips the first time each part of the game comes up. <button class="ghost" id="sTipsReset" style="font-size:15px;padding:2px 8px">Show them all again</button></small></span></label>
        <label class="rng"><span>Effects volume</span><input type="range" id="sSvol" min="0" max="1" step=".05" value="${SET.svol}" ${SET.sfx ? '' : 'disabled'}></label>
      </div>
      <p class="hint">${SET.music ? (T ? `Now playing: <b>${esc(T.name)}</b>${MUS.mode === 'hype' ? ' (exciting)' : MUS.mode === 'calm' ? ' (calm)' : ''}.` : 'Music starts after your next click or key press.') : 'Music is off.'} Settings are saved in this browser.</p>`;
    $('sMusic').onchange = e => { SET.music = e.target.checked; saveSettings(); if (!SET.music) musicStop(); else unlock(); draw(); syncSetBtn(); };
    $('sSfx').onchange = e => { SET.sfx = e.target.checked; SND.on = SET.sfx; saveSettings(); if (SET.sfx) sfx.coin(); draw(); syncSetBtn(); };
    $('sDiff').onchange = e => { SET.diff = +e.target.value; DR.diff = null; saveSettings(); draw(); };
    $('sTips').onchange = e => { SET.tips = e.target.checked; saveSettings(); };
    $('sTipsReset').onclick = e => { e.preventDefault(); TIPS_SEEN.length = 0; try { localStorage.removeItem(pkey('sd-tips')); } catch (x) { } SET.tips = true; saveSettings(); draw(); };
    $('sMvol').oninput = e => { SET.mvol = +e.target.value; saveSettings(); if (SND.ctx && MUS_BUS && MUS.timer) MUS_BUS.gain.setTargetAtTime(SET.mvol * .9 * MODE_VOL[MUS.mode || 'fight'], SND.ctx.currentTime, .1); };
    $('sSvol').oninput = e => { SET.svol = +e.target.value; saveSettings(); if (SFX_BUS) SFX_BUS.gain.value = SET.svol; };
    $('sSvol').onchange = () => sfx.card();
  };
  modal(''); draw();
}
function syncSetBtn() { const b = $('bSound'); if (!b) return; b.textContent = 'Settings'; b.setAttribute('aria-pressed', 'true'); b.title = `Music ${SET.music ? 'on' : 'off'}, sound effects ${SET.sfx ? 'on' : 'off'}`; }
(() => { const b = $('bSound'); if (b) { b.onclick = showSettings; syncSetBtn(); } })();

