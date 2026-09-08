// Product completion is distinct from successfully collecting a known limitation.
export const steps=['placement','contact','materialEvolution','continuousView','worldEvolution','commitRemnants','addAfterImpact','restartAndContinue'];
export function score(checks){
 const byId=new Map(checks.map(c=>[c.id,c]));
 if(byId.size!==checks.length)throw Error('Duplicate acceptance step');
 for(const c of checks)if(!steps.includes(c.id)||!['passed','unsupported','not_tested','failed'].includes(c.status)||!c.evidence)throw Error('Invalid acceptance evidence');
 const rows=steps.map(id=>byId.get(id)??{id,status:'not_tested',evidence:'No observation recorded'});
 return {workflowComplete:rows.every(c=>c.status==='passed'),firstBlocker:rows.find(c=>c.status!=='passed')?.id??null,checks:rows};
}
export function compareRuns(a,b){
 if(!a.collectionComplete||!b.collectionComplete)throw Error('Incomplete collection');
 if(a.fixtureSha256!==b.fixtureSha256)throw Error('Changed fixture');
 return a.cases.length===b.cases.length&&a.cases.every((c,i)=>c.id===b.cases[i].id&&JSON.stringify(c.checks.map(x=>[x.id,x.status]))===JSON.stringify(b.cases[i].checks.map(x=>[x.id,x.status])));
}
