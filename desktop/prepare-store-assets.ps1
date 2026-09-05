$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot 'generated\store-assets'
$appxAssets = Join-Path $assetRoot 'appx'
New-Item -ItemType Directory -Force -Path $appxAssets | Out-Null
$sourceImage = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'assets\app-icon.png'))
try {
    $sizes = @(
        @{ Name = 'appx\StoreLogo.png'; Width = 50; Height = 50 },
        @{ Name = 'appx\Square44x44Logo.png'; Width = 44; Height = 44 },
        @{ Name = 'appx\Square150x150Logo.png'; Width = 150; Height = 150 },
        @{ Name = 'appx\Wide310x150Logo.png'; Width = 310; Height = 150 },
        @{ Name = 'StoreListingLogo-300.png'; Width = 300; Height = 300 }
    )
    foreach ($size in $sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($size.Width, $size.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::FromArgb(7, 10, 18))
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $edge = [Math]::Min($size.Width, $size.Height)
            $graphics.DrawImage($sourceImage, [int](($size.Width - $edge) / 2), [int](($size.Height - $edge) / 2), $edge, $edge)
            $bitmap.Save((Join-Path $assetRoot $size.Name), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $sourceImage.Dispose()
}
Write-Output 'Store icons generated from the existing app icon.'
