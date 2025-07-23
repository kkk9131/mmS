import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type HandPreference = 'left' | 'right';

const HAND_PREFERENCE_KEY = 'hand_preference';

export const useHandPreference = () => {
  const [handPreference, setHandPreference] = useState<HandPreference>('right');
  const [loading, setLoading] = useState(true);

  // AsyncStorageから利き手設定を読み込み
  useEffect(() => {
    console.log('🚀 useHandPreference フック初期化開始 - Platform:', Platform.OS);
    const loadHandPreference = async () => {
      try {
        console.log('📖 AsyncStorageから利き手設定を読み込み中...');
        
        // Web版の場合、localStorageも試す
        if (Platform.OS === 'web') {
          try {
            const webStored = localStorage.getItem(HAND_PREFERENCE_KEY);
            console.log('🌐 Web localStorage値:', webStored);
            if (webStored && (webStored === 'left' || webStored === 'right')) {
              setHandPreference(webStored);
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
          setHandPreference(stored);
          console.log('✅ AsyncStorage設定を復元:', stored);
        } else {
          console.log('ℹ️ 保存された設定がないため、デフォルト(right)を使用');
        }
      } catch (error) {
        console.error('利き手設定の読み込みに失敗:', error);
      } finally {
        setLoading(false);
        console.log('🏁 useHandPreference フック初期化完了 - 最終値:', handPreference);
      }
    };

    loadHandPreference();
  }, []);

  // 利き手設定を保存
  const saveHandPreference = async (preference: HandPreference) => {
    try {
      console.log('🖐️ 利き手設定を変更:', preference, '- Platform:', Platform.OS);
      
      // Web版の場合、localStorageにも保存
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(HAND_PREFERENCE_KEY, preference);
          console.log('🌐 Web localStorageに保存完了:', preference);
        } catch (webError) {
          console.log('⚠️ Web localStorage保存失敗:', webError);
        }
      }
      
      await AsyncStorage.setItem(HAND_PREFERENCE_KEY, preference);
      setHandPreference(preference);
      console.log('🖐️ AsyncStorage保存完了:', preference);
      
      // 即座に状態を更新
      console.log('🔄 状態を即座に更新:', preference);
    } catch (error) {
      console.error('利き手設定の保存に失敗:', error);
    }
  };

  // 空いている手（利き手の逆側）を取得
  const getFreeHandSide = (): 'left' | 'right' => {
    return handPreference === 'right' ? 'left' : 'right';
  };

  return {
    handPreference,
    setHandPreference: saveHandPreference,
    getFreeHandSide,
    loading,
  };
};