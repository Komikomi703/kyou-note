# 今日ノート

「今日ノート」は、タスク・習慣・目標・振り返りを日付ごとにまとめる、Calm SkyデザインのレスポンシブWebアプリです。FirebaseやGoogleの認証情報がなくても、すべての基本機能をローカル保存モードで利用できます。

## 起動

Node.js 20.19以上（または22.12以上）を使用してください。

```bash
npm install
npm run dev
```

表示されたローカルURLを開きます。本番確認は次のとおりです。

```bash
npm run build
npm run preview
```

品質チェック:

```bash
npm run quality
```

`quality` はlint、TypeScriptの型検査、単体・結合・主要画面の自動アクセシビリティ検査、本番ビルドを順に実行します。

## 実装済みの機能

- 日付移動、日付選択、過去・未来を保持する日別タスク
- 月間カレンダー（完了数、達成率別表示、今日の強調、日別詳細）
- 時刻、期限、所要時間、カテゴリー、優先度、メモ、サブタスク、画像、目標、通知を持つタスク
- 毎日、平日、毎週、曜日指定、毎月、N日ごと、終了日の繰り返し。各回の完了状態は独立
- 編集可能な初期カテゴリー8種とユーザーカテゴリー
- 習慣の日別・月間記録、現在/最長連続、週間/月間達成率
- 親子目標、関連タスク/習慣からの自動進捗、手動進捗
- 気分5段階と5つの記述欄、画像、タスク/習慣率を持つ日別振り返り
- タスク・目標・習慣・振り返りの横断検索と絞り込み
- 週間/月間レポート、前期比較、カテゴリー/習慣/気分/目標の可視化と文章サマリー
- ポイント、レベル、7日連続ボーナス、ユーザー定義のご褒美（設定で非表示）
- JSON全量バックアップ、JSONインポート、タスクCSV
- 2MBまでの JPEG / PNG / WebP / GIF画像プレビュー・削除
- PWA、オフラインキャッシュ、更新案内、アプリ内リマインダー、Web通知
- Firebase認証、リアルタイム同期、競合解決、削除履歴、確認付きローカルデータ移行
- タスク・目標・振り返りの画像、実体MIME検証、自動圧縮、重複防止
- Googleカレンダー選択、予定取得、重複防止登録、更新、選択式削除
- PWAインストール画面、iPhone/Android向け追加案内
- 通常／maskableを分けたPNGアプリアイコン、favicon、Apple Touch Icon
- ライト/ダーク/端末連動、週の開始曜日、PCサイドバー、スマホ下部ナビ
- エラー境界、空状態、保存/読込状態、確認ダイアログ、ARIA、キーボードフォーカス、`prefers-reduced-motion`
- 削除直後の取り消し、タスク複製、完了項目の折りたたみ、振り返りの未保存下書き保護
- Firebaseコードの必要時読み込みと、初期PWAキャッシュからの除外
- スキップ可能な3ステップの初回ガイドと、設定画面からの再表示
- 未保存フォームの離脱確認、画像名を示す削除確認、100件単位のタスク表示

## ローカル保存

初回から `localStorage` へ自動保存します。ページを再読み込みしても記録は残ります。オフライン中も編集でき、ログイン済みの場合は同期待ちとして保持して再接続時に送信します。Firestore側の永続キャッシュとアプリ側の保存を併用し、クラウド書き込みは1.2秒デバウンスします。

初回に表示される3つの習慣は操作確認用のサンプルです。不要な場合は習慣画面の削除ボタンから、対象名を確認して削除できます。

同じIDを複数端末で編集した場合は `updatedAt` が新しい内容を採用します。削除したIDは削除履歴へ記録するため、オフラインだった別端末の古いデータで復活しません。

## Firebase設定

Firebase未設定でもアプリは正常に動作し、ログイン画面にはローカルモードが表示されます。

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトとウェブアプリを作成します。
2. Authenticationで「メール/パスワード」と「Google」を有効にします。
3. Cloud Firestore、Storage、Cloud Messagingを有効にします（Spark無料枠で開始できます）。
4. `.env.example` を `.env.local` へコピーし、ウェブアプリの設定値、任意のMeasurement ID、Web PushのVAPIDキーを記入します。
5. Firebase CLIでログインし、対象プロジェクトを選択してルールを反映します。

```bash
firebase use --add
firebase deploy --only firestore:rules,storage
```

Firestoreは `users/{uid}/...`、Storageは `users/{uid}/attachments/...` のみを本人が読み書きできるルールです。ルールはUID、状態の必須型、配列上限、表示名長、FCMトークン長を検証します。Storageは所有者メタデータ、MIME、2MB上限を検証します。画像はStorageへ保存し、FirestoreにはURLと型付き状態を保存します。

ログイン時はローカルとクラウドの件数を表示し、「重複を除いて統合」「クラウド優先」「ローカル優先」「今は移行しない」から選択します。移行前JSONも保存できます。自動上書きは行いません。

