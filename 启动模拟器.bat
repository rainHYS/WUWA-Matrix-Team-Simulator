@echo off
title 鸣潮·终焉矩阵配队模拟器
cd /d "%~dp0"

echo.
echo   ==========================================
echo     鸣潮·终焉矩阵配队模拟器
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [错误] 没有找到 Node.js。
  echo   请先到 https://nodejs.org/ 下载安装 LTS 版本，再重新双击本文件。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   首次运行，正在安装依赖，大约 1 分钟...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [错误] 依赖安装失败，请把上面的报错发给开发者。
    pause
    exit /b 1
  )
)

echo   正在构建...
call npm run build >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [错误] 构建失败，请把上面的报错发给开发者。
  pause
  exit /b 1
)

echo.
echo   正在启动本地服务并打开浏览器...
echo   使用期间请不要关闭本窗口；用完了直接关掉它，服务就停了。
echo.

node scripts\serve.mjs 4173 --open
pause