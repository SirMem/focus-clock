# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

- Install dependencies: `npm install`
- Run the React/Figma prototype locally: `npm run dev`
- Build the React/Figma prototype: `npm run build`
- If `npm run dev` or `npm run build` reports `vite` is not found, run `npm install` first; this repository has a `package-lock.json`, but `node_modules` may be incomplete.
- Run the WeChat Mini Program: open the repository root in WeChat DevTools using `project.config.json`, then compile/preview from DevTools.
- After changing Mini Program npm dependencies such as `tdesign-miniprogram`, rebuild npm packages in WeChat DevTools so `miniprogram_npm/` matches `package.json` / `package-lock.json`.
- There is currently no configured lint or test script and no test framework in the project source, so there is no single-test command yet.

## Repository shape

This repository contains two related front-end targets for the same product, plus planning docs:

1. **WeChat Mini Program at the repository root** — this is the native Mini Program implementation opened by `project.config.json`.
2. **React/Vite Figma Make prototype** — source under `src/`, with a duplicated exported copy under `Figma/Designv1/`.
3. **Product and architecture docs** — under `docs/`, including the module plan and PRD.

Prefer editing the root Mini Program files when working on the native app. Prefer editing root `src/` when working on the React/Figma prototype. Treat `Figma/Designv1/` as a duplicated Figma export unless the task explicitly targets that folder.

## WeChat Mini Program architecture

- `app.json` registers the Mini Program entry page (`pages/focus/focus`), uses `navigationStyle: "custom"`, and declares TDesign Mini Program components globally (`t-button`, `t-icon`, `t-tab-bar`, etc.).
- `app.wxss` defines global design tokens and utility classes for the Mini Program, using `rpx`, WXSS variables, and shared colors such as `--primary`, `--bg`, `--text-primary`, and `--radius-*`.
- `pages/focus/focus.*` is the current native page implementation. `focus.js` owns timer state in `Page.data`, implements start/pause/reset/skip with `setInterval`, manages mode/sound/tab UI state, and sends simple feedback through WeChat APIs such as `wx.vibrateShort` and `wx.showToast`.
- `pages/focus/focus.wxml` composes the custom nav bar, `<circular-timer />`, sound chips, mode toggle, controls, summary cards, AI tip card, and TDesign tab bar. The tab bar currently updates local `activeTab` and shows a toast rather than navigating to separate pages.
- `components/circular-timer/*` is a custom Canvas 2D component. It receives `progress`, `mode`, `timeLeft`, and `state` as properties; observers redraw the ring and update formatted time/state labels.
- `miniprogram_npm/tdesign-miniprogram/` is generated/vendor output for WeChat npm components. Do not hand-edit it unless the task is specifically about vendored component output.
- `project.config.json` sets `miniprogramRoot` to `.`, `compileType` to `miniprogram`, `packNpmManually: true`, and the base library version to `3.7.12`.

## React/Figma prototype architecture

- `src/main.tsx` mounts `src/app/App.tsx` and imports `src/styles/index.css`.
- `src/app/App.tsx` is the central prototype shell: it renders a fixed-size phone frame, custom status/nav bars, a six-item tab bar, and owns tab selection. It also contains inline Focus, Todo, Profile, icon, helper, and mock-data logic.
- `src/app/components/StatsScreen.tsx`, `DiaryScreen.tsx`, and `AICoachScreen.tsx` are standalone prototype screens with local state and hard-coded/mock data.
- `src/app/components/ui/` contains shadcn/Radix-style generated UI primitives and `utils.ts` (`cn` combines `clsx` with `tailwind-merge`). Prefer app-specific changes in screens before modifying these primitives.
- `src/styles/index.css` imports `fonts.css`, `tailwind.css`, and `theme.css`. `theme.css` contains Tailwind v4 theme variables and app design tokens for the prototype.
- `vite.config.ts` uses React plus Tailwind v4 plugins, defines `@` as an alias to `src`, and includes a `figma:asset/...` resolver to map generated Figma asset imports into `src/assets`. Keep the React and Tailwind plugins because the config notes they are required for Figma Make.
- `postcss.config.mjs` is intentionally empty; Tailwind v4 is wired through `@tailwindcss/vite`, not PostCSS plugins.

## Product context from docs

- The product is a Pomodoro/focus-clock app for WeChat, aiming at a loop of **计划 → 执行 → 反思 → 优化** for students, exam preparation users, remote workers, and knowledge workers.
- `docs/basic/prd.md` is the concise current PRD. P0 scope includes focus timer with todo association, todo list, day/week/month statistics plus calendar heatmap, diary with emotion tags, and AI coach score/insight.
- `docs/module-plan-v1.md` expands the six-module plan: Pomodoro timer, todo list, statistics dashboard, diary reflection, AI coach, and goals/ranking.
- `docs/PRD.md` captures the interaction model for associating todos with Pomodoro sessions: select a task when starting focus; the timer screen displays the current task; completed Pomodoros increment the task count afterward.
- `docs/CHANGELOG-v1.3.0-architecture-upgrade.md` describes a Clean Layered Architecture (`pages/ → store/ → services/ → lib/`) and files such as `store/` and `services/`, but those directories are not present in the current tree. Verify the actual filesystem before relying on that changelog as implemented architecture.

## Styling and implementation notes

- UI copy is primarily Chinese; keep new user-facing copy consistent with the existing Chinese product language.
- Native Mini Program styles use WXSS/rpx and root tokens in `app.wxss`; React prototype styles use Tailwind utilities, inline styles, and CSS variables in `src/styles/theme.css`.
- Recharts is used in the React prototype statistics/coach screens. The native Mini Program currently does not include a charting layer in source.
- The root `package.json` covers both the Vite prototype dependencies and Mini Program npm dependency `tdesign-miniprogram`. `Figma/Designv1/package.json` is a standalone duplicate for the Figma export and does not include the native Mini Program files.
