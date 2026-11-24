<#
.SYNOPSIS
  WeatherBuddy Windows Desktop Screen Companion Launcher
.DESCRIPTION
  Calculates exact screen working-area coordinates via .NET System.Windows.Forms.Screen
  and launches WeatherBuddy in a clean borderless app window at the selected screen corner.
#>
[CmdletBinding()]
param(
  [ValidateSet('BottomRight', 'TopRight', 'BottomLeft', 'TopLeft')]
  [string]$Corner = 'BottomRight',

  [ValidateSet('Compact', 'Standard')]
  [string]$Size = 'Standard',

  [ValidateSet('male', 'female')]
  [string]$Gender = 'male'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
$workingArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea

if ($Size -eq 'Compact') {
  $winWidth = 300
  $winHeight = 420
} else {
  $winWidth = 380
  $winHeight = 540
}

$margin = 16

switch ($Corner) {
  'TopLeft' {
    $posX = $workingArea.Left + $margin
    $posY = $workingArea.Top + $margin
  }
  'TopRight' {
    $posX = $workingArea.Right - $winWidth - $margin
    $posY = $workingArea.Top + $margin
  }
  'BottomLeft' {
    $posX = $workingArea.Left + $margin
    $posY = $workingArea.Bottom - $winHeight - $margin
  }
  default {
    # BottomRight
    $posX = $workingArea.Right - $winWidth - $margin
    $posY = $workingArea.Bottom - $winHeight - $margin
  }
}

$widgetHtmlPath = Join-Path $PSScriptRoot 'widget.html'
if (-not (Test-Path -LiteralPath $widgetHtmlPath)) {
  throw "Không tìm thấy widget.html tại: $widgetHtmlPath"
}

$resolvedFilePath = (Resolve-Path -LiteralPath $widgetHtmlPath).Path
$fileUri = ([System.Uri]::new($resolvedFilePath)).AbsoluteUri
$targetUri = "${fileUri}?mode=widget&corner=$Corner&size=$Size&gender=$Gender"

# Locate Microsoft Edge, Google Chrome, Brave, or CocCoc
$browserCandidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:LocalAppData\CocCoc\Browser\Application\browser.exe"
)

$browserExe = $null
foreach ($candidate in $browserCandidates) {
  if ($candidate -and (Test-Path -LiteralPath $candidate)) {
    $browserExe = $candidate
    break
  }
}

if (-not $browserExe) {
  Start-Process $targetUri
  exit 0
}

$profileDir = Join-Path $env:LOCALAPPDATA 'WeatherBuddyWidgetProfile'
$argList = @(
  "--app=$targetUri",
  "--window-position=$posX,$posY",
  "--window-size=$winWidth,$winHeight",
  "--user-data-dir=$profileDir",
  "--no-first-run",
  "--no-default-browser-check"
)

Start-Process -FilePath $browserExe -ArgumentList $argList
Write-Output "Launched WeatherBuddy Desktop Widget ($Size, $Corner, $Gender) at ($posX, $posY)."
