/**
 * アクセシビリティラベル定数
 * 日本語での適切なスクリーンリーダー読み上げ用
 */
export const ACCESSIBILITY_LABELS = {
  // ナビゲーション
  NAVIGATION: {
    HOME: 'ホーム画面に移動',
    NOTIFICATIONS: '通知画面に移動',
    POST: '投稿作成画面に移動',
    PROFILE: 'プロフィール画面に移動',
    CHAT: 'チャット画面に移動',
    BACK: '前の画面に戻る',
    CLOSE: '画面を閉じる',
    MENU: 'メニューを開く'
  },

  // 投稿関連
  POST: {
    CONTENT: '投稿内容',
    LIKE_BUTTON: 'この投稿に共感する',
    UNLIKE_BUTTON: 'この投稿への共感を取り消す',
    COMMENT_BUTTON: 'この投稿にコメントする',
    SHARE_BUTTON: 'この投稿を共有する',
    MORE_OPTIONS: '投稿のその他の操作',
    TIMESTAMP: '投稿日時',
    AUTHOR: '投稿者',
    LIKE_COUNT: '共感数',
    COMMENT_COUNT: 'コメント数',
    IMAGE: '投稿画像',
    VIDEO: '投稿動画'
  },

  // ユーザー情報
  USER: {
    PROFILE: 'ユーザープロフィール',
    AVATAR: 'プロフィール画像',
    NAME: 'ユーザー名',
    BIO: '自己紹介',
    FOLLOW_BUTTON: 'このユーザーをフォローする',
    UNFOLLOW_BUTTON: 'このユーザーのフォローを解除する',
    FOLLOWER_COUNT: 'フォロワー数',
    FOLLOWING_COUNT: 'フォロー数',
    POSTS_COUNT: '投稿数'
  },

  // フォーム要素
  FORM: {
    TEXT_INPUT: 'テキスト入力欄',
    PASSWORD_INPUT: 'パスワード入力欄',
    EMAIL_INPUT: 'メールアドレス入力欄',
    SEARCH_INPUT: '検索キーワード入力欄',
    SUBMIT_BUTTON: '送信する',
    CANCEL_BUTTON: 'キャンセルする',
    SAVE_BUTTON: '保存する',
    DELETE_BUTTON: '削除する',
    EDIT_BUTTON: '編集する',
    REQUIRED_FIELD: '必須項目'
  },

  // 通知
  NOTIFICATION: {
    BADGE: '未読通知',
    ITEM: '通知項目',
    MARK_READ: '既読にする',
    MARK_UNREAD: '未読にする',
    DELETE: '通知を削除する',
    SETTINGS: '通知設定',
    NEW: '新しい通知',
    LIKE: '共感通知',
    COMMENT: 'コメント通知',
    FOLLOW: 'フォロー通知',
    MENTION: 'メンション通知'
  },

  // チャット
  CHAT: {
    MESSAGE: 'メッセージ',
    SEND_BUTTON: 'メッセージを送信する',
    ATTACHMENT_BUTTON: 'ファイルを添付する',
    EMOJI_BUTTON: '絵文字を選択する',
    MESSAGE_INPUT: 'メッセージ入力欄',
    USER_ONLINE: 'オンライン',
    USER_OFFLINE: 'オフライン',
    TYPING: '入力中',
    DELIVERED: '配信済み',
    READ: '既読'
  },

  // 画像・メディア
  MEDIA: {
    IMAGE: '画像',
    VIDEO: '動画',
    AUDIO: '音声',
    CAMERA_BUTTON: 'カメラで撮影する',
    GALLERY_BUTTON: 'ギャラリーから選択する',
    PLAY_BUTTON: '再生する',
    PAUSE_BUTTON: '一時停止する',
    VOLUME_BUTTON: '音量調整',
    FULLSCREEN_BUTTON: '全画面表示',
    CLOSE_MEDIA: 'メディアを閉じる'
  },

  // 設定
  SETTINGS: {
    ACCESSIBILITY: 'アクセシビリティ設定',
    SCREEN_READER: 'スクリーンリーダー',
    HIGH_CONTRAST: '高コントラストモード',
    LARGE_TEXT: '大きなテキスト',
    ONE_HANDED: '片手操作モード',
    REDUCED_MOTION: 'アニメーション軽減',
    HAPTIC_FEEDBACK: 'ハプティックフィードバック',
    TEXT_SIZE: 'テキストサイズ',
    COLOR_BLINDNESS: '色覚サポート',
    VOICE_CONTROL: '音声コントロール'
  },

  // 一般的なUI要素
  COMMON: {
    LOADING: '読み込み中',
    ERROR: 'エラーが発生しました',
    SUCCESS: '成功しました',
    WARNING: '注意',
    INFO: '情報',
    REFRESH: '更新する',
    RETRY: '再試行する',
    CONFIRM: '確認する',
    SELECT: '選択する',
    CLEAR: 'クリアする',
    FILTER: 'フィルター',
    SORT: '並び替え',
    SEARCH: '検索',
    HELP: 'ヘルプ'
  },

  // モーダル・ダイアログ
  MODAL: {
    TITLE: 'ダイアログタイトル',
    CLOSE: 'ダイアログを閉じる',
    CONFIRM: '確認ダイアログ',
    ALERT: 'アラートダイアログ',
    ACTION_SHEET: 'アクションシート',
    PICKER: '選択ダイアログ',
    DATE_PICKER: '日付選択',
    TIME_PICKER: '時刻選択'
  },

  // アクセシビリティ専用
  ACCESSIBILITY: {
    TAP_TARGET_TOO_SMALL: 'タップ領域が小さすぎます',
    CONTRAST_TOO_LOW: 'コントラスト比が低すぎます',
    MISSING_LABEL: 'アクセシビリティラベルがありません',
    FOCUS_TRAPPED: 'フォーカスがトラップされています',
    SCREEN_READER_ON: 'スクリーンリーダーが有効です',
    SCREEN_READER_OFF: 'スクリーンリーダーが無効です',
    HIGH_CONTRAST_ON: '高コントラストモードが有効です',
    HIGH_CONTRAST_OFF: '高コントラストモードが無効です',
    ONE_HANDED_ON: '片手操作モードが有効です',
    ONE_HANDED_OFF: '片手操作モードが無効です'
  }
} as const;

