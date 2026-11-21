import {describe,it,expect} from 'vitest';
import {MetarConsistencyClient} from '../metar-consistency.js';
const result={status:'suspicious',station_id:'KFST',checked_at_utc:'2026-11-20T12:00:00Z',target:{station_id:'KFST',observed_at_epoch:1795176000,category:'VFR',original:{rawOb:'KFST ORIGINAL'}},neighbors:[],flags:[{code:'regional_disagreement',explanation:'Conflicting observations'}],forecast_context:[],qualifying_neighbors:0,ifr_neighbors:0,policy:{},source:{},truncated:false,errors:[],limitations:['Not a sensor diagnosis']};
describe('service METAR consistency client',()=>{
 it('preserves original source and explanatory findings with bounded query',async()=>{
  const calls:unknown[]=[];const client=new MetarConsistencyClient({fetchFn:async(url,options)=>{calls.push([String(url),options]);return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}});
  expect(await client.assess('kfst',{maxNeighbors:3})).toEqual(result);
  expect((calls[0] as any)[0]).toContain('airport=KFST');expect((calls[0] as any)[0]).toContain('max_neighbors=3');expect((calls[0] as any)[1].redirect).toBe('error');
 });
 it('rejects invalid station/radius and malformed or oversized source without empty success',async()=>{
  let calls=0;const client=new MetarConsistencyClient({fetchFn:async()=>{calls++;return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}});
  await expect(client.assess('../X')).rejects.toThrow();await expect(client.assess('KFST',{radiusNm:200})).rejects.toThrow();expect(calls).toBe(0);
  for(const body of [{...result,station_id:'OTHER'}, {...result,status:'validated'}, {...result,neighbors:null}, {...result,target:{...result.target,observed_at_epoch:'unknown'}}, {...result,qualifying_neighbors:7}, {...result,forecast_context:[{period:{},observed_votes:1}]}]){
   await expect(new MetarConsistencyClient({fetchFn:async()=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}})}).assess('KFST')).rejects.toThrow();
  }
  await expect(new MetarConsistencyClient({fetchFn:async()=>new Response(' '.repeat(262145),{headers:{'content-type':'application/json'}})}).assess('KFST')).rejects.toThrow(/large/);
 });
});
