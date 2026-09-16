#!/bin/bash
set -e
echo '{"NODE_ENV":"production","BASE_URL":"https://adiong.org"}' > /tmp/adiong-env.json
/usr/sbin/cloudlinux-selector set --interpreter=nodejs --json \
  --domain=adiong.org \
  --app-root=adiong \
  --env-vars="$(cat /tmp/adiong-env.json)"
echo
/usr/sbin/cloudlinux-selector restart --interpreter=nodejs --json \
  --domain=adiong.org \
  --app-root=adiong
sleep 2
echo '==== htaccess ===='
cat /home/ftwvuuyryn/public_html/.htaccess
echo
echo '==== robots ===='
curl -sL https://adiong.org/robots.txt
echo
echo '==== selector ===='
cat /home/ftwvuuyryn/.cl.selector/node-selector.json
