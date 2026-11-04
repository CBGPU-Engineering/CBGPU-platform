#!/usr/bin/env bash
set -euo pipefail
app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
flutter_dir="${CBGPU_FLUTTER_DIR:-$HOME/develop/flutter}"
signing_dir="${CBGPU_SIGNING_DIR:-$HOME/.local/share/cbgpu-signing}"
if [[ ! -f "$signing_dir/cbgpu-release.jks" || ! -f "$app_dir/android/key.properties" ]]; then
  echo 'The existing release keystore and android/key.properties are required.' >&2
  exit 1
fi
docker run --rm \
  -v "$flutter_dir:/flutter" \
  -v "$app_dir:/app" \
  -v "$signing_dir:/signing" \
  -v cbgpu-flutter-pub-cache:/root/.pub-cache \
  -v cbgpu-flutter-gradle-cache:/root/.gradle \
  -v cbgpu-android-sdk:/opt/android-sdk-linux \
  -w /app \
  ghcr.io/cirruslabs/flutter@sha256:46691e311715845de03a3ba4753a475476936805b29431b1f00f1816981033f8 \
  bash -lc 'set -e; git config --global --add safe.directory /flutter; /flutter/bin/flutter pub get; /flutter/bin/flutter build apk --release'
