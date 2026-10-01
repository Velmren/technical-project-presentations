$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath("$PSScriptRoot/..")
$dest=[IO.Path]::GetFullPath("$root/../../public/projects/npc-system")
& node "$root/scripts/art.mjs"
if($LASTEXITCODE){throw 'Asset generation failed'}
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item "$root/web/*" $dest -Recurse -Force
Copy-Item "$root/build/north-harbor-2.0.0.jar" $dest -Force
if(Test-Path "$root/project.json"){Copy-Item "$root/project.json" $dest -Force}
Copy-Item "$root/src/main/resources/config.yml" $dest -Force
Write-Output "Static result: $dest"
