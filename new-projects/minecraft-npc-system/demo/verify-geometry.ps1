param([string]$LibraryRoot, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (-not $LibraryRoot) { $LibraryRoot = Join-Path (Split-Path $project -Parent) 'npc-system/.server/libraries' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path ([System.IO.Path]::GetTempPath()) 'minecraft-npc-demo-geometry' }
if (-not (Test-Path -LiteralPath $LibraryRoot)) { throw 'Supply -LibraryRoot pointing to Bukkit/Paper runtime library jars.' }
$jars = (Get-ChildItem -LiteralPath $LibraryRoot -Recurse -Filter '*.jar').FullName -join [System.IO.Path]::PathSeparator
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
& javac --release 17 -encoding UTF-8 -cp $jars -d $OutputDirectory (Join-Path $project 'src/main/java/dev/velmren/npc/DemoWorld.java') (Join-Path $PSScriptRoot 'GeometryProbe.java')
if ($LASTEXITCODE -ne 0) { throw 'Geometry probe compilation failed.' }
& java -cp ($OutputDirectory + [System.IO.Path]::PathSeparator + $jars) GeometryProbe
if ($LASTEXITCODE -ne 0) { throw 'Geometry assertion failed.' }
