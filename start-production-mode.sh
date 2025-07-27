#!/bin/bash

echo "🚀 本番モードでアプリを起動します..."

# 本番環境変数を設定
export NODE_ENV=production
export EXPO_PUBLIC_DEBUG_MODE=false
export EXPO_PUBLIC_USE_SUPABASE=true
export EXPO_PUBLIC_USE_REDUX=true

# キャッシュクリア
echo "📦 キャッシュをクリアしています..."
npx expo start --clear

echo "✅ 本番モードで起動しました"
echo "📱 Expo Goアプリでスキャンしてテストしてください"