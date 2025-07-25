import * as React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Dimensions,
  LayoutChangeEvent,
  Platform
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { useOneHandedZones } from '../../hooks/useAccessibility';
import { AccessibleButton } from './AccessibleButton';
import { AccessibleText } from './AccessibleText';

/**
 * 片手操作ゾーンの定義
 */
export interface OneHandedZone {
  name: string;
  area: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  reachability: 'easy' | 'medium' | 'hard';
  description: string;
}

/**
 * 片手操作レイアウトプロパティ
 */
export interface OneHandedLayoutProps {
  children: React.ReactNode;
  enabled?: boolean;
  primaryActions?: React.ReactNode; // 主要操作ボタン
  secondaryActions?: React.ReactNode; // 補助操作ボタン
  fabEnabled?: boolean; // フローティングアクションボタン
  reachabilityHelper?: boolean; // 到達支援機能
  style?: ViewStyle;
  testID?: string;
}

/**
 * 片手操作レイアウトコンポーネント
 * 母親の片手操作（授乳中等）に最適化されたレイアウト
 */
export const OneHandedLayout: React.FC<OneHandedLayoutProps> = ({
  children,
  enabled,
  primaryActions,
  secondaryActions,
  fabEnabled = true,
  reachabilityHelper = true,
  style,
  testID
}) => {
  const { settings } = useAccessibility();
  const { getOneHandedZones, screenDimensions } = useOneHandedZones();
  const [zones, setZones] = React.useState<OneHandedZone[]>([]);

  const isOneHandedMode = enabled ?? settings.oneHandedMode;

  // ゾーンの計算
  React.useEffect(() => {
    const calculatedZones = calculateOneHandedZones(screenDimensions);
    setZones(calculatedZones);
  }, [screenDimensions]);

  if (!isOneHandedMode) {
    return (
      <View style={[styles.container, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.oneHandedContainer, style]} testID={testID}>
      {/* メインコンテンツエリア */}
      <View style={styles.contentArea}>
        {children}
      </View>

      {/* 到達支援オーバーレイ */}
      {reachabilityHelper && __DEV__ && (
        <ReachabilityOverlay zones={zones} />
      )}

      {/* フローティングアクションボタン */}
      {fabEnabled && (
        <FloatingActionButton />
      )}

      {/* 主要操作エリア（画面下部） */}
      {primaryActions && (
        <View style={styles.primaryActionArea}>
          {primaryActions}
        </View>
      )}

      {/* 補助操作エリア（サイドアクセス） */}
      {secondaryActions && (
        <View style={styles.secondaryActionArea}>
          {secondaryActions}
        </View>
      )}

      {/* 上部要素へのアクセス支援 */}
      <ReachabilityAssistant />
    </View>
  );
};

/**
 * 片手操作ゾーンの計算
 */
const calculateOneHandedZones = (dimensions: { width: number; height: number }): OneHandedZone[] => {
  const { width, height } = dimensions;
  
  // 親指の平均的な到達範囲を考慮
  const thumbReach = Math.min(width * 0.75, height * 0.6);
  
  return [
    {
      name: 'easy-zone',
      area: {
        top: height - (height * 0.35),
        bottom: height,
        left: 0,
        right: width
      },
      reachability: 'easy',
      description: '親指で簡単に到達可能'
    },
    {
      name: 'medium-zone',
      area: {
        top: height - (height * 0.65),
        bottom: height - (height * 0.35),
        left: 0,
        right: width
      },
      reachability: 'medium',
      description: '少し手を伸ばせば到達可能'
    },
    {
      name: 'hard-zone',
      area: {
        top: 0,
        bottom: height - (height * 0.65),
        left: 0,
        right: width
      },
      reachability: 'hard',
      description: '到達困難な領域'
    }
  ];
};

/**
 * 到達可能性オーバーレイ（開発用）
 */
interface ReachabilityOverlayProps {
  zones: OneHandedZone[];
}

const ReachabilityOverlay: React.FC<ReachabilityOverlayProps> = ({ zones }) => {
  const overlayColors = {
    easy: 'rgba(0, 255, 0, 0.2)',
    medium: 'rgba(255, 255, 0, 0.2)',
    hard: 'rgba(255, 0, 0, 0.2)'
  };

  return (
    <View style={styles.reachabilityOverlay} pointerEvents="none">
      {zones.map((zone) => (
        <View
          key={zone.name}
          style={[
            styles.zoneOverlay,
            {
              top: zone.area.top,
              bottom: Dimensions.get('window').height - zone.area.bottom,
              left: zone.area.left,
              right: Dimensions.get('window').width - zone.area.right,
              backgroundColor: overlayColors[zone.reachability]
            }
          ]}
        >
          <AccessibleText style={styles.zoneLabel}>
            {zone.reachability.toUpperCase()}
          </AccessibleText>
        </View>
      ))}
    </View>
  );
};

/**
 * フローティングアクションボタン
 */
const FloatingActionButton: React.FC = () => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { getOneHandedZones } = useOneHandedZones();
  
  const zones = getOneHandedZones();
  const fabPosition = {
    bottom: 120, // 簡単到達ゾーン内
    right: 20
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={[styles.fab, fabPosition]}>
      {isExpanded && (
        <View style={styles.fabActions}>
          <AccessibleButton
            onPress={() => {/* 上部へスクロール */}}
            style={styles.fabAction}
            accessibilityLabel="ページ上部に移動"
            accessibilityHint="ページの先頭にスクロールします"
          >
            ⬆️
          </AccessibleButton>
          
          <AccessibleButton
            onPress={() => {/* メニュー表示 */}}
            style={styles.fabAction}
            accessibilityLabel="メニューを開く"
            accessibilityHint="アプリメニューを表示します"
          >
            📋
          </AccessibleButton>
          
          <AccessibleButton
            onPress={() => {/* 検索 */}}
            style={styles.fabAction}
            accessibilityLabel="検索"
            accessibilityHint="検索画面を開きます"
          >
            🔍
          </AccessibleButton>
        </View>
      )}
      
      <AccessibleButton
        onPress={toggleExpanded}
        style={styles.fabMain}
        accessibilityLabel={isExpanded ? "アクションメニューを閉じる" : "アクションメニューを開く"}
        accessibilityHint="片手操作用のクイックアクションメニューです"
      >
        {isExpanded ? '✖️' : '⚡'}
      </AccessibleButton>
    </View>
  );
};

