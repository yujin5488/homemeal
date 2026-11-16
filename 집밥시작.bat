@echo off
rem 오늘의 집밥 - 더블클릭하면 최신 코드를 받고 앱을 켭니다.
rem Double-click to update to the latest code and open the app.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start.ps1"
if errorlevel 1 pause
