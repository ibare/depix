# Depix DSL Reference — LLM Prompt

You are generating Depix DSL code. Depix is a declarative language for creating visual presentations: slides, diagrams, flowcharts, data visualizations, and infographics.

All content is expressed as DSL text. The compiler transforms DSL into a visual scene rendered on a canvas.

---

## Document Structure

A Depix document has two parts: **directives** (document-level settings) and **scenes** (visual pages).

```
@page 16:9
@style sketch

scene "Title Slide" {
  layout: header
  header: heading "Welcome to Depix"
  body: text "A DSL for visual content"
}

scene "Details" {
  layout: split
  left: stat "42%" { label: "Growth" }
  right: bullet [ "Fast", "Flexible", "Beautiful" ]
}
```

If no `scene` block is written, the compiler wraps all top-level content in an implicit scene.

---

## Directives

Directives start with `@` and set document-level configuration. Place them before any scene.

| Directive | Values | Description |
|-----------|--------|-------------|
| `@page` | `16:9`, `4:3`, `1:1`, `*` | Canvas aspect ratio. `*` = auto-height (content-driven) |
| `@style` | `default`, `sketch` | Drawing style hint |
| `@transition` | `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom-in`, `zoom-out` | Scene transition |
| `@ratio` | `16:9` etc. | Alias for @page |

### @data — Named Dataset

```
@data "sales" {
  "Quarter" "Revenue" "Profit"
  "Q1" 120 30
  "Q2" 150 45
  "Q3" 180 60
}
```

The first row is automatically treated as the header. Reference by name in a `chart` block.

### @overrides — Element Position Override

```
@overrides {
  #myElement { x: 10, y: 20, w: 30, h: 40 }
}
```

Used by the editor to store manual position adjustments.

---

## Scenes

Each scene is a visual page/slide. Scenes use **slot-based layouts** to arrange content.

```
scene "Page Title" {
  layout: <preset>
  <slotName>: <content>
  <slotName>: <content>
}
```

### Layout Presets (14)

| Preset | Slots | Description |
|--------|-------|-------------|
| `full` | body | Single full-area content |
| `center` | body | Centered content area |
| `split` | left, right | Vertical split (50:50, adjust with `ratio`) |
| `rows` | top, bottom | Horizontal split (50:50, adjust with `ratio`) |
| `sidebar` | main, side | Main + sidebar (70:30, adjust with `ratio`, `direction`) |
| `header` | header, body | Top header + body below |
| `header-split` | header, left, right | Header + vertical split |
| `header-rows` | header, top, bottom | Header + horizontal split |
| `header-sidebar` | header, main, side | Header + sidebar layout |
| `grid` | cell (repeatable) | Uniform grid cells |
| `header-grid` | header, cell (repeatable) | Header + grid |
| `focus` | focus, cell (repeatable) | Large focus area + smaller cells |
| `header-focus` | header, focus, cell (repeatable) | Header + focus + cells |
| `custom` | cell (repeatable) | Simple vertical stack fallback |

### Slot Names

```
header  — top section (fixed height)
body    — main content area
left    — left half (split layouts)
right   — right half (split layouts)
top     — top half (rows layouts)
bottom  — bottom half (rows layouts)
main    — primary area (sidebar layouts)
side    — secondary area (sidebar layouts)
focus   — large focal area (focus layouts)
cell    — repeatable grid cell (grid/focus/custom)
```

### Scene Properties

```
scene "Title" {
  layout: header-split      // layout preset (required for multi-slot)
  ratio: 0.4                // split ratio (0.0–1.0)
  direction: left            // sidebar direction
}
```

### Slot Assignment Syntax

Assign content to a slot with `slotName: content`:

```
scene {
  layout: header
  header: heading "Main Title"
  body: flow {
    node "Start" #a
    node "End"   #b
    #a -> #b
  }
}
```

---

## Elements

Elements are the atomic visual units. Each element type has a specific visual representation.

### Shape Elements

Shape elements render as geometric shapes with optional inner text.

| Element | Shape | Typical Use |
|---------|-------|-------------|
| `node` | rect | Generic node |
| `rect` | rect | Rectangle |
| `circle` | circle | Circle |
| `diamond` | diamond | Decision/branch |
| `pill` | pill (rounded rect) | Terminal/start-end |
| `ellipse` | ellipse | Oval |
| `hexagon` | hexagon | Preparation step |
| `triangle` | triangle | Warning/direction |
| `parallelogram` | parallelogram | Data I/O |
| `cylinder` | cylinder | Database/storage |
| `trapezoid` | trapezoid | Manual operation |
| `badge` | pill | Small label badge |
| `cell` | rect | Generic cell |

**Syntax:**

```
node "Label"
diamond "Decision?" { background: accent }
pill "Start" #myId { background: primary, color: white }
```