通常テストでは、ルールにUID照合・既定拒否・所有者/MIME/容量検証が含まれることを静的検査します。実Firebaseでの別ユーザー拒否確認にはFirebase Emulator Suiteを利用してください。

## 通知とPWA

タスクの開始/期限前、指定時刻、朝の予定、夜の未完了、習慣の指定時刻リマインダーは、アプリ起動中に判定してService Workerの通知を使います。通知が拒否・未対応の場合はアプリ内リマインダーへ切り替わります。設定画面で権限状態を確認し、テスト通知を送れます。

FCM設定済みかつログイン済みの場合は、通知許可時に端末トークンも登録します。`push-handler.js` がバックグラウンド通知と通知タップ後の対象画面移動を処理します。アプリを完全に閉じた状態で時刻指定通知を送るには、Cloud Scheduler + Cloud Functionsなどの安全なサーバー処理が別途必要です。Admin SDK鍵をクライアントへ置かないでください。

iPhoneではiOS 16.4以降を推奨します。設定画面に「共有ボタン → ホーム画面に追加」の手順を表示します。Android/Chromiumでは対応時にインストールボタンが有効になります。インストールした今日ノート内から通知を許可してください。

アプリアイコンの編集用マスターは `public/icon-master.svg` と
`public/maskable-icon-master.svg` です。通常アイコンは `purpose: any`、
中央の安全領域を広く取ったAndroid用アイコンは `purpose: maskable` として
Manifestへ別々に登録しています。SVGを変更した場合は次のコマンドで、
favicon、Apple Touch Icon、16〜512pxのPNGを再生成できます。

```bash
npm run generate:icons
```

設定画面の「アプリとして使う」では、インストール可否、現在の起動状態、
オフライン・通知対応、Androidのインストールボタン、iPhone/iPadのSafariでの
追加手順を端末に合わせて表示します。案内を閉じた結果は端末内へ記録され、
ユーザー操作なしにインストール画面を繰り返し表示しません。

## Googleカレンダー設定

Google認証情報がなくても、Google連携以外はすべて動作します。

1. [Google Cloud Console](https://console.cloud.google.com/) でGoogle Calendar APIを有効にします。
2. OAuth同意画面を設定します。開発中は利用するGoogleアカウントをテストユーザーへ追加します。
3. 「ウェブアプリケーション」のOAuth 2.0クライアントIDを作成します。
4. 承認済みJavaScript生成元へ開発URL（例 `http://localhost:5173`）と本番URLを追加します。
5. クライアントIDを `.env.local` の `VITE_GOOGLE_CLIENT_ID` に設定し、開発サーバーを再起動します。

設定画面から連携すると、予定の読み取りと書き込み権限をGoogleが確認します。カレンダー一覧から表示・登録先を選択できます。書き込み前にはタイトル、日付、開始、終了、登録先、説明を確認します。タスクIDをprivate extended propertyへ保存して重複を防ぎ、イベントIDとカレンダーIDをタスクへ保持します。タスク更新時はGoogle予定も更新し、削除時は「今日ノートだけ」「両方」を選べます。

アクセストークンは永続的な `localStorage` へ保存せず、タブを閉じると消える `sessionStorage` にだけ保持して連携解除時に失効させます。リフレッシュトークンやクライアントシークレットはフロントエンドへ配置しません。現在のGoogle Identity ServicesトークンクライアントではリダイレクトURLを使わず、承認済みJavaScript生成元を設定します。将来サーバー側の認可コード方式へ変更する場合は、Cloud Functions等のコールバックURLを承認済みリダイレクトURIへ登録し、トークンをサーバー側だけで保管してください。

## データ構造

中心型は [src/types.ts](src/types.ts) にあります。`UserProfile`、`Task`、`Subtask`、`Category`、`Habit`、`HabitRecord`、`Goal`、`GoalMilestone`、`DailyReflection`、`DailyStatistics`、`Attachment`、`Reminder`、`Reward`、`UserSettings` を管理し、ユーザーデータには `userId`、`createdAt`、`updatedAt` を持たせています。削除履歴と移行履歴も同期対象です。

## デプロイ

Cloudflare Workers Static Assets向けの `wrangler.jsonc` を同梱しています。初回だけCloudflareへログインし、その後は次のコマンドでビルドと本番公開を実行できます。

```bash
npx wrangler login
npm run deploy:cloudflare
```

`dist/` がCloudflareの世界各地のエッジへ配置され、存在しないパスはSPA用に `index.html` へフォールバックします。Firebase用の環境変数はViteのビルド時に必要なため、クラウド機能を有効にする場合は公開前に `.env.local` を設定してください。未設定の場合もローカル保存モードで動作します。

Firebase Hostingを使う場合は次のコマンドでも公開できます。

```bash
npm run build
firebase deploy --only hosting
```

`.env.local` は `.gitignore` 対象です。環境変数の値、OAuthクライアント情報、サービスアカウント鍵をコミットしないでください。
