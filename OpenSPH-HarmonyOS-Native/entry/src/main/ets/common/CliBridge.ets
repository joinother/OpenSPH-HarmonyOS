import { OrbitBodyConfig } from 'libsimulation.so';
import { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

export interface CommandPayload {
  orientation?:string;
  mode?:number; brightness?:number;
  x?:number; y?:number;
  action?:string; field?:string; value?:string|number;
  orbitBodies?:OrbitBodyConfig[];
  clouds?:boolean; atmosphere?:boolean; trails?:boolean; closeup?:boolean; autoSpin?:boolean;
  targetRadiusKm?: number; impactorRadiusKm?: number; targetDensity?: number; impactorDensity?: number; targetSpin?: number; seed?: number; title?: string; id?: string;
  preset?: number; count?: number; speed?: number; angle?: number; duration?: number;
  yaw?: number; pitch?: number; zoom?: number; focus?: number; color?: number;
  frame?: number; panel?: number;
}
interface Request { id: string; command: string; payload: string; }
type Handler = (command: string, payload: CommandPayload) => Promise<string>;

// A launch request waits for the real page; UI and CLI call the same actions.
export class CliBridge {
  private static handler: Handler | undefined = undefined;
  private static queue: Request[] = [];
  private static busy: boolean = false;
  private static seen: string[] = [];
  static bind(handler: Handler): void { CliBridge.handler = handler; CliBridge.drain(); }
  static unbind(): void { CliBridge.handler = undefined; }
  static receive(want: Want): void {
    const p = want.parameters;
    if (!p || typeof p['sph.command'] !== 'string' || typeof p['sph.request'] !== 'string') return;
    const id: string = p['sph.request'] as string;
    const command: string = p['sph.command'] as string;
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(id) || !/^[a-zA-Z]{1,32}$/.test(command)) return;
    if (CliBridge.seen.includes(id)) return;
    const encoded: string = typeof p['sph.payload'] === 'string' ? p['sph.payload'] as string : '%7B%7D';
    if (encoded.length > 16384 || CliBridge.queue.length >= 16) {
      CliBridge.reply(id, JSON.stringify({ok:false,error:'request too large or queue full'})); return;
    }
    try {
      const payload: string = decodeURIComponent(encoded);
      CliBridge.seen.push(id);
      if (CliBridge.seen.length > 128) CliBridge.seen.shift();
      CliBridge.queue.push({id:id,command:command,payload:payload});
      CliBridge.drain();
    } catch (_) { CliBridge.reply(id, JSON.stringify({ok:false,error:'invalid payload encoding'})); }
  }
  private static reply(id: string, value: string): void {
    const size: number = 500;
    const total: number = Math.ceil(value.length / size);
    for (let index = 0; index < total; index++) {
      hilog.info(0x0001, 'SPHCLI', 'SPHCLI %{public}s %{public}d/%{public}d %{public}s', id, index, total, value.slice(index*size,(index+1)*size));
    }
  }
  private static async drain(): Promise<void> {
    if (CliBridge.busy || !CliBridge.handler) return;
    CliBridge.busy = true;
    while (CliBridge.queue.length > 0 && CliBridge.handler) {
      const r: Request = CliBridge.queue.shift()!;
      try {
        const parsed: CommandPayload = JSON.parse(r.payload) as CommandPayload;
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload must be an object');
        CliBridge.reply(r.id, await CliBridge.handler(r.command, parsed));
      } catch (error) { CliBridge.reply(r.id, JSON.stringify({ok:false,error:String(error)})); }
    }
    CliBridge.busy = false;
  }
}
