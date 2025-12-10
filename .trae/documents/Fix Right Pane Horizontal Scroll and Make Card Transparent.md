## Root Cause
- Element Plus `ElRow` uses negative horizontal margins when `gutter>0`. Inside a 100% width container, these negative margins overflow horizontally, creating a scrollbar.
- The `ElCard` still has a non-transparent root background and border unless explicitly overridden, even if `body-style` sets `backgroundColor: 'transparent'`.

## Changes
1) Remove overflow source
- In `src/renderer/src/components/ShellLayout.vue`: set `:gutter="0"` on the right-side `ElRow`.
- Alternative (if spacing is desired later): wrap content in an inner container with `padding: 8px` instead of using `gutter`.

2) Make the right outer card truly transparent
- Add a class to the card, e.g. `transparent-card`, and CSS:
  - `--el-card-bg-color: transparent`
  - `border: none`
  - `box-shadow: none`
- Keep `:body-style="{ padding: '0px', backgroundColor: 'transparent' }"`.

3) Hardening (optional)
- Add `overflow-x: hidden` on `.right-card` to guard against future gutter reintroduction.

## Implementation Details
- ShellLayout.vue changes:
```
<ElCard class="right-card transparent-card" shadow="never" :body-style="{ padding: '0px', backgroundColor: 'transparent' }">
  <ElRow :gutter="0" class="right-grid">
```
- CSS:
```
.transparent-card { --el-card-bg-color: transparent; border: none; box-shadow: none; }
.right-card { overflow-x: hidden; }
```

## Verification
- Reload the app, confirm the right pane no longer shows a horizontal scrollbar at any window width.
- Confirm the outer card has no visible background, border, or shadow.
- Check that header and table still render correctly within the right pane.
