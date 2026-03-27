export const metadata = {
  title: "利用規約 | 今日のタスク",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-2xl font-bold mb-8">利用規約</h1>

      <p className="mb-6 text-sm text-gray-500">最終更新日：2026年3月27日</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">1. サービスの概要</h2>
        <p>
          「今日のタスク」（以下「本サービス」）は、Google Tasks
          と連携し、本日期限のタスクや期限切れタスクを管理するためのウェブアプリケーションです。
          本規約は、本サービスを利用するすべてのユーザーに適用されます。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">2. 利用条件</h2>
        <p>本サービスを利用するには、以下の条件を満たす必要があります。</p>
        <ul className="list-disc pl-6 space-y-1 mt-3">
          <li>有効なGoogleアカウントを保有していること</li>
          <li>本規約およびプライバシーポリシーに同意していること</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">3. 禁止事項</h2>
        <p>ユーザーは、以下の行為を行ってはなりません。</p>
        <ul className="list-disc pl-6 space-y-1 mt-3">
          <li>本サービスへの不正アクセスや、過度な負荷をかける行為</li>
          <li>本サービスを利用した違法行為</li>
          <li>その他、本サービスの運営を妨げる行為</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">4. 免責事項</h2>
        <p className="mb-3">
          本サービスは現状有姿で提供されます。以下について、運営者は一切の責任を負いません。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>本サービスの中断・停止・変更・廃止によって生じた損害</li>
          <li>Google Tasks API の仕様変更や障害によって生じた損害</li>
          <li>ユーザーのタスクデータの消失または誤操作によって生じた損害</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">5. サービスの変更・終了</h2>
        <p>
          運営者は、事前の通知なく本サービスの内容を変更し、または提供を終了することがあります。
          予めご了承ください。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">6. 規約の変更</h2>
        <p>
          本規約は、必要に応じて変更される場合があります。変更後の規約は本ページに掲載した時点で効力を生じます。
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
