import { test, expect } from '@playwright/test';

test.describe('Profile Flow E2E', () => {
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

  test('should navigate to profile screen', async ({ page }) => {
    // Click profile tab
    await page.getByRole('tab', { name: /プロフィール|profile|👤/i }).click();
    
    // Should navigate to profile page
    await expect(page).toHaveURL(/.*\/profile$/);
    
    // Check for profile header
    await expect(page.getByRole('heading', { name: /プロフィール|profile/i })).toBeVisible();
  });

  test('should display user profile information', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    await page.waitForTimeout(1000);
    
    // Should show user nickname
    await expect(page.getByText(/テストユーザー/)).toBeVisible();
    
    // Should show user stats (posts, followers, following)
    await expect(page.getByText(/投稿|posts/).first()).toBeVisible();
    await expect(page.getByText(/フォロワー|followers/)).toBeVisible();
    await expect(page.getByText(/フォロー中|following/)).toBeVisible();
    
    // Should show profile picture placeholder or actual image
    await expect(page.getByAltText(/プロフィール.*画像|profile.*image/i)).toBeVisible();
  });

  test('should edit profile information', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Look for edit profile button
    const editButton = page.getByRole('button', { name: /編集|edit|プロフィール.*編集/i });
    await expect(editButton).toBeVisible();
    await editButton.click();
    
    // Should open edit form
    await expect(page.getByLabel(/ニックネーム|nickname/i)).toBeVisible();
    await expect(page.getByLabel(/自己紹介|bio|プロフィール/i)).toBeVisible();
    
    // Update nickname
    const nicknameInput = page.getByLabel(/ニックネーム|nickname/i);
    await nicknameInput.clear();
    await nicknameInput.fill('更新されたユーザー');
    
    // Update bio
    const bioInput = page.getByLabel(/自己紹介|bio/i);
    await bioInput.clear();
    await bioInput.fill('これは更新されたプロフィールです。');
    
    // Save changes
    await page.getByRole('button', { name: /保存|save|更新/i }).click();
    
    // Should show success message
    await expect(page.getByText(/保存.*完了|saved|更新.*成功/i)).toBeVisible();
    
    // Should display updated information
    await expect(page.getByText(/更新されたユーザー/)).toBeVisible();
    await expect(page.getByText(/これは更新されたプロフィールです/)).toBeVisible();
  });

  test('should upload and update profile picture', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Look for profile picture edit option
    const profileImage = page.getByAltText(/プロフィール.*画像|profile.*image/i);
    await expect(profileImage).toBeVisible();
    await profileImage.click();
    
    // Should show image upload options
    const uploadButton = page.getByRole('button', { name: /画像.*選択|choose.*image|アップロード/i });
    if (await uploadButton.isVisible()) {
      // Simulate file upload
      const fileInput = page.getByRole('button', { name: /ファイル.*選択|browse/i });
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles('./src/assets/test-profile.jpg');
        
        // Should show preview
        await expect(page.getByAltText(/プレビュー|preview/i)).toBeVisible();
        
        // Save new profile picture
        await page.getByRole('button', { name: /保存|save|設定/i }).click();
        
        // Should show success message
        await expect(page.getByText(/画像.*更新|image.*updated/i)).toBeVisible();
      }
    }
  });

  test('should display user posts in profile', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    await page.waitForTimeout(1000);
    
    // Should show user's posts section
    await expect(page.getByText(/投稿|posts|マイ.*投稿/i)).toBeVisible();
    
    // Check for posts grid or list
    const postsSection = page.getByText(/投稿/).locator('..');
    await expect(postsSection).toBeVisible();
    
    // If user has posts, should display them
    const postItems = page.getByTestId('post-item');
    const postCount = await postItems.count();
    
    if (postCount > 0) {
      // Should show post content
      await expect(postItems.first()).toBeVisible();
    } else {
      // Should show empty state
      await expect(page.getByText(/投稿.*ありません|no.*posts/i)).toBeVisible();
    }
  });

  test('should handle follow/unfollow functionality', async ({ page, context }) => {
    // Create a second user to test follow functionality
    const page2 = await context.newPage();
    await loginUser(page2, 'test789', '別ユーザー');
    
    // First user navigates to second user's profile
    await page.getByRole('tab', { name: /ホーム|home/i }).click();
    await page.waitForTimeout(1000);
    
    // Find a post by the second user and click on their name
    const userName = page.getByText(/別ユーザー/).first();
    if (await userName.isVisible()) {
      await userName.click();
      
      // Should navigate to their profile
      await expect(page.getByText(/別ユーザー/).first()).toBeVisible();
      
      // Should show follow button
      const followButton = page.getByRole('button', { name: /フォロー|follow/i });
      if (await followButton.isVisible()) {
        await followButton.click();
        
        // Should change to unfollow button
        await expect(page.getByRole('button', { name: /フォロー中|following|アンフォロー/i })).toBeVisible();
        
        // Click again to unfollow
        await page.getByRole('button', { name: /フォロー中|following/i }).click();
        
        // Should change back to follow button
        await expect(page.getByRole('button', { name: /フォロー|follow/i })).toBeVisible();
      }
    }
    
    await page2.close();
  });

  test('should view followers and following lists', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Click on followers count
    const followersLink = page.getByText(/\d+.*フォロワー|\d+.*followers/);
    if (await followersLink.isVisible()) {
      await followersLink.click();
      
      // Should show followers list
      await expect(page.getByRole('heading', { name: /フォロワー|followers/i })).toBeVisible();
      
      // Should show list of followers or empty state
      const hasFollowers = await page.getByText(/フォロワー.*いません|no.*followers/).isVisible();
      if (!hasFollowers) {
        await expect(page.getByTestId('follower-item').first()).toBeVisible();
      }
      
      // Go back to profile
      await page.goBack();
    }
    
    // Click on following count
    const followingLink = page.getByText(/\d+.*フォロー中|\d+.*following/);
    if (await followingLink.isVisible()) {
      await followingLink.click();
      
      // Should show following list
      await expect(page.getByRole('heading', { name: /フォロー中|following/i })).toBeVisible();
    }
  });

  test('should handle profile settings', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Look for settings button
    const settingsButton = page.getByRole('button', { name: /設定|settings|⚙/i });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    
    // Should show settings options
    await expect(page.getByText(/プライバシー|privacy/i)).toBeVisible();
    await expect(page.getByText(/通知|notifications/i)).toBeVisible();
    await expect(page.getByText(/アカウント|account/i)).toBeVisible();
    
    // Test privacy settings
    const privacyToggle = page.getByLabel(/プライベート.*アカウント|private.*account/i);
    if (await privacyToggle.isVisible()) {
      await privacyToggle.check();
      
      // Should show confirmation
      await expect(page.getByText(/プライベート.*設定|private.*mode/i)).toBeVisible();
    }
  });

  test('should handle logout from profile', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Look for logout button in settings or menu
    const settingsButton = page.getByRole('button', { name: /設定|settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }
    
    const logoutButton = page.getByRole('button', { name: /ログアウト|logout|サインアウト/i });
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    
    // Should show confirmation dialog
    const confirmButton = page.getByRole('button', { name: /確認|confirm|はい|yes/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*\/login$/);
    await expect(page.getByRole('heading', { name: /ログイン|login/i })).toBeVisible();
  });

  test('should validate profile form inputs', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Open edit profile form
    await page.getByRole('button', { name: /編集|edit/i }).click();
    
    // Test nickname validation
    const nicknameInput = page.getByLabel(/ニックネーム|nickname/i);
    
    // Test too short nickname
    await nicknameInput.clear();
    await nicknameInput.fill('a');
    await page.getByRole('button', { name: /保存|save/i }).click();
    await expect(page.getByText(/短すぎる|too.*short|2文字以上/i)).toBeVisible();
    
    // Test too long nickname
    await nicknameInput.clear();
    await nicknameInput.fill('a'.repeat(51));
    await page.getByRole('button', { name: /保存|save/i }).click();
    await expect(page.getByText(/長すぎる|too.*long|50文字以下/i)).toBeVisible();
    
    // Test bio length
    const bioInput = page.getByLabel(/自己紹介|bio/i);
    await bioInput.clear();
    await bioInput.fill('あ'.repeat(501));
    await page.getByRole('button', { name: /保存|save/i }).click();
    await expect(page.getByText(/文字数.*超過|too.*long|500.*文字/i)).toBeVisible();
  });

  test('should show profile statistics', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    await page.waitForTimeout(1000);
    
    // Should show various stats
    await expect(page.getByText(/投稿.*\d+|posts.*\d+/).first()).toBeVisible();
    await expect(page.getByText(/フォロワー.*\d+|followers.*\d+/)).toBeVisible();
    await expect(page.getByText(/フォロー中.*\d+|following.*\d+/)).toBeVisible();
    
    // Should show additional stats if available
    const likesReceived = page.getByText(/いいね.*\d+|likes.*\d+/);
    if (await likesReceived.isVisible()) {
      await expect(likesReceived).toBeVisible();
    }
  });

  test('should handle profile accessibility features', async ({ page }) => {
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should focus on interactive elements
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT'].includes(focusedElement || '')).toBeTruthy();
    
    // Test screen reader accessibility
    const profileImage = page.getByAltText(/プロフィール.*画像|profile.*image/i);
    await expect(profileImage).toBeVisible();
    
    // Buttons should have accessible labels
    const editButton = page.getByRole('button', { name: /編集|edit/i });
    await expect(editButton).toBeVisible();
  });
});