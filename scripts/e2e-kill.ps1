# Encerra a stack E2E (web :3100, postgres :5433, worker e o orquestrador).
$ErrorActionPreference = "SilentlyContinue"
$procs = Get-CimInstance Win32_Process
$targets = @()
$targets += Get-NetTCPConnection -State Listen -LocalPort 3100, 5433 | Select-Object -ExpandProperty OwningProcess
$targets += $procs | Where-Object { $_.CommandLine -match "e2e-stack" } | Select-Object -ExpandProperty ProcessId
# worker da stack E2E: filho do orquestrador
$stackIds = $procs | Where-Object { $_.CommandLine -match "e2e-stack" } | Select-Object -ExpandProperty ProcessId
foreach ($id in $stackIds) { $targets += $procs | Where-Object { $_.ParentProcessId -eq $id } | Select-Object -ExpandProperty ProcessId }
foreach ($id in ($targets | Sort-Object -Unique)) { taskkill /pid $id /T /F | Out-Null }
