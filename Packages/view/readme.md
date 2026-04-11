# @hedystia/view

Reactive UI engine — fine-grained signals, no Virtual DOM, real DOM nodes.

## Installation

```bash
bun add @hedystia/view
```

## Quick Start

Configure your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@hedystia/view"
  }
}
```

```tsx
import { sig, val, set, mount } from "@hedystia/view";

function Counter() {
  const count = sig(0);

  return (
    <div style={{ padding: "16px" }}>
      <h1>Counter: {() => val(count)}</h1>
      <button onClick={() => set(count, val(count) + 1)}>+</button>
    </div>
  );
}

mount(Counter, document.getElementById("root")!);
```

> Components run **once**. Reactivity comes from wrapping signal reads in `() => ...` accessors.

## Signals

```tsx
import { sig, val, set, update, memo, batch, peek, untrack } from "@hedystia/view";

const count = sig(0);

// Read (tracked inside reactive contexts)
val(count); // 0

// Write
set(count, 5);

// Update from previous
update(count, (prev) => prev + 1);

// Derived / computed
const doubled = memo(() => val(count) * 2);

// Batch multiple updates into one reactive cycle
batch(() => {
  set(a, 1);
  set(b, 2);
});

// Read without tracking
peek(count);

// Run without tracking
untrack(() => val(count));
```

### JSX reactive patterns

```tsx
function App() {
  const count = sig(0);
  const doubled = memo(() => val(count) * 2);

  return (
    <div>
      {/* Reactive text — wrap in () => */}
      <span>{() => val(count)}</span>
      <span>Doubled: {() => val(doubled)}</span>

      {/* Reactive style — pass a function */}
      <div style={() => ({ color: val(count) > 5 ? "red" : "blue" })}>
        Dynamic color
      </div>

      {/* Reactive prop — pass a function */}
      <input value={() => `Count is ${val(count)}`} />

      {/* Reactive list — function child returning array */}
      <ul>
        {() => val(items).map((item) => (
          <li>{item.name}</li>
        ))}
      </ul>

      {/* Events */}
      <button onClick={() => set(count, val(count) + 1)}>+</button>
    </div>
  );
}
```

## Store

Nested reactive state with fine-grained updates:

```tsx
import { store, val, set, patch, snap, reset } from "@hedystia/view";

const app = store({
  user: { name: "guest", role: "viewer" },
  theme: "dark",
  count: 0,
});

function Profile() {
  return (
    <div>
      <span>{() => val(app.user.name)}</span>
      <button onClick={() => set(app.theme, "light")}>Light mode</button>
      <button onClick={() => patch(app.user, { name: "alice", role: "admin" })}>
        Login
      </button>
    </div>
  );
}

// Plain snapshot
const snapshot = snap(app);

// Reset to initial values
reset(app, { user: { name: "guest", role: "viewer" }, theme: "dark", count: 0 });
```

## Effects

```tsx
import { on, once, watch, watchAll } from "@hedystia/view";

// Runs whenever count changes
const dispose = on(
  () => val(count),
  (value, prev) => {
    console.log(`${prev} → ${value}`);
    return () => console.log("cleanup"); // optional cleanup
  }
);

// Run once then auto-dispose
once(() => val(count), (value) => {
  console.log("initial:", value);
});

// Stop watching
dispose();

// Concise shorthand — pass a signal directly
watch(count, (value, prev) => {
  console.log(`${prev} → ${value}`);
});

// Track multiple signals at once
watchAll([a, b], ([aVal, bVal], [prevA, prevB]) => {
  console.log(aVal, bVal);
});
```

## Data Fetching

```tsx
import { sig, val, set, load, action } from "@hedystia/view";

const userId = sig(1);

const user = load(
  () => val(userId),
  async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }
);

function UserCard() {
  return (
    <div>
      {() => {
        if (val(user.loading)) return <span>Loading...</span>;
        if (val(user.error)) return <span>Error: {val(user.error)!.message}</span>;
        const data = val(user.data);
        if (!data) return <span>No data</span>;
        return <span>{data.name}</span>;
      }}
      <button onClick={() => set(userId, val(userId) + 1)}>Next user</button>
    </div>
  );
}

// Mutations
const savePost = action(async (data: { title: string }) => {
  const res = await fetch("/api/posts", { method: "POST", body: JSON.stringify(data) });
  return res.json();
});

