# copy-home-images.ps1
# Copies existing images from public/images/ to public/images/home/ with canonical names
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pub = Join-Path $root 'public\images'
$home = Join-Path $pub 'home'
if (!(Test-Path $home)) { New-Item -ItemType Directory -Path $home | Out-Null }
$map = @{
    'Calumpit_Church,_Bulacan,_Apr_2025_(2).jpg' = 'barasoain-1.jpg'
    'Feast_of_Sto._Niño_de_Malolos_in_Bulacan,_Philippines.jpg' = 'fiesta-1.jpg'
    'photo-1724861824003-ddbc6f56aa56.jpg' = 'market-1.jpg'
    'Grotto_of_Our_Lady_of_Lourdes,_SJDM,_Bulacan_(November_2020).jpg' = 'church-facade.jpg'
}
foreach ($srcName in $map.Keys) {
    $srcPath = Join-Path $pub $srcName
    $dstPath = Join-Path $home $map[$srcName]
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $dstPath -Force
        Write-Host "Copied $srcName -> $dstPath"
    } else {
        Write-Host "Missing: $srcName (source not found at $srcPath)" -ForegroundColor Yellow
    }
}
