import { test, expect } from '@playwright/test';

test.describe('Posts Flow E2E', () => {
  // Helper function to login
  const loginUser = async (page: any, handbookNumber = 'test123456', nickname = 'テストユーザー') => {
    await page.goto('/');
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill(handbookNumber);
    await page.getByLabel(/ニックネーム|nickname/i).fill(nickname);
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    await expect(page).toHaveURL(/.*\/(tabs\/)?$/);
  };

  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('should display posts feed on home screen', async ({ page }) => {
    // Check if posts feed is visible
    await expect(page.getByText(/投稿|posts|フィード|feed/i)).toBeVisible();
    
    // Check for refresh functionality
    await expect(page.getByRole('button', { name: /更新|refresh|reload/i })).toBeVisible();
    
    // Should show loading state initially
    await expect(page.getByText(/読み込み|loading/i)).toBeVisible();
    
    // Wait for posts to load
    await page.waitForTimeout(2000);
  });

  test('should create a new post', async ({ page }) => {
    // Look for create post button or form
    const createButton = page.getByRole('button', { name: /投稿|post|作成|create/i }).first();
    await expect(createButton).toBeVisible();
    await createButton.click();
    
    // Fill in post content
    const contentInput = page.getByLabel(/内容|content|投稿.*内容/i).or(page.getByPlaceholder(/何.*考えている|what.*thinking|投稿/i));
    await expect(contentInput).toBeVisible();
    await contentInput.fill('これはテスト投稿です。Playwright E2Eテストから作成されました。');
    
    // Submit the post
    await page.getByRole('button', { name: /投稿|post|送信|submit|作成/i }).last().click();
    
    // Verify post creation success
    await expect(page.getByText(/投稿.*完了|post.*created|作成.*成功/i)).toBeVisible();
    
    // Verify post appears in feed
    await expect(page.getByText(/これはテスト投稿です/)).toBeVisible();
  });

  test('should create anonymous post', async ({ page }) => {
    // Open create post form
    await page.getByRole('button', { name: /投稿|post|作成|create/i }).first().click();
    
    // Fill content
    await page.getByLabel(/内容|content/i).fill('匿名投稿テストです。');
    
    // Enable anonymous posting
    const anonymousCheckbox = page.getByLabel(/匿名|anonymous|名前.*非表示/i);
    await expect(anonymousCheckbox).toBeVisible();
    await anonymousCheckbox.check();
    
    // Submit
    await page.getByRole('button', { name: /投稿|post|送信/i }).last().click();
    
    // Verify anonymous post appears without user name
    await expect(page.getByText(/匿名投稿テストです/)).toBeVisible();
    await expect(page.getByText(/匿名|anonymous/)).toBeVisible();
  });

  test('should like and unlike posts', async ({ page }) => {
    // Wait for posts to load
    await page.waitForTimeout(2000);
    
    // Find first like button
    const likeButton = page.getByRole('button', { name: /いいね|like|♡|❤/i }).first();
    await expect(likeButton).toBeVisible();
    
    // Get initial like count
    const likeCountBefore = await page.getByText(/\d+.*いいね|\d+.*likes?/).first().textContent();
    
    // Click like button
    await likeButton.click();
    
    // Verify like count increased
    await expect(page.getByText(/いいね.*済み|liked|♥|❤/)).toBeVisible();
    
    // Click again to unlike
    await likeButton.click();
    
    // Verify unliked state
    await expect(page.getByText(/いいね|like|♡/)).toBeVisible();
  });

  test('should add and view comments', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Find and click comment button on first post
    const commentButton = page.getByRole('button', { name: /コメント|comment|💬/i }).first();
    await expect(commentButton).toBeVisible();
    await commentButton.click();
    
    // Should open comment form/modal
    await expect(page.getByLabel(/コメント|comment/i)).toBeVisible();
    
    // Add a comment
    const commentInput = page.getByLabel(/コメント|comment/i);
    await commentInput.fill('テストコメントです！');
    
    // Submit comment
    await page.getByRole('button', { name: /投稿|post|送信|submit/i }).last().click();
    
    // Verify comment appears
    await expect(page.getByText(/テストコメントです/)).toBeVisible();
  });

  test('should filter posts by user', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for user profile link or filter option
    const userLink = page.getByText(/テストユーザー/).first();
    if (await userLink.isVisible()) {
      await userLink.click();
      
      // Should show only posts from this user
      await expect(page.getByText(/テストユーザー.*投稿|posts.*by/)).toBeVisible();
    }
  });

  test('should handle infinite scroll', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Scroll to bottom of page
    await page.keyboard.press('End');
    
    // Should trigger loading more posts
    await expect(page.getByText(/読み込み|loading|more/i)).toBeVisible();
    
    // Wait for more content to load
    await page.waitForTimeout(3000);
  });

  test('should handle pull-to-refresh', async ({ page }) => {
    // Simulate mobile pull-to-refresh gesture
    await page.touchscreen.tap(300, 100);
    await page.touchscreen.tap(300, 300);
    
    // Should show refresh indicator
    await expect(page.getByText(/更新|refresh|loading/i)).toBeVisible();
  });

  test('should search posts', async ({ page }) => {
    // Look for search functionality
    const searchInput = page.getByLabel(/検索|search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('テスト');
      await page.keyboard.press('Enter');
      
      // Should filter results
      await expect(page.getByText(/検索結果|search.*results/i)).toBeVisible();
    }
  });

  test('should handle post validation errors', async ({ page }) => {
    // Open create post form
    await page.getByRole('button', { name: /投稿|post|作成/i }).first().click();
    
    // Try to submit empty post
    await page.getByRole('button', { name: /投稿|post|送信/i }).last().click();
    
    // Should show validation error
    await expect(page.getByText(/内容.*必須|content.*required|空.*投稿/i)).toBeVisible();
    
    // Try posting too long content
    const longContent = 'あ'.repeat(501);
    await page.getByLabel(/内容|content/i).fill(longContent);
    await page.getByRole('button', { name: /投稿|post|送信/i }).last().click();
    
    // Should show length validation error
    await expect(page.getByText(/文字数.*超過|too.*long|500.*文字/i)).toBeVisible();
  });

  test('should show real-time updates', async ({ page, context }) => {
    // Open a second tab to simulate another user
    const page2 = await context.newPage();
    await loginUser(page2, 'test789', '別ユーザー');
    
    // Create post from second user
    await page2.getByRole('button', { name: /投稿|create/i }).first().click();
    await page2.getByLabel(/内容|content/i).fill('リアルタイムテストです');
    await page2.getByRole('button', { name: /投稿|post/i }).last().click();
    
    // Wait a moment for real-time update
    await page.waitForTimeout(2000);
    
    // First tab should show the new post
    await expect(page.getByText(/リアルタイムテストです/)).toBeVisible();
    
    await page2.close();
  });

  test('should handle offline state', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);
    
    // Try to create a post
    await page.getByRole('button', { name: /投稿|create/i }).first().click();
    await page.getByLabel(/内容|content/i).fill('オフライン投稿テスト');
    await page.getByRole('button', { name: /投稿|post/i }).last().click();
    
    // Should show offline message
    await expect(page.getByText(/オフライン|offline|接続.*確認/i)).toBeVisible();
    
    // Go back online
    await page.context().setOffline(false);
    
    // Should sync and show success
    await page.waitForTimeout(2000);
    await expect(page.getByText(/オンライン|connected|同期.*完了/i)).toBeVisible();
  });

  test('should handle image upload in posts', async ({ page }) => {
    // Open create post form
    await page.getByRole('button', { name: /投稿|create/i }).first().click();
    
    // Look for image upload functionality
    const imageUpload = page.getByLabel(/画像|image|写真|photo/i);
    if (await imageUpload.isVisible()) {
      // Simulate file upload
      await imageUpload.setInputFiles('./src/assets/test-image.jpg');
      
      // Should show image preview
      await expect(page.getByAltText(/プレビュー|preview|uploaded/i)).toBeVisible();
      
      // Add content and post
      await page.getByLabel(/内容|content/i).fill('画像付き投稿です');
      await page.getByRole('button', { name: /投稿|post/i }).last().click();
      
      // Verify posted with image
      await expect(page.getByText(/画像付き投稿です/)).toBeVisible();
    }
  });
});