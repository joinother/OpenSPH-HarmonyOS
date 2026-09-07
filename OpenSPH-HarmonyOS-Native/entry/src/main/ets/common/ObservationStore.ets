import { fileIo as fs } from '@kit.CoreFileKit';
import { ObservationReference, copyReference, validateReference } from './ObservationComparison';
const FILE='observation-reference.json';
const LIMIT=131072;
export class ObservationStore {
  static load(directory:string):ObservationReference|undefined {
    const path=directory+'/'+FILE;if(!fs.accessSync(path))return undefined;
    if(fs.statSync(path).size>LIMIT)throw new Error('对照文件过大');
    const value=JSON.parse(fs.readTextSync(path)) as ObservationReference;validateReference(value);return value;
  }
  static save(directory:string,value:ObservationReference):ObservationReference {
    const copy=copyReference(value),text=JSON.stringify(copy),path=directory+'/'+FILE,temp=path+'.tmp';
    // JSON can contain multibyte names. Verify the complete text before replacement.
    if(text.length>LIMIT)throw new Error('对照文件过大');
    let file:fs.File|undefined=undefined;
    try {
      file=fs.openSync(temp,fs.OpenMode.CREATE|fs.OpenMode.READ_WRITE|fs.OpenMode.TRUNC);
      fs.writeSync(file.fd,text);fs.fsyncSync(file.fd);fs.closeSync(file.fd);file=undefined;
      if(fs.statSync(temp).size>LIMIT||fs.readTextSync(temp)!==text)throw new Error('对照写入不完整，请重试');
      fs.renameSync(temp,path);return copy;
    }finally{
      try{if(file!==undefined)fs.closeSync(file.fd);}finally{try{if(fs.accessSync(temp))fs.unlinkSync(temp);}catch(_) {}}
    }
  }
  static clear(directory:string):void {const path=directory+'/'+FILE;if(fs.accessSync(path))fs.unlinkSync(path);}
}
