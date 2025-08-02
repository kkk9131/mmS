# TODO機能実装に必要なパッケージインストール手順

## 必要なパッケージ

TODO機能の実装で使用している以下のパッケージをインストールする必要があります：

### 1. @react-native-community/netinfo
ネットワーク状態の監視に使用（backgroundSync.tsで使用）

```bash
npm install @react-native-community/netinfo
# または
yarn add @react-native-community/netinfo
```

### 2. @react-native-community/datetimepicker
時刻選択モーダルに使用（TimePickerModal.tsxで使用）

```bash
npm install @react-native-community/datetimepicker
# または
yarn add @react-native-community/datetimepicker
```

## Expo設定

### app.json/app.config.jsの更新
```json
{
  "expo": {
    "plugins": [
      "@react-native-community/datetimepicker"
    ]
  }
}
```

## プラットフォーム固有の設定

### iOS
特別な設定は不要です。`expo install`を使用した場合、自動的に設定されます。

### Android
DateTimePickerは自動的に設定されます。NetInfoについても追加設定は不要です。

## 代替実装（パッケージなしで実行する場合）

もしパッケージをインストールしたくない場合は、以下のファイルを修正してください：

### 1. backgroundSync.ts
```typescript
// NetInfoの代わりにmock実装を使用
const NetInfo = {
  addEventListener: () => () => {},
  fetch: () => Promise.resolve({ isConnected: true })
};
```

### 2. TimePickerModal.tsx
```typescript
// DateTimePickerの代わりにTextInputを使用
// または既存のAlert.promptを使用した簡易実装
```

## インストール後の確認

パッケージインストール後、以下のコマンドで確認：

```bash
# 依存関係のチェック
npx expo doctor

# iOS設定の確認
npx expo run:ios

# Android設定の確認  
npx expo run:android
```

## エラーが発生した場合

### Metro bundlerエラー
```bash
npx expo start --clear
```

### Podfile関連エラー（iOS）
```bash
cd ios && pod install && cd ..
```

### Gradle関連エラー（Android）
```bash
cd android && ./gradlew clean && cd ..
```