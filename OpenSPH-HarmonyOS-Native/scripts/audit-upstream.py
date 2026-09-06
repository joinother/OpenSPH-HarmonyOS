#!/usr/bin/env python3
from pathlib import Path
import subprocess,hashlib,csv,collections,json,sys
if len(sys.argv)!=2: raise SystemExit('Usage: audit-upstream.py UPSTREAM_GIT_REPOSITORY')
src=Path(sys.argv[1])
commit='f3033faf4422a056dcb79cc6643c7c6f3d9fee19'
root=Path(__file__).resolve().parent.parent;dst=root/'third_party/opensph'
entries=subprocess.check_output(['git','-C',str(src),'ls-tree','-rz',commit]).split(b'\0')
rows=[]
for item in entries:
 if not item:continue
 meta,path=item.split(b'\t',1);mode,kind,sha=meta.decode().split();name=path.decode();f=dst/name
 status='not-imported';local=''
 if f.is_file():
  raw=f.read_bytes();local=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest();status='identical' if local==sha else 'modified'
 rows.append([name,sha,local,status])
(root/'docs/evidence').mkdir(parents=True,exist_ok=True)
with (root/'docs/evidence/upstream-file-inventory.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['upstream_path','upstream_git_blob','imported_git_blob','import_status']);w.writerows(rows)
summary={'upstreamCommit':subprocess.check_output(['git','-C',str(src),'rev-parse',commit],text=True).strip(),'files':len(rows),'status':dict(collections.Counter(r[3] for r in rows)),'modules':dict(collections.Counter(r[0].split('/')[0] for r in rows)),'modified':[r[0] for r in rows if r[3]=='modified']}
(root/'docs/evidence/upstream-inventory-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
