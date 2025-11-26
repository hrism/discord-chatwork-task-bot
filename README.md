# Discord-Chatwork タスク管理Bot

Discord Botで自然言語でタスクを登録し、Chatworkで通知を受け取れるタスク管理システムです。

## デプロイ先

**AWS Lightsail** (※Railwayではない)

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

### AWS Lightsail（月$3.5・推奨）

24時間稼働させるために、AWS Lightsailへのデプロイを推奨します。

#### 前提条件

- AWS CLIがインストール済み
- AWS認証情報が設定済み（`aws configure`）
- GitHubリポジトリが作成済み

#### CLI完結のデプロイ手順

1. **デプロイスクリプトを準備**

   User Dataスクリプト（`user-data.sh`）を作成:
   ```bash
   #!/bin/bash
   exec > >(tee /var/log/user-data.log)
   exec 2>&1

   # Node.js 20のインストール
   curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
   yum install -y nodejs git

   # Botユーザーの作成
   useradd -m -s /bin/bash botuser

   # リポジトリをクローン
   cd /home/botuser
   sudo -u botuser git clone https://github.com/YOUR_USERNAME/discord-chatwork-task-bot.git
   cd discord-chatwork-task-bot

   # 環境変数ファイルを作成
   cat > .env << 'ENVEOF'
   DISCORD_TOKEN=あなたのDiscordトークン
   CHATWORK_API_TOKEN=あなたのChatworkトークン
   CHATWORK_ROOM_ID=あなたのChatworkルームID
   GEMINI_API_KEY=あなたのGemini APIキー（オプション）
   TIMEZONE=Asia/Tokyo
   MORNING_NOTIFY_HOUR=8
   ENVEOF

   chown botuser:botuser .env

   # 依存関係のインストール
   sudo -u botuser npm install --production

   # PM2のインストールと起動
   npm install -g pm2
   sudo -u botuser pm2 start index.js --name discord-bot
   sudo -u botuser pm2 startup systemd -u botuser --hp /home/botuser
   sudo -u botuser pm2 save
   env PATH=$PATH:/usr/bin pm2 startup systemd -u botuser --hp /home/botuser
   systemctl enable pm2-botuser
   ```

2. **Lightsailインスタンスを作成**
   ```bash
   aws lightsail create-instances \
     --instance-names discord-chatwork-bot \
     --availability-zone ap-northeast-1a \
     --blueprint-id amazon_linux_2023 \
     --bundle-id nano_3_0 \
     --user-data file:///path/to/user-data.sh \
     --region ap-northeast-1
   ```

3. **デプロイ完了**
   - 2-3分待つと自動的にセットアップが完了します
   - Discordで動作確認してください

**料金**: 月$3.5（nano_3_0プラン）

#### 管理コマンド

```bash
# インスタンスの状態確認
aws lightsail get-instance --instance-name discord-chatwork-bot --region ap-northeast-1

# インスタンス停止（課金ストップ）
aws lightsail stop-instance --instance-name discord-chatwork-bot --region ap-northeast-1

# インスタンス再起動
aws lightsail reboot-instance --instance-name discord-chatwork-bot --region ap-northeast-1

# インスタンス削除（完全に削除）
aws lightsail delete-instance --instance-name discord-chatwork-bot --region ap-northeast-1
```

#### ブラウザからの管理

AWS Lightsailコンソール: https://lightsail.aws.amazon.com/

- SSH接続（ブラウザベース）
- ログ確認: `sudo tail -f /var/log/user-data.log`
- Botステータス確認: `sudo -u botuser pm2 status`
- Bot再起動: `sudo -u botuser pm2 restart discord-bot`

**Gemini API キーについて（オプション）**:
- Gemini APIキーを設定すると、自然言語でタスク操作が可能になります
- 設定しない場合は従来のキーワードマッチングで動作します
- APIキーの取得: [Google AI Studio](https://aistudio.google.com/apikey)
- コスト: 無料枠あり（gemini-2.0-flash-expを使用）

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
GEMINI_API_KEY=your_gemini_api_key_here  # オプション：自然言語処理を有効化
TIMEZONE=Asia/Tokyo
MORNING_NOTIFY_HOUR=8
```

**Gemini API キー（オプション）**:
- 設定すると自然言語でタスク操作が可能になります（例: "be4bc269のタスクにこのURLを追加"）
- 設定しない場合は従来のキーワードマッチング（"be4bc269 編集 ..."）で動作します
- 取得方法: [Google AI Studio](https://aistudio.google.com/apikey)

## 起動方法

```bash
# 本番環境
npm start

# 開発環境（ファイル変更時に自動再起動）
npm run dev
```

## コードの更新と再デプロイ

### Lightsailへの変更の反映

コードを変更した後、以下の手順で更新します：

**方法1: GitHubにpushして手動更新（推奨）**

```bash
# 変更をコミット
git add .
git commit -m "変更内容の説明"
git push origin main

# LightsailインスタンスでGitプル
# AWSコンソールのブラウザSSHまたはCLIで実行
ssh -i /tmp/lightsail-key.pem ec2-user@インスタンスIP
sudo -u botuser -i
cd discord-chatwork-task-bot
git pull
npm install  # 依存関係に変更があれば
pm2 restart discord-bot
```

**方法2: User Dataスクリプトで完全再デプロイ**

インスタンスを作り直して最新コードで起動:
```bash
# 既存インスタンスを削除
aws lightsail delete-instance --instance-name discord-chatwork-bot --region ap-northeast-1

# 新しいインスタンスを作成（最新のUser Dataスクリプトで）
aws lightsail create-instances \
  --instance-names discord-chatwork-bot \
  --availability-zone ap-northeast-1a \
  --blueprint-id amazon_linux_2023 \
  --bundle-id nano_3_0 \
  --user-data file:///path/to/user-data.sh \
  --region ap-northeast-1
```

### ローカル環境での再起動

ローカルで開発中にコードを変更した場合：

- **開発モード（`npm run dev`）**: ファイル変更を検知して自動的に再起動
- **本番モード（`npm start`）**: `Ctrl+C`で停止してから`npm start`で再起動

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
