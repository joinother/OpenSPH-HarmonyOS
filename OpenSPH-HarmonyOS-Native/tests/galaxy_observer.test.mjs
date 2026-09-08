import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
test('native galaxy observer keeps tracer identity across time, validates sky geometry and scene boundaries',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),temp=mkdtempSync(tmpdir()+'/galaxy-observer-');
 try{execFileSync('clang++',['-std=c++17','-O2','-I',root+'entry/src/main/cpp',root+'tests/galaxy_observer_test.cpp','-o',temp+'/test']);execFileSync(temp+'/test');}finally{rmSync(temp,{recursive:true,force:true});}
});
