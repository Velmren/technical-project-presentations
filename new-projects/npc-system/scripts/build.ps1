param([string]$Libraries = "$PSScriptRoot/../.server/libraries")
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath("$PSScriptRoot/..")
$jars = Get-ChildItem -LiteralPath $Libraries -Recurse -Filter '*.jar'
if (!$jars.Count) { throw 'Pass -Libraries with the libraries directory of an initialized Paper 1.21.11 server.' }
$cp = ($jars.FullName -join [IO.Path]::PathSeparator)
New-Item -ItemType Directory -Force "$root/build/plugin-classes","$root/build/test-classes" | Out-Null
$src = (Get-ChildItem "$root/src/main/java" -Recurse -Filter '*.java').FullName
& javac --release 21 -encoding UTF-8 -cp $cp -d "$root/build/plugin-classes" $src
if ($LASTEXITCODE) { throw 'Compilation failed' }
Copy-Item "$root/src/main/resources/*" "$root/build/plugin-classes" -Force
& jar --create --file "$root/build/north-harbor-2.0.0.jar" -C "$root/build/plugin-classes" .
if ($LASTEXITCODE) { throw 'Packaging failed' }
& javac --release 21 -encoding UTF-8 -cp "$root/build/plugin-classes" -d "$root/build/test-classes" "$root/src/test/java/dev/velmren/guide/QuestTest.java"
if ($LASTEXITCODE) { throw 'Test compilation failed' }
& java -cp "$root/build/plugin-classes$([IO.Path]::PathSeparator)$root/build/test-classes" dev.velmren.guide.QuestTest
if ($LASTEXITCODE) { throw 'Tests failed' }
Write-Output "Built $root/build/north-harbor-2.0.0.jar"

