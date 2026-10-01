param([string]$Output='E:/Astra/2026-09-26/realtime-voice-chat/outputs/portfolio-projects/npc-system')
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath("$PSScriptRoot/..")
$static=[IO.Path]::GetFullPath("$root/../../public/projects/npc-system")
& "$PSScriptRoot/build-web.ps1"
New-Item -ItemType Directory -Force $Output | Out-Null
Compress-Archive -Path "$root/src","$root/scripts","$root/web","$root/README.md","$root/project.json" -DestinationPath "$static/source.zip" -Force
Copy-Item "$root/build/north-harbor-2.0.0.jar","$root/README.md","$root/project.json","$root/src/main/resources/config.yml","$static/source.zip" $Output -Force
if(Test-Path "$Output/thumbnail.png"){Copy-Item "$Output/thumbnail.png" "$static/thumbnail.png" -Force}
New-Item -ItemType Directory -Force "$root/build/release/public/projects/npc-system","$root/build/release/new-projects/npc-system" | Out-Null
Copy-Item "$static/*" "$root/build/release/public/projects/npc-system" -Recurse -Force
Copy-Item "$root/src","$root/scripts","$root/web","$root/README.md","$root/project.json" "$root/build/release/new-projects/npc-system" -Recurse -Force
Compress-Archive -Path "$root/build/release/public","$root/build/release/new-projects" -DestinationPath "$Output/north-harbor-release.zip" -Force
Get-FileHash "$Output/north-harbor-2.0.0.jar","$Output/source.zip","$Output/north-harbor-release.zip" -Algorithm SHA256 | Select-Object Hash,Path | ConvertTo-Json | Set-Content "$Output/checksums.json"
Write-Output "Release: $Output/north-harbor-release.zip"
