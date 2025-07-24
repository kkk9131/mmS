/**
 * 画像編集コンポーネント
 * クロップ、フィルター、片手操作対応の画像編集機能
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler
} from 'react-native-gesture-handler';
import { 
  Check, 
  X, 
  RotateCcw, 
  Crop, 
  Palette,
  Type
} from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useHandPreference } from '../../contexts/HandPreferenceContext';
import { ImageAsset, ProcessedImage, CropData, FilterType } from '../../types/image';
import { ImageProcessor } from '../../services/image/ImageProcessor';

interface ImageEditorProps {
  visible: boolean;
  image: ImageAsset | null;
  onSave: (editedImage: ProcessedImage) => void;
  onCancel: () => void;
  darkMode?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type EditMode = 'none' | 'crop' | 'filter' | 'text';

export const ImageEditor: React.FC<ImageEditorProps> = ({
  visible,
  image,
  onSave,
  onCancel,
  darkMode = false
}) => {
  const { theme } = useTheme();
  const { handPreference } = useHandPreference();
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [altText, setAltText] = useState('');
  
  // クロップ関連の状態
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<number | null>(null);
  
  // フィルター関連の状態
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null);
  
  const imageProcessor = useRef(new ImageProcessor()).current;

  const handleSave = async () => {
    if (!image) return;
    
    try {
      setIsProcessing(true);
      
      const result = await imageProcessor.processImage(image, {
        crop: cropData || undefined,
        filter: selectedFilter || undefined,
        stripMetadata: true,
        generateThumbnail: true
      });
      
      // ProcessedImage形式に変換
      const finalImage: ProcessedImage = {
        id: result.processed.id || `processed_${Date.now()}`,
        uri: result.processed.uri,
        width: result.processed.width,
        height: result.processed.height,
        fileSize: result.processed.fileSize,
        mimeType: result.processed.mimeType,
        fileName: result.processed.fileName,
        exif: result.processed.exif,
        compressed: true,
        compressionRatio: 0.8,
        thumbnailUri: result.thumbnail?.uri,
        altText: altText.trim() || undefined,
        processedAt: new Date()
      };
      
      onSave(finalImage);
    } catch (error) {
      console.error('画像編集保存エラー:', error);
      Alert.alert(
        'エラー',
        '画像の保存に失敗しました',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) {
      onCancel();
    }
  };

  const handleReset = () => {
    setCropData(null);
    setSelectedFilter(null);
    setSelectedAspectRatio(null);
    setAltText('');
    setEditMode('none');
  };

  // アスペクト比オプション
  const aspectRatios = [
    { label: '自由', value: null },
    { label: '正方形', value: 1 },
    { label: '16:9', value: 16/9 },
    { label: '4:3', value: 4/3 },
    { label: '3:2', value: 3/2 }
  ];

  // ダークモード最適化フィルター
  const filters = ImageProcessor.getDarkModeOptimizedFilters();

  // 片手操作対応のコントロール配置
  const getControlsStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      bottom: 100,
      paddingHorizontal: 20
    };

    if (handPreference === 'left') {
      return { ...baseStyle, left: 0, right: screenWidth * 0.3 };
    } else {
      return { ...baseStyle, left: screenWidth * 0.3, right: 0 };
    }
  };

  const getTopControlsStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      top: 60,
      flexDirection: 'row' as const,
      gap: 12
    };

    if (handPreference === 'left') {
      return { ...baseStyle, left: 20 };
    } else {
      return { ...baseStyle, right: 20 };
    }
  };

  const renderCropControls = () => (
    <View style={styles.editPanel}>
      <Text style={[styles.panelTitle, { color: theme.colors.text.primary }]}>
        クロップ
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.aspectRatioContainer}>
          {aspectRatios.map((ratio) => (
            <TouchableOpacity
              key={ratio.label}
              style={[
                styles.aspectRatioButton,
                selectedAspectRatio === ratio.value && styles.selectedAspectRatio,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
              ]}
              onPress={() => setSelectedAspectRatio(ratio.value)}
              accessible={true}
              accessibilityLabel={`アスペクト比: ${ratio.label}`}
              accessibilityRole="button"
            >
              <Text style={[
                styles.aspectRatioText,
                { color: theme.colors.text.primary },
                selectedAspectRatio === ratio.value && { color: theme.colors.primary }
              ]}>
                {ratio.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderFilterControls = () => (
    <View style={styles.editPanel}>
      <Text style={[styles.panelTitle, { color: theme.colors.text.primary }]}>
        フィルター
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterContainer}>
          {/* フィルターなし */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              !selectedFilter && styles.selectedFilter,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
            ]}
            onPress={() => setSelectedFilter(null)}
            accessible={true}
            accessibilityLabel="フィルターなし"
            accessibilityRole="button"
          >
            <Text style={[
              styles.filterText,
              { color: theme.colors.text.primary },
              !selectedFilter && { color: theme.colors.primary }
            ]}>
              なし
            </Text>
          </TouchableOpacity>
          
          {/* フィルター選択肢 */}
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.name}
              style={[
                styles.filterButton,
                selectedFilter?.name === filter.name && styles.selectedFilter,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
              ]}
              onPress={() => setSelectedFilter(filter)}
              accessible={true}
              accessibilityLabel={`フィルター: ${filter.name}`}
              accessibilityRole="button"
            >
              <Text style={[
                styles.filterText,
                { color: theme.colors.text.primary },
                selectedFilter?.name === filter.name && { color: theme.colors.primary }
              ]}>
                {filter.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderTextControls = () => (
    <View style={styles.editPanel}>
      <Text style={[styles.panelTitle, { color: theme.colors.text.primary }]}>
        代替テキスト
      </Text>
      <TextInput
        style={[
          styles.altTextInput,
          { 
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            color: theme.colors.text.primary
          }
        ]}
        value={altText}
        onChangeText={setAltText}
        placeholder="画像の説明を入力してください（アクセシビリティ対応）"
        placeholderTextColor={theme.colors.text.secondary}
        multiline
        maxLength={200}
        accessible={true}
        accessibilityLabel="画像の代替テキスト"
        accessibilityHint="スクリーンリーダー用の画像説明を入力してください"
      />
      <Text style={[styles.characterCount, { color: theme.colors.text.primarySecondary }]}>
        {altText.length}/200
      </Text>
    </View>
  );

  if (!visible || !image) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* トップコントロール */}
        <View style={[styles.topControls, getTopControlsStyle()]}>
          <TouchableOpacity
            style={[styles.topButton, { backgroundColor: theme.colors.card }]}
            onPress={handleCancel}
            disabled={isProcessing}
            accessible={true}
            accessibilityLabel="編集をキャンセル"
            accessibilityRole="button"
          >
            <X size={20} color={theme.colors.text.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.topButton, { backgroundColor: theme.colors.card }]}
            onPress={handleReset}
            disabled={isProcessing}
            accessible={true}
            accessibilityLabel="編集をリセット"
            accessibilityRole="button"
          >
            <RotateCcw size={20} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* 画像表示エリア */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: image.uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* 編集モード選択 */}
        <View style={[styles.modeSelector, getControlsStyle()]}>
          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                editMode === 'crop' && styles.activeModeButton,
                { backgroundColor: theme.colors.card }
              ]}
              onPress={() => setEditMode(editMode === 'crop' ? 'none' : 'crop')}
              accessible={true}
              accessibilityLabel="クロップモード"
              accessibilityRole="button"
            >
              <Crop size={20} color={editMode === 'crop' ? theme.colors.primary : theme.colors.text.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modeButton,
                editMode === 'filter' && styles.activeModeButton,
                { backgroundColor: theme.colors.card }
              ]}
              onPress={() => setEditMode(editMode === 'filter' ? 'none' : 'filter')}
              accessible={true}
              accessibilityLabel="フィルターモード"
              accessibilityRole="button"
            >
              <Palette size={20} color={editMode === 'filter' ? theme.colors.primary : theme.colors.text.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modeButton,
                editMode === 'text' && styles.activeModeButton,
                { backgroundColor: theme.colors.card }
              ]}
              onPress={() => setEditMode(editMode === 'text' ? 'none' : 'text')}
              accessible={true}
              accessibilityLabel="テキストモード"
              accessibilityRole="button"
            >
              <Type size={20} color={editMode === 'text' ? theme.colors.primary : theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 編集パネル */}
        {editMode === 'crop' && renderCropControls()}
        {editMode === 'filter' && renderFilterControls()}
        {editMode === 'text' && renderTextControls()}

        {/* 保存ボタン */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { 
                backgroundColor: '#FFFFFF',
                borderWidth: 2,
                borderColor: '#FF69B4',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              },
              isProcessing && styles.disabledButton
            ]}
            onPress={handleSave}
            disabled={isProcessing}
            activeOpacity={0.7}
            accessible={true}
            accessibilityLabel="編集を保存"
            accessibilityRole="button"
          >
            <Check size={24} color="#FF69B4" />
            <Text style={[styles.saveButtonText, { color: '#FF69B4', fontWeight: 'bold' }]}>
              {isProcessing ? '処理中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  topControls: {
    zIndex: 10
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 200
  },
  image: {
    width: screenWidth - 40,
    height: (screenHeight - 400),
    maxWidth: screenWidth - 40,
    maxHeight: screenHeight - 400
  },
  modeSelector: {
    zIndex: 5
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center'
  },
  modeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  activeModeButton: {
    borderWidth: 2
  },
  editPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    maxHeight: 150
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#FFFFFF'
  },
  aspectRatioContainer: {
    flexDirection: 'row',
    gap: 8
  },
  aspectRatioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  selectedAspectRatio: {
    borderWidth: 2
  },
  aspectRatioText: {
    fontSize: 14,
    fontWeight: '500'
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1
  },
  selectedFilter: {
    borderWidth: 2
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500'
  },
  altTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4
  },
  saveContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center'
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 56,
    borderRadius: 12,
    gap: 8,
    minWidth: 120
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
    borderColor: '#FFB6C1'
  }
});

export default ImageEditor;