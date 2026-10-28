---
name: single-file-game-hardening
description: Checklist and fixes for the failure modes that bite large single-file HTML/canvas games built from concatenated source parts and hosted in sandboxed frames (claude.ai artifacts, iframes, static hosts). Use when a browser game shows blurry or smeared graphics, a button "does nothing", tooltips or features silently stop working after adding code, saves leak between players, mid-game state will not restore, or before shipping a new system in such a game.
---

# Hardening a single-file browser game

These are the bugs that actually happened while building *Sudden Death*, a roughly 520 KB single-file canvas deckbuilder, and the fixes that held. Each one was silent: no exception, just wrong behaviour.

## 1. Duplicate global names

**Symptom.** A feature stops working everywhere after an unrelated addition. In *Sudden Death*, tooltips died because a new `showTip()` for onboarding tips replaced the tooltip `showTip()`.

**Cause.** Concatenated parts share one global scope, and a later `function x` silently wins.

**Fix.** Fail the build on duplicates:

```bash
dups=$(grep -oE "^(async )?function [A-Za-z_\$][A-Za-z0-9_\$]*|^(const|let|var) [A-Za-z_\$][A-Za-z0-9_\$]*" build/all.js | awk '{print $NF}' | sort | uniq -d)
[ -n "$dups" ] && { echo "Duplicate global names: $dups" >&2; exit 1; }
```

To extend a function on purpose, reassign it (`f = function () { _f(); … }`) rather than redeclaring it.

## 2. Native dialogs in sandboxed frames

**Symptom.** "Forfeit" or "Delete" does nothing on the hosted page but works locally.

**Cause.** Sandboxed iframes (including claude.ai artifacts) block `alert`/`confirm`/`prompt`. `confirm()` returns `false` without showing anything.

**Fix.** Never use them. Build a small in-game `askConfirm(title, body, okLabel, onYes, onNo)` on your modal, with Cancel focused by default. Test it by having Playwright *dismiss* dialogs (`page.on('dialog', d => d.dismiss())`), which mimics the blocked behaviour.

## 3. Blurry or smeared canvas

There are two independent causes, so fix both.

- **Backing store drifts from display size.** Layout shifts (a scrollbar appearing, the hand or log growing, zoom) change the canvas's CSS size without a `resize` event, so the canvas is stretched.
  - Refit with a `ResizeObserver` on the canvas: `width = round(cssWidth * devicePixelRatio)`, skipping changes under 1%.
  - Don't measure while the canvas is hidden, because `clientWidth` is 0. Refit on the next frame after showing it.
- **Leaked context state.** If a draw throws between `save()` and `restore()`, `shadowBlur`, `filter` or `globalAlpha` persist into every later frame.
  - Start every frame from a clean context: `ctx.reset()` after a caught error, otherwise set `shadowBlur=0`, `filter='none'`, `globalAlpha=1` and `globalCompositeOperation='source-over'`.
  - Add a render fuzz that draws every entity in every mode and asserts those four values are back to defaults afterwards.

## 4. Mid-game save and resume

- **Keep battle state plain data.** That means objects, arrays, numbers and strings: no functions, Maps, Sets or identity that matters. Snapshot it with `JSON.parse(JSON.stringify(state, (k, v) => typeof v === 'function' ? undefined : v))`.
- **Snapshot only at a quiet point** (player's turn, nothing animating or resolving). Recompute anything derived (AI plans, caches) on restore.
- **Save at turn start, after each action, on Save and quit, and on `pagehide`/`beforeunload`.**
- **Reset the id counter** past every id in the restored state.
- **Test the round trip.** Play part of a turn, save, open a new page, resume, and deep-compare hand, piles, HP, statuses, intents and score. Do it again after closing the tab mid-turn.

## 5. Per-player storage (local profiles)

- Route every per-player key through one function, e.g. `pkey('game-run')`. The default profile keeps the original bare keys, so existing saves stay with it. Keep device settings un-namespaced.
- **Switch profiles by saving, then `location.reload()`,** so every module re-reads its data cleanly.
- **Close the page-close save.** The `pagehide` autosave will otherwise write the old player's game under the *new* profile's key after the switch. Set a `__switching` flag and skip the autosave when it is set.

## 6. Performance: cache what is idle

Procedural character drawing can be most of a frame. Keep one offscreen canvas per entity:
- Redraw it at most about 20 times a second while the entity is idle, and draw live while it is animating (attacking, posing, charging).
- Blit it on whole device pixels (`setTransform(1,0,0,1,0,0)` and rounded coordinates) so it stays as crisp as a live draw.
- Verify parity by drawing every kind both ways at the same moment and diffing alpha.

This took a fight frame from about 2.9 ms to 0.7 ms.

## 7. Explain the numbers

When many systems modify damage, record each modifier as it is applied: a global `WHY` array that the damage function pushes `[label, op, n]` into when it is set. Show the breakdown for the selected action. It doubles as a debugging tool.

## Ship checklist

- [ ] Build fails on syntax errors and duplicate globals.
- [ ] No `alert`/`confirm`/`prompt` anywhere (`grep -n "confirm(\|alert(\|prompt(" src/`).
- [ ] Render fuzz passes with no leaked context state.
- [ ] Canvas refits on display-size change; screenshot at devicePixelRatio 2.
- [ ] Save, then resume in a new page, round-trips identically, including after closing mid-turn.
- [ ] Profile switch mid-game leaves the other profile untouched.
- [ ] Every new system has a check in the quick suite, and the check asserts rather than just prints.