await savePost.run({ title: "Hello" });
val(savePost.loading); // true while saving
val(savePost.data);    // result when done
val(savePost.error);   // error if failed
```

## Flow Components

```tsx
import { Show, For, Index, Switch, Match, Portal, Suspense, ErrorBoundary } from "@hedystia/view";
```

### Show

```tsx
<div>
  {Show({
    when: () => val(loggedIn),
    fallback: <span>Please log in</span>,
    children: <Dashboard />
  })}
</div>
```

### For (keyed list)

```tsx
<ul>
  {For({
    each: () => val(items),
    key: (item) => item.id,
    children: (item, index) => <li>{val(item).name}</li>
  })}
</ul>
```

### Index (index-based list)

```tsx
<ul>
  {Index({
    each: () => val(items),
    children: (item, index) => <li>#{index}: {val(item)}</li>
  })}
</ul>
```

### Switch / Match

```tsx
<div>
  {Switch({
    fallback: <span>Not found</span>,
    children: [
      Match({ when: () => val(route) === "home", children: <Home /> }),
      Match({ when: () => val(route) === "settings", children: <Settings /> }),
    ]
  })}
</div>
```

### Portal

```tsx
<div>
  {Portal({ mount: document.body, children: <Modal /> })}
</div>
```

## Lifecycle

```tsx
import { onMount, onCleanup, onReady } from "@hedystia/view";

function Component() {
  onMount(() => {
    console.log("mounted");
    return () => console.log("unmounted");
  });

  onCleanup(() => console.log("cleaning up"));
  onReady(() => console.log("ready"));

  return <div>Hello</div>;
}
```

## Context

```tsx
import { ctx, use } from "@hedystia/view";

const ThemeCtx = ctx<{ mode: "dark" | "light"; accent: string }>({
  mode: "dark",
  accent: "#00d9ff",
});

function App() {
  return ThemeCtx.Provider({
    value: { mode: "dark", accent: "#00d9ff" },
    children: <Dashboard />
  });
}

function Dashboard() {
  const theme = use(ThemeCtx);
  return <div style={{ color: theme.accent }}>Theme: {theme.mode}</div>;
}
```

## Text Measurement

Pure-arithmetic text layout without DOM reflow:

```tsx
import { sig, val, set, memo, prepare, layout } from "@hedystia/view";

const text = "Hello world, this is a long paragraph.";
const font = '16px "Helvetica Neue", sans-serif';

// Prepare once (measures segments via canvas)
const prepared = prepare(text, font);

const width = sig(300);

// Layout at any width — pure arithmetic, ~0.0002ms
const result = memo(() => layout(prepared, val(width), 24));

function TextBlock() {
  return (
    <div>
      <p>Lines: {() => val(result).lineCount}</p>
      <p>Height: {() => val(result).height}px</p>
    </div>
  );
}
```

## Style Utilities

```tsx
import { style, merge, toCssString } from "@hedystia/view";

const baseStyle = style({ padding: "16px", background: "#1a1a2e" });
const merged = merge(baseStyle(), { color: "#fff", borderRadius: "8px" });
const css = toCssString(merged); // "padding: 16px; background: #1a1a2e; color: #fff; ..."
```

## Scheduler

```tsx
import { tick, nextFrame, forceFlush } from "@hedystia/view";

// Schedule for next animation frame
tick(() => { /* DOM update */ });

// Await next frame
await nextFrame();

// Force flush pending callbacks (testing)
await forceFlush();
```

## Render

```tsx
import { mount, renderToString } from "@hedystia/view";

// Mount to DOM
const app = mount(App, document.getElementById("root")!);
app.dispose(); // unmount

// SSR
const html = renderToString(App);
```

## API Reference

| Category | Functions |
|----------|-----------|
| **Signals** | `sig`, `val`, `set`, `update`, `memo`, `batch`, `peek`, `untrack` |
| **Store** | `store`, `patch`, `reset`, `snap` |
| **Effects** | `on`, `once`, `watch`, `watchAll` |
| **Lifecycle** | `onMount`, `onCleanup`, `onReady` |
| **Context** | `ctx`, `use` |
| **Fetch** | `load`, `action` |
| **Flow** | `Show`, `For`, `Index`, `Switch`, `Match`, `Portal`, `Suspense`, `ErrorBoundary` |
| **Render** | `mount`, `renderToString` |
| **Text** | `prepare`, `layout`, `reactiveLayout` |
| **Style** | `style`, `merge`, `toCssString` |
| **Scheduler** | `tick`, `nextFrame`, `forceFlush` |

## License

MIT
