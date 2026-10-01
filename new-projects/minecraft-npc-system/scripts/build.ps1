param([string]$Libraries = '', [string]$ApiJar = '', [string]$PlaceholderApiJar = '', [switch]$SkipTests)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath("$PSScriptRoot/..")
New-Item -ItemType Directory -Force "$projectRoot/build/deps" | Out-Null
if (!$ApiJar -and !$Libraries) {
  $ApiJar = "$projectRoot/build/deps/spigot-api-1.16.5.jar"
  if (!(Test-Path -LiteralPath $ApiJar)) { Invoke-WebRequest -Uri 'https://hub.spigotmc.org/nexus/content/repositories/snapshots/org/spigotmc/spigot-api/1.16.5-R0.1-SNAPSHOT/spigot-api-1.16.5-R0.1-20210611.041013-99-shaded.jar' -OutFile $ApiJar }
}
if (!$PlaceholderApiJar) {
  $PlaceholderApiJar = "$projectRoot/build/deps/placeholderapi-2.11.7.jar"
  if (!(Test-Path -LiteralPath $PlaceholderApiJar)) { Invoke-WebRequest -Uri 'https://repo.extendedclip.com/releases/me/clip/placeholderapi/2.11.7/placeholderapi-2.11.7.jar' -OutFile $PlaceholderApiJar }
}
if ($ApiJar) { $jars = @(Get-Item -LiteralPath $ApiJar) } else { $jars = @(Get-ChildItem -LiteralPath $Libraries -Recurse -Filter '*.jar') }
if (!$jars.Count) { throw 'Provide -ApiJar (Spigot API) or -Libraries (initialized Paper libraries).' }
if ($PlaceholderApiJar) { $jars += Get-Item -LiteralPath $PlaceholderApiJar }
if (Test-Path "$projectRoot/build/deps/annotations.jar") { $jars += Get-Item "$projectRoot/build/deps/annotations.jar" }
$cp = $jars.FullName -join [IO.Path]::PathSeparator
New-Item -ItemType Directory -Force "$projectRoot/build/classes","$projectRoot/build/tests" | Out-Null
$sources = (Get-ChildItem "$projectRoot/src/main/java" -Recurse -Filter '*.java').FullName
& javac --release 16 -encoding UTF-8 -cp $cp -d "$projectRoot/build/classes" $sources
if ($LASTEXITCODE) { throw 'Java compilation failed' }
Copy-Item "$projectRoot/src/main/resources/*" "$projectRoot/build/classes" -Force
& jar --create --file "$projectRoot/build/minecraft-npc-system-1.0.0.jar" -C "$projectRoot/build/classes" .
if ($LASTEXITCODE) { throw 'JAR packaging failed' }
$tests = @(Get-ChildItem "$projectRoot/src/test/java" -Recurse -Filter '*.java' -ErrorAction SilentlyContinue)
if ($tests.Count -and !$SkipTests) {
  & javac --release 16 -encoding UTF-8 -cp "$cp$([IO.Path]::PathSeparator)$projectRoot/build/classes" -d "$projectRoot/build/tests" $tests.FullName
  if ($LASTEXITCODE) { throw 'Test compilation failed' }
  & java -cp "$cp$([IO.Path]::PathSeparator)$projectRoot/build/classes$([IO.Path]::PathSeparator)$projectRoot/build/tests" dev.velmren.npc.CoreTests
  if ($LASTEXITCODE) { throw 'Core tests failed' }
}
Write-Output "Built $projectRoot/build/minecraft-npc-system-1.0.0.jar (Java release 16)"

