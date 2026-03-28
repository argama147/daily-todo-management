export const metadata = {
  title: "ヘルプ | 今日のタスク",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 text-gray-800">
        <h1 className="text-3xl font-bold mb-8">今日のタスク - ヘルプ</h1>

        {/* アプリの概要 */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">アプリの概要</h2>
          <p className="mb-4">
            「今日のタスク」は、Google Tasks と連携してタスク管理を効率的に行うウェブアプリケーションです。
            本日期限のタスクや期限切れのタスクを分かりやすく整理して表示し、タスクの優先順位付けをサポートします。
          </p>
        </section>

        {/* 基本操作 */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">基本操作</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">ログイン</h3>
              <p className="text-sm text-gray-600">
                Googleアカウントを使用してログインします。Google Tasksへのアクセス権限が必要です。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">タスクの表示・編集</h3>
              <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600">
                <li>タスクをクリックすると詳細画面が開きます</li>
                <li>タスクの完了・未完了の切り替えができます</li>
                <li>タスクの編集・削除も可能です</li>
                <li>変更は即座にGoogle Tasksに反映されます</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">設定の変更</h3>
              <p className="text-sm text-gray-600">
                右上の設定アイコンから表示設定やフィルターを変更できます。
              </p>
            </div>
          </div>
        </section>

        {/* タスク分類の説明 */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">タスク分類について</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-lg font-medium text-red-800 mb-2">期限切れタスク</h3>
                <p className="text-sm text-red-700">
                  期限が昨日以前に設定されているが、まだ完了していないタスクです。優先的に対応しましょう。
                </p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-medium text-blue-800 mb-2">今日の未完了タスク</h3>
                <p className="text-sm text-blue-700">
                  期限が本日に設定されているタスクのうち、まだ完了していないものです。
                </p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-medium text-green-800 mb-2">完了したタスク</h3>
                <p className="text-sm text-green-700">
                  本日完了したタスクの一覧です。達成感を味わいましょう。
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-lg font-medium text-yellow-800 mb-2">一週間以内のタスク</h3>
                <p className="text-sm text-yellow-700">
                  明日から一週間以内に期限が設定されているタスクです。
                </p>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="text-lg font-medium text-purple-800 mb-2">一ヶ月以内のタスク</h3>
                <p className="text-sm text-purple-700">
                  一週間より先、一ヶ月以内に期限が設定されているタスクです。
                </p>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-2">長期タスク・期限なしタスク</h3>
                <p className="text-sm text-gray-700">
                  一ヶ月より先の期限、または期限が設定されていないタスクです。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 設定機能の説明 */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">設定機能</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">表示設定</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm text-gray-600">
                <li><strong>ログイン名を表示</strong>：画面右上にユーザー名を表示するかどうかを設定</li>
                <li><strong>表示するリスト</strong>：各タスクカテゴリの表示・非表示を個別に設定可能</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3">フィルターセット機能</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm text-gray-600">
                <li>Google Tasksのタスクリスト（プロジェクト）ごとに表示・非表示を設定</li>
                <li>複数のフィルターセットを作成して、用途に応じて切り替え可能</li>
                <li>例：「仕事用」「プライベート用」など</li>
                <li>フィルターセット名は10文字まで設定可能</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Google Tasks連携について */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">Google Tasks連携について</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">連携の仕組み</h3>
              <p className="text-sm text-gray-600 mb-3">
                このアプリは、Google Tasks API を使用してリアルタイムでタスクデータを取得・更新します。
                アプリ独自のデータベースは使用せず、すべてのデータはGoogle Tasksに保存されます。
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">利用できる機能</h3>
              <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600">
                <li>タスクの一覧表示（期限による自動分類）</li>
                <li>タスクの完了・未完了の切り替え</li>
                <li>タスクの編集（タイトル、期限、詳細）</li>
                <li>タスクの削除</li>
                <li>Google Tasksの複数リスト（プロジェクト）に対応</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">データの同期</h3>
              <p className="text-sm text-gray-600">
                Google Tasksアプリや他のGoogle Tasksクライアントでの変更も、このアプリに即座に反映されます。
                逆に、このアプリでの変更もGoogle Tasksアプリに同期されます。
              </p>
            </div>
          </div>
        </section>

        {/* 利用規約・プライバシーポリシー */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">利用規約・プライバシーポリシー</h2>
          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-sm text-gray-600 mb-4">
              本アプリの利用に関する詳細な規約と、個人情報の取り扱いについては以下をご覧ください。
            </p>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">プライバシーポリシー</h3>
                <p className="text-sm text-gray-600 mb-3">
                  本アプリが取得・利用する個人情報の種類、利用目的、保存・管理方法について説明しています。
                  Google Tasks API の利用、データの保存場所、第三者への情報提供などについて詳しく記載されています。
                </p>
                <a 
                  href="/privacy" 
                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                >
                  プライバシーポリシーを読む →
                </a>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <h3 className="text-lg font-medium mb-2">利用規約</h3>
                <p className="text-sm text-gray-600 mb-3">
                  本サービスの利用条件、禁止事項、免責事項などを定めています。
                  Google Tasks との連携利用、サービスの変更・終了、規約の変更などについて記載されています。
                </p>
                <a 
                  href="/terms" 
                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                >
                  利用規約を読む →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* サポート・お問い合わせ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">サポート・お問い合わせ</h2>
          <div className="bg-blue-50 p-6 rounded-lg">
            <p className="text-sm text-gray-600 mb-4">
              アプリの不具合報告、機能改善のご要望、使い方に関するご質問は、
              GitHubリポジトリのIssueからお気軽にお問い合わせください。
            </p>
            <a 
              href="https://github.com/argama147/daily-todo-management/issues" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
            >
              GitHub Issues でお問い合わせ
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </section>

        {/* ナビゲーション */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between items-center">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            ← トップページに戻る
          </a>
          <p className="text-xs text-gray-400">
            最終更新日：{new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日
          </p>
        </div>
      </div>
    </div>
  );
}