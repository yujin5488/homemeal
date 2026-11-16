# 오늘의 집밥 로컬 실행기
# 1) GitHub에서 최신 코드를 받아 이 폴더를 업데이트하고
# 2) 내 컴퓨터에 작은 웹서버를 켜고
# 3) 브라우저로 앱을 열어요.
# 창을 닫으면 앱 서버도 꺼져요.

$ErrorActionPreference = "Stop"
$Repo   = "yujin5488/homemeal"
$Branch = "main"
$Port   = 8088   # 바꾸지 마세요: 포트가 바뀌면 브라우저에 저장된 냉장고 내용이 안 보여요.
$Root   = Split-Path -Parent $PSScriptRoot
$Url    = "http://localhost:$Port/"

try { $Host.UI.RawUI.WindowTitle = "오늘의 집밥" } catch {}
Write-Host ""
Write-Host "  오늘의 집밥을 준비하고 있어요..." -ForegroundColor Green
Write-Host ""

# ---------- 1. 최신 코드 받기 ----------
function Update-WithGit {
  Write-Host "  [1/3] 최신 코드 받는 중 (git)..."
  $ErrorActionPreference = "Continue"   # git 은 안내 문구를 오류 출력으로 내보내서, 그걸로 멈추지 않게
  & git -C $Root pull --ff-only 2>&1 | ForEach-Object { Write-Host "        $_" }
  if ($LASTEXITCODE -ne 0) { throw "git pull 실패" }
}
function Update-WithZip {
  Write-Host "  [1/3] 최신 코드 받는 중..."
  $tmp = Join-Path $env:TEMP ("homemeal-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $zip = Join-Path $tmp "code.zip"
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
    # 실행 중인 .bat 파일은 덮어쓰지 않아요.
    & robocopy $src.FullName $Root /E /XF *.bat /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "파일 복사 실패" }
    Write-Host "        최신 코드로 바꿨어요."
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}
try {
  $hasGit = [bool](Get-Command git -ErrorAction SilentlyContinue)
  if ($hasGit -and (Test-Path (Join-Path $Root ".git"))) { Update-WithGit } else { Update-WithZip }
} catch {
  Write-Host "        업데이트를 못 했어요 (인터넷 연결을 확인해 주세요). 지금 있는 파일로 열게요." -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $Root "index.html"))) {
  Write-Host ""
  Write-Host "  index.html 이 없어요. 이 파일이 homemeal 폴더 안에 있는지 확인해 주세요." -ForegroundColor Red
  exit 1
}

# ---------- 2. 파이썬 찾기 ----------
Write-Host "  [2/3] 파이썬 찾는 중..."
$py = $null
$ErrorActionPreference = "Continue"
foreach ($cand in @(@("py","-3"), @("python"), @("python3"))) {
  $cmd = Get-Command $cand[0] -ErrorAction SilentlyContinue
  if (-not $cmd) { continue }
  try {
    $args0 = @($cand | Select-Object -Skip 1) + "--version"
    $v = & $cand[0] @args0 2>&1
    if ($LASTEXITCODE -eq 0) { $py = $cand; Write-Host "        $v"; break }
  } catch {}
}
if (-not $py) {
  Write-Host ""
  Write-Host "  파이썬을 찾지 못했어요." -ForegroundColor Red
  Write-Host "  https://www.python.org/downloads/ 에서 설치하고,"
  Write-Host "  설치 첫 화면에서 'Add python.exe to PATH' 에 꼭 체크해 주세요."
  exit 1
}

# ---------- 3. 서버 켜고 브라우저 열기 ----------
$busy = $false
try { $l = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port); $l.Start(); $l.Stop() } catch { $busy = $true }
if ($busy) {
  Write-Host "  이미 켜져 있는 것 같아요. 브라우저만 열게요." -ForegroundColor Yellow
  Start-Process $Url
  Start-Sleep -Seconds 2
  exit 0
}

Write-Host "  [3/3] 앱을 켜는 중... $Url"
$argList = @($py | Select-Object -Skip 1) + @("-m","http.server","$Port","--bind","127.0.0.1")
$proc = Start-Process -FilePath $py[0] -ArgumentList $argList -WorkingDirectory $Root -NoNewWindow -PassThru
Start-Sleep -Seconds 1
Start-Process $Url
Write-Host ""
Write-Host "  앱이 열렸어요!  주소: $Url" -ForegroundColor Green
Write-Host "  다 쓰면 이 창을 닫으면 돼요. (이 창을 닫으면 앱도 꺼져요)"
Write-Host ""
Wait-Process -Id $proc.Id
