#!/usr/bin/env bash
#
# deploy.sh -- pack, upload and publish Dhundo, from Git Bash on Windows.
#
#     cd "/d/project/services app/services-app/services-app"
#     ./deploy.sh
#
# Same job as deploy.cmd, for the shell you actually use. Set SERVER below
# once; everything after that is one command.
#
# To stop it asking for the password twice (scp, then ssh):
#     ssh-keygen -t ed25519          # press Enter at every prompt
#     ssh-copy-id root@13.140.171.143
#
set -euo pipefail

SERVER="root@13.140.171.143"

cd "$(dirname "$0")"

echo
echo "[1/3] Packing…"
# .tar.gz, NOT .zip. Git Bash ships GNU tar, which cannot write zip archives
# at all -- `tar -a -c -f x.zip` silently produces a TAR file with a .zip
# name, and unzip on the server then reports "End-of-central-directory
# signature not found". Windows Command Prompt has bsdtar, which does make
# real zips, which is why the same command worked there and not here.
# tar.gz works with both.
rm -f dhundo-deploy.tar.gz dhundo-deploy.zip
# The signing keystore and the file holding its password live in the
# PWABuilder output folder. Packing them would publish your Android signing
# key to the web server, so they are excluded by folder AND by pattern.
# public/dhundo.apk IS included -- that is the copy people download.
# Packed from INSIDE the project, so the archive has no top-level folder --
# src/, public/, package.json at the root of it. The server therefore
# extracts into an explicitly created ~/services-app rather than into ~,
# which is where the first run scattered everything.
tar -czf dhundo-deploy.tar.gz \
  --exclude=node_modules --exclude=dist --exclude=shots --exclude=_to_delete \
  --exclude=.git --exclude='dhundo-deploy.*' \
  --exclude='*.keystore' --exclude='*key-info*' --exclude='*.aab' \
  --exclude='Dhundo - Google Play package' \
  --exclude='Dhundo - Google Play package.zip' \
  *

# Belt and braces: if anything signing-related slipped through, stop here
# rather than uploading it.
if tar -tzf dhundo-deploy.tar.gz 2>/dev/null | grep -qiE 'keystore|key-info|\.aab$'; then
  echo "  ABORT: signing material found in the package. Not uploading."
  exit 1
fi
echo "  $(du -h dhundo-deploy.tar.gz | cut -f1)"

echo "[2/3] Uploading…"
scp dhundo-deploy.tar.gz "$SERVER:~/"

echo "[3/3] Publishing…"
# config.js is saved BEFORE the old folder goes: it is not in the zip, and
# losing it once pointed the whole app at the wrong Supabase project.
ssh "$SERVER" "cp ~/services-app/src/config.js ~/config.js.keep 2>/dev/null; rm -rf ~/services-app && mkdir -p ~/services-app && tar -xzf ~/dhundo-deploy.tar.gz -C ~/services-app && bash ~/services-app/server-deploy.sh"

echo
echo "  Done. Hard-refresh with Ctrl+Shift+R — the old service worker will"
echo "  otherwise serve you the previous version."
echo
