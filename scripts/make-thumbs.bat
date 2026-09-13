@echo off
setlocal enabledelayedexpansion
title Batch Make WebP Thumbnails (FFmpeg)

REM ============================================================
REM  make-thumbs.bat - Mirror an originals folder into a
REM  thumbnail folder: every jpg/jpeg/png/bmp/tif/gif is
REM  resized and re-encoded as .webp, keeping subfolders.
REM
REM  Usage 1: Drag an image folder (or several) onto this .bat
REM           e.g. drop "originals"  -^>  gets "originals-thumbs"
REM  Usage 2: Double-click it inside the image folder
REM
REM  Site workflow:
REM    docs\public\images\originals\<id>\*.jpg   (high-res)
REM      -- drop this "originals" folder here --^>
REM    docs\public\images\originals-thumbs\<id>\*.webp
REM      then copy them into docs\public\images\<id>\
REM
REM  Optional settings:
REM    QUALITY  WebP quality 1-100 (75)
REM    MAXW     Max width in px (1000, matches the site)
REM
REM  Originals are never modified or deleted. Existing .webp
REM  outputs are skipped, so re-runs only process new files.
REM  Filenames containing %% are supported.
REM ============================================================

set "QUALITY=75"
set "MAXW=1000"

where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo [ERROR] ffmpeg was not found in PATH.
    echo         Install it with:  winget install Gyan.FFmpeg
    echo         Download page:    https://ffmpeg.org/download.html
    echo.
    pause
    exit /b 1
)

set /a TOTAL=0
set /a OK=0
set /a SKIP=0
set /a FAIL=0

if "%~1"=="" (
    call :process_dir "%CD%"
) else (
    for %%P in (%*) do (
        if exist "%%~P\" (
            set "FOLDERNAME=%%~nxP"
            if "!FOLDERNAME:~-7!"=="-thumbs" (
                echo [skip] Looks like a thumbnail folder already: %%~P
            ) else (
                call :process_dir "%%~fP"
            )
        ) else (
            echo [skip] Not a folder, use img2webp.bat for single files: %%~nxP
        )
    )
)

echo.
echo ============================================================
echo All done. Total !TOTAL!, converted !OK!, skipped !SKIP!, failed !FAIL!
echo ============================================================
pause
exit /b 0


REM ------------------------------------------------------------
REM  process_dir <folder>  -^>  <folder>-thumbs mirror
REM  Inline block + delayed expansion so filenames with %% work.
REM ------------------------------------------------------------
:process_dir
set "SRC=%~1"
echo.
echo Source : !SRC!
echo Output : !SRC!-thumbs
echo.

for /r "%SRC%" %%F in (*.jpg *.jpeg *.png *.bmp *.tif *.tiff *.gif) do (
    set "IN=%%~fF"
    set "OUTDIR=%%~dpF"
    set "OUTDIR=!OUTDIR:%SRC%=%SRC%-thumbs!"
    set "OUT=!OUTDIR!%%~nF.webp"
    set /a TOTAL+=1

    if exist "!OUT!" (
        echo  [skip] %%~nxF
        set /a SKIP+=1
    ) else (
        if not exist "!OUTDIR!" mkdir "!OUTDIR!"
        echo  [webp] %%~nxF
        ffmpeg -hide_banner -loglevel error -y -i "!IN!" -vf "scale='min(!MAXW!,iw)':-2:flags=lanczos" -c:v libwebp -pix_fmt yuva420p -quality !QUALITY! -compression_level 6 -loop 0 "!OUT!"
        if errorlevel 1 (
            echo          [failed]
            if exist "!OUT!" del /f /q "!OUT!" 2>nul
            set /a FAIL+=1
        ) else (
            set /a OK+=1
        )
    )
)
goto :eof
