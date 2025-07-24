import * as Crypto from 'expo-crypto';

export interface JWTHeader {
  typ: string;
  alg: string;
}

export interface JWTPayload {
  iss?: string; // issuer
  sub?: string; // subject
  aud?: string; // audience
  exp?: number; // expiration time
  nbf?: number; // not before
  iat?: number; // issued at
  jti?: string; // JWT ID
  [key: string]: any;
}

export class JWTUtils {
  /**
   * Base64URLエンコード（React Native対応）
   */
  static base64URLEncode(str: string): string {
    const base64 = Buffer.from(str, 'utf8').toString('base64');
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64URLデコード（React Native対応）
   */
  static base64URLDecode(str: string): string {
    // パディングを追加
    let padded = str;
    const padding = 4 - (str.length % 4);
    if (padding !== 4) {
      padded += '='.repeat(padding);
    }
    
    // URL-safeな文字を標準Base64に変換
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    
    try {
      return Buffer.from(base64, 'base64').toString('utf8');
    } catch (error) {
      throw new Error(`Base64URLデコードに失敗しました: ${error}`);
    }
  }

  /**
   * JWTのパース（検証なし）
   */
  static parseJWT(token: string): { header: JWTHeader; payload: JWTPayload; signature: string } {
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      throw new Error('無効なJWTフォーマットです');
    }

    try {
      const header = JSON.parse(this.base64URLDecode(parts[0])) as JWTHeader;
      const payload = JSON.parse(this.base64URLDecode(parts[1])) as JWTPayload;
      const signature = parts[2];

      return { header, payload, signature };
    } catch (error) {
      throw new Error(`JWTのパースに失敗しました: ${error}`);
    }
  }

  /**
   * JWTのペイロードのみを取得
   */
  static decodePayload(token: string): JWTPayload {
    const { payload } = this.parseJWT(token);
    return payload;
  }

  /**
   * JWTのヘッダーのみを取得
   */
  static decodeHeader(token: string): JWTHeader {
    const { header } = this.parseJWT(token);
    return header;
  }

  /**
   * トークンの期限チェック
   */
  static isExpired(token: string, gracePeriodSeconds: number = 30): boolean {
    try {
      const payload = this.decodePayload(token);
      
      if (!payload.exp) {
        return false; // expクレームがない場合は期限なしとみなす
      }

      const expirationTime = payload.exp * 1000; // JWTのexpは秒単位
      const now = Date.now();
      const gracePeriod = gracePeriodSeconds * 1000;

      return now >= (expirationTime + gracePeriod);
    } catch (error) {
      console.warn('Token expiry check failed:', error);
      return true; // パースに失敗した場合は期限切れとみなす
    }
  }

  /**
   * トークンの有効期限が近いかチェック
   */
  static isNearExpiry(token: string, thresholdSeconds: number): boolean {
    try {
      const payload = this.decodePayload(token);
      
      if (!payload.exp) {
        return false;
      }

      const expirationTime = payload.exp * 1000;
      const now = Date.now();
      const threshold = thresholdSeconds * 1000;

      return (expirationTime - now) <= threshold;
    } catch (error) {
      console.warn('Token near expiry check failed:', error);
      return true;
    }
  }

  /**
   * JWTの基本的な形式検証
   */
  static validateFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // 各部分がBase64URLエンコードされているかチェック
    for (const part of parts) {
      if (!/^[A-Za-z0-9_-]+$/.test(part)) {
        return false;
      }
    }

    // パース可能かチェック
    try {
      this.parseJWT(token);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * トークンのクレーム検証
   */
  static validateClaims(
    token: string,
    options: {
      issuer?: string;
      audience?: string;
      maxAge?: number; // 秒
    } = {}
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const payload = this.decodePayload(token);

      // 発行者チェック
      if (options.issuer && payload.iss !== options.issuer) {
        errors.push(`無効な発行者: 期待値=${options.issuer}, 実際値=${payload.iss}`);
      }

      // 対象者チェック
      if (options.audience) {
        const aud = payload.aud;
        let audienceValid = false;

        if (Array.isArray(aud)) {
          audienceValid = aud.includes(options.audience);
        } else if (typeof aud === 'string') {
          audienceValid = aud === options.audience;
        }

        if (!audienceValid) {
          errors.push(`無効な対象者: 期待値=${options.audience}, 実際値=${aud}`);
        }
      }

      // 最大年齢チェック
      if (options.maxAge && payload.iat) {
        const tokenAge = (Date.now() / 1000) - payload.iat;
        if (tokenAge > options.maxAge) {
          errors.push(`トークンが古すぎます: 年齢=${Math.floor(tokenAge)}秒, 最大=${options.maxAge}秒`);
        }
      }

      // 必須クレームチェック
      if (payload.exp === undefined) {
        errors.push('expクレームが必須です');
      }

      if (payload.iat === undefined) {
        errors.push('iatクレームが必須です');
      }

      // nbf (Not Before) チェック
      if (payload.nbf && payload.nbf > (Date.now() / 1000)) {
        errors.push('トークンはまだ有効ではありません');
      }

      // 発行時刻が未来でないことをチェック
      if (payload.iat && payload.iat > (Date.now() / 1000) + 300) { // 5分の猶予
        errors.push('発行時刻が未来に設定されています');
      }

    } catch (error) {
      errors.push(`トークンのパースに失敗しました: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 簡単なJWT作成（テスト用 - 本番では使用しない）
   */
  static async createMockJWT(payload: JWTPayload, expiresIn: number = 3600): Promise<string> {
    const header: JWTHeader = {
      typ: 'JWT',
      alg: 'HS256', // Mock only - 実際の署名は行わない
    };

    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
      iat: now,
      exp: now + expiresIn,
      ...payload,
    };

    const headerEncoded = this.base64URLEncode(JSON.stringify(header));
    const payloadEncoded = this.base64URLEncode(JSON.stringify(fullPayload));
    
    // Mock signature (セキュアではない - テスト用のみ)
    const mockSignature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${headerEncoded}.${payloadEncoded}.mock_secret`
    );
    
    const signatureEncoded = this.base64URLEncode(mockSignature.substring(0, 32));

    return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
  }

  /**
   * デバッグ用：JWTの情報を読みやすく表示
   */
  static debugJWT(token: string): void {
    try {
      const { header, payload } = this.parseJWT(token);
      
      console.log('=== JWT Debug Info ===');
      console.log('Header:', header);
      console.log('Payload:', payload);
      
      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const isExpired = this.isExpired(token);
        console.log(`Expires: ${expDate.toISOString()} (${isExpired ? 'EXPIRED' : 'VALID'})`);
      }
      
      if (payload.iat) {
        const iatDate = new Date(payload.iat * 1000);
        console.log(`Issued: ${iatDate.toISOString()}`);
      }
      
      console.log('======================');
    } catch (error) {
      console.error('JWT Debug failed:', error);
    }
  }
}