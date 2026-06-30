# 🧪 Drug Craft

An [Infinite Craft](https://neal.fun/infinite-craft/)-style crafting game — but instead of
combining the four classical elements into the universe, you combine **Plant**, **Chemical**,
**Water**, and **Fire** to discover the entire (satirical) pharmacopeia. Drag two elements
together and see what you get. Then combine *those*. The tree never ends.

> **Satire & commentary.** This is a word game in the spirit of Infinite Craft. The element
> names are pop-culture references; the game contains **no real synthesis information,
> dosages, or how-to instructions** of any kind, and does not encourage drug use. It pokes at
> drug culture and policy the way Infinite Craft pokes at cosmology.

## Play it

**Zero setup — just open the file.**

```
open index.html        # macOS
# or double-click index.html in your file browser
```

That's it. Everything (the combination engine, your discoveries, the layout) runs in the
browser. Progress is saved to `localStorage`.

### How to play

1. You start with the four pillars: 🌿 Plant · ⚗️ Chemical · 💧 Water · 🔥 Fire.
2. **Click** a discovery in the sidebar to drop it on the table, or **press-and-drag** it out.
3. **Drag one token onto another** to combine them. The two merge into something new.
4. A gold **"First Discovery"** banner + sparkles fire the first time anyone makes a given item.
5. Search and re-sort your discoveries (by time / A–Z / type) in the sidebar.
6. **Double-click** a token to clear it; **Clear table** sweeps the canvas (keeps discoveries);
   **Reset progress** wipes everything back to the four pillars.

There are dozens of hand-authored recipes (Cannabis → Joint, Coca Leaf + Chemical → Cocaine,
Poppy → Opium → Morphine → Heroin → Fentanyl, Mushroom → Psilocybin, and so on), plus a
deterministic generator that turns *any* two elements into a plausible new one — so you can
keep combining forever, and the same pair always gives the same result.

## Optional: true AI combinations (Claude)

Want genuinely open-ended generation like the real Infinite Craft? Run the included backend
and the game will ask Claude to invent each combination, falling back to the offline engine if
the server is unreachable.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...      # your key
npm start                                 # serves the game + API on :8787
```

Then open **http://localhost:8787**, tick the **🤖 AI mode** box in the sidebar (the badge
turns green when it connects), and start crafting. Untick it to go back offline at any time.

- Model defaults to **Claude Haiku 4.5** — fast and cheap, ideal for a generation-per-combine
  game. Override with `DRUGCRAFT_MODEL=claude-opus-4-8` for richer results.
- Results are cached server-side per pair, so repeats are free and stay consistent.
- See `.env.example` for all options.

## Project layout

| File          | What it is |
| ------------- | ---------- |
| `index.html`  | Page structure (canvas + discoveries sidebar) |
| `styles.css`  | The clean, Infinite-Craft-inspired look |
| `engine.js`   | The offline combination engine: recipes → transform rules → procedural blend. Pure, deterministic, no dependencies. |
| `game.js`     | UI controller: drag-and-drop, state, persistence, search/sort, toasts, the optional AI hook |
| `server.js`   | Optional Node backend that serves the game and proxies combinations to Claude |
| `package.json`, `.env.example` | For the optional backend |

## Tech

Vanilla HTML/CSS/JS for the game (no build step, no framework). The optional backend is plain
Node with the official [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk).
