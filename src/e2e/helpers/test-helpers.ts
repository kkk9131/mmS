import { Page, expect } from '@playwright/test';

/**
 * E2Eテスト用のヘルパー関数集
 */

/**
 * ユーザーログインヘルパー
 */
export async function loginUser(
  page: Page,
  handbookNumber: string = 'test123456',
  nickname: string = 'テストユーザー'
) {
  await page.goto('/');
  
  // ログイン画面が表示されるまで待機
  await expect(page.getByRole('heading', { name: /ログイン|login/i })).toBeVisible();
  
  // 母子手帳番号を入力
  await page.getByLabel(/母子手帳番号|handbook.*number/i).fill(handbookNumber);
  
  // ニックネームを入力
  await page.getByLabel(/ニックネーム|nickname/i).fill(nickname);
  
  // ログインボタンクリック
  await page.getByRole('button', { name: /ログイン|login/i }).click();
  
  // ホーム画面に遷移するまで待機
  await expect(page).toHaveURL(/.*\/(tabs\/)?$/);
  await expect(page.getByText(/ホーム|home/i)).toBeVisible();
}

/**
 * ログアウトヘルパー
 */
export async function logoutUser(page: Page) {
  // プロフィール画面に移動
  await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
  
  // 設定メニューを開く
  const settingsButton = page.getByRole('button', { name: /設定|settings/i });
  if (await settingsButton.isVisible()) {
    await settingsButton.click();
  }
  
  // ログアウトボタンクリック
  const logoutButton = page.getByRole('button', { name: /ログアウト|logout|サインアウト/i });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  
  // 確認ダイアログがある場合は確認
  const confirmButton = page.getByRole('button', { name: /確認|confirm|はい|yes/i });
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
  
  // ログイン画面に戻ることを確認
  await expect(page).toHaveURL(/.*\/login$/);
}

/**
 * 投稿作成ヘルパー
 */
export async function createPost(
  page: Page,
  content: string,
  isAnonymous: boolean = false
) {
  // ホーム画面に移動
  await page.getByRole('tab', { name: /ホーム|home/i }).click();
  
  // 投稿作成ボタンクリック
  await page.getByRole('button', { name: /投稿|post|作成|create/i }).first().click();
  
  // 内容入力
  const contentInput = page.getByLabel(/内容|content|投稿.*内容/i)
    .or(page.getByPlaceholder(/何.*考えている|what.*thinking|投稿/i));
  await expect(contentInput).toBeVisible();
  await contentInput.fill(content);
  
  // 匿名投稿の場合はチェックボックスをチェック
  if (isAnonymous) {
    const anonymousCheckbox = page.getByLabel(/匿名|anonymous|名前.*非表示/i);
    if (await anonymousCheckbox.isVisible()) {
      await anonymousCheckbox.check();
    }
  }
  
  // 投稿ボタンクリック
  await page.getByRole('button', { name: /投稿|post|送信|submit|作成/i }).last().click();
  
  // 投稿完了メッセージ確認
  await expect(page.getByText(/投稿.*完了|post.*created|作成.*成功/i)).toBeVisible();
  
  // 投稿がフィードに表示されることを確認
  await expect(page.getByText(content)).toBeVisible();
}

/**
 * いいねヘルパー
 */
export async function likePost(page: Page, postIndex: number = 0) {
  const likeButtons = page.getByRole('button', { name: /いいね|like|♡|❤/i });
  const likeButton = likeButtons.nth(postIndex);
  
  await expect(likeButton).toBeVisible();
  await likeButton.click();
  
  // いいね済み状態を確認
  await expect(page.getByText(/いいね.*済み|liked|♥|❤/).nth(postIndex)).toBeVisible();
}

/**
 * コメント追加ヘルパー
 */
