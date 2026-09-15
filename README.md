# ztools

An online tool site for developers. Core goals: **simple, useful, powerful — solving real pain points**.

- Pure frontend; all tools run locally in the browser, data never leaves your device
- Responsive, works on both mobile and desktop
- English by default, Chinese supported (switchable)
- Light / dark theme support

> **[中文文档 (Chinese)](README.zh-CN.md)**

## Features

- **Landing page**: the site home is a landing page showing a tool overview
- **URL equals tool**: each tool lives at its own route, e.g. `https://example.com/json_diff` is the JSON diff tool
- **Discovery**: keyword search, plus filtering by **category** and **tag**
- **i18n**: English by default, Chinese supported, switchable
- **Light / dark mode**: switchable theme
- **No accounts**: pure tool site — no registration, no login, no backend storage

## First batch of tools

| Route | Tool | Description |
| --- | --- | --- |
| `/json_diff` | JSON Diff | Diff between two JSON documents |
| `/text_diff` | Text Diff | Line-by-line diff between two texts |
| `/json_format` | JSON Formatter | Format / minify JSON |
| `/timestamp` | Timestamp | Convert between timestamps and dates |

## Tech stack

- **Vite + React** (SPA)
- Tools run entirely client-side; no backend
- More tools will be added over time

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

## Routing convention

Each tool maps to a single route, named with lowercase letters and underscores:

```
/json_diff
/text_diff
/json_format
/timestamp
```

## Project structure (planned)

```
src/
  components/     # Shared components
  pages/          # Page-level components
    Home.tsx      # Landing page
    Tool.tsx      # Shared tool layout
  tools/          # One directory per tool
    json-diff/
      index.tsx   # Tool implementation
      meta.ts     # Name, description, category, tags, i18n config
    json-format/
    timestamp/
  i18n/           # Locale strings (en / zh-CN)
  themes/         # Light / dark theme variables
  router.tsx      # Route registration
```

## How to add a new tool

1. Create a new directory under `src/tools/` (e.g. `my-tool/`)
2. Implement the tool page `index.tsx`
3. Write `meta.ts` declaring the tool's name, description, category, tags, and i18n strings
4. Register the route `/my_tool`
5. The tool automatically appears on the home page, in search, and in category / tag filters

## Category & tag system (planned)

- **Category**: coarse-grained, e.g. data, time, text, code
- **Tag**: fine-grained descriptors for more precise search

## Internationalization

- Default language: English (en)
- Supported language: Chinese (zh-CN)
- Tool names, descriptions, and UI strings are all managed through i18n

## Theming

- Two themes (light / dark) implemented with CSS variables
- Manual toggle supported; can follow system preference

## License

[MIT](LICENSE)