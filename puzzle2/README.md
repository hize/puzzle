# 数独大师 (Sudoku Master)

基于 **Capacitor 6** 的跨平台数独小游戏（Web / iOS / Android）。

## 关卡设计

| 难度 | 关卡数 | 提示数 | 说明 |
|------|--------|--------|------|
| 🟢 初级 | 10 关 | 43 个 | 入门友好 |
| 🟡 中级 | 20 关 | 35 个 | 需要推理技巧 |
| 🔴 高级 | 50 关 | 28 个 | 高手挑战 |

- 每关使用**确定性种子生成**（同一关卡永远是同一盘面），并经唯一解校验
- 关卡顺序解锁，通关后按用时/错误/提示评 1~3 星，进度存于 localStorage

## 游戏功能

- 行/列/宫与同数字高亮、冲突红字提示
- 笔记模式（铅笔标记）、撤销、擦除、提示（每关 3 次）
- 计时器、暂停、错误上限 3 次判定失败
- 桌面端支持键盘操作（数字键、方向键、N 笔记、H 提示、Z 撤销）

## 目录结构

```
www/                 # Web 资源（Capacitor webDir）
  index.html
  css/style.css
  js/sudoku.js       # 数独引擎：生成 + 唯一解校验
  js/app.js          # 界面与游戏逻辑
android/             # Android 原生工程
ios/                 # iOS 原生工程
capacitor.config.json
```

## 开发与运行

```bash
npm install

# 浏览器直接调试
python3 -m http.server 8765 -d www   # 或 npx serve www

# 修改 www/ 后同步到原生工程
npx cap sync

# 打开原生 IDE 构建
npx cap open android   # 需 Android Studio
npx cap open ios       # 需 Xcode + CocoaPods（本机未装 Xcode 时先安装，再执行 npx cap sync ios）
```

> 注：当前机器只有 Command Line Tools，`ios` 平台已创建但 pod install 未执行；安装完整 Xcode 后运行 `npx cap sync ios` 即可补齐。
