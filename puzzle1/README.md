# 推箱子 · Sokoban

一个零依赖的网页版推箱子游戏，内置 **170 个关卡**：

| 难度 | 关卡数 | 特点 |
| --- | --- | --- |
| 初级 | 20 | 1–2 个箱子，地图小巧，适合熟悉规则 |
| 中级 | 50 | 2–4 个箱子，需要提前规划推箱顺序 |
| 高级 | 100 | 4–7 个箱子，空间狭窄，容错率低 |

支持键盘、触屏滑动、虚拟方向键；进度自动保存在本地；作为 PWA 可以离线游玩并安装到手机桌面。

---

## 运行

游戏是纯静态页面，只需要一个静态服务器（浏览器出于安全策略不允许 `file://` 直接加载脚本时使用）。

```bash
cd puzzle
python3 -m http.server 8000
# 然后浏览器打开 http://localhost:8000/
```

macOS 用户可以直接双击 **`start.command`**，脚本会自动选择空闲端口并打开浏览器。

---

## 目录结构

```
puzzle/
├── index.html              页面结构（首页 / 选关 / 游戏 / 通关弹窗）
├── manifest.webmanifest    PWA 清单
├── sw.js                   离线缓存 Service Worker
├── start.command           macOS 一键启动
├── icons/                  应用图标（SVG + 180/192/512 PNG）
├── styles/main.css         全部样式
├── src/
│   ├── data/levels.js      生成的关卡数据（由脚本产出）
│   └── js/
│       ├── engine.js       游戏核心逻辑（无 DOM 依赖）
│       ├── board.js        棋盘渲染与动画
│       ├── storage.js      本地存档
│       ├── audio.js        Web Audio 合成音效
│       ├── ui.js           界面与交互
│       └── main.js         入口
└── scripts/                关卡生成工具（Python，仅开发时使用）
    ├── sokoban.py          地图模型 / A* 求解器 / 反向生成器
    ├── build_levels.py     批量生成 170 关
    └── make_icons.py       生成 PNG 图标
```

---

## 关卡怎么来的

手工设计 170 个关卡不现实，所以关卡由程序生成并通过求解器评级：

1. **随机房间**：先造一个带墙壁的房间，再用连通性剪枝只保留最大连通区域。
2. **反向生成**：把箱子全部放在目标格上，然后不断执行「拉箱子」操作。
   由于每一步「拉」的逆操作恰好是合法的「推」，最终得到的局面**必然可解**，
   而且拉箱序列本身就是一条参考解法。
3. **难度评级**：用 A\* 搜索（以推动次数为代价，带角落死锁剪枝）求出最优推动数，
   按这个数值把关卡分配到初级 / 中级 / 高级，并从小到大排序。

重新生成关卡：

```bash
python3 scripts/build_levels.py                 # 全部三档
python3 scripts/build_levels.py --tier advanced # 只生成某一档
python3 scripts/build_levels.py --jobs 8        # 指定并行进程数
python3 scripts/make_icons.py                   # 重新生成图标
```

生成结果写入 `src/data/levels.js`。只生成部分难度时会自动与已有文件合并。

---

## 操作方式

| 操作 | 键盘 | 触屏 |
| --- | --- | --- |
| 移动 | 方向键 / WASD | 在棋盘上滑动，或点虚拟方向键 |
| 撤销 | `U` 或 `Ctrl+Z` | 点击撤销按钮 |
| 重开 | `R` | 点击重开按钮 |

长按虚拟方向键可以连续移动。

---

## 安装到手机

### 方式 A：直接作为 PWA

网页版本身就是 PWA，无需打包：

- **Android / Chrome**：菜单里选择「添加到主屏幕」
- **iOS / Safari**：分享 → 「添加到主屏幕」

### 方式 B：用 Capacitor 打包上架（推荐）

`www/` 目录里已是打包所需的全部 Web 资源，`capacitor.config.json` 和 `package.json` 已就位。完成首次接入：

```bash
# 安装依赖（Node.js ≥ 18，macOS 推荐 brew install node）
npm install

# 同步 Web 资源并添加 iOS 平台（需要 Xcode + CocoaPods）
npm run cap:sync
npx cap add ios
npx cap open ios        # 启动 Xcode，选择真机/模拟器运行

# Android 平台（需要 Android Studio + ANDROID_HOME）
npx cap add android
npx cap open android    # 启动 Android Studio
```

或者用脚本一次性处理：

```bash
bash scripts/add-platforms.sh all
```

每次修改了 Web 代码后：

```bash
npm run cap:sync        # 复制资源并更新原生工程
# 然后到 Xcode / Android Studio 里重新 Run
```

#### 准备上架

**iOS（App Store）**
1. Apple Developer Program 账号（$99/年）
2. 在 Xcode 里把 Bundle Identifier 改成自己的（如 `com.yourname.sokoban`）
3. 设置 Signing & Capabilities → Team 选自己的证书
4. 提供隐私政策 URL（一行静态网页即可，参考 GitHub Pages）
5. 准备 6.7" / 6.1" / 5.5" 截图（用模拟器启动游戏后 `Cmd+S`）
6. Product → Archive → Distribute App → App Store Connect
7. 在 App Store Connect 提交审核（一般 24–48 小时）

**Android（Google Play / 国内商店）**
1. 在 `android/app/build.gradle` 把 `applicationId` 改成自己的
2. 生成签名密钥：`keytool -genkey -v -keystore release.keystore ...`
3. Build → Generate Signed Bundle / APK → 选 AAB 格式
4. Google Play 上传：$25 一次性注册费
5. 国内商店：腾讯应用宝、华为、小米、OPPO、vivo 都要求软著 + ICP 备案

#### 常见坑

- **包名/包 ID 一旦上架不要改**，升级包名会被识别为另一款 app
- **iOS WKWebView 会拦截 `file://`**，但 Capacitor 用 `capacitor://`（Android 用 `https://localhost`）已经解决
- **Service Worker 缓存** 在原生壳里仍然生效，但更新时建议发版前 bump `sw.js` 顶部的 `CACHE_NAME`
- **音频** 首次播放需要用户交互（点击 / 按键），iOS 策略严格，已经在首次按键时初始化 AudioContext
- **图片资源体积** 全部图标已预生成到 `icons/`，不要临时引用 `src/data/levels.js` 之外的远程资源

