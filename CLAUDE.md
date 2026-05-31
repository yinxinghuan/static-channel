# Mini Game — Dev Guidelines

> 复制本文件到新游戏项目根目录，Claude Code 会在每次会话开始时自动读取。

---

## Tech Stack

当前项目使用 React + TypeScript + Less + Vite，但技术选型不做强制，新游戏可根据需要选择合适的框架和语言。

---

## Project Structure（当前 React 项目参考）

```
src/
  <GameName>/
    <GameName>.tsx        # 主组件
    <GameName>.less
    index.ts              # 导出主组件
    components/           # 子组件
    hooks/                # 游戏逻辑 hooks
    utils/                # 工具函数
    i18n/                 # 轻量 i18n
```

---

## Conventions

- CSS 命名：BEM + 游戏前缀（`.otd-` for one-tap-a-day）
- `@keyframes` 加游戏前缀
- 只用 `onPointerDown`，不要同时注册 `onMouseDown + onTouchStart`
- 交互元素加：`-webkit-tap-highlight-color: transparent; user-select: none; touch-action: none;`
- 每次提交前必须 `npm run build` 通过
- 用户可见文字走 `t()`，不内联硬编码

---

## Game Meta + UUID

- 根目录 `meta.json` 必备
- UUID 来自 `games/games.json`，跑 `scripts/sync-game-ids.py` 注入到 `src/game-id.ts`
- `main.tsx` 顶部必须 `import './game-id';`

完整接入：见 `/Users/yin/code/games/RUNTIME.md`
