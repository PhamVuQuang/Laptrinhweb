# Start Server Script (PowerShell)
Write-Host "🔄 Killing old Node processes..." -ForegroundColor Yellow
try {
    taskkill /F /IM node.exe 2>$null
    Write-Host "✓ Killed old processes" -ForegroundColor Green
} catch {
    Write-Host "No node processes to kill" -ForegroundColor Gray
}

Write-Host "⏳ Waiting for port to be released..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host "🚀 Starting server on port 3000..." -ForegroundColor Green
node server.js