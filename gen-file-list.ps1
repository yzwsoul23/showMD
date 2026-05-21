$scriptDir = $PSScriptRoot
$outputFile = Join-Path $scriptDir "file-list.json"

$files = Get-ChildItem -Path $scriptDir -Recurse -Filter "*.md" | Where-Object {
    $_.FullName -ne (Join-Path $scriptDir "file-list.md")
} | ForEach-Object {
    $relativePath = $_.FullName.Substring($scriptDir.Length + 1) -replace '\\', '/'
    $dirName = Split-Path $relativePath -Parent
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $cleanName = $fileName -replace '^[^_]+_', ''
    if ($cleanName -eq $fileName) {
        $cleanName = $fileName -replace '^[^A-Za-z\u4e00-\u9fff]+', ''
    }
    if ($cleanName -eq '' -or $cleanName -eq $fileName) {
        $cleanName = $fileName
    }
    $displayName = $dirName + " - " + $cleanName
    [PSCustomObject]@{
        path = $relativePath
        name = $displayName
    }
}

$json = $files | ConvertTo-Json
Set-Content -Path $outputFile -Value $json -Encoding UTF8

Write-Host "已生成文件列表，共 $($files.Count) 个 MD 文件"
Write-Host "输出文件：$outputFile"