### Text Elements

| Element | Description |
|---------|-------------|
| `heading` | Large bold centered text. Use for titles. |
| `text` | Body text |
| `label` | Body text (alias for text) |
| `item` | Body text (alias for text) |
| `stat` | Large value + small label below. Props: `label` |
| `quote` | Italic quote + attribution. Props: `attribution` |
| `step` | Numbered circle marker + description. Props: `description` |
| `icon` | Symbol character (large) + label + description. Props: `label`, `description` |

**Examples:**

```
heading "Welcome"
stat "42%" { label: "Conversion Rate" }
quote "Design is not just what it looks like." { attribution: "Steve Jobs" }
step "1" { description: "Sign up for an account" }
icon "🚀" { label: "Launch", description: "Deploy to production" }
```

### List Elements

```
list ["Apples", "Bananas", "Milk"]
list ordered ["First", "Second", "Third"]
bullet ["Item A", "Item B", "Item C"]
```

`list` and `bullet` are interchangeable. Add `ordered` flag for numbered lists.

### Other Elements

```
divider                          // horizontal line
image "alt text" { src: "url" }  // image placeholder
```

---

## Element Syntax

Every element follows this pattern:

```
<elementType> ["label"] [#id] [flags] [{ props/style/children }]
```

All parts except `<elementType>` are optional.

### ID

Suffix with `#` to assign an ID (required for edge connections):

```
pill "Begin" #start
diamond "Check?" #decision
```

### Label

A quoted string after the element type:

```
heading "Title Text"
node "Process Data"
```

### Flags

Bare keywords that modify the element:

```
heading "Title" bold center
list ordered ["a", "b"]
```

Available flags: `bold`, `italic`, `underline`, `strikethrough`, `center`, `outline`, `header`, `ordered`

### Properties & Styles

Inside `{ }`, write key-value pairs:

```
node "Server" {
  background: primary
  color: white
  border: accent
  border-width: 2
  radius: 4
  opacity: 0.8
  shape: diamond          // override shape
  width: 20
  height: 15
}
```

**Style keys** (visual appearance — go to `style`):
`background`, `color`, `border`, `border-width`, `border-style`, `shadow`, `radius`, `opacity`, `font-size`, `font-weight`

**Property keys** (semantic data — go to `props`):
`direction`, `gap`, `ratio`, `cols`, `layout`, `subtitle`, `attribution`, `description`, `label`, `type`, `shape`, `width`, `height`, `size`, `fit`, `src`, `x`, `y`

### Color Values

- Semantic: `primary`, `accent`, `surface`, `text`, `textMuted`, `background`
- Hex: `#ff5733`
- Gradient: `gradient(right, #f00, #00f)`

---

## Blocks

Blocks are containers for layout and grouping.

### flow — Directed Graph / Flowchart

```
flow {
  pill "Start"       #start
  diamond "Valid?"    #check
  rect "Process"     #process
  cylinder "Database" #db
  pill "End"         #end

  #start -> #check
  #check -> #process "Yes"
  #check --> #db "No"         // dashed arrow
  #process -> #end
  #db -> #end
}
```

**Direction property:** `direction: right` (default), `left`, `down`, `up`

### tree — Hierarchical Tree

```
tree {
  node "CEO" #root
  node "CTO" #a
  node "CFO" #b

  #root -> #a
  #root -> #b
}
```

**Direction:** `down` (default), `up`, `right`, `left`

### stack — Linear Layout

```
stack direction:row {
  node "A"
  node "B"
  node "C"
}
```

**Direction:** `col` (default, vertical), `row` (horizontal)

### grid — Uniform Grid

```
grid cols:3 {
  node "1"
  node "2"
  node "3"
  node "4"
}
```

### layers — Stacked Layers

```
layers {
  layer "Frontend" { node "React" }
  layer "Backend" { node "Node.js" }
  layer "Data" { cylinder "PostgreSQL" }
}
```

### box — Styled Container

```
box {
  background: primary
  heading "Section Title"
  text "Content inside a box"
}
```

### layer — Container with Zone Label

```
layer "Category Name" {
  node "Item A"
  node "Item B"
}
```

Renders a top-left category label + bordered container.

### group — Container with Default Border

```
group {
  node "Grouped A"
  node "Grouped B"
}
```

### table — Data Table

```
table {
  row ["Name", "Age", "City"] header
  row ["Alice", 30, "Seoul"]
  row ["Bob", 25, "Tokyo"]
}
```

First row with `header` flag gets header styling.

### chart — Data Visualization

```
chart "sales" type:bar
chart "metrics" type:line
chart "distribution" type:pie
```

References a `@data` dataset by name. Supported types: `bar`, `line`, `pie`.

### column — Vertical Content Column

```
column {
  heading "Title"
  text "Paragraph"
  divider
  text "More content"
}
```

