@echo off
chcp 65001 >nul
cd /d "%~dp0"

git pull
git add .
git commit -m "update: %date% %time%"
git push
