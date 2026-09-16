#!/bin/bash
set -e
HT=/home/ftwvuuyryn/public_html/.htaccess
# Friendly errors + ensure passenger config
cat > "$HT" <<'EOF'
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/ftwvuuyryn/adiong"
PassengerBaseURI "/"
PassengerNodejs "/home/ftwvuuyryn/nodevenv/adiong/22/bin/node"
PassengerAppType node
PassengerStartupFile app.cjs
PassengerFriendlyErrorPages on
PassengerAppEnv development
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
# DO NOT REMOVE OR MODIFY. CLOUDLINUX ENV VARS CONFIGURATION BEGIN
<IfModule Litespeed>
SetEnv NODE_ENV production
SetEnv BASE_URL https://adiong.org
</IfModule>
# DO NOT REMOVE OR MODIFY. CLOUDLINUX ENV VARS CONFIGURATION END
EOF

# CJS wrapper for Passenger + ESM app
cat > /home/ftwvuuyryn/adiong/app.cjs <<'EOF'
'use strict';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
import('./server/index.js').catch((err) => {
  console.error('[adiong] startup failed:', err);
  process.exit(1);
});
EOF

mkdir -p /home/ftwvuuyryn/adiong/server/data /home/ftwvuuyryn/adiong/server/uploads
chmod -R u+rwX /home/ftwvuuyryn/adiong/server/data /home/ftwvuuyryn/adiong/server/uploads

/usr/sbin/cloudlinux-selector set --interpreter=nodejs --json \
  --domain=adiong.org \
  --app-root=adiong \
  --startup-file=app.cjs || true

/usr/sbin/cloudlinux-selector restart --interpreter=nodejs --json \
  --domain=adiong.org \
  --app-root=adiong

sleep 3
echo '==== HTACCESS ===='
cat "$HT"
echo '==== CURL ===='
curl -sL https://adiong.org/ | head -c 2500
echo
echo '==== API ===='
curl -sL https://adiong.org/api/settings | head -c 500
echo
