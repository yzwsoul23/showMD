@echo off
chcp 65001 >nul
set REPO_DIR=E:\codeing\showMD
set LOG_FILE=%REPO_DIR%\update.log

echo [%date% %time%] 开始更新 >> "%LOG_FILE%"

cd /d "%REPO_DIR%" || (
    echo [%date% %time%] 错误：目录不存在 >> "%LOG_FILE%"
    exit /b 1
)

git pull origin main >> "%LOG_FILE%" 2>&1

if %errorlevel% equ 0 (
    echo [%date% %time%] 更新成功 >> "%LOG_FILE%"
) else (
    echo [%date% %time%] 更新失败，请检查网络或 Git 配置 >> "%LOG_FILE%"
)

echo 完成，日志见 %LOG_FILE%
pause