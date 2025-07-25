// Mamapace統一カラーテーマ
export const colors = {
  "primary": {
    "main": "#FF6B6B",
    "light": "#FFE0E0",
    "dark": "#E85555"
  },
  "secondary": {
    "main": "#4ECDC4",
    "light": "#E0F7F6",
    "dark": "#3BA59E"
  },
  "neutral": {
    "white": "#FFFFFF",
    "background": "#F8F9FA",
    "gray100": "#F5F5F5",
    "gray200": "#E9ECEF",
    "gray300": "#DEE2E6",
    "gray400": "#CED4DA",
    "gray500": "#ADB5BD",
    "gray600": "#6C757D",
    "gray700": "#495057",
    "gray800": "#343A40",
    "gray900": "#212529",
    "black": "#000000"
  },
  "semantic": {
    "success": "#52C41A",
    "warning": "#FAAD14",
    "error": "#F5222D",
    "info": "#1890FF"
  },
  "text": {
    "primary": "#212529",
    "secondary": "#6C757D",
    "disabled": "#ADB5BD",
    "inverse": "#FFFFFF"
  }
};

export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = colors;
  for (const key of keys) {
    value = value[key];
  }
  return value || '#000000';
};

// 使用例:
// getColor('primary.main') => '#FF6B6B'
// getColor('neutral.gray500') => '#ADB5BD'
