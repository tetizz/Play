[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $projectRoot 'stockfish19-src\src'
$toolchainBin = Join-Path $projectRoot 'toolchain\llvm-mingw-20260602-ucrt-x86_64\bin'
$gitUsrBin = 'C:\Progra~1\Git\usr\bin'
$makePath = Join-Path $toolchainBin 'mingw32-make.exe'
$builtEngine = Join-Path $sourceRoot 'stockfish.exe'
$releaseEngine = Join-Path $projectRoot 'dist\BadMannersStockfish19.exe'

foreach ($requiredPath in @($sourceRoot, $toolchainBin, $makePath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required Stockfish 19 build input is missing."
    }
}

$env:PATH = "$toolchainBin;$gitUsrBin;$env:PATH"
& $makePath -C $sourceRoot -j4 build ARCH=x86-64-avx2 COMP=clang
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $builtEngine -PathType Leaf)) {
    throw 'Bad Manners Stockfish 19 compilation failed.'
}

$releaseDirectory = Split-Path -Parent $releaseEngine
New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
$temporaryEngine = Join-Path $releaseDirectory ('.BadMannersStockfish19-{0}.tmp' -f [guid]::NewGuid().ToString('N'))
try {
    Copy-Item -LiteralPath $builtEngine -Destination $temporaryEngine
    Move-Item -LiteralPath $temporaryEngine -Destination $releaseEngine -Force
}
finally {
    if (Test-Path -LiteralPath $temporaryEngine) {
        Remove-Item -LiteralPath $temporaryEngine -Force
    }
}

$hash = (Get-FileHash -LiteralPath $releaseEngine -Algorithm SHA256).Hash
Write-Output "Built $releaseEngine"
Write-Output "SHA256 $hash"
