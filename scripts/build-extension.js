#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Chrome拡張のビルドを開始します...');

// アイコンファイルが存在しない場合はSVGからPNGを生成
const iconsDir = path.join(__dirname, '../icons');
const svgPath = path.join(iconsDir, 'icon.svg');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// アイコンファイルの作成（簡易版）
const iconSizes = [16, 32, 48, 128];
iconSizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon-${size}.png`);
  if (!fs.existsSync(iconPath)) {
    // 簡易的なテキストアイコンを作成（実際の開発では画像変換ライブラリを使用）
    console.log(`ℹ️  アイコン ${size}x${size} を作成しています...`);
    
    // Base64エンコードされた簡易PNGアイコン（青色の正方形にテキスト）
    const iconData = createSimpleIcon(size);
    fs.writeFileSync(iconPath, iconData, 'base64');
  }
});

// manifest.jsonの検証
const manifestPath = path.join(__dirname, '../manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('✅ manifest.json が見つかりました');
  console.log(`   名前: ${manifest.name}`);
  console.log(`   バージョン: ${manifest.version}`);
} else {
  console.error('❌ manifest.json が見つかりません');
  process.exit(1);
}

// 必要なファイルの存在確認
const requiredFiles = [
  'popup.html',
  'popup.css', 
  'popup.js',
  'background.js'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '../', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} が見つかりました`);
  } else {
    console.error(`❌ ${file} が見つかりません`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.error('❌ 必要なファイルが不足しています');
  process.exit(1);
}

console.log('🎉 Chrome拡張のビルドが完了しました！');
console.log('');
console.log('📦 拡張機能をパッケージ化するには:');
console.log('   npm run package:extension');
console.log('');
console.log('🔧 Chrome拡張として読み込むには:');
console.log('   1. chrome://extensions/ を開く');
console.log('   2. 「デベロッパーモード」を有効にする');
console.log('   3. 「パッケージ化されていない拡張機能を読み込む」をクリック');
console.log('   4. このプロジェクトフォルダを選択');

function createSimpleIcon(size) {
  // 極簡易的な1x1ピクセルの青い画像のBase64データ
  // 実際の開発では sharp や canvas などで適切なアイコンを生成
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return Buffer.from(base64Data, 'base64');
}