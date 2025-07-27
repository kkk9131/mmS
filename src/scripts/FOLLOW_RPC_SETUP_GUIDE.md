# フォロー機能RPC関数設定ガイド

## 概要

このガイドでは、MamapaceアプリケーションでSupabaseのRLS（Row Level Security）ポリシーを回避してフォロー機能を実装するためのRPC関数の設定方法を説明します。

## 作成されるRPC関数

以下の3つのRPC関数を作成します：

1. **follow_user** - ユーザーをフォローする
2. **unfollow_user** - ユーザーのフォローを解除する
3. **get_follow_relationship** - 2人のユーザー間のフォロー関係を取得する

## 実装手順

### ステップ1: Supabaseダッシュボードにアクセス

1. [Supabaseダッシュボード](https://supabase.com/dashboard)にアクセス
2. プロジェクト `zfmqxdkqpeyvsuqyzuvy` を選択
3. 左側メニューから **SQL Editor** を選択

### ステップ2: RPC関数の作成

以下のSQLスクリプトをSQL Editorにコピー＆ペーストして実行してください：

#### 完全なSQLスクリプト

```sql
-- フォロー機能用のRPC関数を作成（Supabaseダッシュボードで手動実行用）
-- 以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください

-- 1. フォローする関数
CREATE OR REPLACE FUNCTION follow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- 自分自身をフォローできない
  IF p_follower_id = p_following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  
  -- 既にフォローしているかチェック
  IF EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = p_follower_id
    AND following_id = p_following_id
  ) THEN
    RETURN TRUE; -- 既にフォロー済み
  END IF;
  
  -- フォロー関係を作成
  INSERT INTO follows (follower_id, following_id)
  VALUES (p_follower_id, p_following_id);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. フォロー解除する関数
CREATE OR REPLACE FUNCTION unfollow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM follows
  WHERE follower_id = p_follower_id
  AND following_id = p_following_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. フォロー関係を取得する関数
CREATE OR REPLACE FUNCTION get_follow_relationship(
  p_user_id UUID,
  p_target_user_id UUID
) RETURNS TABLE (
  is_following BOOLEAN,
  is_followed_by BOOLEAN,
  followed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = p_user_id
      AND following_id = p_target_user_id
    ) AS is_following,
    EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = p_target_user_id
      AND following_id = p_user_id
    ) AS is_followed_by,
    (
      SELECT created_at FROM follows
      WHERE follower_id = p_user_id
      AND following_id = p_target_user_id
      LIMIT 1
    ) AS followed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 権限を付与
GRANT EXECUTE ON FUNCTION follow_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unfollow_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_follow_relationship TO anon, authenticated;
```

### ステップ3: 動作確認

RPC関数が正常に作成されたことを確認するために、以下のテストスクリプトを実行してください：

```bash
npx tsx src/scripts/test-follow-rpc-functions.ts
```

### ステップ4: アプリケーションでの使用方法

作成したRPC関数は、以下のようにSupabaseクライアントから呼び出せます：

#### TypeScript/JavaScriptでの使用例

```typescript
import { supabaseClient } from '../services/supabase/client';

// ユーザーをフォローする
const followUser = async (followerId: string, followingId: string) => {
  const { data, error } = await supabaseClient.rpc('follow_user', {
    p_follower_id: followerId,
    p_following_id: followingId
  });
  
  if (error) {
    console.error('フォローエラー:', error);
    return false;
  }
  
  return data;
};

// ユーザーのフォローを解除する
const unfollowUser = async (followerId: string, followingId: string) => {
  const { data, error } = await supabaseClient.rpc('unfollow_user', {
    p_follower_id: followerId,
    p_following_id: followingId
  });
  
  if (error) {
    console.error('フォロー解除エラー:', error);
    return false;
  }
  
  return data;
};

// フォロー関係を取得する
const getFollowRelationship = async (userId: string, targetUserId: string) => {
  const { data, error } = await supabaseClient.rpc('get_follow_relationship', {
    p_user_id: userId,
    p_target_user_id: targetUserId
  });
  
  if (error) {
    console.error('フォロー関係取得エラー:', error);
    return null;
  }
  
  return data[0]; // { is_following: boolean, is_followed_by: boolean, followed_at: string }
};
```

## 関数の詳細仕様

### follow_user関数

**パラメータ:**
- `p_follower_id` (UUID): フォローするユーザーのID
- `p_following_id` (UUID): フォローされるユーザーのID

**戻り値:**
- `BOOLEAN`: 成功時は `true`、失敗時は `false`

**エラーケース:**
- 自分自身をフォローしようとした場合: `Cannot follow yourself` 例外
- 既にフォローしている場合: `true` を返す（重複防止）

### unfollow_user関数

**パラメータ:**
- `p_follower_id` (UUID): フォロー解除するユーザーのID
- `p_following_id` (UUID): フォロー解除されるユーザーのID

**戻り値:**
- `BOOLEAN`: 成功時は `true`、失敗時は `false`

### get_follow_relationship関数

**パラメータ:**
- `p_user_id` (UUID): 基準となるユーザーのID
- `p_target_user_id` (UUID): 関係を調べる対象ユーザーのID

**戻り値:**
- テーブル形式のデータ:
  - `is_following` (BOOLEAN): `p_user_id` が `p_target_user_id` をフォローしているか
  - `is_followed_by` (BOOLEAN): `p_user_id` が `p_target_user_id` にフォローされているか
  - `followed_at` (TIMESTAMPTZ): フォローした日時（フォローしていない場合はNULL）

## セキュリティ考慮事項

- すべての関数は `SECURITY DEFINER` として作成されており、RLSポリシーを回避して実行されます
- `anon` および `authenticated` ロールに実行権限が付与されています
- 自分自身をフォローすることを防ぐ検証が組み込まれています
- エラーハンドリングが実装されており、例外が発生しても `false` を返します

## トラブルシューティング

### 関数が見つからないエラー
```
Could not find the function public.follow_user(...) in the schema cache
```

**解決方法:**
1. Supabaseダッシュボードで上記のSQLスクリプトが正常に実行されたか確認
2. SQL Editorでエラーメッセージが表示されていないか確認
3. 必要に応じて関数を再作成

### 権限エラー
```
permission denied for function follow_user
```

**解決方法:**
1. GRANT文が実行されているか確認
2. 必要に応じて権限を再付与：
```sql
GRANT EXECUTE ON FUNCTION follow_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unfollow_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_follow_relationship TO anon, authenticated;
```

## 関連ファイル

- `/src/scripts/create-follow-rpc.sql` - 元のRPC関数定義
- `/src/scripts/follow-rpc-manual-setup.sql` - 手動実行用SQLファイル
- `/src/scripts/execute-follow-rpc.ts` - 自動実行スクリプト（参考用）
- `/src/scripts/test-follow-rpc-functions.ts` - テストスクリプト
- `/test-reports/follow-rpc-test-*.json` - テスト結果レポート

## 次のステップ

1. RPC関数の作成が完了したら、アプリケーションのフォロー機能UIコンポーネントでこれらの関数を使用
2. フォロー機能のユニットテストを作成
3. フォロー機能のUIテストを実装
4. パフォーマンステストでフォロー機能の負荷テストを実施

---

**注意:** このガイドは、Mamapace本番環境（`zfmqxdkqpeyvsuqyzuvy`）での実装を前提としています。開発環境や他のプロジェクトで使用する場合は、適切な環境変数と設定を使用してください。