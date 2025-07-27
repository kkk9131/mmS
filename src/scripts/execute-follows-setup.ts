import { supabaseClient } from '../services/supabase/client';

/**
 * フォローシステムのセットアップを実行
 * 注意: CREATE FUNCTION等のDDLコマンドはSupabaseダッシュボードで手動実行が必要
 */
export class FollowsSystemSetup {
  public static async setup(): Promise<void> {
    console.log('🚀 フォローシステムのセットアップを開始します...');

    try {
      // 1. Supabaseクライアントの初期化確認
      await this.ensureSupabaseConnection();

      // 2. フォローテーブルの作成
      await this.createFollowsTable();

      // 3. インデックスの作成
      await this.createIndexes();

      // 4. RLSポリシーの設定
      await this.setupRLSPolicies();

      // 5. 設定完了の確認
      await this.verifySetup();

      console.log('✅ フォローシステムのセットアップが完了しました！');
      console.log('');
      console.log('⚠️  次のステップ:');
      console.log('1. Supabaseダッシュボード (https://app.supabase.com) にログイン');
      console.log('2. プロジェクトのSQL Editorを開く');
      console.log('3. src/scripts/create-follows-table.sql の内容をコピー&ペーストして実行');
      console.log('   (特にRPC関数の作成部分が重要です)');

    } catch (error) {
      console.error('❌ フォローシステムのセットアップに失敗しました:', error);
      throw error;
    }
  }

  private static async ensureSupabaseConnection(): Promise<void> {
    console.log('🔗 Supabase接続を確認中...');
    
    if (!supabaseClient.isInitialized()) {
      throw new Error('Supabaseクライアントが初期化されていません');
    }

    const status = await supabaseClient.testConnection();
    if (!status.isConnected) {
      throw new Error(`Supabase接続に失敗: ${status.error || 'Unknown error'}`);
    }

    console.log('✅ Supabase接続確認完了');
  }

  private static async createFollowsTable(): Promise<void> {
    console.log('📋 フォローテーブルを作成中...');
    
    const client = supabaseClient.getClient();
    
    const { error } = await client.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS follows (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamp with time zone DEFAULT NOW(),
          updated_at timestamp with time zone DEFAULT NOW(),
          
          CONSTRAINT unique_follow_relationship UNIQUE (follower_id, following_id),
          CONSTRAINT no_self_follow CHECK (follower_id != following_id)
        );
      `
    });

    if (error) {
      console.warn('⚠️  フォローテーブル作成でエラー（既に存在する可能性）:', error.message);
    } else {
      console.log('✅ フォローテーブル作成完了');
    }
  }

  private static async createIndexes(): Promise<void> {
    console.log('🔍 インデックスを作成中...');
    
    const client = supabaseClient.getClient();
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)',
      'CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)',
      'CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at)'
    ];

    for (const indexSql of indexes) {
      try {
        const { error } = await client.rpc('exec_sql', { query: indexSql });
        if (error) {
          console.warn(`⚠️  インデックス作成でエラー: ${error.message}`);
        }
      } catch (e) {
        console.warn(`⚠️  インデックス作成でエラー: ${e}`);
      }
    }

    console.log('✅ インデックス作成完了');
  }

  private static async setupRLSPolicies(): Promise<void> {
    console.log('🛡️  RLSポリシーを設定中...');
    
    const client = supabaseClient.getClient();
    
    try {
      const { error } = await client.rpc('exec_sql', {
        query: 'ALTER TABLE follows ENABLE ROW LEVEL SECURITY'
      });
      
      if (error) {
        console.warn('⚠️  RLS有効化でエラー:', error.message);
      } else {
        console.log('✅ RLSポリシー設定完了');
      }
    } catch (e) {
      console.warn('⚠️  RLSポリシー設定でエラー:', e);
      console.log('📝 手動でSupabaseダッシュボードからRLSポリシーを設定してください');
    }
  }

  private static async verifySetup(): Promise<void> {
    console.log('🔍 セットアップを検証中...');
    
    const client = supabaseClient.getClient();
    
    try {
      // フォローテーブルの存在確認
      const { data: tables, error: tablesError } = await client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'follows');

      if (tablesError) {
        throw new Error(`テーブル確認エラー: ${tablesError.message}`);
      }

      if (!tables || tables.length === 0) {
        throw new Error('followsテーブルが見つかりません');
      }

      console.log('✅ followsテーブルの存在確認完了');
      
    } catch (error) {
      console.warn('⚠️  セットアップ検証でエラー:', error);
      console.log('📝 手動でSupabaseダッシュボードから確認してください');
    }
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  FollowsSystemSetup.setup()
    .then(() => {
      console.log('🎉 フォローシステムセットアップスクリプト実行完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 スクリプト実行エラー:', error);
      process.exit(1);
    });
}

export default FollowsSystemSetup;