---

## Edges (Connections)

Edges connect elements by their `#id`. Only valid inside `flow`, `tree`, and other diagram blocks.

### Arrow Syntax

| Syntax | Meaning | Visual |
|--------|---------|--------|
| `#a -> #b` | Directed arrow | Solid line + triangle arrowhead |
| `#a --> #b` | Dashed arrow | Dashed line + triangle arrowhead |
| `#a -- #b` | Undirected line | Solid line, no arrowhead |
| `#a <-> #b` | Bidirectional | Solid line + arrowheads on both ends |

### Edge Labels

Add a label with `"text"` after the target:

```
#a -> #b "Yes"
#a --> #c "No"
```

### Edge Chains

Connect multiple nodes in sequence:

```
#a -> #b -> #c -> #d
```

This creates edges: a→b, b→c, c→d.

### Cycle Support

Back-edges (loops) are automatically detected and routed with wider curved paths:

```
flow {
  node "Start"  #start
  diamond "OK?" #check
  node "Fix"    #fix
  pill "Done"   #end

  #start -> #check
  #check -> #fix "No"
  #fix -> #check            // back-edge: curved route
  #check -> #end "Yes"
}
```

---

## Comments

```
// This is a comment
node "A"  // inline comment
```

Only line comments (`//`) are supported.

---

## Complete Examples

### Presentation Slide

```
@page 16:9

scene "Title" {
  layout: center
  body: heading "Quarterly Report" bold
}

scene "Metrics" {
  layout: header-split
  header: heading "Key Numbers"
  left: stat "42%" { label: "Growth" }
  right: stat "$1.2M" { label: "Revenue" }
}

scene "Details" {
  layout: header
  header: heading "Process"
  body: bullet ["Analyze data", "Build models", "Deploy", "Monitor"]
}
```

### Flowchart

```
@page 4:3

scene {
  layout: full
  body: flow {
    pill "Start" #start { background: primary }
    parallelogram "Get Input" #input
    diamond "Valid?" #check
    rect "Process" #process
    cylinder "Save to DB" #db
    rect "Show Error" #error { background: #ff4444, color: white }
    pill "End" #end { background: primary }

    #start -> #input
    #input -> #check
    #check -> #process "Yes"
    #check -> #error "No"
    #error --> #input "Retry"
    #process -> #db
    #db -> #end
  }
}
```

### Data Dashboard

```
@page 16:9
@data "revenue" {
  "Month" "Revenue"
  "Jan" 100
  "Feb" 120
  "Mar" 150
  "Apr" 130
}

scene "Dashboard" {
  layout: header-split
  header: heading "Revenue Overview"
  left: chart "revenue" type:bar
  right: stat "$500K" { label: "Total Revenue" }
}
```

### Architecture Diagram

```
@page 16:9

scene {
  layout: full
  body: layers {
    layer "Client" {
      node "Browser"
      node "Mobile App"
    }
    layer "API" {
      node "Gateway"
      node "Auth Service"
    }
    layer "Data" {
      cylinder "PostgreSQL"
      cylinder "Redis"
    }
  }
}
```

### Auto-Height Document

```
@page *

box {
  background: primary
  heading "Shopping List"
  list [
    "Apples"
    "Bananas"
    "Milk"
    "Bread"
    "Eggs"
    "Cheese"
  ]
}
```

Canvas height grows automatically to fit all content.

---

## Quick Reference

**Shapes:** `rect`, `circle`, `ellipse`, `diamond`, `pill`, `hexagon`, `triangle`, `parallelogram`, `cylinder`, `trapezoid`

**Blocks:** `flow`, `tree`, `stack`, `grid`, `layers`, `box`, `layer`, `group`, `column`, `table`, `chart`, `scene`, `canvas`

**Text:** `heading`, `text`, `label`, `stat`, `quote`, `step`, `icon`, `item`

**Lists:** `list`, `bullet` — with `["item1", "item2"]` syntax, optional `ordered` flag

**Arrows:** `->` (solid), `-->` (dashed), `--` (no arrow), `<->` (bidirectional)

**Layouts:** `full`, `center`, `split`, `rows`, `sidebar`, `header`, `header-split`, `header-rows`, `header-sidebar`, `grid`, `header-grid`, `focus`, `header-focus`, `custom`

**Slots:** `header`, `body`, `left`, `right`, `top`, `bottom`, `main`, `side`, `focus`, `cell`

**Directives:** `@page`, `@style`, `@transition`, `@ratio`, `@data`, `@overrides`

**Flags:** `bold`, `italic`, `underline`, `strikethrough`, `center`, `outline`, `header`, `ordered`

**Style keys:** `background`, `color`, `border`, `border-width`, `border-style`, `shadow`, `radius`, `opacity`, `font-size`, `font-weight`
