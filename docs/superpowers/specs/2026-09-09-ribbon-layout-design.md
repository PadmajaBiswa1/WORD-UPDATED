# EtherXWord Ribbon Layout Design

## Goal

Make the document ribbon visually consistent and responsive across every tab, while preventing clipped controls and keeping the page sidebar and editor canvas below the ribbon’s actual rendered height.

## Scope

- Shared ribbon group, action, caption, divider, and spacing behavior.
- Home, Insert, Draw, Design, Layout, References, Mailings, Review, View, and Help tabs.
- Horizontal ribbon overflow affordances.
- Design style-gallery overflow.
- Dynamic ribbon-height measurement for editor layout safety.

## Design

### Shared controls

Introduce shared ribbon layout primitives and CSS tokens in the toolbar/theme layer. A ribbon action has a fixed icon slot, fixed icon-to-label gap, consistent label line-height, centered content, and a minimum desktop interaction size. `RibbonGroup` owns its content row, caption, padding, and divider so captions remain centered against the group’s own width.

Existing handlers, tooltips, active states, and editor commands remain unchanged. Tab-specific controls such as selects, zoom controls, and the Design gallery use the same group shell but may keep their specialized internal control.

### Overflow

Ribbon groups remain non-wrapping so controls never split or clip. The content rail scrolls horizontally when needed and exposes visible previous/next chevrons only when additional content exists. The scroller preserves keyboard focus and uses accessible labels. The Design gallery gets a bounded internal horizontal rail so its thumbnails cannot expand past the group.

### Layout measurement

The ribbon root is measured with `ResizeObserver` whenever its active tab, viewport, or content changes. The measured height is published as a CSS layout value. Editor shells use normal flex flow with `min-height: 0`, and any top-positioned layout surface consumes the measured value instead of a fixed ribbon offset.

## Design principles

- Align related controls and captions to a shared grid.
- Use progressive disclosure through visible scrolling controls rather than silent clipping.
- Keep labels legible and controls keyboard-accessible.
- Preserve the existing dark/gold visual language and tab behavior.

## Verification

- Targeted lint/static checks for shared ribbon primitives and undefined identifiers.
- Full frontend lint.
- Production build.
- Browser-level checks at wide and narrow viewport sizes for every tab.
- Confirm no clipped control, visible overflow affordance when required, and no overlap between ribbon, Pages sidebar, and editor canvas.
