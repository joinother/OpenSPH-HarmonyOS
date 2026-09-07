#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {openSync,writeFileSync,fsyncSync,closeSync,unlinkSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export function exportTable(table,output){
 if(!table?.ok||!Number.isInteger(table.rows)||table.rows<1||table.rows>480||typeof table.csv!=='string'||!table.csv.startsWith('series,frame,time_year,distance_AU,barycentric_speed_km_s\n')||table.csv.split('\n').length!==table.rows+2)throw Error('No valid observation rows to export');
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
 const table=JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command','getObservationTable'],{encoding:'utf8',timeout:40000}));
 return exportTable(table,output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}catch(e){console.error(String(e));process.exitCode=1;}}
