/**
 * 開発環境判定とデバッグユーティリティ
 * mamapaceアプリの本番環境セキュリティ確保
 */

/**
 * 開発環境判定（厳密）
 * 本番環境では絶対にtrueにならない
 */
export const isDevelopment = (): boolean => {
  return __DEV__ && (process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_ENV !== 'production');
};

/**
 * 条件付きコンソールログ（開発環境のみ）
 * @param message ログメッセージ
 * @param data 追加データ（オプション）
 */
export const devLog = (message: string, data?: any): void => {
  if (isDevelopment()) {
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

/**
 * 条件付きエラーログ（開発環境のみ詳細、本番環境は最小限）
 * @param message エラーメッセージ
 * @param error エラーオブジェクト
 */
export const devError = (message: string, error?: any): void => {
  if (isDevelopment()) {
    console.error(message, error);
  } else {
    // 本番環境では最小限のエラー情報のみ
    console.error(message);
  }
};

/**
 * 条件付き警告ログ（開発環境のみ）
 * @param message 警告メッセージ
 * @param data 追加データ（オプション）
 */
export const devWarn = (message: string, data?: any): void => {
  if (isDevelopment()) {
    if (data !== undefined) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
  }
};

/**
 * 画像URL表示用のセーフな短縮関数
 * プライバシー保護のため完全URLは表示しない
 * @param url 画像URL
 * @returns 短縮された安全なURL表示
 */
export const safeUrlDisplay = (url?: string): string => {
  if (!url) return 'なし';
  
  // URLが50文字以上の場合は短縮表示
  if (url.length > 50) {
    return url.substring(0, 30) + '...' + url.substring(url.length - 10);
  }
  return url;
};

/**
 * オブジェクトの安全な表示用変換
 * 機密情報を除外してログ表示用に変換
 * @param obj 元オブジェクト
 * @returns 安全な表示用オブジェクト
 */
export const safeObjectDisplay = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const safe: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // 機密情報のキーは除外
    if (['password', 'token', 'secret', 'key', 'private'].some(secret => 
      key.toLowerCase().includes(secret)
    )) {
      safe[key] = '[HIDDEN]';
    } else if (typeof value === 'string' && value.length > 100) {
      // 長い文字列は短縮
      safe[key] = value.substring(0, 50) + '...';
    } else {
      safe[key] = value;
    }
  }
  
  return safe;
};