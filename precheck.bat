@echo off
REM ── precheck.bat — pre-push quality gate ──────────────────────────────
REM
REM Runs lint + tests + build in sequence. Stops on first failure so the
REM error message is the LAST thing on screen (not buried).
REM
REM Usage:  type `precheck` in the VS Code terminal before `git push`.
REM
REM Why this is committed to the repo (unlike sync.bat which is local):
REM   - It's a project quality standard, not a personal helper.
REM   - Anyone cloning the repo can run the exact same checks.
REM   - The matching CI workflow runs the same commands on GitHub.

setlocal

echo ============================================================
echo  Pre-push quality gate
echo ============================================================
echo.

echo [1/3] Linting...
echo ------------------------------------------------------------
call npm run lint
if errorlevel 1 (
    echo.
    echo ============================================================
    echo  FAILED at lint step.
    echo  Fix the errors above and re-run precheck.
    echo ============================================================
    exit /b 1
)

echo.
echo [2/3] Running tests...
echo ------------------------------------------------------------
call npm test
if errorlevel 1 (
    echo.
    echo ============================================================
    echo  FAILED at test step.
    echo  Fix the failing tests above and re-run precheck.
    echo ============================================================
    exit /b 1
)

echo.
echo [3/3] Building production bundle...
echo ------------------------------------------------------------
call npm run build
if errorlevel 1 (
    echo.
    echo ============================================================
    echo  FAILED at build step.
    echo  Fix the build errors above and re-run precheck.
    echo ============================================================
    exit /b 1
)

echo.
echo ============================================================
echo  All checks passed. Safe to push.
echo ============================================================

endlocal