/**
 * アクセシビリティヒント定数
 * 要素の使用方法を説明するヒント
 */
export const ACCESSIBILITY_HINTS = {
  POST: {
    LIKE_BUTTON: 'ダブルタップで共感を表現できます',
    COMMENT_BUTTON: 'ダブルタップでコメント入力画面を開きます',
    SHARE_BUTTON: 'ダブルタップで共有オプションを表示します',
    IMAGE: 'ダブルタップで画像を拡大表示します'
  },

  NAVIGATION: {
    TAB_BAR: 'スワイプで他のタブに移動できます',
    BACK_BUTTON: 'ダブルタップで前の画面に戻ります'
  },

  FORM: {
    TEXT_INPUT: 'ダブルタップで入力を開始できます',
    SUBMIT_BUTTON: 'すべての項目を入力後にダブルタップしてください'
  },

  SETTINGS: {
    TOGGLE: 'ダブルタップで設定を切り替えできます',
    SLIDER: '上下にスワイプで値を調整できます'
  }
} as const;

/**
 * アクセシビリティロール定数
 */
export const ACCESSIBILITY_ROLES = {
  BUTTON: 'button',
  LINK: 'link',
  TEXT: 'text',
  IMAGE: 'image',
  HEADER: 'header',
  SEARCH: 'search',
  TAB: 'tab',
  TABLIST: 'tablist',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  SWITCH: 'switch',
  SLIDER: 'slider',
  PROGRESSBAR: 'progressbar',
  ALERT: 'alert',
  DIALOG: 'dialog',
  NAVIGATION: 'navigation',
  LIST: 'list',
  LISTITEM: 'listitem'
} as const;

/**
 * セマンティックレベル定数
 */
export const SEMANTIC_LEVELS = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6
} as const;

export type AccessibilityLabel = typeof ACCESSIBILITY_LABELS;
export type AccessibilityHint = typeof ACCESSIBILITY_HINTS;
export type AccessibilityRole = typeof ACCESSIBILITY_ROLES;
export type SemanticLevel = typeof SEMANTIC_LEVELS;