#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {openSync,writeFileSync,fsyncSync,closeSync,unlinkSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export function exportTable(table,output){
 const units={pressure:'GPa',internal:'MJ/kg',damage:'0–1',kinetic:'J',energy:'J',gravity:'J',relativeKinetic:'J',radius:'km',radial:'m/s'};
 if(!table?.ok||!Number.isInteger(table.rows)||table.rows<1||table.rows>480||units[table.metric]!==table.unit||table.timeUnit!=='s'||table.timeAlignment!=='simulation-start'||typeof table.csv!=='string'||!table.csv.startsWith('series,frame,time_s,value\n')||table.csv.split('\n').length!==table.rows+2)throw Error('No valid SPH comparison rows to export');
 const previous=new Map();
 for(const row of table.csv.trim().split('\n').slice(1)){
  const cells=row.split(','),series=cells[0],numbers=cells.slice(1).map(Number);
  if(cells.length!==4||!['current','reference'].includes(series)||cells.slice(1).some(c=>c.trim()==='')||numbers.some(n=>!Number.isFinite(n))||!Number.isInteger(numbers[0])||numbers[0]<0||numbers[0]>=240||numbers[1]<0)throw Error('Invalid raw SPH sample');
  const last=previous.get(series);if((last&&(numbers[0]!==last[0]+1||numbers[1]<=last[1]))||(!last&&numbers[0]!==0))throw Error('Invalid SPH sample order');previous.set(series,numbers);
 }
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
 const table=JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command','getSphComparisonTable'],{encoding:'utf8',timeout:40000}));
 return exportTable(table,output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}catch(e){console.error(String(e));process.exitCode=1;}}
