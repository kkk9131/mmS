import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface AccessibleDataDisplayProps {
  data: any[];
  title: string;
  emptyMessage?: string;
}

export const AccessibleDataDisplay: React.FC<AccessibleDataDisplayProps> = ({
  data,
  title,
  emptyMessage = 'データがありません'
}) => {
  const renderDataItem = (item: any, index: number) => {
    return (
      <View 
        key={item.id || index}
        style={styles.dataItem}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`項目 ${index + 1}: ${item.content || item.title || item.name || '内容'}`}
        accessibilityHint="詳細を表示するにはダブルタップしてください"
      >
        {/* ユーザー情報 */}
        {item.authorName && (
          <Text 
            style={styles.authorName}
            accessible={true}
            accessibilityLabel={`投稿者: ${item.authorName}`}
          >
            {item.authorName}
          </Text>
        )}
        
        {/* メインコンテンツ */}
        <Text 
          style={styles.content}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`内容: ${item.content || item.description || item.text || ''}`}
        >
          {item.content || item.description || item.text || item.title || '内容がありません'}
        </Text>
        
        {/* メタデータ */}
        <View style={styles.metadata}>
          {item.createdAt && (
            <Text 
              style={styles.metaText}
              accessible={true}
              accessibilityLabel={`作成日時: ${new Date(item.createdAt).toLocaleDateString('ja-JP')}`}
            >
              {new Date(item.createdAt).toLocaleDateString('ja-JP')}
            </Text>
          )}
          
          {item.likesCount !== undefined && (
            <Text 
              style={styles.metaText}
              accessible={true}
              accessibilityLabel={`いいね数: ${item.likesCount}件`}
            >
              👍 {item.likesCount}
            </Text>
          )}
          
          {item.commentsCount !== undefined && (
            <Text 
              style={styles.metaText}
              accessible={true}
              accessibilityLabel={`コメント数: ${item.commentsCount}件`}
            >
              💬 {item.commentsCount}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View 
      style={styles.container}
      accessible={true}
      accessibilityRole="list"
      accessibilityLabel={`${title}: ${data.length}件のデータ`}
    >
      <Text 
        style={styles.title}
        accessible={true}
        accessibilityRole="header"
        accessibilityLevel={2}
      >
        {title}
      </Text>
      
      {data.length === 0 ? (
        <View 
          style={styles.emptyContainer}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={emptyMessage}
        >
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.dataList}
          accessible={true}
          accessibilityLabel={`${data.length}件のデータのリスト`}
          contentContainerStyle={styles.scrollContent}
        >
          {data.map(renderDataItem)}
        </ScrollView>
      )}
      
      {/* データ統計 */}
      <View 
        style={styles.statistics}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={`統計情報: 合計${data.length}件`}
      >
        <Text style={styles.statisticsText}>合計: {data.length}件</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  dataList: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  dataItem: {
    backgroundColor: colors.neutral.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  authorName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary.main,
    marginBottom: 4,
  },
  content: {
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 8,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginRight: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyMessage: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statistics: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.gray200,
    paddingTop: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  statisticsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
});