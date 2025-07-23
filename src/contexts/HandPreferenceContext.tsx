import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type HandPreference = 'left' | 'right';

interface HandPreferenceContextType {
  handPreference: HandPreference;
  setHandPreference: (preference: HandPreference) => Promise<void>;
  getFreeHandSide: () => 'left' | 'right';
  loading: boolean;
}

const HandPreferenceContext = createContext<HandPreferenceContextType | undefined>(undefined);

const HAND_PREFERENCE_KEY = 'hand_preference';

export const HandPreferenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [handPreference, setHandPreferenceState] = useState<HandPreference>('right');
  const [loading, setLoading] = useState(true);

  // 利き手設定を読み込み
  useEffect(() => {
    console.log('🚀 HandPreferenceContext初期化開始 - Platform:', Platform.OS);
    const loadHandPreference = async () => {
      try {
        console.log('📖 利き手設定を読み込み中...');
        
        // Web版の場合、localStorageを優先
        if (Platform.OS === 'web') {
          try {
            const webStored = localStorage.getItem(HAND_PREFERENCE_KEY);
            console.log('🌐 Web localStorage値:', webStored);
            if (webStored && (webStored === 'left' || webStored === 'right')) {
              setHandPreferenceState(webStored);
              console.log('✅ Web localStorage設定を復元:', webStored);
              setLoading(false);
              return;
            }
          } catch (webError) {
            console.log('⚠️ Web localStorage読み込み失敗:', webError);
          }
        }
        
        const stored = await AsyncStorage.getItem(HAND_PREFERENCE_KEY);
        console.log('📖 AsyncStorage保存値:', stored);
        if (stored && (stored === 'left' || stored === 'right')) {
          setHandPreferenceState(stored);
          console.log('✅ AsyncStorage設定を復元:', stored);
        } else {
          console.log('ℹ️ 保存された設定がないため、デフォルト(right)を使用');
        }
      } catch (error) {
        console.error('利き手設定の読み込みに失敗:', error);
      } finally {
        setLoading(false);
        console.log('🏁 HandPreferenceContext初期化完了');
      }
    };

    loadHandPreference();
  }, []);

  // 利き手設定を保存
  const setHandPreference = async (preference: HandPreference) => {
    try {
      console.log('🖐️ Context利き手設定を変更:', preference, '- Platform:', Platform.OS);
      
      // Web版の場合、localStorageにも保存
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(HAND_PREFERENCE_KEY, preference);
          console.log('🌐 Context Web localStorageに保存完了:', preference);
        } catch (webError) {
          console.log('⚠️ Context Web localStorage保存失敗:', webError);
        }
      }
      
      await AsyncStorage.setItem(HAND_PREFERENCE_KEY, preference);
      console.log('🖐️ Context AsyncStorage保存完了:', preference);
      
      // 即座に状態を更新
      setHandPreferenceState(preference);
      console.log('🔄 Context状態を即座に更新:', preference);
      
      
    } catch (error) {
      console.error('Context利き手設定の保存に失敗:', error);
    }
  };

  // 空いている手（利き手の逆側）を取得
  const getFreeHandSide = (): 'left' | 'right' => {
    return handPreference === 'right' ? 'left' : 'right';
  };

  const value: HandPreferenceContextType = {
    handPreference,
    setHandPreference,
    getFreeHandSide,
    loading,
  };

  return (
    <HandPreferenceContext.Provider value={value}>
      {children}
    </HandPreferenceContext.Provider>
  );
};

export const useHandPreference = (): HandPreferenceContextType => {
  const context = useContext(HandPreferenceContext);
  if (context === undefined) {
    throw new Error('useHandPreference must be used within a HandPreferenceProvider');
  }
  return context;
};