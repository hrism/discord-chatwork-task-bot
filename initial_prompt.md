claude-code "Discord BotとChatwork APIを連携したタスク管理システムを作成してください。

## 技術スタック
- Node.js
- discord.js (Discord Bot)
- axios (Chatwork API通信用)
- node-cron (定期実行)
- date-fns (日付処理)
- dotenv (環境変数)

## ファイル構成
discord-chatwork-task-bot/
├── index.js           # メインのBot処理
├── services/
│   ├── discordBot.js      # Discord Bot機能
│   ├── chatworkClient.js  # Chatwork API通信
│   └── taskScheduler.js   # 定期通知処理
├── utils/
│   ├── dateParser.js      # 自然言語→日付変換
│   └── taskManager.js     # タスク管理ロジック
├── data/
│   └── tasks.json         # タスク永続化
├── .env.example           # 環境変数サンプル
├── package.json
└── README.md

## 機能要件

### 1. Discord Bot機能
- 自然言語でタスク登録
  - 「明日レポート提出」→ 翌日23:59が期限
  - 「3日後に会議」→ 3日後の23:59が期限
  - 「来週月曜に資料作成」→ 次の月曜23:59
  - 「今週金曜15時に打ち合わせ」→ 時刻も含めて設定
  - 「月末までに請求書」→ 当月末日
- コマンド
  - 「リスト」「一覧」→ 全タスク表示
  - 「今日」→ 今日期限のタスク
  - 「削除 [番号]」→ タスク削除
  - 「完了 [番号]」→ タスク完了

### 2. 日本語の自然言語パーサー
以下のパターンに対応：
- 相対日付: 今日、明日、明後日、昨日
- 相対期間: 3日後、1週間後、2ヶ月後
- 曜日指定: 月曜、来週の金曜、今週の水曜
- 月末/月初: 月末、月初、今月末、来月末
- 時刻: 15時、午後3時、15:00、3pm
- 優先度キーワード: 重要、緊急、至急 → 高優先度

### 3. Chatwork通知機能
- 毎朝8時に定期通知
  - 今日期限のタスク一覧
  - 3日以内に期限のタスク一覧
- 期限通知
  - タスク期限の1時間前に通知
- 緊急タスク即時通知
  - 「緊急」「至急」を含むタスクは登録時に即通知

### 4. データ構造
tasks.json:
{
  \"tasks\": [
    {
      \"id\": \"uuid\",
      \"title\": \"レポート提出\",
      \"deadline\": \"2024-12-21T23:59:00\",
      \"priority\": \"normal\", // normal, high, urgent
      \"status\": \"pending\", // pending, completed
      \"createdAt\": \"2024-12-20T10:00:00\",
      \"createdBy\": \"Discord UserID\"
    }
  ]
}

### 5. Chatworkメッセージフォーマット
定期通知:
[info][title]📋 タスク通知 - {日付}[/title]
[今日期限のタスク]
🔴 {タスク名} ({時刻})

[3日以内のタスク]
🟡 {タスク名} ({日付} {時刻})
[/info]

### 6. 環境変数（.env）
DISCORD_TOKEN=
CHATWORK_API_TOKEN=
CHATWORK_ROOM_ID=
TIMEZONE=Asia/Tokyo
MORNING_NOTIFY_HOUR=8

### 7. エラーハンドリング
- Discord接続エラー時の再接続
- Chatwork API失敗時のリトライ（3回まで）
- 不正な日付入力時のユーザーへのフィードバック
- タスクファイル破損時の自動バックアップ

## 追加の考慮事項
- 日付処理は全てJST（日本時間）で統一
- タスクIDはUUIDv4で生成
- Chatwork APIのレート制限（5分で300回）を考慮
- グレースフルシャットダウン（Ctrl+C時にタスク保存）
- 起動時に期限切れタスクを自動アーカイブ

必要なnpmパッケージもpackage.jsonに含めてください。
READMEには環境構築手順とDiscord Bot・Chatwork APIトークンの取得方法を記載してください。"