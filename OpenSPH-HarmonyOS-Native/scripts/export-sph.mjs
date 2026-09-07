#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {openSync,writeFileSync,fsyncSync,closeSync,unlinkSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export function exportTable(table,output){
 const base='frame,time_s,pressure_min_GPa,pressure_max_GPa,pressure_mean_GPa,internal_min_MJkg,internal_max_MJkg,internal_mean_MJkg,damage_mean,damage_max,kinetic_J,internal_J';
 const extended=base+',gravity_J,relative_kinetic_J,rms_radius_km,radial_velocity_ms';
 if(!table?.ok||!Number.isInteger(table.rows)||table.rows<1||table.rows>240||typeof table.csv!=='string')throw Error('No valid observation rows to export');
 const lines=table.csv.split('\n'),columns=lines[0]===base?12:(lines[0]===extended?16:0);
 if(!columns||lines.length!==table.rows+2||lines.at(-1)!=='')throw Error('Invalid SPH table schema');
 for(let i=1;i<=table.rows;i++){const cells=lines[i].split(',');if(cells.length!==columns||cells.some(v=>v.trim()===''||!Number.isFinite(Number(v)))||Number(cells[0])!==i-1)throw Error('Invalid SPH table row');}
 if(!/\.csv$/i.test(output))throw Error('Output must end in .csv');
 const csv=resolve(output),metadata=csv.replace(/\.csv$/i,'.metadata.json'),created=[];
 const {csv:rows,...provenance}=table;mkdirSync(dirname(csv),{recursive:true});
 try{
  for(const [file,content]of [[csv,rows],[metadata,JSON.stringify(provenance,null,2)+'\n']]){
   const fd=openSync(file,'wx');created.push(file);try{writeFileSync(fd,content,'utf8');fsyncSync(fd);}finally{closeSync(fd);}
  }
 }catch(e){for(const file of created)unlinkSync(file);throw e;}
 return {ok:true,rows:table.rows,csv,metadata};
}
export function main(args){
 let device,output;
 for(let i=0;i<args.length;i+=2){if(!args[i+1])throw Error('Missing flag value');if(args[i]==='--device'&&!device)device=args[i+1];else if(args[i]==='--output'&&!output)output=args[i+1];else throw Error('Expected --device DEVICE --output FILE.csv');}
 if(!device||!output)throw Error('Explicit --device and --output required');
 const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
 const table=JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command','getSphTable'],{encoding:'utf8',timeout:40000}));
 return exportTable(table,output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}catch(e){console.error(String(e));process.exitCode=1;}}
