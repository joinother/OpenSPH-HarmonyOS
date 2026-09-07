import { fileIo as fs } from '@kit.CoreFileKit';
import { SavedProject, SceneDefinition, ExperimentRecipe, validateScene, validateRecipe } from './SceneModel';

export class ProjectStore {
  static list(directory: string): SavedProject[] {
    const result: SavedProject[]=[];
    const names: string[]=fs.listFileSync(directory);
    for(const name of names) {
      if(!/^project-[0-9]+-[0-9]+\.json$/.test(name)) continue;
      const id: string=name.slice(0,-5);
      // A damaged entry is isolated; valid experiments remain accessible.
      try { result.push(ProjectStore.load(directory,id)); } catch (_) {}
    }
    return result.sort((a: SavedProject,b: SavedProject) => b.savedAt-a.savedAt);
  }
  static load(directory: string, id: string): SavedProject {
    if(!/^project-[0-9]+-[0-9]+$/.test(id)) throw new Error('无效的实验编号');
    const path: string=directory+'/'+id+'.json';
    if(fs.statSync(path).size>32768) throw new Error('实验文件过大');
    const value: SavedProject=JSON.parse(fs.readTextSync(path)) as SavedProject;
    if(!value || value.id!==id || !Number.isFinite(value.savedAt)) throw new Error('实验文件已损坏');
    validateScene(value.scene);
    if(value.recipe!==undefined)validateRecipe(value.recipe,value.scene);
    return value;
  }
  static save(directory: string, scene: SceneDefinition, recipe?:ExperimentRecipe): SavedProject {
    validateScene(scene);
    if(recipe!==undefined)validateRecipe(recipe,scene);
    if(ProjectStore.list(directory).length>=50) throw new Error('最多保存 50 个实验');
    const time: number=Date.now();
    const id: string='project-'+time+'-'+Math.floor(Math.random()*1000000);
    const value: SavedProject={id:id,savedAt:time,scene:scene};
    if(recipe!==undefined)value.recipe=recipe;
    const path: string=directory+'/'+id+'.json';
    const temp: string=path+'.tmp';
    let file: fs.File | undefined=undefined;
    try {
      file=fs.openSync(temp,fs.OpenMode.CREATE|fs.OpenMode.READ_WRITE|fs.OpenMode.TRUNC);
      fs.writeSync(file.fd,JSON.stringify(value));fs.fsyncSync(file.fd);fs.closeSync(file.fd);file=undefined;
      fs.renameSync(temp,path);
      return value;
    } finally { if(file!==undefined) fs.closeSync(file.fd); }
  }
}
