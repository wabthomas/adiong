#!/bin/bash
set -e
cd /home/ftwvuuyryn

# Update only server/index.js from local upload path if present
# (we'll scp the file separately)

# Prefer direct startup file (ESM) now that top-level await is gone
/usr/sbin/cloudlinux-selector set --interpreter=nodejs --json \
  --domain=adiong.org \
  --app-root=adiong \
  --startup-file=server/index.js

# Keep a CJS fallback wrapper too
cat > /home/ftwvuuyryn/adiong/app.cjs <<'EOF'
'use strict';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./server/index.js');
EOF

/usr/sbin/cloudlinux-selector restart --interpreter=nodejs --json \
  --domain=adiong.org \
  --app-root=adiong

sleep 3
echo '==== manual smoke ===='
cd /home/ftwvuuyryn/adiong
export NODE_ENV=production PORT=passenger
timeout 5 /home/ftwvuuyryn/nodevenv/adiong/22/bin/node server/index.js 2>&1 || true
echo
echo '==== curl ===='
curl -sI https://adiong.org/ | head -15
echo '==== body ===='
curl -sL https://adiong.org/ | head -c 400
echo
echo '==== api ===='
curl -sL https://adiong.org/api/settings | head -c 300
echo
