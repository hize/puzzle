#!/usr/bin/env bash
# 添加 iOS / Android 原生平台。
# 依赖：Node.js + (Xcode + CocoaPods) / (Android Studio + JDK + ANDROID_HOME)
# 自动处理：xcode-select 指向 CommandLineTools 的情况、Android Studio 自带 JDK。
set -euo pipefail
cd "$(dirname "$0")/.."

# 在 macOS 上注入 Xcode / JDK 路径
if [ "$(uname -s)" = "Darwin" ]; then
  # shellcheck disable=SC1091
  source scripts/setup-mac.sh
fi

echo "== 同步 Web 资源 =="
node scripts/build-www.js

echo "== 同步 Capacitor 配置 =="
npx cap sync

add_one() {
  local platform="$1"
  if [ -d "$platform" ]; then
    echo "$platform/ 已存在，跳过 cap add"
  else
    npx cap add "$platform"
  fi
}

if [ "${1:-}" = "ios" ] || [ "${1:-}" = "all" ] || [ -z "${1:-}" ]; then
  if command -v xcodebuild >/dev/null 2>&1 && command -v pod >/dev/null 2>&1; then
    add_one ios
  else
    echo "缺少 Xcode / CocoaPods，跳过 iOS"
  fi
fi

if [ "${1:-}" = "android" ] || [ "${1:-}" = "all" ] || [ -z "${1:-}" ]; then
  if [ -n "${ANDROID_HOME:-}" ] && [ -n "${JAVA_HOME:-}" ] && command -v java >/dev/null 2>&1; then
    add_one android
  else
    echo "缺少 Android SDK 或 JDK（ANDROID_HOME / JAVA_HOME），跳过 Android"
  fi
fi

echo
echo "完成。下一步："
echo "  npx cap open ios       # 用 Xcode 打开 iOS 工程"
echo "  npx cap open android   # 用 Android Studio 打开 Android 工程"
