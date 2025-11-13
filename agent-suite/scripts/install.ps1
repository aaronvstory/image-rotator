param(
  [Parameter(Mandatory = $true)][string]$TargetPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $TargetPath)) {
  throw "Target path does not exist: $TargetPath"
}

$src = Join-Path $PSScriptRoot '..\templates\.github\workflows'
$dst = Join-Path $TargetPath '.github\workflows'

New-Item -ItemType Directory -Force -Path $dst | Out-Null

Get-ChildItem -Path $src -Filter '*.yml' | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $dst -Force
}

Write-Host "Copied workflows to $dst"
