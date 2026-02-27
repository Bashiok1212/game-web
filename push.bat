@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========== Git 推送 ==========
set /p msg="Commit message (直接回车用 update): "
if "%msg%"=="" set msg=update

git add .
git status
echo.
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo 无变更或提交失败
  pause
  exit /b 1
)

git push origin master:main
echo.
if errorlevel 1 (
  echo 推送失败，请检查网络或远程仓库
) else (
  echo 推送完成
)
pause
