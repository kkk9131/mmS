# 🌐 Mamapace ドメイン・SSL設定ガイド

## 📋 概要

MamapaceはReact Native（Expo）モバイルアプリのため、**現時点では独自ドメイン・SSL設定は不要**です。
ただし、将来的なWeb版・管理画面・ランディングページ作成時に必要となる設定手順をガイドします。

## 🎯 推奨アプローチ

### 現在（フェーズ1）: Supabaseドメインのまま ✅
```bash
# 現在の設定（変更不要）
EXPO_PUBLIC_SUPABASE_URL=https://zfmqxdkqpeyvsuqyzuvy.supabase.co
# メリット: コスト不要、高セキュリティ、すぐに本番移行可能
```

### 将来（フェーズ2）: 独自ドメイン・Web版作成時
以下の手順で独自ドメインを設定

---

# 🔧 詳細実装手順

## ステップ1: ドメイン取得

### 1.1 ドメイン名決定
```bash
# 推奨ドメイン名
mamapace.app          # 第1候補（アプリらしい）
mamapace.com          # 第2候補（一般的） 
mama-peace.app        # 第3候補（意味を強調）
```

### 1.2 ドメイン取得サービス選択
| サービス | 年間料金 | メリット | デメリット |
|----------|----------|----------|------------|
| お名前.com | 1,000-3,000円 | 日本語サポート | 更新料高い |
| Cloudflare | $8-12 | 安価、CDN統合 | 英語のみ |
| ムームードメイン | 1,500円～ | 日本企業、安い | 機能限定 |

### 1.3 ドメイン購入手順
```bash
# Cloudflareでの購入例
1. https://www.cloudflare.com/ja-jp/ にアクセス
2. "ドメインを登録" → ドメイン名入力
3. 支払い情報入力・購入完了
4. DNS管理画面に移動
```

## ステップ2: DNS設定

### 2.1 基本DNSレコード設定
```bash
# DNS レコード設定（Cloudflare管理画面）
Type    Name        Value                               TTL    Proxy
A       @           104.21.xxx.xxx (CloudflareのIP)     Auto   Proxied
CNAME   www         mamapace.app                        Auto   Proxied  
CNAME   api         zfmqxdkqpeyvsuqyzuvy.supabase.co   Auto   DNS only
CNAME   admin       admin.mamapace.app                  Auto   Proxied
TXT     @           "v=spf1 include:_spf.google.com ~all" Auto   DNS only
```

### 2.2 サブドメイン設定
```bash
# 将来の拡張を考慮したサブドメイン設計
www.mamapace.app      # メインサイト
api.mamapace.app      # API（現在はSupabase）
admin.mamapace.app    # 管理画面
blog.mamapace.app     # ブログ・お知らせ
help.mamapace.app     # ヘルプ・サポート
```

## ステップ3: SSL証明書設定

### 3.1 Cloudflare SSL設定
```javascript
// Cloudflare SSL/TLS設定
{
  "ssl_mode": "Full (strict)",
  "universal_ssl": true,
  "always_use_https": true,
  "hsts": {
    "enabled": true,
    "max_age": 31536000,
    "include_subdomains": true,
    "preload": true
  }
}
```

### 3.2 セキュリティヘッダー設定
```javascript
// Page Rules または Workers で設定
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
}
```

### 3.3 SSL品質確認
```bash
# SSL設定確認方法
1. https://www.ssllabs.com/ssltest/ でテスト
2. A+ レーティング目標
3. 主要チェック項目:
   - Certificate: Valid
   - Protocol Support: TLS 1.2, 1.3のみ
   - Key Exchange: 強度十分
   - Cipher Strength: 強度十分
```

## ステップ4: Webアプリケーション作成（オプション）

### 4.1 簡単なランディングページ
```bash
# Next.js でのランディングページ作成例
mkdir mamapace-web && cd mamapace-web
npx create-next-app@latest . --typescript --tailwind --app
```

```typescript
// app/page.tsx - 簡単なランディングページ
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Mamapace - 母親向けSNSアプリ
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            育児の悩みを共有し、支え合うコミュニティ
          </p>
          <div className="space-x-4">
            <a href="#" className="bg-pink-500 text-white px-6 py-3 rounded-lg">
              App Store からダウンロード
            </a>
            <a href="#" className="bg-green-500 text-white px-6 py-3 rounded-lg">
              Google Play からダウンロード
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 4.2 Vercel デプロイ設定
```bash
# Vercelでのデプロイ
npm install -g vercel
vercel --prod

# カスタムドメイン設定
vercel domains add mamapace.app
vercel alias <deployment-url> mamapace.app
```

---

# 📊 費用・時間見積もり

## 費用見積もり
| 項目 | 費用 | 備考 |
|------|------|------|
| ドメイン取得 | $8-30/年 | .app, .com により変動 |
| Cloudflare Pro | $20/月 | 高度なセキュリティ機能 |
| Vercel Pro | $20/月 | Web版ホスティング |
| **合計** | **$50-90/月** | **Web版作成時のみ** |

## 時間見積もり
| タスク | 時間 | 備考 |
|--------|------|------|
| ドメイン取得・DNS設定 | 2-4時間 | 初回のみ |
| SSL・セキュリティ設定 | 2-3時間 | 初回のみ |
| ランディングページ作成 | 8-16時間 | デザインによる |
| **合計** | **12-23時間** | **1-3日程度** |

---

# 🚨 重要な注意事項

## 現在のフェーズでは不要 ⚠️
- **Mamapaceは現在モバイルアプリのみ**
- **Supabaseドメインで十分セキュア**
- **独自ドメインは追加コストが発生**
- **本番環境移行を優先すべき**

## いつ実装すべきか 🤔
✅ **実装推奨タイミング:**
- Web版・PWA作成時
- 管理画面作成時  
- マーケティングサイト必要時
- ブランディング強化時

❌ **今は不要:**
- モバイルアプリのみの現段階
- 初期ユーザー獲得フェーズ
- 機能開発優先時期

---

# 📋 実装チェックリスト

## 事前準備
- [ ] Web版・管理画面の必要性確認
- [ ] ドメイン名候補リスト作成
- [ ] 予算・時間の確保

## ドメイン取得
- [ ] ドメインレジストラ選定
- [ ] ドメイン名取得
- [ ] 所有者情報設定・確認

## DNS・SSL設定  
- [ ] Cloudflareアカウント作成
- [ ] DNS レコード設定
- [ ] SSL/TLS設定（Full Strict）
- [ ] セキュリティヘッダー設定
- [ ] SSL品質テスト（A+達成）

## Webアプリケーション
- [ ] ランディングページ作成
- [ ] Vercelデプロイ設定
- [ ] カスタムドメイン接続
- [ ] 動作確認・テスト

## 運用準備
- [ ] 監視・アラート設定
- [ ] ドメイン更新リマインダー
- [ ] SSL証明書更新確認
- [ ] DNS設定バックアップ

---

**現在のMamapaceプロジェクトでは、P1.2は「将来の準備」として位置づけ、P1.3（パフォーマンス最適化）やP3（品質保証・テスト）を優先することを推奨します。** 🚀