export async function addComment(
  page: Page,
  comment: string,
  postIndex: number = 0
) {
  // コメントボタンクリック
  const commentButton = page.getByRole('button', { name: /コメント|comment|💬/i }).nth(postIndex);
  await expect(commentButton).toBeVisible();
  await commentButton.click();
  
  // コメント入力
  const commentInput = page.getByLabel(/コメント|comment/i);
  await expect(commentInput).toBeVisible();
  await commentInput.fill(comment);
  
  // コメント投稿
  await page.getByRole('button', { name: /投稿|post|送信|submit/i }).last().click();
  
  // コメントが表示されることを確認
  await expect(page.getByText(comment)).toBeVisible();
}

/**
 * 画面遷移ヘルパー
 */
export async function navigateToTab(page: Page, tabName: string) {
  const tabButton = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
  await expect(tabButton).toBeVisible();
  await tabButton.click();
  
  // 画面遷移完了まで待機
  await page.waitForTimeout(500);
}

/**
 * プルトゥリフレッシュヘルパー
 */
export async function pullToRefresh(page: Page) {
  // モバイルプルトゥリフレッシュジェスチャーをシミュレート
  await page.touchscreen.tap(300, 100);
  await page.touchscreen.tap(300, 300);
  
  // リフレッシュインジケーター確認
  await expect(page.getByText(/更新|refresh|読み込み|loading/i)).toBeVisible();
  
  // リフレッシュ完了まで待機
  await page.waitForTimeout(2000);
}

/**
 * エラーメッセージ確認ヘルパー
 */
export async function expectErrorMessage(page: Page, errorPattern: string | RegExp) {
  await expect(page.getByText(errorPattern)).toBeVisible();
}

/**
 * 成功メッセージ確認ヘルパー
 */
export async function expectSuccessMessage(page: Page, successPattern: string | RegExp) {
  await expect(page.getByText(successPattern)).toBeVisible();
}

/**
 * ローディング状態確認ヘルパー
 */
export async function expectLoadingState(page: Page) {
  await expect(page.getByText(/読み込み|loading|処理中|processing/i)).toBeVisible();
}

/**
 * ネットワーク状態制御ヘルパー
 */
export async function setNetworkState(page: Page, isOnline: boolean) {
  await page.context().setOffline(!isOnline);
  await page.waitForTimeout(1000);
}

/**
 * ローカルストレージクリアヘルパー
 */
export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * フォームバリデーションテストヘルパー
 */
export async function testFormValidation(
  page: Page,
  fieldSelector: string,
  invalidValues: string[],
  submitButtonSelector: string,
  expectedErrorPattern: string | RegExp
) {
  for (const invalidValue of invalidValues) {
    await page.fill(fieldSelector, invalidValue);
    await page.click(submitButtonSelector);
    await expectErrorMessage(page, expectedErrorPattern);
    await page.fill(fieldSelector, ''); // クリア
  }
}

/**
 * キーボードナビゲーションテストヘルパー
 */
export async function testKeyboardNavigation(page: Page) {
  // Tab キーでナビゲーション
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  
  // フォーカスされた要素を確認
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(['BUTTON', 'A', 'INPUT', 'TEXTAREA'].includes(focusedElement || '')).toBeTruthy();
}

/**
 * レスポンシブデザインテストヘルパー
 */
export async function testResponsiveDesign(page: Page) {
  // デスクトップサイズ
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForTimeout(500);
  
  // タブレットサイズ
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  
  // モバイルサイズ
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
}

/**
 * パフォーマンステストヘルパー
 */
export async function measurePageLoadTime(page: Page, url: string) {
  const startTime = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const endTime = Date.now();
  
  return endTime - startTime;
}

/**
 * 複数ユーザーシミュレーションヘルパー
 */
export async function createMultipleUsers(context: any, userCount: number) {
  const pages = [];
  for (let i = 0; i < userCount; i++) {
    const page = await context.newPage();
    await loginUser(page, `test${i}123456`, `テストユーザー${i}`);
    pages.push(page);
  }
  return pages;
}

/**
 * データベースリセットヘルパー（テスト環境用）
 */
export async function resetTestDatabase(page: Page) {
  // テスト環境でのみ使用
  if (process.env.NODE_ENV === 'test') {
    await page.evaluate(() => {
      // IndexedDBやWebStorageをクリア
      if (window.indexedDB) {
        window.indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }
    });
  }
}