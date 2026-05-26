@echo off
REM ============================================
REM  AI Session Cleaner
REM  Clears session history & conversation data
REM  for Claude Code, Codex, and Gemini CLI
REM  Does NOT touch config, auth, memory, or settings
REM ============================================

set "CLAUDE_DIR=%USERPROFILE%\.claude"
set "CODEX_DIR=%USERPROFILE%\.codex"
set "GEMINI_DIR=%USERPROFILE%\.gemini"
set COUNT=0

echo ============================================
echo  AI Session Cleaner
echo ============================================
echo.

REM ---------- Claude Code ----------
if exist "%CLAUDE_DIR%" (
    echo --- Claude Code ---

    REM Clear global session history
    if exist "%CLAUDE_DIR%\history.jsonl" (
        echo [DEL] history.jsonl
        del /f /q "%CLAUDE_DIR%\history.jsonl" >nul
        set /a COUNT+=1
    )

    REM Clear session summary files
    if exist "%CLAUDE_DIR%\sessions" (
        echo [DEL] sessions\*
        del /f /q "%CLAUDE_DIR%\sessions\*.json" >nul 2>&1
        set /a COUNT+=1
    )

    REM Clear per-project session files (*.jsonl)
    if exist "%CLAUDE_DIR%\projects" (
        echo [DEL] projects\**\*.jsonl
        for /d %%P in ("%CLAUDE_DIR%\projects\*") do (
            del /f /q "%%P\*.jsonl" >nul 2>&1
            set /a COUNT+=1
            REM Clear subagent session folders
            if exist "%%P\*\subagents" (
                for /d %%S in ("%%P\*\subagents\*") do (
                    del /f /q "%%S\*.*" >nul 2>&1
                )
            )
        )
    )

    REM Clear tasks, todos, debug, file-history, paste-cache
    for %%D in (tasks todos debug file-history paste-cache) do (
        if exist "%CLAUDE_DIR%\%%D" (
            echo [DEL] %%D\*
            del /f /q "%CLAUDE_DIR%\%%D\*.*" >nul 2>&1
            set /a COUNT+=1
        )
    )
    echo.
) else (
    echo [SKIP] Claude Code directory not found: %CLAUDE_DIR%
    echo.
)

REM ---------- Codex ----------
if exist "%CODEX_DIR%" (
    echo --- Codex ---

    REM Clear session directories
    for %%D in (sessions archived_sessions) do (
        if exist "%CODEX_DIR%\%%D" (
            echo [DEL] %%D\*
            rmdir /s /q "%CODEX_DIR%\%%D"
            set /a COUNT+=1
        )
    )

    REM Clear session index/history files
    for %%F in (session_index.jsonl history.jsonl) do (
        if exist "%CODEX_DIR%\%%F" (
            echo [DEL] %%F
            del /f /q "%CODEX_DIR%\%%F" >nul
            set /a COUNT+=1
        )
    )
    echo.
) else (
    echo [SKIP] Codex directory not found: %CODEX_DIR%
    echo.
)

REM ---------- Gemini CLI ----------
if exist "%GEMINI_DIR%" (
    echo --- Gemini CLI ---

    REM Clear per-project conversation history
    if exist "%GEMINI_DIR%\history" (
        echo [DEL] history\*
        for /d %%D in ("%GEMINI_DIR%\history\*") do (
            rmdir /s /q "%%~fD" 2>nul
            set /a COUNT+=1
        )
    )

    REM Clear temp project chats and tool outputs, but keep shared bin cache
    if exist "%GEMINI_DIR%\tmp" (
        echo [DEL] tmp\project-data
        for /d %%D in ("%GEMINI_DIR%\tmp\*") do (
            if /i not "%%~nxD"=="bin" (
                rmdir /s /q "%%~fD" 2>nul
                set /a COUNT+=1
            )
        )
    )

    REM Clear Gemini internal conversation/context artifacts, preserve knowledge and config
    if exist "%GEMINI_DIR%\antigravity" (
        for %%D in (context_state conversations html_artifacts implicit) do (
            if exist "%GEMINI_DIR%\antigravity\%%D" (
                echo [DEL] antigravity\%%D\*
                rmdir /s /q "%GEMINI_DIR%\antigravity\%%D" 2>nul
                set /a COUNT+=1
            )
        )
    )
    echo.
) else (
    echo [SKIP] Gemini CLI directory not found: %GEMINI_DIR%
    echo.
)

echo ============================================
echo  Done. Cleared %COUNT% category(ies).
echo.
echo  Preserved: settings, auth, config, memory,
echo             CLAUDE.md, hooks, shared caches, logs, etc.
echo ============================================
pause
