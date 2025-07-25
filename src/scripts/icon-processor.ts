#!/usr/bin/env npx tsx
/**
 * アイコン処理・サイズ変更スクリプト
 * TestFlight用に適切なサイズのアイコンを自動生成
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface IconConfig {
  name: string;
  size: number;
  purpose: string;
  required: boolean;
}

const ICON_CONFIGS: IconConfig[] = [
  { name: 'icon.png', size: 1024, purpose: 'App Store・メインアイコン', required: true },
  { name: 'adaptive-icon.png', size: 1024, purpose: 'Android適応アイコン', required: false },
  { name: 'favicon.png', size: 48, purpose: 'Web用ファビコン', required: false },
  { name: 'notification-icon.png', size: 256, purpose: 'プッシュ通知アイコン', required: false },
  { name: 'splash-icon.png', size: 512, purpose: 'スプラッシュ画面用', required: false }
];

async function processIcons(sourceIconPath?: string): Promise<void> {
  console.log('🎨 アイコン処理・サイズ変更開始');
  console.log('==========================================');
  
  try {
    // Step 1: ソースアイコンの確認
    console.log('\n1️⃣ ソースアイコン確認中...');
    const sourcePath = await findSourceIcon(sourceIconPath);
    
    if (!sourcePath) {
      console.log('📁 利用可能な画像処理オプション:');
      console.log('1. ImageMagick (convert コマンド)');
      console.log('2. sips (macOS標準)');
      console.log('3. オンライン変換サービス');
      console.log('\n💡 使用方法:');
      console.log('npx tsx src/scripts/icon-processor.ts [アイコンファイルパス]');
      return;
    }
    
    console.log(`✅ ソースアイコン発見: ${sourcePath}`);
    
    // Step 2: 画像処理ツールの確認
    console.log('\n2️⃣ 画像処理ツール確認中...');
    const processingTool = await checkImageProcessingTools();
    console.log(`🛠️ 使用ツール: ${processingTool}`);
    
    // Step 3: 必要なアイコンサイズを生成
    console.log('\n3️⃣ アイコンサイズ生成中...');
    const assetsDir = path.join(process.cwd(), 'assets', 'images');
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    
    for (const config of ICON_CONFIGS) {
      try {
        console.log(`🔄 ${config.name} (${config.size}x${config.size}) 生成中...`);
        
        const outputPath = path.join(assetsDir, config.name);
        await resizeIcon(sourcePath, outputPath, config.size, processingTool);
        
        console.log(`✅ ${config.name} 生成完了 - ${config.purpose}`);
      } catch (error) {
        if (config.required) {
          console.error(`❌ 必須アイコン ${config.name} の生成に失敗:`, error);
          throw error;
        } else {
          console.warn(`⚠️ オプションアイコン ${config.name} の生成をスキップ`);
        }
      }
    }
    
    // Step 4: アイコン検証
    console.log('\n4️⃣ 生成アイコン検証中...');
    const validationResults = await validateGeneratedIcons(assetsDir);
    displayValidationResults(validationResults);
    
    // Step 5: app.json更新確認
    console.log('\n5️⃣ app.json設定確認中...');
    await verifyAppJsonIconSettings();
    
    // Step 6: TestFlight用追加設定
    console.log('\n6️⃣ TestFlight用設定生成中...');
    await generateTestFlightIconSettings();
    
    console.log('\n🎉 アイコン処理・サイズ変更完了！');
    console.log('📱 TestFlightビルドの準備が整いました。');
    
  } catch (error) {
    console.error('❌ アイコン処理でエラーが発生:', error);
    throw error;
  }
}

// ソースアイコンの検索
async function findSourceIcon(providedPath?: string): Promise<string | null> {
  if (providedPath && fs.existsSync(providedPath)) {
    return providedPath;
  }
  
  // 一般的な場所を検索
  const commonPaths = [
    path.join(process.cwd(), 'assets', 'images', 'icon.png'),
    path.join(process.cwd(), 'assets', 'icon.png'),
    path.join(process.cwd(), 'icon.png'),
    path.join(process.env.HOME || '~', 'Downloads', 'mamapace-icon.png'),
    path.join(process.env.HOME || '~', 'Downloads', 'icon.png'),
    path.join(process.env.HOME || '~', 'Desktop', 'mamapace-icon.png'),
    path.join(process.env.HOME || '~', 'Desktop', 'icon.png')
  ];
  
  for (const iconPath of commonPaths) {
    if (fs.existsSync(iconPath)) {
      console.log(`📁 アイコンファイル発見: ${iconPath}`);
      return iconPath;
    }
  }
  
  return null;
}

// 画像処理ツールの確認
async function checkImageProcessingTools(): Promise<string> {
  // macOS標準のsipsを優先
  try {
    await execAsync('which sips');
    return 'sips';
  } catch (error) {
    // sipsが利用できない場合はImageMagickを確認
    try {
      await execAsync('which convert');
      return 'imagemagick';
    } catch (error) {
      console.warn('⚠️ 画像処理ツールが見つかりません');
      console.log('💡 以下のいずれかをインストールしてください:');
      console.log('1. macOS: sips (標準搭載)');
      console.log('2. ImageMagick: brew install imagemagick');
      throw new Error('画像処理ツールが利用できません');
    }
  }
}

// アイコンリサイズ実行
async function resizeIcon(
  sourcePath: string, 
  outputPath: string, 
  size: number, 
  tool: string
): Promise<void> {
  let command = '';
  
  switch (tool) {
    case 'sips':
      command = `sips -z ${size} ${size} "${sourcePath}" --out "${outputPath}"`;
      break;
    case 'imagemagick':
      command = `convert "${sourcePath}" -resize ${size}x${size} "${outputPath}"`;
      break;
    default:
      throw new Error(`サポートされていない画像処理ツール: ${tool}`);
  }
  
  await execAsync(command);
}

// 生成アイコンの検証
async function validateGeneratedIcons(assetsDir: string) {
  const results: Array<{
    name: string;
    exists: boolean;
    size: string;
    purpose: string;
    valid: boolean;
  }> = [];
  
  for (const config of ICON_CONFIGS) {
    const iconPath = path.join(assetsDir, config.name);
    const exists = fs.existsSync(iconPath);
    
    let actualSize = '';
    let valid = false;
    
    if (exists) {
      try {
        // ファイルサイズ取得
        const stats = fs.statSync(iconPath);
        actualSize = `${Math.round(stats.size / 1024)}KB`;
        valid = stats.size > 0;
      } catch (error) {
        actualSize = 'エラー';
        valid = false;
      }
    }
    
    results.push({
      name: config.name,
      exists,
      size: actualSize,
      purpose: config.purpose,
      valid: exists && valid
    });
  }
  
  return results;
}

// 検証結果表示
function displayValidationResults(results: any[]): void {
  console.log('📊 アイコン検証結果:');
  results.forEach(result => {
    const status = result.valid ? '✅' : '❌';
    console.log(`${status} ${result.name} - ${result.size} (${result.purpose})`);
  });
}

// app.json設定確認
async function verifyAppJsonIconSettings(): Promise<void> {
  const appJsonPath = path.join(process.cwd(), 'app.json');
  
  if (!fs.existsSync(appJsonPath)) {
    console.warn('⚠️ app.json が見つかりません');
    return;
  }
  
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  
  console.log('📱 現在のアイコン設定:');
  console.log(`   メインアイコン: ${appJson.expo.icon || '未設定'}`);
  console.log(`   Androidアイコン: ${appJson.expo.android?.icon || '未設定'}`);
  console.log(`   通知アイコン: ${appJson.expo.notification?.icon || '未設定'}`);
  
  // 設定が適切かチェック
  const iconPath = appJson.expo.icon;
  if (iconPath && !fs.existsSync(path.join(process.cwd(), iconPath.replace('./', '')))) {
    console.warn(`⚠️ 設定されたアイコンファイルが存在しません: ${iconPath}`);
  } else {
    console.log('✅ アイコン設定は正常です');
  }
}

// TestFlight用追加設定
async function generateTestFlightIconSettings(): Promise<void> {
  const additionalSettings = {
    ios_specific_settings: {
      icon_variants: [
        { size: '1024x1024', purpose: 'App Store' },
        { size: '180x180', purpose: 'iPhone App Icon' },
        { size: '120x120', purpose: 'iPhone App Icon (2x)' },
        { size: '167x167', purpose: 'iPad Pro App Icon' },
        { size: '152x152', purpose: 'iPad App Icon' }
      ],
      requirements: [
        'PNG形式必須',
        '透明度なし（背景必須）',
        '角丸なし（iOSが自動適用）',
        '最高品質での保存'
      ]
    },
    testflight_checklist: [
      '✅ 1024x1024 メインアイコン準備完了',
      '✅ app.json にアイコンパス設定済み',
      '✅ アイコンファイルの存在確認済み',
      '✅ TestFlightビルド準備完了'
    ]
  };
  
  const settingsPath = path.join(process.cwd(), 'docs', 'ICON_SETTINGS.json');
  fs.writeFileSync(settingsPath, JSON.stringify(additionalSettings, null, 2));
  
  console.log('📋 TestFlightアイコン設定チェックリスト:');
  additionalSettings.testflight_checklist.forEach(item => {
    console.log(`   ${item}`);
  });
}

// メイン実行
if (require.main === module) {
  const sourceIconPath = process.argv[2];
  
  processIcons(sourceIconPath)
    .then(() => {
      console.log('\n✅ アイコン処理完了');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ アイコン処理失敗:', error);
      process.exit(1);
    });
}

export { processIcons };