$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$oauthPort = 3031
$tunnelLog = Join-Path $env:TEMP 'postflow-cloudflared.log'
$tunnelOutput = Join-Path $env:TEMP 'postflow-cloudflared-output.log'
$tunnelProcess = $null
$agentProcess = $null
$devProcess = $null
$ownerEnv = Join-Path $projectRoot '.env.local'
$publicCallbackUrl = ''

if (-not (Test-Path -LiteralPath $cloudflared)) {
  throw 'Cloudflare Tunnel is not installed. Install Cloudflare.cloudflared with winget first.'
}

try {
  if (Test-Path -LiteralPath $ownerEnv) {
    $secretLine = Get-Content -LiteralPath $ownerEnv | Where-Object { $_ -match '^\s*INSTAGRAM_APP_SECRET\s*=' } | Select-Object -Last 1
    if ($secretLine) { $env:INSTAGRAM_APP_SECRET = ($secretLine -replace '^\s*INSTAGRAM_APP_SECRET\s*=\s*', '').Trim().Trim('"').Trim("'") }
    $callbackLine = Get-Content -LiteralPath $ownerEnv | Where-Object { $_ -match '^\s*POSTFLOW_PUBLIC_CALLBACK_URL\s*=' } | Select-Object -Last 1
    if ($callbackLine) { $publicCallbackUrl = ($callbackLine -replace '^\s*POSTFLOW_PUBLIC_CALLBACK_URL\s*=\s*', '').Trim().Trim('"').Trim("'") }
    $openAiLine = Get-Content -LiteralPath $ownerEnv | Where-Object { $_ -match '^\s*OPENAI_API_KEY\s*=' } | Select-Object -Last 1
    if ($openAiLine) { $env:OPENAI_API_KEY = ($openAiLine -replace '^\s*OPENAI_API_KEY\s*=\s*', '').Trim().Trim('"').Trim("'") }
    $captionModelLine = Get-Content -LiteralPath $ownerEnv | Where-Object { $_ -match '^\s*OPENAI_CAPTION_MODEL\s*=' } | Select-Object -Last 1
    if ($captionModelLine) { $env:OPENAI_CAPTION_MODEL = ($captionModelLine -replace '^\s*OPENAI_CAPTION_MODEL\s*=\s*', '').Trim().Trim('"').Trim("'") }
  }

  if ($publicCallbackUrl) {
    $callbackUrl = $publicCallbackUrl
  } else {
    if (Test-Path -LiteralPath $tunnelLog) { Remove-Item -LiteralPath $tunnelLog }
    if (Test-Path -LiteralPath $tunnelOutput) { Remove-Item -LiteralPath $tunnelOutput }
    $tunnelProcess = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$oauthPort", '--protocol', 'http2', '--no-autoupdate') -RedirectStandardError $tunnelLog -RedirectStandardOutput $tunnelOutput -WindowStyle Hidden -PassThru

    $deadline = (Get-Date).AddSeconds(30)
    $tunnelUrl = $null
    while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
      Start-Sleep -Milliseconds 300
      if (Test-Path -LiteralPath $tunnelLog) {
        $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($match) { $tunnelUrl = $match.Matches[0].Value }
      }
    }
    if (-not $tunnelUrl) { throw 'Could not create the secure HTTPS tunnel.' }
    $callbackUrl = "$tunnelUrl/instagram/callback"
  }
  Set-Clipboard -Value $callbackUrl
  $env:INSTAGRAM_REDIRECT_URI = $callbackUrl
  $env:POSTFLOW_OAUTH_CALLBACK_PORT = [string]$oauthPort

  Write-Host ''
  Write-Host 'Postflow is ready.' -ForegroundColor Green
  Write-Host 'OAuth callback URL (also available inside Postflow):' -ForegroundColor Cyan
  Write-Host $callbackUrl -ForegroundColor Yellow
  Write-Host '(It has also been copied to your clipboard.)'
  Write-Host 'Open http://localhost:3000 and click Connect with Meta.'
  if ([string]::IsNullOrWhiteSpace($env:INSTAGRAM_APP_SECRET)) { Write-Host 'Owner setup needed: add INSTAGRAM_APP_SECRET to .env.local, then restart.' -ForegroundColor Yellow }
  if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) { Write-Host 'AI captions are disabled: add OPENAI_API_KEY to .env.local, then restart.' -ForegroundColor Yellow }
  Write-Host 'Keep this PowerShell window open while using Postflow.'
  Write-Host ''

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  $node = if ($nodeCommand) { $nodeCommand.Source } elseif (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { throw 'Node.js was not found.' }
  $env:Path = "$(Split-Path -Parent $node);$env:Path"

  try {
    Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/' -TimeoutSec 2 | Out-Null
  } catch {
    $pnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (-not (Test-Path -LiteralPath $pnpm)) { throw 'Postflow package runner was not found.' }
    $devProcess = Start-Process -FilePath $pnpm -ArgumentList @('dev') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
  }
  $agentProcess = Start-Process -FilePath $node -ArgumentList @((Join-Path $projectRoot 'local-agent.mjs')) -WorkingDirectory $projectRoot -NoNewWindow -PassThru
  Start-Process 'http://localhost:3000'
  Wait-Process -Id $agentProcess.Id
} finally {
  if ($agentProcess -and -not $agentProcess.HasExited) { Stop-Process -Id $agentProcess.Id -Force }
  if ($devProcess -and -not $devProcess.HasExited) { Stop-Process -Id $devProcess.Id -Force }
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) { Stop-Process -Id $tunnelProcess.Id -Force }
  if (Test-Path -LiteralPath $tunnelLog) { Remove-Item -LiteralPath $tunnelLog }
  if (Test-Path -LiteralPath $tunnelOutput) { Remove-Item -LiteralPath $tunnelOutput }
}
