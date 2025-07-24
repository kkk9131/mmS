import { ValidationResult, ValidationRules, JWTAuthError } from './types';
import { JWTUtils } from './JWTUtils';

export class TokenValidator {
  private rules: ValidationRules;
  private issuer: string;
  private audience: string;

  constructor(
    rules?: Partial<ValidationRules>,
    issuer: string = 'mamapace-app',
    audience: string = 'mamapace-users'
  ) {
    this.rules = {
      checkExpiry: true,
      checkFormat: true,
      checkSignature: false, // Supabaseトークンは外部署名のため無効化
      checkIssuer: true,
      checkAudience: true,
      ...rules,
    };
    this.issuer = issuer;
    this.audience = audience;
  }

  validateToken(token: string): ValidationResult {
    const errors: string[] = [];
    let payload: any = null;
    let expiresAt: Date | undefined;

    try {
      // 基本的な形式チェック
      if (this.rules.checkFormat && !this.validateJWTFormat(token)) {
        errors.push('無効なJWTフォーマットです');
      }

      // トークンデコード
      try {
        payload = JWTUtils.decodePayload(token);
        if (!payload) {
          errors.push('トークンのデコードに失敗しました');
          return { isValid: false, errors };
        }
      } catch (error) {
        errors.push(`トークンの解析に失敗しました: ${error}`);
        return { isValid: false, errors };
      }

      // 期限チェック
      if (this.rules.checkExpiry && !this.validateExpiry(payload)) {
        errors.push('トークンが期限切れです');
      }

      // 発行者チェック
      if (this.rules.checkIssuer && !this.validateIssuer(payload)) {
        errors.push('無効な発行者です');
      }

      // 対象者チェック
      if (this.rules.checkAudience && !this.validateAudience(payload)) {
        errors.push('無効な対象者です');
      }

      // その他のクレームチェック
      if (!this.validateClaims(payload)) {
        errors.push('無効なクレームです');
      }

      // 期限日を設定
      if (payload.exp) {
        expiresAt = new Date(payload.exp * 1000);
      }

    } catch (error) {
      errors.push(`検証中にエラーが発生しました: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      payload: errors.length === 0 ? payload : undefined,
      expiresAt,
    };
  }

  validateAccessToken(token: string): ValidationResult {
    const result = this.validateToken(token);
    
    if (result.isValid && result.payload) {
      // アクセストークン固有の検証
      const tokenType = result.payload.token_type || result.payload.typ;
      if (tokenType && tokenType !== 'access') {
        result.errors.push('アクセストークンではありません');
        result.isValid = false;
      }

      // スコープチェック
      const scope = result.payload.scope;
      if (!scope || !Array.isArray(scope) || scope.length === 0) {
        result.errors.push('有効なスコープが設定されていません');
        result.isValid = false;
      }
    }

    return result;
  }

  validateRefreshToken(token: string): ValidationResult {
    const result = this.validateToken(token);
    
    if (result.isValid && result.payload) {
      // リフレッシュトークン固有の検証
      const tokenType = result.payload.token_type || result.payload.typ;
      if (tokenType && tokenType !== 'refresh') {
        result.errors.push('リフレッシュトークンではありません');
        result.isValid = false;
      }

      // リフレッシュトークンは長期間有効なので、より厳格な検証
      if (!result.payload.jti) {
        result.errors.push('一意識別子(JTI)が設定されていません');
        result.isValid = false;
      }
    }

    return result;
  }

  private validateJWTFormat(token: string): boolean {
    return JWTUtils.validateFormat(token);
  }

  private validateExpiry(payload: any): boolean {
    if (!payload.exp) {
      return false; // expクレームが必須
    }

    const expirationTime = payload.exp * 1000; // JWTのexpは秒単位
    const now = Date.now();
    const gracePeriod = 30 * 1000; // 30秒の猶予期間

    return now < (expirationTime + gracePeriod);
  }

  private validateIssuer(payload: any): boolean {
    if (!this.rules.checkIssuer) {
      return true;
    }

    const iss = payload.iss;
    if (!iss) {
      return false;
    }

    // Supabaseのissuerパターンもサポート
    return iss === this.issuer || 
           iss.includes('supabase') || 
           iss.includes('mamapace');
  }

  private validateAudience(payload: any): boolean {
    if (!this.rules.checkAudience) {
      return true;
    }

    const aud = payload.aud;
    if (!aud) {
      return false;
    }

    // audienceは文字列または文字列配列
    if (Array.isArray(aud)) {
      return aud.includes(this.audience) || 
             aud.some(a => a.includes('mamapace'));
    }

    return aud === this.audience || aud.includes('mamapace');
  }

  private validateClaims(payload: any): boolean {
    // 必須クレームのチェック
    const requiredClaims = ['sub', 'iat'];
    for (const claim of requiredClaims) {
      if (!payload[claim]) {
        return false;
      }
    }

    // 発行時刻が未来でないことをチェック
    if (payload.iat) {
      const issuedAt = payload.iat * 1000;
      const now = Date.now();
      const maxSkew = 5 * 60 * 1000; // 5分の時刻ずれを許容

      if (issuedAt > (now + maxSkew)) {
        return false;
      }
    }

    // nbf (Not Before) クレームのチェック
    if (payload.nbf) {
      const notBefore = payload.nbf * 1000;
      const now = Date.now();
      if (now < notBefore) {
        return false;
      }
    }

    return true;
  }

  // セキュリティ強化のための追加検証メソッド
  validateTokenSecurity(token: string, 
    options?: {
      maxAge?: number; // 最大許可年齢（ミリ秒）
      requiredScopes?: string[]; // 必須スコープ
      allowedIssuers?: string[]; // 許可された発行者リスト
    }
  ): ValidationResult {
    const result = this.validateToken(token);
    
    if (!result.isValid) {
      return result;
    }

    const payload = result.payload!;
    const errors: string[] = [];

    // 最大年齢チェック
    if (options?.maxAge && payload.iat) {
      const tokenAge = Date.now() - (payload.iat * 1000);
      if (tokenAge > options.maxAge) {
        errors.push('トークンが古すぎます');
      }
    }

    // 必須スコープチェック
    if (options?.requiredScopes && payload.scope) {
      const tokenScopes = Array.isArray(payload.scope) ? payload.scope : [payload.scope];
      const missingScopes = options.requiredScopes.filter(
        scope => !tokenScopes.includes(scope)
      );
      if (missingScopes.length > 0) {
        errors.push(`必要なスコープが不足しています: ${missingScopes.join(', ')}`);
      }
    }

    // 許可された発行者チェック
    if (options?.allowedIssuers && payload.iss) {
      if (!options.allowedIssuers.includes(payload.iss)) {
        errors.push('許可されていない発行者です');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: [...result.errors, ...errors],
      payload: result.payload,
      expiresAt: result.expiresAt,
    };
  }

  // トークンのメタデータ取得
  getTokenMetadata(token: string): {
    header: any;
    payload: any;
    signature: string;
  } | null {
    try {
      const { header, payload, signature } = JWTUtils.parseJWT(token);
      return { header, payload, signature };
    } catch (error) {
      return null;
    }
  }
}