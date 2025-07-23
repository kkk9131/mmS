import { test, expect } from '@playwright/test';

test.describe('Authentication Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display login screen initially', async ({ page }) => {
    // Check if login form is visible
    await expect(page.getByRole('heading', { name: /ログイン|login/i })).toBeVisible();
    
    // Check for mother's handbook number input
    await expect(page.getByLabel(/母子手帳番号|handbook.*number/i)).toBeVisible();
    
    // Check for nickname input
    await expect(page.getByLabel(/ニックネーム|nickname/i)).toBeVisible();
    
    // Check login button
    await expect(page.getByRole('button', { name: /ログイン|login/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click login button without filling fields
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Check for validation error messages
    await expect(page.getByText(/母子手帳番号.*必須|handbook.*required/i)).toBeVisible();
    await expect(page.getByText(/ニックネーム.*必須|nickname.*required/i)).toBeVisible();
  });

  test('should show loading state during login', async ({ page }) => {
    // Fill in login form
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('test123456');
    await page.getByLabel(/ニックネーム|nickname/i).fill('テストユーザー');
    
    // Click login button
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Check for loading indicator
    await expect(page.getByText(/ログイン中|logging.*in|loading/i)).toBeVisible();
  });

  test('should complete successful login flow', async ({ page }) => {
    // Fill in valid credentials
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('test123456');
    await page.getByLabel(/ニックネーム|nickname/i).fill('テストユーザー');
    
    // Submit login
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Wait for navigation to home screen
    await expect(page).toHaveURL(/.*\/(tabs\/)?$/);
    
    // Check for authenticated state indicators
    await expect(page.getByText(/ホーム|home/i)).toBeVisible();
    await expect(page.getByText(/投稿|posts/i)).toBeVisible();
  });

  test('should handle login error gracefully', async ({ page }) => {
    // Mock network error or use invalid credentials
    await page.route('**/auth/**', route => route.abort());
    
    // Attempt login
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('invalid123');
    await page.getByLabel(/ニックネーム|nickname/i).fill('InvalidUser');
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Check for error message
    await expect(page.getByText(/エラー|error|失敗|failed/i)).toBeVisible();
  });

  test('should persist authentication across page refresh', async ({ page }) => {
    // Complete login first
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('test123456');
    await page.getByLabel(/ニックネーム|nickname/i).fill('テストユーザー');
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Wait for successful login
    await expect(page).toHaveURL(/.*\/(tabs\/)?$/);
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated (not redirected to login)
    await expect(page).toHaveURL(/.*\/(tabs\/)?$/);
    await expect(page.getByText(/ホーム|home/i)).toBeVisible();
  });

  test('should handle logout flow', async ({ page }) => {
    // Complete login first
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('test123456');
    await page.getByLabel(/ニックネーム|nickname/i).fill('テストユーザー');
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Navigate to profile/settings
    await page.getByRole('tab', { name: /プロフィール|profile/i }).click();
    
    // Find and click logout button
    await page.getByRole('button', { name: /ログアウト|logout|サインアウト|sign.*out/i }).click();
    
    // Confirm logout if confirmation dialog appears
    await page.getByRole('button', { name: /確認|confirm|はい|yes/i }).click();
    
    // Should redirect to login screen
    await expect(page).toHaveURL(/.*\/login$/);
    await expect(page.getByRole('heading', { name: /ログイン|login/i })).toBeVisible();
  });

  test('should handle session expiry', async ({ page }) => {
    // Complete login
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('test123456');
    await page.getByLabel(/ニックネーム|nickname/i).fill('テストユーザー');
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    await expect(page).toHaveURL(/.*\/(tabs\/)?$/);
    
    // Clear session storage to simulate expiry
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Navigate to a protected route
    await page.getByRole('tab', { name: /通知|notifications/i }).click();
    
    // Should redirect to login due to expired session
    await expect(page).toHaveURL(/.*\/login$/);
  });

  test('should validate mother handbook number format', async ({ page }) => {
    // Test invalid format
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('123');
    await page.getByLabel(/ニックネーム|nickname/i).fill('テストユーザー');
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    
    // Should show format validation error
    await expect(page.getByText(/形式.*正しくない|invalid.*format|桁数.*足りない/i)).toBeVisible();
  });

  test('should validate nickname length and characters', async ({ page }) => {
    await page.getByLabel(/母子手帳番号|handbook.*number/i).fill('test123456');
    
    // Test too short nickname
    await page.getByLabel(/ニックネーム|nickname/i).fill('a');
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    await expect(page.getByText(/短すぎる|too.*short|文字以上/i)).toBeVisible();
    
    // Test too long nickname
    await page.getByLabel(/ニックネーム|nickname/i).fill('a'.repeat(51));
    await page.getByRole('button', { name: /ログイン|login/i }).click();
    await expect(page.getByText(/長すぎる|too.*long|文字以下/i)).toBeVisible();
  });
});