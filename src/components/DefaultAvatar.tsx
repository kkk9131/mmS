import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface DefaultAvatarProps {
  size?: number;
  name?: string;
  imageUrl?: string;
  style?: any;
}

export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({
  size = 40,
  name = '',
  imageUrl,
  style
}) => {
  // ユーザー名から初期文字を生成
  const getInitials = (userName: string): string => {
    if (!userName || userName.trim() === '') return '👤';
    
    // 日本語の場合は最初の1文字、英語の場合は最初の2文字の頭文字
    const trimmed = userName.trim();
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmed)) {
      // ひらがな、カタカナ、漢字が含まれる場合は最初の1文字
      return trimmed.charAt(0);
    } else {
      // 英語の場合は最初の2単語の頭文字
      const words = trimmed.split(' ').filter(word => word.length > 0);
      return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
    }
  };

  // 名前に基づいた一貫性のある背景色を生成
  const getBackgroundColor = (userName: string): string => {
    if (!userName) return colors.neutral.gray200;
    
    const pastelColors = [
      '#FFE0E0', // 薄いピンク
      '#E0F7F6', // 薄いティール
      '#E6F7FF', // 薄いブルー
      '#FFF7E0', // 薄いオレンジ
      '#F0E6FF', // 薄いパープル
      '#E0FFE0', // 薄いグリーン
      '#FFE0F7', // 薄いマゼンタ
      '#E0FFFF', // 薄いシアン
    ];
    
    // 名前の文字コードの合計を使って一貫した色を選択
    const hash = userName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return pastelColors[hash % pastelColors.length];
  };

  const getTextColor = (userName: string): string => {
    if (!userName) return colors.text.secondary;
    
    const darkColors = [
      colors.primary.dark,
      colors.secondary.dark,
      colors.semantic.info,
      '#D48806', // ダークオレンジ
      '#722ED1', // ダークパープル
      '#389E0D', // ダークグリーン
      '#C41D7F', // ダークマゼンタ
      '#0050B3', // ダークシアン
    ];
    
    const hash = userName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return darkColors[hash % darkColors.length];
  };

  if (imageUrl) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image 
          source={{ uri: imageUrl }}
          style={[styles.image, { width: size, height: size }]}
          onError={() => {
            // 画像読み込みエラー時のフォールバック処理
            console.warn('Avatar image failed to load:', imageUrl);
          }}
        />
      </View>
    );
  }

  const initials = getInitials(name);
  const backgroundColor = getBackgroundColor(name);
  const textColor = getTextColor(name);
  const fontSize = size > 60 ? typography.fontSize.xl : 
                   size > 40 ? typography.fontSize.lg : 
                   size > 30 ? typography.fontSize.md : typography.fontSize.sm;

  return (
    <View 
      style={[
        styles.container, 
        styles.defaultAvatar,
        { 
          width: size, 
          height: size, 
          backgroundColor,
          borderRadius: size / 2 
        }, 
        style
      ]}
    >
      <Text 
        style={[
          styles.initials, 
          { 
            fontSize, 
            color: textColor,
            lineHeight: size * 0.4 // 垂直中央揃えのための調整
          }
        ]}
      >
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 1000, // 大きな値で確実に円形にする
  },
  defaultAvatar: {
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  initials: {
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});