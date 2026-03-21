# 今日のタスク

Google Tasks と連携し、今日が期限のタスクを全リストから一覧表示する Next.js アプリ。

## 使い方

### 1. Google Cloud Console の設定

#### 1-1. プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. 画面上部のプロジェクト選択 → **「新しいプロジェクト」** をクリック
3. プロジェクト名を入力して作成

#### 1-2. Google Tasks API の有効化

1. 左メニュー **「APIとサービス」→「ライブラリ」** を開く
2. 検索欄に **「Google Tasks API」** と入力
3. 結果をクリック → **「有効にする」** ボタンを押す

#### 1-3. OAuth 同意画面の設定

1. 左メニュー **「Google Auth Platform」→「概要」** を開く（または「APIとサービス」→「OAuth 同意画面」）
2. **「開始」** をクリックし、以下を入力：
   - アプリ名: 任意（例: `今日のタスク`）
   - ユーザーサポートメール: 自分のメールアドレス
3. **「対象」** セクションで **「外部」** を選択 → 保存
4. **「テストユーザー」** に自分の Google アカウントのメールアドレスを追加

#### 1-4. OAuth 2.0 クライアント ID の作成

1. 左メニュー **「APIとサービス」→「認証情報」** を開く
2. **「認証情報を作成」→「OAuth クライアント ID」** をクリック
3. 以下を設定：
   - アプリケーションの種類: **「ウェブアプリケーション」**
   - 承認済みのリダイレクト URI: `http://localhost:3000/api/auth/callback/google` を追加
4. 作成後に表示される **クライアント ID** と **クライアントシークレット** をコピーしておく

---

### 2. 環境変数の設定

プロジェクトルートの `.env.local` を編集：

```env
GOOGLE_CLIENT_ID=取得したクライアントID
GOOGLE_CLIENT_SECRET=取得したクライアントシークレット
AUTH_SECRET=ランダムな文字列（下記コマンドで生成）
NEXTAUTH_URL=http://localhost:3000
```

`AUTH_SECRET` の生成:

```bash
openssl rand -base64 32
```

---

### 3. 起動

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いて **「Google でログイン」** をクリック。

---

## 開発フロー

| 作業 | リンク |
|---|---|
| 仕様Issueを作成 | [New 仕様 Issue](../../issues/new?template=spec.md&labels=spec&assignees=argama147&title=%5B%E4%BB%95%E6%A7%98%5D%20) |

---

## 機能

- Google アカウントで OAuth 2.0 ログイン / ログアウト
- 全タスクリストから今日期限のタスクを抽出して一覧表示
- 各タスクにリスト名バッジを表示
- 丸ボタンでタスクを完了にする
- 「更新」ボタンで最新状態を再取得
