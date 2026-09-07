import {test} from 'node:test';import assert from 'node:assert/strict';
import {waitForSimulation} from '../scripts/opensph-cli.mjs';
const state=(phase,id=4)=>({ok:true,simulation:{state:phase,error:'failed detail',preparation:{requestId:id,stage:'target',stageMs:16000,slow:true}}});
async function run(states,target='paused'){
 let now=0,calls=0;const result=await waitForSimulation({timeout:300,'wait-state':target},state('preparing'),{now:()=>now,delay:async ms=>{now+=ms;},request:async()=>{calls++;const value=states.shift();if(value instanceof Error)throw value;return value??state('preparing');}});return {result,calls};
}
test('CLI timeout retains the last preparation evidence and transport failure retains the prior state',async()=>{
 const {result,calls}=await run([]);assert.equal(result.ok,false);assert.match(result.error,/Timed out/);assert.equal(result.preparation.requestId,4);assert.equal(result.state.simulation.state,'preparing');assert.equal(calls,2);
 const lost=await run([state('preparing'),Error('bridge lost')]);assert.equal(lost.result.preparation.stage,'target');assert.match(lost.result.error,/bridge lost/);
});
test('CLI never accepts another experiment completion; cancellation and failures stop waiting',async()=>{
 assert.match((await run([state('paused',5)])).result.error,/replaced/);
 assert.match((await run([state('cancelled')])).result.error,/cancelled/);
 assert.equal((await run([state('failed')])).result.error,'failed detail');
 assert.equal((await run([state('preparing'),state('paused')])).result.ok,true);
 assert.equal((await run([state('cancelled')],'cancelled')).result.ok,true);
});

test('lightweight preparation query also correlates the wait and survives a failed first poll',async()=>{
 const initial={ok:true,state:'preparing',preparation:{requestId:4,stage:'target'}};
 const options={timeout:300,'wait-state':'paused'};
 const replaced=await waitForSimulation(options,initial,{now:()=>0,delay:async()=>{},request:async()=>state('paused',5)});
 assert.match(replaced.error,/replaced/);
 const lost=await waitForSimulation(options,initial,{now:()=>0,delay:async()=>{},request:async()=>{throw Error('bridge lost');}});
 assert.equal(lost.preparation.requestId,4);assert.equal(lost.state,initial);
});
