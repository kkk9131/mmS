import * as React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Modal,
  ScrollView,
  Animated
} from 'react-native';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { AccessibleButton } from './AccessibleButton';
import { AccessibleText, AccessibleHeading } from './AccessibleText';

/**
 * 認知サポートの種類
 */
export type CognitiveSupportType = 
  | 'navigation-help'
  | 'task-guidance'
  | 'confirmation'
  | 'simplification'
  | 'memory-aid';

/**
 * ガイダンスステップ
 */
export interface GuidanceStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  isCompleted?: boolean;
  isOptional?: boolean;
}

/**
 * 認知サポートプロバイダー
 */
interface CognitiveSupportContextType {
  showGuidance: (steps: GuidanceStep[], title?: string) => void;
  showConfirmation: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
  showHelp: (content: string, title?: string) => void;
  simplifyInterface: (enabled: boolean) => void;
  isSimplifiedMode: boolean;
}

const CognitiveSupportContext = React.createContext<CognitiveSupportContextType | undefined>(undefined);

export const CognitiveSupportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [guidanceVisible, setGuidanceVisible] = React.useState(false);
  const [confirmationVisible, setConfirmationVisible] = React.useState(false);
  const [helpVisible, setHelpVisible] = React.useState(false);
  const [isSimplifiedMode, setIsSimplifiedMode] = React.useState(false);
  
  const [guidanceData, setGuidanceData] = React.useState<{
    steps: GuidanceStep[];
    title: string;
  }>({ steps: [], title: '' });
  
  const [confirmationData, setConfirmationData] = React.useState<{
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({ message: '', onConfirm: () => {} });
  
  const [helpData, setHelpData] = React.useState<{
    content: string;
    title: string;
  }>({ content: '', title: '' });

  const showGuidance = React.useCallback((steps: GuidanceStep[], title: string = 'ガイダンス') => {
    setGuidanceData({ steps, title });
    setGuidanceVisible(true);
  }, []);

  const showConfirmation = React.useCallback((
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void
  ) => {
    setConfirmationData({ message, onConfirm, onCancel });
    setConfirmationVisible(true);
  }, []);

  const showHelp = React.useCallback((content: string, title: string = 'ヘルプ') => {
    setHelpData({ content, title });
    setHelpVisible(true);
  }, []);

  const simplifyInterface = React.useCallback((enabled: boolean) => {
    setIsSimplifiedMode(enabled);
  }, []);

  const contextValue: CognitiveSupportContextType = {
    showGuidance,
    showConfirmation,
    showHelp,
    simplifyInterface,
    isSimplifiedMode
  };

  return (
    <CognitiveSupportContext.Provider value={contextValue}>
      {children}
      
      {/* ガイダンスモーダル */}
      <GuidanceModal
        visible={guidanceVisible}
        onClose={() => setGuidanceVisible(false)}
        steps={guidanceData.steps}
        title={guidanceData.title}
      />
      
      {/* 確認ダイアログ */}
      <ConfirmationDialog
        visible={confirmationVisible}
        onClose={() => setConfirmationVisible(false)}
        message={confirmationData.message}
        onConfirm={confirmationData.onConfirm}
        onCancel={confirmationData.onCancel}
      />
      
      {/* ヘルプモーダル */}
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        content={helpData.content}
        title={helpData.title}
      />
    </CognitiveSupportContext.Provider>
  );
};

/**
 * 認知サポートフック
 */
export const useCognitiveSupport = (): CognitiveSupportContextType => {
  const context = React.useContext(CognitiveSupportContext);
  
  if (context === undefined) {
    throw new Error('useCognitiveSupport must be used within a CognitiveSupportProvider');
  }
  
  return context;
};

/**
 * ガイダンスモーダル
 */
interface GuidanceModalProps {
  visible: boolean;
  onClose: () => void;
  steps: GuidanceStep[];
  title: string;
}

