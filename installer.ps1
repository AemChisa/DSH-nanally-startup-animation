param(
    [ValidateSet('install','uninstall','check')][string]$Action='install',
    [string]$DshExe,
    [string]$DshHome,
    [string]$ManagedRoot,
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$')][string]$Profile='desktop',
    [switch]$NonInteractive
)
$ErrorActionPreference='Stop'
function Valid-Dsh([string]$Candidate) {
    if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) { return $false }
    $item=Get-Item -LiteralPath $Candidate
    return ($item.Name -eq 'DeepSeek Harness.exe' -and $item.VersionInfo.ProductName -eq 'DeepSeek Harness' -and (Test-Path -LiteralPath (Join-Path $item.DirectoryName 'resources\app.asar')))
}
try {
    $candidates=New-Object 'System.Collections.Generic.List[string]'
    if ($DshExe) { if (-not (Valid-Dsh $DshExe)) { throw '指定的文件不是完整的官方 DSH Windows 桌面版。' }; $candidates.Add((Resolve-Path -LiteralPath $DshExe).Path) }
    else {
        $shortcutRoots=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'))
        $shell=New-Object -ComObject WScript.Shell
        foreach($root in $shortcutRoots){if($root -and (Test-Path -LiteralPath $root)){Get-ChildItem -LiteralPath $root -Filter '*DeepSeek*Harness*.lnk' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {$target=$shell.CreateShortcut($_.FullName).TargetPath;if(Valid-Dsh $target){$candidates.Add($target)}}}}
        $programBases=@((Join-Path $env:LOCALAPPDATA 'Programs'),$env:ProgramFiles,${env:ProgramFiles(x86)})
        foreach($base in $programBases){if($base){foreach($folder in @('DeepSeek Harness','DeepSeekHarness')){$candidate=Join-Path (Join-Path $base $folder) 'DeepSeek Harness.exe';if(Valid-Dsh $candidate){$candidates.Add($candidate)}}}}
        foreach($reg in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')){
            Get-ItemProperty -Path ($reg+'\*') -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -eq 'DeepSeek Harness'} | ForEach-Object {
                if($_.InstallLocation){$candidate=Join-Path $_.InstallLocation 'DeepSeek Harness.exe';if(Valid-Dsh $candidate){$candidates.Add($candidate)}}
                if($_.DisplayIcon){$candidate=($_.DisplayIcon -replace ',\d+$','').Trim('"');if(Valid-Dsh $candidate){$candidates.Add($candidate)}}
            }
        }
    }
    $found=@($candidates | ForEach-Object {[IO.Path]::GetFullPath($_)} | Sort-Object -Unique)
    if($found.Count -eq 1){$DshExe=$found[0]}
    elseif($NonInteractive){throw '未找到唯一的 DSH 安装位置，请指定 -DshExe。'}
    else {Add-Type -AssemblyName System.Windows.Forms;$picker=New-Object System.Windows.Forms.OpenFileDialog;$picker.Title='请选择 DSH 的 DeepSeek Harness.exe';$picker.Filter='DSH 桌面程序|DeepSeek Harness.exe';if($picker.ShowDialog() -ne 'OK'){throw '已取消，没有修改 DSH。'};$DshExe=$picker.FileName;if(-not (Valid-Dsh $DshExe)){throw '所选文件不是完整的官方 DSH Windows 桌面版。'}}
    $version=(Get-Item -LiteralPath $DshExe).VersionInfo.FileVersion
    if($version -ne '0.2.1-rc.5'){
        if($NonInteractive){throw ('仅验证过 DSH 0.2.1-rc.5，当前版本为 '+$version+'。')}
        Write-Host ('当前 DSH 版本：'+$version+'。本主题已验证版本为 0.2.1-rc.5，其他版本可能显示异常。') -ForegroundColor Yellow
        if((Read-Host '输入 YES 继续，其他输入取消') -cne 'YES'){throw '已取消，没有修改 DSH。'}
    }
    $oldElectron=$env:ELECTRON_RUN_AS_NODE;$env:ELECTRON_RUN_AS_NODE='1'
    try {
        $manager=Join-Path $PSScriptRoot 'tools\manager.cjs'
        $arguments=@('--action',$Action,'--exe',$DshExe,'--profile',$Profile,'--payload',$PSScriptRoot)
        if($DshHome){$arguments+=@('--home',$DshHome)}
        if($ManagedRoot){$arguments+=@('--root',$ManagedRoot)}
        & $DshExe $manager @arguments
        $code=$LASTEXITCODE
    } finally { $env:ELECTRON_RUN_AS_NODE=$oldElectron }
    exit $code
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