/**
 * 到達支援機能
 */
const ReachabilityAssistant: React.FC = () => {
  const [showAssistant, setShowAssistant] = React.useState(false);
  const { screenDimensions } = useOneHandedZones();

  // 上部要素のクリックを検出して支援を提供
  const handleTopAreaInteraction = () => {
    setShowAssistant(true);
    
    // 3秒後に自動非表示
    setTimeout(() => {
      setShowAssistant(false);
    }, 3000);
  };

  if (!showAssistant) return null;

  return (
    <View style={styles.reachabilityAssistant}>
      <AccessibleText style={styles.assistantText}>
        上部の要素にアクセスするには、下のボタンを使用してください
      </AccessibleText>
      
      <View style={styles.assistantActions}>
        <AccessibleButton
          onPress={() => {/* 上部へスクロール */}}
          style={styles.assistantButton}
          accessibilityLabel="上部にスクロール"
        >
          ⬆️ 上へ
        </AccessibleButton>
        
        <AccessibleButton
          onPress={() => {/* 画面を下げる */}}
          style={styles.assistantButton}
          accessibilityLabel="画面を下げる"
        >
          ⬇️ 画面下げ
        </AccessibleButton>
        
        <AccessibleButton
          onPress={() => setShowAssistant(false)}
          style={styles.assistantButton}
          accessibilityLabel="閉じる"
        >
          ✖️ 閉じる
        </AccessibleButton>
      </View>
    </View>
  );
};

/**
 * 片手操作ジェスチャーハンドラー
 */
export const useOneHandedGestures = () => {
  const { settings, updateSettings } = useAccessibility();
  
  // 画面を下に引き下げるジェスチャー
  const handlePullDown = React.useCallback(() => {
    if (settings.oneHandedMode) {
      // 実装: 画面コンテンツを下に移動
      console.log('OneHandedGestures: 画面を下に引き下げ');
    }
  }, [settings.oneHandedMode]);

  // ダブルタップでの片手モード切り替え
  const handleDoubleTap = React.useCallback(() => {
    updateSettings({ oneHandedMode: !settings.oneHandedMode });
  }, [settings.oneHandedMode, updateSettings]);

  // 端からのスワイプジェスチャー
  const handleEdgeSwipe = React.useCallback((direction: 'left' | 'right') => {
    if (settings.oneHandedMode) {
      // 片手操作時の特別なジェスチャー処理
      console.log(`OneHandedGestures: ${direction}端からスワイプ`);
    }
  }, [settings.oneHandedMode]);

  return {
    handlePullDown,
    handleDoubleTap,
    handleEdgeSwipe
  };
};

/**
 * 片手操作最適化フック
 */
export const useOneHandedOptimization = () => {
  const { settings } = useAccessibility();
  const { getOneHandedZones, isInEasyZone } = useOneHandedZones();

  // 要素の配置を最適化
  const optimizeElementPlacement = React.useCallback((element: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    if (!settings.oneHandedMode) return element;

    const zones = getOneHandedZones();
    const isInEasy = isInEasyZone(element.y, element.height);

    if (!isInEasy) {
      // 重要な要素は簡単到達ゾーンに移動を提案
      return {
        ...element,
        y: zones.EASY.top + 20,
        optimized: true
      };
    }

    return { ...element, optimized: false };
  }, [settings.oneHandedMode, getOneHandedZones, isInEasyZone]);

  return {
    optimizeElementPlacement,
    isOneHandedMode: settings.oneHandedMode
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  oneHandedContainer: {
    flex: 1,
    position: 'relative'
  },
  contentArea: {
    flex: 1,
    paddingBottom: 80 // 下部操作エリア分の余白
  },
  primaryActionArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16 // セーフエリア対応
  },
  secondaryActionArea: {
    position: 'absolute',
    right: 0,
    top: '40%',
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    paddingVertical: 16,
    alignItems: 'center'
  },
  reachabilityOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999
  },
  zoneOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.3)'
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.7)'
  },
  fab: {
    position: 'absolute',
    alignItems: 'center'
  },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  fabActions: {
    marginBottom: 16,
    alignItems: 'center'
  },
  fabAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  reachabilityAssistant: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    zIndex: 1000
  },
  assistantText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12
  },
  assistantActions: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  assistantButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80
  }
});

export default OneHandedLayout;