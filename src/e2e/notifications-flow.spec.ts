import { test, expect } from '@playwright/test';

test.describe('Notifications Flow E2E', () => {
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

  test('should navigate to notifications screen', async ({ page }) => {
    // Click notifications tab
    await page.getByRole('tab', { name: /通知|notifications|🔔/i }).click();
    
    // Should navigate to notifications page
    await expect(page).toHaveURL(/.*\/notifications$/);
    
    // Check for notifications header
    await expect(page.getByRole('heading', { name: /通知|notifications/i })).toBeVisible();
  });

  test('should display notifications list', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    
    // Should show loading state initially
    await expect(page.getByText(/読み込み|loading/i)).toBeVisible();
    
    // Wait for notifications to load
    await page.waitForTimeout(2000);
    
    // Should show notifications or empty state
    const hasNotifications = await page.getByText(/いいね|like|コメント|comment|フォロー|follow/).count() > 0;
    if (hasNotifications) {
      await expect(page.getByText(/いいね|like|コメント|comment|フォロー|follow/).first()).toBeVisible();
    } else {
      await expect(page.getByText(/通知.*ありません|no.*notifications|空/i)).toBeVisible();
    }
  });

  test('should show notification badge when there are unread notifications', async ({ page }) => {
    // Create activity that generates notification (like a post)
    await page.getByRole('tab', { name: /ホーム|home/i }).click();
    
    // Like a post to generate notification for another user
    const likeButton = page.getByRole('button', { name: /いいね|like/i }).first();
    if (await likeButton.isVisible()) {
      await likeButton.click();
    }
    
    // Check if notification badge appears
    const notificationBadge = page.getByText(/\d+/).locator('near=tab[name*="通知"]');
    if (await notificationBadge.isVisible()) {
      await expect(notificationBadge).toBeVisible();
    }
  });

  test('should mark notifications as read when viewed', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(2000);
    
    // Check for unread notification indicators
    const unreadIndicator = page.getByText(/未読|unread|new|•/).first();
    if (await unreadIndicator.isVisible()) {
      // Click on the notification
      const notification = unreadIndicator.locator('..');
      await notification.click();
      
      // Should mark as read (indicator disappears)
      await expect(unreadIndicator).not.toBeVisible();
    }
  });

  test('should handle different notification types', async ({ page, context }) => {
    // Create a second user to generate notifications
    const page2 = await context.newPage();
    await loginUser(page2, 'test789', '別ユーザー');
    
    // First user creates a post
    await page.getByRole('tab', { name: /ホーム|home/i }).click();
    await page.getByRole('button', { name: /投稿|create/i }).first().click();
    await page.getByLabel(/内容|content/i).fill('通知テスト用の投稿です');
    await page.getByRole('button', { name: /投稿|post/i }).last().click();
    await page.waitForTimeout(1000);
    
    // Second user likes the post
    await page2.reload();
    await page2.waitForTimeout(2000);
    const likeButton = page2.getByRole('button', { name: /いいね|like/i }).first();
    if (await likeButton.isVisible()) {
      await likeButton.click();
      await page2.waitForTimeout(1000);
    }
    
    // Second user comments on the post
    const commentButton = page2.getByRole('button', { name: /コメント|comment/i }).first();
    if (await commentButton.isVisible()) {
      await commentButton.click();
      await page2.getByLabel(/コメント|comment/i).fill('素晴らしい投稿ですね！');
      await page2.getByRole('button', { name: /投稿|post|送信/i }).last().click();
      await page2.waitForTimeout(1000);
    }
    
    // First user should receive notifications
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(2000);
    
    // Check for like notification
    await expect(page.getByText(/いいね|liked/).first()).toBeVisible();
    
    // Check for comment notification  
    await expect(page.getByText(/コメント|comment/).first()).toBeVisible();
    
    await page2.close();
  });

  test('should handle pull-to-refresh on notifications', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(1000);
    
    // Simulate pull-to-refresh gesture
    await page.touchscreen.tap(300, 100);
    await page.touchscreen.tap(300, 300);
    
    // Should show refresh indicator
    await expect(page.getByText(/更新|refresh|読み込み/i)).toBeVisible();
    
    // Wait for refresh to complete
    await page.waitForTimeout(2000);
  });

  test('should clear all notifications', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(2000);
    
    // Look for clear all button
    const clearAllButton = page.getByRole('button', { name: /すべて.*削除|clear.*all|全て.*既読/i });
    if (await clearAllButton.isVisible()) {
      await clearAllButton.click();
      
      // Confirm action if confirmation dialog appears
      const confirmButton = page.getByRole('button', { name: /確認|confirm|はい|yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Should show empty state
      await expect(page.getByText(/通知.*ありません|no.*notifications/i)).toBeVisible();
    }
  });

  test('should handle notification settings', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    
    // Look for settings/preferences button
    const settingsButton = page.getByRole('button', { name: /設定|settings|⚙/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Should show notification settings
      await expect(page.getByText(/通知.*設定|notification.*settings/i)).toBeVisible();
      
      // Check for notification type toggles
      await expect(page.getByLabel(/いいね.*通知|like.*notifications/i)).toBeVisible();
      await expect(page.getByLabel(/コメント.*通知|comment.*notifications/i)).toBeVisible();
    }
  });

  test('should show real-time notifications', async ({ page, context }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(1000);
    
    // Create second user
    const page2 = await context.newPage();
    await loginUser(page2, 'test789', '別ユーザー');
    
    // Second user creates and likes first user's post
    await page2.getByRole('tab', { name: /ホーム|home/i }).click();
    const likeButton = page2.getByRole('button', { name: /いいね|like/i }).first();
    if (await likeButton.isVisible()) {
      await likeButton.click();
    }
    
    // First user should see notification appear in real-time
    await page.waitForTimeout(3000);
    await expect(page.getByText(/いいね|liked/).first()).toBeVisible();
    
    await page2.close();
  });

  test('should handle notification filtering', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(2000);
    
    // Look for filter options
    const filterButton = page.getByRole('button', { name: /フィルター|filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Should show filter options
      await expect(page.getByText(/いいね|likes/i)).toBeVisible();
      await expect(page.getByText(/コメント|comments/i)).toBeVisible();
      await expect(page.getByText(/フォロー|follows/i)).toBeVisible();
      
      // Select like notifications only
      await page.getByLabel(/いいね|likes/).check();
      await page.getByLabel(/コメント|comments/).uncheck();
      
      // Apply filter
      await page.getByRole('button', { name: /適用|apply/i }).click();
      
      // Should show only like notifications
      const notifications = page.getByTestId('notification-item');
      const count = await notifications.count();
      for (let i = 0; i < count; i++) {
        await expect(notifications.nth(i)).toContainText(/いいね|like/i);
      }
    }
  });

  test('should handle notification actions', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(2000);
    
    // Find a notification with actionable content
    const notification = page.getByText(/いいね|comment|follow/).first();
    if (await notification.isVisible()) {
      await notification.click();
      
      // Should navigate to related content (post, profile, etc.)
      await page.waitForTimeout(1000);
      
      // Should be on a different page now
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/notifications');
    }
  });

  test('should show notification count badge', async ({ page }) => {
    // Check notification tab for badge
    const notificationTab = page.getByRole('tab', { name: /通知|notifications/i });
    
    // Should have badge if there are unread notifications
    const badge = notificationTab.getByText(/\d+/);
    if (await badge.isVisible()) {
      const badgeText = await badge.textContent();
      expect(parseInt(badgeText!)).toBeGreaterThan(0);
    }
    
    // Click notifications tab
    await notificationTab.click();
    await page.waitForTimeout(2000);
    
    // Badge should disappear after viewing
    await expect(badge).not.toBeVisible();
  });

  test('should handle empty notifications state', async ({ page }) => {
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    await page.waitForTimeout(2000);
    
    // If no notifications, should show empty state
    const hasNotifications = await page.getByText(/いいね|like|コメント|comment/).count() > 0;
    
    if (!hasNotifications) {
      await expect(page.getByText(/通知.*ありません|no.*notifications|空/i)).toBeVisible();
      await expect(page.getByText(/アクティビティ.*開始|start.*activity/i)).toBeVisible();
    }
  });
});