const GuidanceModal: React.FC<GuidanceModalProps> = ({ visible, onClose, steps, title }) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<string>>(new Set());

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    onClose();
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      accessibilityViewIsModal={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.guidanceModal}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <AccessibleHeading level={2} style={styles.modalTitle}>
              {title}
            </AccessibleHeading>
            <AccessibleButton
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="ガイダンスを閉じる"
            >
              ✖️
            </AccessibleButton>
          </View>

          {/* プログレスバー */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <AccessibleText style={styles.progressText}>
              {currentStep + 1} / {steps.length}
            </AccessibleText>
          </View>

          {/* ステップ内容 */}
          <ScrollView style={styles.stepContent}>
            <AccessibleHeading level={3} style={styles.stepTitle}>
              {step?.title}
            </AccessibleHeading>
            
            <AccessibleText style={styles.stepDescription}>
              {step?.description}
            </AccessibleText>

            {step?.action && (
              <View style={styles.stepAction}>
                <AccessibleText style={styles.actionLabel}>
                  実行する操作:
                </AccessibleText>
                <AccessibleText style={styles.actionText}>
                  {step.action}
                </AccessibleText>
              </View>
            )}
          </ScrollView>

          {/* ナビゲーションボタン */}
          <View style={styles.navigationButtons}>
            <AccessibleButton
              onPress={handlePrevious}
              disabled={currentStep === 0}
              style={StyleSheet.flatten([styles.navButton, styles.previousButton])}
              accessibilityLabel="前のステップ"
            >
              ⬅️ 前へ
            </AccessibleButton>

            <AccessibleButton
              onPress={() => handleStepComplete(step?.id || '')}
              style={StyleSheet.flatten([styles.navButton, styles.completeButton])}
              accessibilityLabel="このステップを完了"
            >
              ✅ 完了
            </AccessibleButton>

            <AccessibleButton
              onPress={handleNext}
              disabled={currentStep === steps.length - 1}
              style={StyleSheet.flatten([styles.navButton, styles.nextButton])}
              accessibilityLabel="次のステップ"
            >
              次へ ➡️
            </AccessibleButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * 確認ダイアログ
 */
interface ConfirmationDialogProps {
  visible: boolean;
  onClose: () => void;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  onClose,
  message,
  onConfirm,
  onCancel
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      accessibilityViewIsModal={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.confirmationDialog}>
          <AccessibleHeading level={2} style={styles.confirmationTitle}>
            確認
          </AccessibleHeading>
          
          <AccessibleText style={styles.confirmationMessage}>
            {message}
          </AccessibleText>

          <View style={styles.confirmationButtons}>
            <AccessibleButton
              onPress={handleCancel}
              style={StyleSheet.flatten([styles.confirmButton, styles.cancelButton])}
              accessibilityLabel="キャンセル"
            >
              キャンセル
            </AccessibleButton>
            
            <AccessibleButton
              onPress={handleConfirm}
              style={StyleSheet.flatten([styles.confirmButton, styles.okButton])}
              accessibilityLabel="確認して実行"
            >
              はい
            </AccessibleButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * ヘルプモーダル
 */
interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  content: string;
  title: string;
}

const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose, content, title }) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      accessibilityViewIsModal={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.helpModal}>
          <View style={styles.modalHeader}>
            <AccessibleHeading level={2} style={styles.modalTitle}>
              {title}
            </AccessibleHeading>
            <AccessibleButton
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="ヘルプを閉じる"
            >
              ✖️
            </AccessibleButton>
          </View>

          <ScrollView style={styles.helpContent}>
            <AccessibleText style={styles.helpText}>
              {content}
            </AccessibleText>
          </ScrollView>

          <View style={styles.helpActions}>
            <AccessibleButton
              onPress={onClose}
              style={styles.helpButton}
              accessibilityLabel="ヘルプを閉じる"
            >
              閉じる
            </AccessibleButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * 簡易化インターフェースコンポーネント
 */
export interface SimplifiedInterfaceProps {
  children: React.ReactNode;
  enabled?: boolean;
  style?: ViewStyle;
}

export const SimplifiedInterface: React.FC<SimplifiedInterfaceProps> = ({
  children,
  enabled,
  style
}) => {
  const { isSimplifiedMode } = useCognitiveSupport();
  
  const shouldSimplify = enabled ?? isSimplifiedMode;

  if (!shouldSimplify) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.simplifiedContainer, style]}>
      {children}
    </View>
  );
};

/**
 * ヘルプボタンコンポーネント
 */
export interface HelpButtonProps {
  helpContent: string;
  helpTitle?: string;
  style?: ViewStyle;
}

export const HelpButton: React.FC<HelpButtonProps> = ({
  helpContent,
  helpTitle = 'ヘルプ',
  style
}) => {
  const { showHelp } = useCognitiveSupport();

  return (
    <AccessibleButton
      onPress={() => showHelp(helpContent, helpTitle)}
      style={StyleSheet.flatten([styles.helpFloatingButton, style])}
      accessibilityLabel="ヘルプを表示"
      accessibilityHint="この画面の使い方を説明します"
    >
      ❓
    </AccessibleButton>
  );
};

/**
 * メモリ支援フック
 */
export const useMemoryAid = () => {
  const [savedStates, setSavedStates] = React.useState<Record<string, any>>({});

  const saveState = React.useCallback((key: string, state: any) => {
    setSavedStates(prev => ({ ...prev, [key]: state }));
  }, []);

  const loadState = React.useCallback((key: string) => {
    return savedStates[key];
  }, [savedStates]);

  const clearState = React.useCallback((key: string) => {
    setSavedStates(prev => {
      const { [key]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    saveState,
    loadState,
    clearState,
    hasState: (key: string) => key in savedStates
  };
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  guidanceModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold'
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 10
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666666'
  },
  stepContent: {
    flex: 1,
    padding: 20
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  stepDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16
  },
  stepAction: {
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF'
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#007AFF'
  },
  actionText: {
    fontSize: 16,
    fontStyle: 'italic'
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  navButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12
  },
  previousButton: {
    backgroundColor: '#F0F0F0'
  },
  completeButton: {
    backgroundColor: '#34C759'
  },
  nextButton: {
    backgroundColor: '#007AFF'
  },
  confirmationDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16
  },
  confirmationMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  confirmButton: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 12
  },
  cancelButton: {
    backgroundColor: '#F0F0F0'
  },
  okButton: {
    backgroundColor: '#007AFF'
  },
  helpModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%'
  },
  helpContent: {
    flex: 1,
    padding: 20
  },
  helpText: {
    fontSize: 16,
    lineHeight: 24
  },
  helpActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  helpButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12
  },
  simplifiedContainer: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 8
  },
  helpFloatingButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000
  }
});

export default CognitiveSupportProvider;