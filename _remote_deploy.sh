#!/bin/bash
set -e
cd /home/ftwvuuyryn
mkdir -p adiong/server/data adiong/server/uploads adiong/tmp
TMP=$(mktemp -d)
tar -xzf adiong-deploy.tgz -C "$TMP"
rsync -a --delete "$TMP/client/dist/" ~/adiong/client/dist/
rsync -a --include='*.js' --exclude='*' "$TMP/server/" ~/adiong/server/
cp "$TMP/package.json" ~/adiong/package.json
mkdir -p ~/adiong/server/uploads/seed
rsync -a "$TMP/server/uploads/seed/" ~/adiong/server/uploads/seed/
rm -rf "$TMP"
chmod -R u+rwX ~/adiong/server/data ~/adiong/server/uploads ~/adiong/tmp
touch ~/adiong/tmp/restart.txt
/usr/sbin/cloudlinux-selector restart --interpreter=nodejs --json --domain=adiong.org --app-root=adiong
sleep 3
echo '==== live ===='
curl -sI https://adiong.org/ | head -12
echo '==== api ===='
curl -sL https://adiong.org/api/public/site | head -c 240
echo
echo '==== start script ===='
grep -n start ~/adiong/package.json
echo '==== chat schema ===='
grep -c chat_conversations ~/adiong/server/db.js
