export const metadata = {
  title: "プライバシーポリシー | 今日のタスク",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-2xl font-bold mb-8">プライバシーポリシー</h1>

      <p className="mb-6 text-sm text-gray-500">最終更新日：2026年3月27日</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">1. はじめに</h2>
        <p>
          本アプリ「今日のタスク」（以下「本サービス」）は、Google Tasks
          と連携してタスク管理を行うウェブアプリケーションです。
          本ポリシーでは、本サービスが取得・利用する情報について説明します。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">2. 取得する情報</h2>
        <p className="mb-3">
          本サービスは、Googleアカウントによるログイン時に以下の情報を取得します。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>メールアドレス</li>
          <li>氏名（Googleプロフィール名）</li>
          <li>プロフィール画像URL</li>
          <li>Google Tasks のタスクリストおよびタスク内容</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">3. 情報の利用目的</h2>
        <p>取得した情報は、以下の目的にのみ使用します。</p>
        <ul className="list-disc pl-6 space-y-1 mt-3">
          <li>ユーザー認証およびセッション管理</li>
          <li>Google Tasks からのタスク表示・更新機能の提供</li>
          <li>画面上のユーザー名・アイコンの表示</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">4. データの保存について</h2>
        <p className="mb-3">
          本サービスは、ユーザーのタスクデータや個人情報を独自のサーバーやデータベースに保存しません。
          タスクデータはリクエストのたびにGoogle Tasks
          APIから直接取得し、表示します。
        </p>
        <p>
          ただし、以下のデータはお使いのブラウザに保存されます。
        </p>
        <ul className="list-disc pl-6 space-y-1 mt-3">
          <li>
            <strong>認証セッション（Cookie）</strong>：ログイン状態の維持に使用。ブラウザを閉じるか、ログアウト時に削除されます。
          </li>
          <li>
            <strong>アプリ設定（Cookie）</strong>：表示設定（タスクリストの表示/非表示など）。有効期限は365日です。
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">5. 第三者への提供</h2>
        <p>
          取得した情報を第三者に販売・提供・開示することはありません。
          ただし、本サービスはGoogle LLC のAPIを利用しており、Googleのプライバシーポリシーが適用されます。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">6. データの削除・連携解除</h2>
        <p className="mb-3">
          本サービスへのアクセス許可を取り消すには、以下の手順でGoogleアカウントのアプリ連携を解除してください。
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Googleアカウントの「セキュリティ」設定を開く
          </li>
          <li>「サードパーティへのアクセス」から本アプリを選択</li>
          <li>「アクセス権を削除」をクリック</li>
        </ol>
        <p className="mt-3">
          連携解除後、本サービスはお客様のGoogleアカウント情報およびタスクデータにアクセスできなくなります。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">7. お問い合わせ</h2>
        <p>
          本ポリシーに関するご質問は、GitHubリポジトリのIssueからお問い合わせください。
        </p>
      </section>

      <div className="mt-12 pt-6 border-t border-gray-200">
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← トップページに戻る
        </a>
      </div>
    </div>
  );
}
