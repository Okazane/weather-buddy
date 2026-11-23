<#
.SYNOPSIS
  Creates a "WeatherBuddy Widget" shortcut on the user's Windows Desktop
  (and optionally in the Windows Startup folder when -RunAtStartup is specified).
#>
[CmdletBinding()]
param(
  [ValidateSet('BottomRight', 'TopRight', 'BottomLeft', 'TopLeft')]
  [string]$Corner = 'BottomRight',

  [ValidateSet('Compact', 'Standard')]
  [string]$Size = 'Standard',

  [ValidateSet('male', 'female')]
  [string]$Gender = 'male',

  [switch]$RunAtStartup
)

$ErrorActionPreference = 'Stop'

$launcherScript = Join-Path $PSScriptRoot 'Launch-Desktop-Widget.ps1'
$iconPath = Join-Path $PSScriptRoot 'assets\weatherbuddy.ico'

$wshShell = New-Object -ComObject WScript.Shell

function New-WeatherBuddyShortcut {
  param([string]$DestinationPath)
  $shortcut = $wshShell.CreateShortcut($DestinationPath)
  $shortcut.TargetPath = 'powershell.exe'
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherScript`" -Corner $Corner -Size $Size -Gender $Gender"
  $shortcut.WorkingDirectory = $PSScriptRoot
  $shortcut.Description = 'WeatherBuddy Chibi NPC Desktop Widget'
  if (Test-Path -LiteralPath $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
  }
  $shortcut.Save()
}

$desktopDir = [Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopDir 'WeatherBuddy Widget.lnk'
New-WeatherBuddyShortcut -DestinationPath $desktopShortcutPath
Write-Output "✅ Đã tạo biểu tượng 'WeatherBuddy Widget' trên Màn hình chính (Desktop): $desktopShortcutPath"

if ($RunAtStartup) {
  $startupDir = [Environment]::GetFolderPath('Startup')
  $startupShortcutPath = Join-Path $startupDir 'WeatherBuddy Widget.lnk'
  New-WeatherBuddyShortcut -DestinationPath $startupShortcutPath
  Write-Output "✅ Đã bật tự khởi động cùng Windows (Startup): $startupShortcutPath"
}
