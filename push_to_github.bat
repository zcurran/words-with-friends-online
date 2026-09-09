@echo off
setlocal
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%LOCALAPPDATA%\Programs\gh\bin;%PATH%"

echo ======================================================
echo   Push Words with Friends / Scrabble to GitHub
echo ======================================================
echo.

echo Checking GitHub CLI login status...
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo You are not logged into GitHub CLI yet.
    echo Starting GitHub login... (Follow the on-screen prompts)
    echo.
    gh auth login -w -p https
)

echo.
set /p REPO_NAME="Enter repository name [default: words-with-friends-online]: "
if "%REPO_NAME%"=="" set REPO_NAME=words-with-friends-online

echo.
echo Creating repository '%REPO_NAME%' on GitHub and pushing code...
gh repo create "%REPO_NAME%" --public --source=. --remote=origin --push

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo   Successfully pushed to GitHub!
    echo ======================================================
) else (
    echo.
    echo If the repository already exists on GitHub, attempting push...
    git push -u origin main
)

pause
