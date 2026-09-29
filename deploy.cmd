@echo off
REM ===========================================================================
REM  deploy.cmd -- pack, upload and publish Dhundo, from Windows.
REM
REM      double-click it, or run  deploy  in a Command Prompt here
REM
REM  Set SERVER below once. Everything else is automatic.
REM
REM  You will be asked for the server password twice -- once by scp, once by
REM  ssh. To stop that, set up a key once:
REM
REM      ssh-keygen -t ed25519            (press Enter at every prompt)
REM      type %USERPROFILE%\.ssh\id_ed25519.pub | ssh SERVER "cat >> ~/.ssh/authorized_keys"
REM
REM  After that it never asks again.
REM ===========================================================================

setlocal

REM --- edit this one line ---------------------------------------------------
set SERVER=root@YOUR_SERVER_IP
REM --------------------------------------------------------------------------

cd /d "%~dp0"

if "%SERVER%"=="root@YOUR_SERVER_IP" (
  echo.
  echo   Open deploy.cmd and put your server's IP address in the SERVER line.
  echo.
  exit /b 1
)

echo.
REM The signing keystore and the file holding its password live in the
REM PWABuilder output folder. Packing them would publish your Android
REM signing key to the web server. They are excluded by name AND by
REM extension, so a renamed copy is still caught.
echo [1/3] Packing...
if exist dhundo-deploy.tar.gz del dhundo-deploy.tar.gz
if exist dhundo-deploy.zip del dhundo-deploy.zip
tar -czf dhundo-deploy.tar.gz --exclude=node_modules --exclude=dist --exclude=_to_delete --exclude=.git --exclude=shots --exclude=dhundo-deploy.* --exclude=*.keystore --exclude=*key-info* --exclude=*.aab --exclude="Dhundo - Google Play package" --exclude="Dhundo - Google Play package.zip" *
if errorlevel 1 goto fail

echo [2/3] Uploading...
scp dhundo-deploy.tar.gz %SERVER%:~/
if errorlevel 1 goto fail

echo [3/3] Publishing...
REM config.js is saved BEFORE the old folder is removed -- it is not in the
REM zip, and losing it is how the app once ended up pointing at the wrong
REM Supabase project.
ssh %SERVER% "cp ~/services-app/src/config.js ~/config.js.keep 2>/dev/null; rm -rf ~/services-app && mkdir -p ~/services-app && tar -xzf ~/dhundo-deploy.tar.gz -C ~/services-app && bash ~/services-app/server-deploy.sh"
if errorlevel 1 goto fail

echo.
echo   Done. Hard-refresh the site with Ctrl+Shift+R -- the old service
echo   worker will otherwise serve you the previous version.
echo.
exit /b 0

:fail
echo.
echo   FAILED at the step above. Nothing was published.
echo.
exit /b 1
