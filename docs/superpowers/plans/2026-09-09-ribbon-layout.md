# EtherXWord Ribbon Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize ribbon control alignment and group spacing across all tabs, provide explicit horizontal overflow controls, and keep the editor/sidebar below the ribbon’s measured height.

**Architecture:** Add a small shared ribbon-layout context and CSS contract consumed by `RibbonGroup`, the existing `Button` primitive, and custom tab controls. Keep tab command handlers unchanged. Make `Ribbon` responsible for measuring its rendered height and for showing scroll chevrons around a horizontally scrollable content rail; make Design’s style gallery a bounded nested rail.

**Tech Stack:** React 18, Vite, inline React styles, CSS in `frontend/src/theme/global.css`, Node’s built-in `node:test` for source-contract regression checks, ESLint, Vite production build.

**Spec:** `docs/superpowers/specs/2026-09-09-ribbon-layout-design.md`

## Global Constraints

- Work directly in the current checkout; do not create a worktree.
- Do not commit changes.
- Preserve all existing ribbon command callbacks, active states, tooltips, and tab navigation.
- Keep the existing dark/gold EtherXWord visual language.
- Never silently clip ribbon controls; overflow must be scrollable and have visible chevrons when applicable.
- Do not expose new dependencies; use the existing React/Vite stack and browser `ResizeObserver`.

---

### Task 1: Add a failing ribbon layout contract test

**Files:**
- Create: `frontend/test/ribbon-layout-contract.test.mjs`
- Test: `frontend/test/ribbon-layout-contract.test.mjs`

**Interfaces:**
- Consumes the source files `src/components/toolbar/Ribbon.jsx`, `src/components/toolbar/RibbonGroup.jsx`, and `src/theme/global.css` as text.
- Produces a repeatable Node test that fails until the shared layout, measurement, and overflow contract exists.

- [ ] **Step 1: Write the failing test**

