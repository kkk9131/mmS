import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  handedness: 'right' | 'left';
  language: 'ja' | 'en';
  notifications: {
    enabled: boolean;
    likes: boolean;
    comments: boolean;
    follows: boolean;
    posts: boolean;
    sound: boolean;
    vibration: boolean;
  };
  privacy: {
    profileVisible: boolean;
    postsVisible: boolean;
    allowAnonymous: boolean;
  };
  accessibility: {
    fontSize: 'small' | 'medium' | 'large';
    highContrast: boolean;
    reduceMotion: boolean;
  };
  data: {
    autoSync: boolean;
    wifiOnly: boolean;
    cacheImages: boolean;
  };
}

export interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  handedness: 'right',
  language: 'ja',
  notifications: {
    enabled: true,
    likes: true,
    comments: true,
    follows: true,
    posts: true,
    sound: true,
    vibration: true,
  },
  privacy: {
    profileVisible: true,
    postsVisible: true,
    allowAnonymous: false,
  },
  accessibility: {
    fontSize: 'medium',
    highContrast: false,
    reduceMotion: false,
  },
  data: {
    autoSync: true,
    wifiOnly: false,
    cacheImages: true,
  },
};

const initialState: SettingsState = {
  settings: defaultSettings,
  isLoading: false,
  error: null,
  hasUnsavedChanges: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Update entire settings
    setSettings: (state, action: PayloadAction<AppSettings>) => {
      state.settings = action.payload;
      state.hasUnsavedChanges = false;
    },

    // Update specific setting categories
    updateThemeSettings: (state, action: PayloadAction<Partial<Pick<AppSettings, 'theme' | 'handedness'>>>) => {
      state.settings = { ...state.settings, ...action.payload };
      state.hasUnsavedChanges = true;
    },

    updateNotificationSettings: (state, action: PayloadAction<Partial<AppSettings['notifications']>>) => {
      state.settings.notifications = { ...state.settings.notifications, ...action.payload };
      state.hasUnsavedChanges = true;
    },

    updatePrivacySettings: (state, action: PayloadAction<Partial<AppSettings['privacy']>>) => {
      state.settings.privacy = { ...state.settings.privacy, ...action.payload };
      state.hasUnsavedChanges = true;
    },

    updateAccessibilitySettings: (state, action: PayloadAction<Partial<AppSettings['accessibility']>>) => {
      state.settings.accessibility = { ...state.settings.accessibility, ...action.payload };
      state.hasUnsavedChanges = true;
    },

    updateDataSettings: (state, action: PayloadAction<Partial<AppSettings['data']>>) => {
      state.settings.data = { ...state.settings.data, ...action.payload };
      state.hasUnsavedChanges = true;
    },

    // Convenience actions for common settings
    setTheme: (state, action: PayloadAction<AppSettings['theme']>) => {
      state.settings.theme = action.payload;
      state.hasUnsavedChanges = true;
    },

    setHandedness: (state, action: PayloadAction<AppSettings['handedness']>) => {
      state.settings.handedness = action.payload;
      state.hasUnsavedChanges = true;
    },

    setLanguage: (state, action: PayloadAction<AppSettings['language']>) => {
      state.settings.language = action.payload;
      state.hasUnsavedChanges = true;
    },

    toggleNotifications: (state) => {
      state.settings.notifications.enabled = !state.settings.notifications.enabled;
      state.hasUnsavedChanges = true;
    },

    // Reset to defaults
    resetSettings: (state) => {
      state.settings = defaultSettings;
      state.hasUnsavedChanges = true;
    },

    resetToSaved: (state) => {
      state.hasUnsavedChanges = false;
    },

    // Loading and error states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setSettings,
  updateThemeSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updateAccessibilitySettings,
  updateDataSettings,
  setTheme,
  setHandedness,
  setLanguage,
  toggleNotifications,
  resetSettings,
  resetToSaved,
  setLoading,
  setError,
  clearError,
} = settingsSlice.actions;

export { settingsSlice };