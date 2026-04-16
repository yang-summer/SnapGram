# Design System Specification: High-End Editorial Experience

## 1. Overview & Creative North Star

### The Creative North Star: "The Digital Curator"

This design system moves beyond the utility of a standard social platform to become an editorial masterpiece. It treats digital content with the reverence of a high-end print magazine, blending the vibrancy of social discovery with the structured elegance of a gallery.

By leveraging **intentional asymmetry**, we break the monotony of the "infinite scroll." The system utilizes a multi-column masonry grid that prioritizes high-quality imagery, allowing content of varying aspect ratios to breathe. We eschew traditional UI rigidness in favor of "Soft Minimalism"—where white space is an active participant in the layout, and depth is achieved through light, not lines.

---

## 2. Colors

The palette is anchored by a crisp white background and punctuated by a "Vibrant Crimson" that commands attention without overwhelming the senses.

### Core Palette

- **Primary (#ff2442):** Used exclusively for high-impact brand moments and primary actions.
- **Surface (#ffffff):** A clean white canvas that keeps the interface bright, open, and image-first.
- **On-Surface (#1b1c1c):** A deep, near-black for maximum typographic legibility.

### The "No-Line" Rule

To maintain an editorial aesthetic, **1px solid borders are prohibited for sectioning.** Structural boundaries must be defined through subtle fill changes, ambient shadows, and spacing rather than hard rules.

- _Example:_ A sidebar can sit on the same white `surface` as the main feed without a divider line; only active rows or focused fields should introduce a soft fill.

### Surface Hierarchy & Nesting

Depth is created by stacking "sheets" of color and soft ambient light.

- **Surface (Base):** The white canvas.
- **Surface-Raised:** Defaults to the same white as the canvas when shells should visually merge with the page.
- **Surface-Soft:** A very light fill used for active pills, hover states, search fields, and other soft emphasis moments.
- **Surface-Container-Lowest:** Reserved for cards placed on tinted sections or moments that need a sheet-like feel.

### Signature Textures: The "Glass & Gradient" Rule

Floating elements (modals, hover states, navigation overlays) should utilize **Glassmorphism**. Apply a semi-transparent `surface` color with a `backdrop-filter: blur(20px)`. Main CTAs should use a subtle linear gradient from `primary` (#bb0028) to `primary-container` (#e80535) at 135 degrees to add "soul" and dimension.

---

## 3. Typography

Use one shared system font stack across the entire interface:
`system-ui, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif, BlinkMacSystemFont, Helvetica Neue, Arial, PingFang SC, PingFang TC, PingFang HK, Microsoft Yahei, Microsoft JhengHei`.

- **Display Scale:** Large, bold, and expressive. Use `display-lg` (3.5rem) for hero moments to establish a strong editorial voice.
- **Headline Scale:** Clear hierarchy for content titles. `headline-sm` (1.5rem) is the standard for masonry card titles.
- **Body Scale:** Optimized for long-form reading. `body-md` (0.875rem) serves as the workhorse for captions and comments.
- **Labels:** Used for metadata (likes, timestamps). Always in `label-md` or `label-sm` to maintain a quiet visual secondary layer.

---

## 4. Elevation & Depth

### The Layering Principle

We convey importance through **Tonal Layering**. With a white base canvas, hierarchy comes from soft fills and ambient shadows instead of hard panel contrast.

- Use `surface-soft` for active and hover states on top of the white canvas. When a card or shell must feel lifted, pair white surfaces with ambient shadows rather than borders.

### Ambient Shadows

When a card requires a "floating" state (e.g., on hover), use **extra-diffused shadows**:

- **Shadow Style:** `0px 20px 40px rgba(27, 28, 28, 0.06)`
- The shadow must be low-opacity and slightly tinted by the `on-surface` color to mimic natural ambient light.

### The "Ghost Border" Fallback

If a border is required for accessibility, it must be a **Ghost Border**:

- Use `outline-variant` (#e8bcbb) at **10% opacity**. 100% opaque, high-contrast borders are strictly forbidden.

---

## 5. Components

### Cards & Masonry

- **Forbid Divider Lines:** Separate content using the Spacing Scale (24px - 32px) or subtle background shifts.
- **Border Radius:** Use `16px` for post image containers to keep the feed soft but tighter than the navigation pills.
- **Imagery:** Images must be the hero. Text overlays on images should use a bottom-up gradient scrim (30% black to transparent).
- **Post Title Typography:** Use `14px`, `500` weight, and `rgb(51,51,51)` for card post titles.
- **Post Meta Typography:** Use `12px`, `400` weight, and `rgb(51,51,51)` for card usernames and like-count text.

### Buttons

- **Primary:** `primary` background, `on-primary` text, `full` (9999px) border-radius for a pill shape.
- **Secondary:** `surface-container-high` background with no border. Soft and approachable.
- **Tertiary:** Text-only, using `primary` color for the label.

### Input Fields

- **Styling:** Use `rgba(0,0,0,0.03)` for the desktop search field background. Keep the field borderless at rest and on focus.
- **Corners:** `md` (1.5rem) radius.
- **Icon Placement:** In the desktop header search, place the search icon inside the field on the right side.
- **Placeholder:** Use `16px`, `400` weight, and `rgba(51,51,51,0.3)` for the placeholder text.
- **State:** Focus should not introduce an outline, stroke, or ghost border.

### Navigation

- **Responsive Shell Breakpoint:** The desktop shell activates at `1024px`. At `1024px` and above, show the left sidebar and hide the bottom navigation. At `1023px` and below, hide the sidebar and show the bottom navigation.
- **Desktop Sidebar:** Persistent on the left, but it should share the same white surface as the main content area. Do not separate the sidebar with a distinct panel background; only the active row uses `rgba(0,0,0,0.03)`.
- **Desktop Sidebar Order:** Primary navigation first, then the `Add Post` action, followed immediately by the user row. A `More` row stays pinned to the bottom of the sidebar.
- **Desktop Sidebar Position:** The sidebar begins below the desktop header, not behind it.
- **Desktop Sidebar Label Color:** Use `rgba(51,51,51,1)` for sidebar text, including `发布笔记`, and set those labels to `16px` with `600` weight. In the user row, replace status or follower metadata with `@用户名`.
- **Desktop Sidebar Shape:** Use `rounded-full` for every sidebar row, including the user row and the `更多` row, so the whole rail matches the tag pills.
- **Desktop Header Rhythm:** The desktop shell uses two aligned rows. Row 1 is the only sticky header region, must remain solid white while scrolling, uses a fixed `72px` height, and should be laid out with horizontal flex alignment. Row 2 is the content tag rail, visually aligned to the sidebar `Home` row but scrolling with the page instead of sticking.
- **Desktop Brand:** Keep the existing icon, but the wordmark becomes `小红书`. Place the full logo lockup above the sidebar, anchor it to the top-left corner, and align it with the sidebar's left edge. Do not apply a shadow to the logo icon.
- **Desktop Tag Rail:** Default to `推荐`, use `rgba(51,51,51,1)` for the active label, `rgba(51,51,51,0.8)` for inactive labels, keep labels at `16px`, and use `600` weight for the active tag with `400` for inactive tags. Use `rgba(0,0,0,0.03)` for the active tag background and tag hover background. Use `24px` top padding for the tag rail, align its top edge with the top of the sidebar `首页` row, and allow horizontal scrolling on narrower desktop widths instead of wrapping.
- **Mobile Header Brand:** In the narrow layout header, replace the `Explore` wordmark with the same `小红书` logo lockup used by the desktop shell, simplified to fit the mobile header's left side.
- **Mobile Header Actions:** Replace the previous secondary action with the sidebar `更多` icon (`menu`). In the narrow header, action icons use `rgba(51,51,51,0.6)`, have no background at rest, and gain a circular `rgba(51,51,51,0.3)` hover background.
- **Mobile Header Search Behavior:** Below `640px`, show the search as a right-side icon button using the same styling as the `更多` icon. At `640px` and above within the narrow layout, replace that icon with a centered search field while keeping the `更多` icon on the right.
- **Mobile Tag Rail:** Mirror the desktop tag rail in both content and styling. Use the same labels, active/default state, text sizes, weights, colors, pill shape, and background treatment, while keeping horizontal scrolling for narrow viewports.
- **Mobile Bottom Bar:** Full-width and edge-to-edge at the bottom of the viewport, with no top corner radius. Use a solid white background with no transparency. The bar height is `48px`.
- **Mobile Bottom Bar Layout:** Use five actions in this order: `首页`, `发现`, `发布`, `直播`, `我`. Each button places the icon on the left and the label on the right. Below `768px`, hide the labels and keep icons only.
- **Mobile Bottom Bar Icon Mapping:** Match the desktop sidebar actions with `home`, `explore`, `add_box`, `live_tv`, and `person`. For `我`, always use the icon instead of a user avatar.
- **Mobile Bottom Bar Type & Color:** Icons use a `24px` by `24px` box with `24px`, `400` weight glyph styling. Labels use `16px`, `400` weight. Active items use `rgb(51,51,51)` and inactive items use `rgba(51,51,51,0.6)` for both icon and label color.

---

## 6. Do's and Don'ts

### Do

- **Do** prioritize high-quality, large-scale imagery. The UI should "get out of the way" of the content.
- **Do** use asymmetrical margins in editorial layouts to create visual interest.
- **Do** ensure all interactive elements have a large hit target, following the `full` or `lg` roundedness scale.

### Don't

- **Don't** use 1px solid black or grey borders. They break the "Digital Curator" fluid feel.
- **Don't** use traditional "drop shadows" with high opacity or small blur radii.
- **Don't** clutter the masonry grid. If a card has too much text, truncate it to preserve the visual rhythm of the imagery.
- **Don't** use pure #000000 for text; always use the `on-surface` (#1b1c1c) token for a more sophisticated, premium tone.
