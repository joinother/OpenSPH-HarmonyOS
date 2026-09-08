import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
test('responsive galaxy conserves the closed system, exchanges forces, refines steps and validates parameter corners',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),temp=mkdtempSync(tmpdir()+'/galaxy-response-');
 try{execFileSync('clang++',['-std=c++17','-O2','-I',root+'entry/src/main/cpp',root+'tests/galaxy_response_test.cpp','-o',temp+'/test']);execFileSync(temp+'/test',{timeout:120000});}finally{rmSync(temp,{recursive:true,force:true});}
});
