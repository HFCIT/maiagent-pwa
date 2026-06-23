# Generates PWA icons (180/192/512) from Logo.png using .NET System.Drawing.
# Run:  powershell -ExecutionPolicy Bypass -File build-icons.ps1
Add-Type -AssemblyName System.Drawing

$root    = if ($PSScriptRoot) { $PSScriptRoot } else { 'D:\PWA' }
$srcPath = Join-Path $root 'Logo.png'
$outDir  = Join-Path $root 'icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$src = [System.Drawing.Image]::FromFile($srcPath)
Write-Output ("source: {0}x{1}" -f $src.Width, $src.Height)

foreach ($size in 180, 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Contain (preserve aspect ratio), centered.
  $scale = [Math]::Min($size / $src.Width, $size / $src.Height)
  $dw = [int][Math]::Round($src.Width  * $scale)
  $dh = [int][Math]::Round($src.Height * $scale)
  $dx = [int][Math]::Round(($size - $dw) / 2)
  $dy = [int][Math]::Round(($size - $dh) / 2)
  $g.DrawImage($src, $dx, $dy, $dw, $dh)
  $g.Dispose()

  $outFile = Join-Path $outDir ("icon-{0}.png" -f $size)
  $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("wrote {0}" -f $outFile)
}
$src.Dispose()
