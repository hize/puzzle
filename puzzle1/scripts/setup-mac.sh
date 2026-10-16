#!/usr/bin/env bash
# 给当前 shell 注入 macOS 上 Capacitor 需要的开发环境。
# 用法: source scripts/setup-mac.sh
#      或  eval "$(scripts/setup-mac.sh print)"
# 不会修改 xcode-select（那需要 sudo）。
set -e

# 1) 指向完整 Xcode（如果当前指向的是 CommandLineTools）
if command -v xcodebuild >/dev/null 2>&1; then
  active="$(xcode-select -p 2>/dev/null || true)"
  if [ -d "/Applications/Xcode.app" ] && [ "$active" = "/Library/Developer/CommandLineTools" ]; then
    export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
    echo "[setup] DEVELOPER_DIR=$DEVELOPER_DIR"
  fi
fi

# 2) 寻找可用的 JDK
# 优先用 Android Studio 自带的 JBR；否则保留系统已有的 java
AS_JDK="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -x "$AS_JDK/bin/java" ]; then
  if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    export JAVA_HOME="$AS_JDK"
    export PATH="$JAVA_HOME/bin:$PATH"
    echo "[setup] JAVA_HOME=$JAVA_HOME (from Android Studio)"
  fi
elif ! command -v java >/dev/null 2>&1; then
  if /usr/libexec/java_home -V >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home 2>/dev/null || true)"
    [ -n "$JAVA_HOME" ] && export PATH="$JAVA_HOME/bin:$PATH" && echo "[setup] JAVA_HOME=$JAVA_HOME"
  else
    echo "[setup] 未找到 JDK，请先安装：brew install openjdk@17"
    return 1 2>/dev/null || exit 1
  fi
fi

# 3) Android SDK
if [ -d "$HOME/Library/Android/sdk" ] && [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  echo "[setup] ANDROID_HOME=$ANDROID_HOME"
fi
