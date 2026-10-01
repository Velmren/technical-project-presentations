$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath("$PSScriptRoot/..")
$apiJar="$projectRoot/build/deps/spigot-api-1.16.5.jar"
if(!(Test-Path -LiteralPath $apiJar)){throw 'Build the core first: the pinned Spigot 1.16.5 API is required.'}
$cp="$apiJar;$projectRoot/build/classes"
New-Item -ItemType Directory -Force "$projectRoot/build/verifier" | Out-Null
& javac --release 16 -encoding UTF-8 -cp $cp -d "$projectRoot/build/verifier" "$projectRoot/verification/NpcRuntimeVerifier.java"
if($LASTEXITCODE){throw 'Verifier compilation failed'}
Copy-Item "$projectRoot/verification/plugin.yml" "$projectRoot/build/verifier/plugin.yml" -Force
& jar --create --file "$projectRoot/build/npc-runtime-verifier.jar" -C "$projectRoot/build/verifier" .
if($LASTEXITCODE){throw 'Verifier packaging failed'}
Write-Output "Built $projectRoot/build/npc-runtime-verifier.jar (Java release 16, Spigot 1.16.5 API)"