Create a Node test that reads the three source files and asserts these exact contracts:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('ribbon exposes measured layout and visible overflow affordances', () => {
  const ribbon = read('src/components/toolbar/Ribbon.jsx');
  const group = read('src/components/toolbar/RibbonGroup.jsx');
  const css = read('src/theme/global.css');

  assert.match(ribbon, /ResizeObserver/);
  assert.match(ribbon, /aria-label=["']Scroll ribbon left/);
  assert.match(ribbon, /aria-label=["']Scroll ribbon right/);
  assert.match(ribbon, /ribbon-content-shell/);
  assert.match(group, /ribbon-group/);
  assert.match(group, /ribbon-group__content/);
  assert.match(group, /ribbon-group__caption/);
  assert.match(css, /--ribbon-action-height/);
  assert.match(css, /\.ribbon-action/);
});
```

- [ ] **Step 2: Run the test to verify it fails for the missing contract**

Run: `node --test test/ribbon-layout-contract.test.mjs` from `frontend`.

Expected: FAIL because the current ribbon has no `ResizeObserver`, chevron buttons, shared group class contract, or action token.

### Task 2: Create shared ribbon group/action layout primitives

**Files:**
- Create: `frontend/src/components/toolbar/ribbonLayout.js`
- Modify: `frontend/src/components/toolbar/RibbonGroup.jsx`
- Modify: `frontend/src/components/ui/index.jsx:16-70`
- Modify: `frontend/src/theme/global.css` near `.ribbon-scroll`

**Interfaces:**
- `RibbonGroup` provides `RibbonGroupContext` with `{ isRibbonGroup: true }` to descendants.
- `Button` reads the context and renders a `.ribbon-action` layout only inside a ribbon group; outside ribbon groups its existing layout remains unchanged.
- `RibbonGroup` renders `.ribbon-group`, `.ribbon-group__content`, and `.ribbon-group__caption`.

- [ ] **Step 1: Add the context and text splitting helper**

In `ribbonLayout.js`, export `RibbonGroupContext` and a `splitRibbonActionChildren(children)` helper. For a single string, treat the first whitespace-delimited token as the icon when a second token exists; render the remaining text as the label. For non-string or multi-node children, preserve the children in a single label slot so selects and custom controls remain functional.

- [ ] **Step 2: Update `RibbonGroup` to use the shared shell**

Wrap the existing group children in the context provider. Use the shared class names, `minWidth: 'fit-content'`, a single horizontal padding token, and a full-width caption with `textAlign: 'center'`. Do not change the `label` prop or child event handlers.

- [ ] **Step 3: Add ribbon-aware rendering to `Button`**

Keep the current `Button` behavior as the default. When the context is active, render the parsed icon and label in fixed slots with `aria-label`/`title` preserved, and apply `.ribbon-action` plus the existing active/disabled/hover colors. Do not change callers outside `RibbonGroup`.

- [ ] **Step 4: Add shared CSS tokens and classes**

Add the following semantic tokens and classes to `global.css`:

```css
:root {
  --ribbon-group-gap: 8px;
  --ribbon-group-padding-x: 8px;
  --ribbon-action-width: 62px;
  --ribbon-action-height: 66px;
  --ribbon-action-icon-size: 24px;
  --ribbon-action-gap: 4px;
  --ribbon-caption-height: 16px;
}

.ribbon-group { display: flex; flex: 0 0 auto; min-width: fit-content; }
.ribbon-group__content { display: flex; align-items: flex-start; justify-content: center; gap: var(--ribbon-group-gap); min-height: var(--ribbon-action-height); }
.ribbon-group__caption { display: block; width: 100%; min-height: var(--ribbon-caption-height); text-align: center; line-height: 1.2; }
.ribbon-action { box-sizing: border-box; width: var(--ribbon-action-width); min-height: var(--ribbon-action-height); display: inline-flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: var(--ribbon-action-gap); padding: 3px 2px 2px; white-space: normal; line-height: 1.1; }
.ribbon-action__icon { display: inline-flex; align-items: center; justify-content: center; width: var(--ribbon-action-icon-size); height: var(--ribbon-action-icon-size); line-height: 1; flex: 0 0 var(--ribbon-action-icon-size); }
.ribbon-action__label { display: block; max-width: 100%; text-align: center; line-height: 1.1; }
```

- [ ] **Step 5: Run the focused contract test and lint**

Run: `node --test test/ribbon-layout-contract.test.mjs` and `npm run lint` from `frontend`.

Expected: the contract test passes and lint reports no new errors.

### Task 3: Make the ribbon shell measurable and scrollable

**Files:**
- Modify: `frontend/src/components/toolbar/Ribbon.jsx`
- Modify: `frontend/src/theme/global.css`

**Interfaces:**
- The ribbon root writes `--etherx-ribbon-height` on `document.documentElement` and updates it through `ResizeObserver`.
- The content rail exposes `scrollLeft`, `scrollWidth`, and `clientWidth` state through left/right chevron visibility.
- Chevron buttons use `aria-label="Scroll ribbon left"` and `aria-label="Scroll ribbon right"` and call `scrollBy({ left: ±viewportAmount, behavior: 'smooth' })`.

- [ ] **Step 1: Add a failing shell assertion to the contract test**

Extend the test with assertions for `--etherx-ribbon-height`, `scrollBy`, `scrollWidth`, `clientWidth`, and `ribbon-overflow-control`.

- [ ] **Step 2: Add root/content refs and measurement state**

Use `useRef`, `useState`, `useCallback`, and `useLayoutEffect` in `Ribbon`. Observe the root and content rail, update ribbon height and scroll state after tab changes, and remove observers/listeners on cleanup.

- [ ] **Step 3: Wrap the content rail with chevrons**

Replace the current direct content div with a `.ribbon-content-shell` containing the conditional left control, the flexing `.ribbon-content` rail, and the conditional right control. Preserve horizontal scrolling, prevent vertical overflow, and reserve chevron space so the last group is never hidden underneath a control.

- [ ] **Step 4: Add scroll affordance styles**

Give the controls a stable desktop hit area, contrasting background, hover/focus state, and a subtle edge treatment. Keep the native scrollbar visually quiet but do not remove keyboard scroll behavior.

- [ ] **Step 5: Run the focused test and build**

Run: `node --test test/ribbon-layout-contract.test.mjs` and `npm run build` from `frontend`.

Expected: both pass, with only the existing bundle-size/dynamic-import warnings if they remain unchanged.

### Task 4: Normalize custom tab groups and constrain the Design gallery

**Files:**
- Modify: `frontend/src/components/toolbar/tabs/HomeTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/InsertTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/DrawTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/DesignTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/LayoutTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/MailingsTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/OtherTabs.jsx`
- Modify: `frontend/src/components/toolbar/tabs/HelpTab.jsx`
- Modify: `frontend/src/components/toolbar/tabs/ReferenceTab.jsx`

**Interfaces:**
- Every tab uses the shared group shell or the shared `.ribbon-group` classes.
- Existing command callbacks and specialized controls remain unchanged.
- Design’s gallery row uses `.ribbon-gallery-scroll` and never expands the page beyond the ribbon rail.

- [ ] **Step 1: Add a source contract for group/caption coverage**

Extend the Node test to assert that `ReferenceTab.jsx` and `OtherTabs.jsx` use `RibbonGroup`, and that `DesignTab.jsx` contains `ribbon-gallery-scroll` and no `grpStyle` reference.

- [ ] **Step 2: Normalize the custom group shells**

Replace per-tab group padding/gap/caption declarations with the shared tokens/classes. Keep special widths only where the content genuinely needs them and set `minWidth: 0` on nested rails so they can scroll instead of forcing clipping.

- [ ] **Step 3: Normalize custom action buttons**

Apply `.ribbon-action` and the fixed icon/label slots to Design, Insert, Draw, and other custom raw buttons. Keep custom icon artwork inside the fixed icon slot and keep labels in the shared label slot.

- [ ] **Step 4: Constrain the Design style gallery**

Apply `.ribbon-gallery-scroll` to the style thumbnail row with `min-width: 0`, `max-width: 100%`, `overflow-x: auto`, and non-shrinking thumbnails. Preserve the existing active-theme visuals and gallery click handlers.

- [ ] **Step 5: Run lint and the source contract**

Run: `node --test test/ribbon-layout-contract.test.mjs`, `npm run lint`, and `npx eslint src/components/toolbar/tabs/DesignTab.jsx --rule 'no-undef:error'` from `frontend`.

Expected: all pass; no tab introduces an undefined style variable or duplicate ad-hoc group contract.

### Task 5: Tie editor layout to the measured ribbon height

**Files:**
- Modify: `frontend/src/pages/EditorPage.jsx`
- Modify: `frontend/src/pages/PageEditorPage.jsx`
- Modify: `frontend/src/components/sidebar/PageSidebar.jsx`
- Modify: `frontend/src/components/sidebar/PageSidebarNav.jsx`
- Modify: `frontend/src/components/editor/EditorCanvas.jsx`
- Modify: `frontend/src/components/editor/PageEditor.jsx`

**Interfaces:**
- Editor body shells use `flex: 1`, `minHeight: 0`, and `overflow: hidden` so their top edge follows the actual in-flow ribbon.
- Any fixed/absolute toolbar or panel offset that references the ribbon uses `var(--etherx-ribbon-height)` rather than a literal ribbon height.

- [ ] **Step 1: Add layout assertions to the source contract**

Assert that the editor page body shells contain `minHeight: 0` and that no target editor/sidebar file contains a hardcoded `top` offset for the ribbon. The test should allow unrelated editor positioning such as thumbnail ghost elements.

- [ ] **Step 2: Fix body-shell flex constraints**

Add `minHeight: 0` to the body containers in both editor page variants and to the canvas/sidebar flex roots. This prevents a taller active ribbon from compressing content into an overlap.

- [ ] **Step 3: Replace ribbon-relative literals if present**

Search the target files for fixed top/margin values tied to the toolbar. Replace only those values with the measured CSS variable; do not change page-content spacing or thumbnail positioning.

- [ ] **Step 4: Run the full local verification set**

Run: `node --test test/ribbon-layout-contract.test.mjs`, `npm run lint`, `npm run build`, and `git diff --check` from the repository root/frontend as appropriate.

Expected: all commands pass.

### Task 6: Manually verify every ribbon tab locally

**Files:**
- No additional production files; use the running Vite app at `http://localhost:3000/`.

**Interfaces:**
- Verification covers File-adjacent navigation plus Home, Insert, Draw, Design, Layout, References, Mailings, Review, View, and Help.

- [ ] **Step 1: Check wide viewport behavior**

Open the editor at a wide viewport and switch through every tab. Confirm every icon and label has the same vertical rhythm, every caption is centered inside its group, and dividers sit between groups rather than through content.

- [ ] **Step 2: Check narrow viewport behavior**

Resize the viewport until the ribbon overflows. Confirm the rightmost control is not clipped, the right chevron appears, clicking it moves the rail, and the left chevron appears after scrolling. Confirm keyboard focus remains visible.

- [ ] **Step 3: Check Design and layout transitions**

Switch repeatedly between Design, References, and Review. Confirm the Design gallery scrolls inside its group, the Pages heading remains fully visible, and the document canvas never starts under the ribbon.

- [ ] **Step 4: Record local verification results**

Report the commands run and any browser-only limitation; do not commit changes.
