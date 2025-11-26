#!/bin/bash

# Lightsailデプロイスクリプト
set -e

INSTANCE_NAME="discord-chatwork-bot"
REGION="ap-northeast-1"
SSH_KEY="$HOME/.ssh/lightsail-discord-bot.pem"
REMOTE_USER="ec2-user"
APP_DIR="discord-chatwork-task-bot"

echo "=== Discord Chatwork Bot デプロイ開始 ==="

# SSH鍵がなければ取得
if [ ! -f "$SSH_KEY" ]; then
  echo "0. SSH鍵を取得..."
  aws lightsail download-default-key-pair --region "$REGION" --query 'privateKeyBase64' --output text > "$SSH_KEY"
  chmod 600 "$SSH_KEY"
fi

# インスタンスIPを動的に取得
echo "1. インスタンスIP取得..."
INSTANCE_IP=$(aws lightsail get-instance --instance-name "$INSTANCE_NAME" --region "$REGION" --query 'instance.publicIpAddress' --output text)
echo "   IP: $INSTANCE_IP"

# SSH接続テスト
echo "2. SSH接続テスト..."
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" "echo 'SSH接続成功'"

# Gitリポジトリをクローン（データは保持）
echo "3. リポジトリをクローン..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << 'EOF'
# タスクデータをバックアップ
if [ -f discord-chatwork-task-bot/data/tasks.json ]; then
  echo "タスクデータをバックアップ"
  cp discord-chatwork-task-bot/data/tasks.json /tmp/tasks.json.bak
fi

if [ -d discord-chatwork-task-bot ]; then
  echo "既存のディレクトリを削除"
  rm -rf discord-chatwork-task-bot
fi
git clone https://github.com/hrism/discord-chatwork-task-bot.git

# タスクデータをリストア
if [ -f /tmp/tasks.json.bak ]; then
  echo "タスクデータをリストア"
  mkdir -p discord-chatwork-task-bot/data
  cp /tmp/tasks.json.bak discord-chatwork-task-bot/data/tasks.json
  rm /tmp/tasks.json.bak
fi
EOF

# .envファイルをアップロード
echo "4. 環境変数ファイルをアップロード..."
scp -i "$SSH_KEY" .env "$REMOTE_USER@$INSTANCE_IP:~/$APP_DIR/.env"

# 依存関係をインストール
echo "5. 依存関係をインストール..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << EOF
cd $APP_DIR
npm install --production
EOF

# PM2をインストールして起動
echo "6. PM2で起動..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << 'EOF'
# PM2をグローバルにインストール（なければ）
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

cd discord-chatwork-task-bot

# 既存のプロセスを停止
pm2 delete discord-bot 2>/dev/null || true

# Botを起動
pm2 start index.js --name discord-bot

# 自動起動設定
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

# ステータス確認
pm2 status
EOF

echo ""
echo "=== デプロイ完了 ==="
echo "インスタンスIP: $INSTANCE_IP"
echo "ステータス確認: ssh -i $SSH_KEY $REMOTE_USER@$INSTANCE_IP 'pm2 status'"
echo "ログ確認: ssh -i $SSH_KEY $REMOTE_USER@$INSTANCE_IP 'pm2 logs discord-bot'"
