@echo off
setlocal enabledelayedexpansion
title Images to WebP (FFmpeg)

REM ============================================================
REM  img2webp.bat - Compress and convert images in place
REM  (a same-named .webp is written next to each source).
REM
REM  Usage 1: Drag one or more files / folders onto this .bat
REM  Usage 2: Double-click it inside an image folder
REM           (all supported images under the folder are
REM            processed recursively)
REM  Usage 3: img2webp.bat file-or-folder [file-or-folder ...]
REM
REM  Supported: jpg jpeg png bmp tif tiff gif
REM             (gif becomes animated webp, alpha is kept)
REM
REM  Optional settings (edit the two lines below):
REM    QUALITY  WebP quality 1-100, lower = smaller file (75)
REM    MAXW     Max width in px, larger images are scaled (1600)
REM
REM  Original files are never deleted. Existing .webp output is
REM  skipped automatically. Filenames containing %% are supported.
REM  To mirror an originals folder into a thumbnail folder use
REM  make-thumbs.bat instead.
REM ============================================================

set "QUALITY=75"
set "MAXW=1600"

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
    echo Processing current folder recursively:
    echo   %CD%
    echo.
    call :do_dir
) else (
    for %%P in (%*) do (
        if exist "%%~P\" (
            echo Scanning folder: %%~P
            pushd "%%~fP"
            call :do_dir
            popd
        ) else (
            REM single file, handled inline (no call, so %% in names is safe)
            set "IN=%%~fP"
            set "OUT=%%~dpnP.webp"
            set "EXT=%%~xP"
            set /a TOTAL+=1
            echo !EXT! | findstr /i /l ".jpg .jpeg .png .bmp .tif .tiff .gif" >nul
            if errorlevel 1 (
                echo  [skip] Unsupported format: %%~nxP
                set /a SKIP+=1
            ) else if exist "!OUT!" (
                echo  [skip] WebP already exists: %%~nxP
                set /a SKIP+=1
            ) else (
                echo  [webp] %%~nxP
                ffmpeg -hide_banner -loglevel error -y -i "!IN!" -vf "scale='min(!MAXW!,iw)':-2:flags=lanczos" -c:v libwebp -pix_fmt yuva420p -quality !QUALITY! -compression_level 6 -loop 0 "!OUT!"
                if errorlevel 1 (
                    echo          [failed] Check whether the source file is valid.
                    if exist "!OUT!" del /f /q "!OUT!" 2>nul
                    set /a FAIL+=1
                ) else (
                    set /a OK+=1
                )
            )
        )
    )
)

echo.
echo ============================================================
echo Done. Found %TOTAL%, converted %OK%, skipped %SKIP%, failed %FAIL%
echo ============================================================
pause
exit /b 0


REM ------------------------------------------------------------
REM  do_dir - convert all supported images under current dir
REM  (no arguments - paths only enter via %%F, so %% in names
REM   never crosses a call boundary)
REM ------------------------------------------------------------
:do_dir
for /r %%F in (*.jpg *.jpeg *.png *.bmp *.tif *.tiff *.gif) do (
    set "IN=%%~fF"
    set "OUT=%%~dpnF.webp"
    set /a TOTAL+=1

    if exist "!OUT!" (
        echo  [skip] %%~nxF
        set /a SKIP+=1
    ) else (
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
