$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath("$PSScriptRoot/..")
$cp=((Get-ChildItem "$root/.server/libraries" -Recurse -Filter '*.jar').FullName -join [IO.Path]::PathSeparator)
$cp="$root/build/plugin-classes$([IO.Path]::PathSeparator)$cp"
New-Item -ItemType Directory -Force "$root/build/verifier" | Out-Null
& javac -encoding UTF-8 -cp $cp -d "$root/build/verifier" "$root/src/test/java/dev/velmren/guide/PaperVerifier.java"
if($LASTEXITCODE){throw 'Verifier compilation failed'}
@'
name: HarborVerifier
version: 1.0.0
main: dev.velmren.guide.PaperVerifier
api-version: '1.21.11'
depend: [NorthHarbor]
'@ | Set-Content "$root/build/verifier/plugin.yml"
& jar --create --file "$root/build/harbor-verifier.jar" -C "$root/build/verifier" .
Copy-Item "$root/build/harbor-verifier.jar","$root/build/north-harbor-2.0.0.jar" "$root/.server/plugins" -Force
& node "$root/scripts/verify-paper.mjs"
if($LASTEXITCODE){throw 'Paper verification failed'}
