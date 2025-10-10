# Discord-Chatwork タスク管理Bot

Discord Botで自然言語でタスクを登録し、Chatworkで通知を受け取れるタスク管理システムです。

## 機能

### Discord Bot機能
- **自然言語でタスク登録**
  - 「明日レポート提出」→ 翌日23:59が期限
  - 「3日後に会議」→ 3日後の23:59が期限
  - 「来週月曜に資料作成」→ 次の月曜23:59
  - 「今週金曜15時に打ち合わせ」→ 時刻も含めて設定
  - 「月末までに請求書」→ 当月末日

- **コマンド**
  - `リスト` / `一覧` - 全タスクを表示
  - `今日` - 今日期限のタスクを表示
  - `削除 [番号]` - タスクを削除
  - `完了 [番号]` - タスクを完了にする
  - `ヘルプ` - ヘルプを表示

### Chatwork通知機能
- **定期通知（毎朝8時）**
  - 今日期限のタスク一覧
  - 3日以内に期限のタスク一覧

- **期限通知**
  - タスク期限の1時間前に自動通知

- **緊急タスク即時通知**
  - 「緊急」「至急」「重要」を含むタスクは登録時に即座に通知

## デプロイ方法

### Railway（無料・推奨）

24時間稼働させるために、Railwayへのデプロイを推奨します。

#### 手順

1. **GitHubリポジトリを作成（GitHub CLI使用）**
   ```bash
   # GitHub CLIで認証（初回のみ）
   gh auth login

   # Gitリポジトリを初期化してプッシュ
   git init
   git add .
   git commit -m "Initial commit"

   # GitHub CLIでリポジトリ作成とプッシュを一発で実行
   gh repo create discord-chatwork-task-bot --public --source=. --push
   ```

   **GitHub CLIがない場合**:
   ```bash
   # Homebrewでインストール（Mac）
   brew install gh

   # またはnpmでインストール
   npm install -g gh
   ```

2. **Railwayにデプロイ**
   - [Railway](https://railway.app/) にアクセス
   - 「Start a New Project」→「Deploy from GitHub repo」を選択
   - 作成したリポジトリを選択

3. **環境変数を設定**
   - Railwayのプロジェクトページで「Variables」タブを開く
   - 以下の環境変数を追加:
     ```
     DISCORD_TOKEN=あなたのDiscordトークン
     CHATWORK_API_TOKEN=あなたのChatworkトークン
     CHATWORK_ROOM_ID=あなたのChatworkルームID
     TIMEZONE=Asia/Tokyo
     MORNING_NOTIFY_HOUR=8
     ```

4. **デプロイ完了**
   - 自動的にデプロイが開始されます
   - ログで起動を確認できます

**無料枠**: 月500時間（このBotなら十分）

---

## ローカル環境での開発

### 必要な環境
- Node.js 18.x 以上
- Discord Bot アカウント
- Chatwork API トークン

### 1. Discord Botの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリックして新しいアプリケーションを作成
3. 左メニューから「Bot」を選択
4. 「Add Bot」をクリックしてBotを作成
5. 「TOKEN」をコピー（後で使用します）
6. 「Privileged Gateway Intents」セクションで以下を有効化:
   - `PRESENCE INTENT`
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
7. 左メニューから「OAuth2」→「URL Generator」を選択
8. 「SCOPES」で `bot` を選択
9. 「BOT PERMISSIONS」で以下を選択:
   - `Send Messages`
   - `Read Message History`
   - `Read Messages/View Channels`
10. 生成されたURLをブラウザで開き、Botをサーバーに招待

### 2. Chatwork APIトークンの取得

1. [Chatwork APIトークンページ](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php) にアクセス
2. ログイン後、「新しいトークンを発行」をクリック
3. 生成されたAPIトークンをコピー

### 3. Chatwork Room IDの取得

1. Chatworkでタスク通知を受け取りたいルームを開く
2. ブラウザのURLから数字部分を確認
   - 例: `https://www.chatwork.com/#!rid123456789` → `123456789` がRoom ID

### 4. プロジェクトのセットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数ファイルの作成
cp .env.example .env
```

### 5. 環境変数の設定

`.env` ファイルを編集して、以下の情報を入力:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CHATWORK_API_TOKEN=your_chatwork_api_token_here
CHATWORK_ROOM_ID=your_chatwork_room_id_here
TIMEZONE=Asia/Tokyo
MORNING_NOTIFY_HOUR=8
```

## 起動方法

```bash
# 本番環境
npm start

# 開発環境（ファイル変更時に自動再起動）
npm run dev
```

## 使い方

### タスクの登録

Discordのチャンネルでメッセージを送信するだけでタスクが登録されます。

**例:**
```
明日レポート提出
3日後に会議
来週月曜15時に資料作成
月末までに請求書
重要：今週金曜に打ち合わせ
```

### タスクの確認

```
リスト
```
または
```
一覧
```

今日のタスクだけを確認:
```
今日
```

### タスクの完了

```
完了 1
```
（番号はタスク一覧で表示される番号）

### タスクの削除

```
削除 1
```
（番号はタスク一覧で表示される番号）

## ファイル構成

```
discord-chatwork-task-bot/
├── index.js                  # メインのBot処理
├── services/
│   ├── discordBot.js         # Discord Bot機能
│   ├── chatworkClient.js     # Chatwork API通信
│   └── taskScheduler.js      # 定期通知処理
├── utils/
│   ├── dateParser.js         # 自然言語→日付変換
│   └── taskManager.js        # タスク管理ロジック
├── data/
│   └── tasks.json            # タスク永続化
├── .env.example              # 環境変数サンプル
├── .env                      # 環境変数（要作成）
├── package.json
└── README.md
```

## 対応している日付表現

- **相対日付**: 今日、明日、明後日、昨日
- **相対期間**: 3日後、1週間後、2ヶ月後
- **曜日指定**: 月曜、来週の金曜、今週の水曜
- **月末/月初**: 月末、月初、今月末、来月末
- **時刻**: 15時、午後3時、15:00

## 優先度

タスクに「重要」「緊急」「至急」のキーワードが含まれると、高優先度タスクとして扱われ、Chatworkに即座に通知されます。

## トラブルシューティング

### Discord Botが起動しない
- `.env` ファイルの `DISCORD_TOKEN` が正しいか確認
- Discord Developer PortalでBotの設定を確認

### Chatwork通知が届かない
- `.env` ファイルの `CHATWORK_API_TOKEN` と `CHATWORK_ROOM_ID` が正しいか確認
- APIトークンの有効期限を確認

### タスクが保存されない
- `data/tasks.json` ファイルの書き込み権限を確認
- ディスク容量を確認

## ライセンス

MIT

## 作者

Developed with Claude Code
