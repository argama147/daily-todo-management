# 今日のタスク - Chrome拡張版

Google Tasks と連携し、今日が期限のタスクを表示するChrome拡張機能。

期限切れのタスクや完了したタスク（今日操作したもののみ）もリスト表示する。

Googleカレンダーのタスク管理画面だと、リストの種類がたくさんある場合、今日が期限タスクがわかりずらい画面構成となっている。そこで今日のタスクを中心としたChrome拡張を作成。

**🔄 このプロジェクトはWebアプリ版からChrome拡張版に変更されました。**

|Googleカレンダーのタスク管理画面|
|----|
|<img width="1095" height="294" alt="スクリーンショット 2026-03-22 21 27 10" src="https://github.com/user-attachments/assets/bdc7d9c6-21b1-4b76-8f7d-1270f3818e34" />|


|このアプリ動作画面（画面は開発中のもの）|
|----|
|<img width="1111" height="523" alt="スクリーンショット 2026-03-22 22 30 20" src="https://github.com/user-attachments/assets/8aca7bbf-9d8a-4fb6-a484-802935410765" /> />|


## 使い方

### 1. Chrome拡張機能の開発・インストール

#### 1-1. リポジトリのクローンとビルド

```bash
git clone <このリポジトリ>
cd daily-todo-management
npm install
npm run build:extension
```

#### 1-2. Chrome拡張機能としてインストール

1. Chromeブラウザで `chrome://extensions/` を開く
2. 右上の **「デベロッパーモード」** を有効にする
3. **「パッケージ化されていない拡張機能を読み込む」** をクリック
4. このプロジェクトのルートディレクトリを選択

#### 1-3. Google Cloud Console の設定

##### OAuth 2.0 クライアント ID の作成

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. 左メニュー **「APIとサービス」→「認証情報」** を開く
3. **「認証情報を作成」→「OAuth クライアント ID」** をクリック
4. 以下を設定：
   - アプリケーションの種類: **「Chrome拡張機能」**
   - 拡張機能のID: Chrome拡張として読み込んだ際に表示されるID
5. 作成後に表示される **クライアント ID** をコピー

##### manifest.jsonの更新

`manifest.json` の `oauth2.client_id` を取得したクライアントIDに変更：

```json
{
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/tasks"]
  }
}
```

### 2. 使用方法

1. Chromeツールバーの拡張機能アイコンをクリック
2. **「Googleでログイン」** をクリックして認証
3. 今日期限のタスク、期限切れタスク、完了済みタスクを確認
4. チェックボックスをクリックしてタスクを完了/未完了に変更

---

## 開発フロー

| 作業 | リンク |
|---|---|
| 仕様Issueを作成 | [New 仕様 Issue](../../issues/new?title=%5B%E4%BB%95%E6%A7%98%5D%20&labels=spec&body=%23%23%20%E6%A6%82%E8%A6%81%0A%3C%21--%20%E3%81%A9%E3%81%AE%E3%82%88%E3%81%86%E3%81%AA%E4%BB%95%E6%A7%98%E3%82%92%E8%BF%BD%E5%8A%A0%E3%83%BB%E5%A4%89%E6%9B%B4%E3%81%99%E3%82%8B%E3%81%8B%E3%80%81%E8%83%8C%E6%99%AF%E3%82%84%E7%9B%AE%E7%9A%84%E3%82%92%E8%AA%AC%E6%98%8E%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%20--%3E%0A%0A%23%23%20%E8%BF%BD%E5%8A%A0%E3%83%BB%E5%A4%89%E6%9B%B4%E5%86%85%E5%AE%B9%0A-%0A%0A%23%23%20%E5%A4%89%E6%9B%B4%E3%81%97%E3%81%AA%E3%81%84%E7%AF%84%E5%9B%B2%EF%BC%88%E3%82%B9%E3%82%B3%E3%83%BC%E3%83%97%E5%A4%96%EF%BC%89%0A-%0A%0A%23%23%20%E5%82%99%E8%80%83%0A%3C%21--%20%E3%81%9D%E3%81%AE%E4%BB%96%E3%80%81%E5%AE%9F%E8%A3%85%E6%99%82%E3%81%AB%E8%80%83%E6%85%AE%E3%81%99%E3%81%B9%E3%81%8D%E4%BA%8B%E9%A0%85%E3%81%8C%E3%81%82%E3%82%8C%E3%81%B0%E8%A8%98%E8%BC%89%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%20--%3E) |

---

## 機能

### Chrome拡張機能の特徴

- **ポップアップUI**: 900x600の3カラムレイアウト
- **Chrome Identity API**: Chrome拡張専用のOAuth認証
- **オフライン対応**: 一時的なネットワーク障害時にキャッシュデータを表示
- **バックグラウンド同期**: 定期的なタスク更新（5分間隔）
- **通知機能**: 期限切れタスクの通知（オプション）

### 主な機能

- Google アカウントでの OAuth 2.0 ログイン / ログアウト
- 全タスクリストから今日期限のタスクを抽出して一覧表示
- 期限切れタスクの表示（経過日数付き）
- 今日完了したタスクの表示
- 各タスクにリスト名バッジを表示
- ワンクリックでタスクを完了/未完了に変更
- 手動更新ボタンで最新状態を再取得

## 開発コマンド

```bash
# Chrome拡張をビルド
npm run build:extension

# Chrome拡張をパッケージ化（ZIP作成）
npm run package:extension

# 開発用ビルド
npm run dev:extension
```
