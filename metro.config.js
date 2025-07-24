const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// この設定でパス解決問題を修正
config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('sql');

// キャッシュの問題を防ぐ設定
config.resetCache = true;

module.exports = config;