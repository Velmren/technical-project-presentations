"""Package authored sources, reproducible demo, and the local landing. No Minecraft binaries."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil, json, hashlib, sys
root=Path(__file__).resolve().parent.parent
output=Path(sys.argv[1]).resolve()
output.mkdir(parents=True,exist_ok=True)
downloads=root/'web/downloads';downloads.mkdir(exist_ok=True)
jar=root/'build/minecraft-npc-system-1.0.0.jar'
shutil.copy2(jar,downloads/'minecraft-npc-system.jar')
for name in ['README.md','SCENARIOS.md','COMPATIBILITY.md']:
    shutil.copy2(root/name,downloads/name)
def archive(path,files):
    with ZipFile(path,'w',ZIP_DEFLATED,compresslevel=6) as z:
        for source,name in sorted(files,key=lambda x:x[1]):z.write(source,name)
source_files=[]
for folder in ['src','docs','scripts','verification','demo','web']:
    for f in (root/folder).rglob('*'):
        if not f.is_file():continue
        relative=f.relative_to(root)
        if any(p in {'compile-check','downloads','node_modules','__pycache__'} for p in relative.parts):continue
        if f.suffix in {'.class','.jar','.log','.zip'}:continue
        source_files.append((f,str(relative).replace('\\','/')))
for name in ['pom.xml','.gitignore','README.md','SCENARIOS.md','COMPATIBILITY.md']:
    source_files.append((root/name,name))
archive(downloads/'source.zip',source_files)
world=root/'.runtime/spigot/npc_demo'
if not (world/'level.dat').exists():raise RuntimeError('A stopped, rebuilt actual demo world is required')
world_files=[(f,'npc_demo/'+str(f.relative_to(world)).replace('\\','/')) for f in world.rglob('*') if f.is_file() and f.name!='session.lock' and not any(p in {'playerdata','stats','advancements'} for p in f.relative_to(world).parts)]
archive(downloads/'world.zip',world_files)
demo_files=[(jar,'minecraft-npc-system.jar'),(downloads/'world.zip','world.zip')]
for f in (root/'src/main/resources').glob('*.yml'):
    if f.name!='plugin.yml':demo_files.append((f,'plugins/MinecraftNPCSystem/'+f.name))
for name in ['README.md','SCENARIOS.md','COMPATIBILITY.md']:demo_files.append((root/name,name))
for f in (root/'demo').rglob('*'):
    if f.is_file() and 'compile-check' not in f.parts and f.suffix!='.class':demo_files.append((f,'demo/'+str(f.relative_to(root/'demo')).replace('\\','/')))
demo_files.append((root/'docs/DEMO-WORLD.md','docs/DEMO-WORLD.md'))
archive(downloads/'demo-kit.zip',demo_files)
for f in downloads.iterdir():
    if f.is_file():shutil.copy2(f,output/f.name)
shutil.copytree(root/'web',output/'landing',dirs_exist_ok=True)
archive(output/'landing.zip',[(f,str(f.relative_to(root/'web')).replace('\\','/')) for f in (root/'web').rglob('*') if f.is_file()])
shutil.copytree(root/'build/verification',output/'verification',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.log','network-client-log.json'))
checksums={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in output.iterdir() if f.is_file() and f.name!='SHA256.json'}
(output/'SHA256.json').write_text(json.dumps(checksums,indent=2)+'\n',encoding='utf8')
print(json.dumps({'output':str(output),'files':list(checksums),'jar_sha256':checksums['minecraft-npc-system.jar']},indent=2))
