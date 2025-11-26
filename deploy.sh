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

# コード更新（git pull）または初回クローン
echo "3. コード更新..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << 'EOF'
if [ -d discord-chatwork-task-bot ]; then
  echo "既存リポジトリを更新 (git pull)"
  cd discord-chatwork-task-bot
  git pull
else
  echo "初回クローン"
  git clone https://github.com/hrism/discord-chatwork-task-bot.git
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

# PM2で再起動
echo "6. PM2で再起動..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$INSTANCE_IP" << 'EOF'
# PM2をグローバルにインストール（なければ）
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

cd discord-chatwork-task-bot

# 既存プロセスがあれば再起動、なければ起動
if pm2 describe discord-bot > /dev/null 2>&1; then
  pm2 restart discord-bot
else
  pm2 start index.js --name discord-bot
  pm2 startup systemd -u ec2-user --hp /home/ec2-user
  pm2 save
fi

# ステータス確認
pm2 status
EOF

echo ""
echo "=== デプロイ完了 ==="
echo "インスタンスIP: $INSTANCE_IP"
echo "ステータス確認: ssh -i $SSH_KEY $REMOTE_USER@$INSTANCE_IP 'pm2 status'"
echo "ログ確認: ssh -i $SSH_KEY $REMOTE_USER@$INSTANCE_IP 'pm2 logs discord-bot'"
