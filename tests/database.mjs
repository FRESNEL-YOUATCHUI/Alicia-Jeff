import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
export const ALBUM='10000000-0000-4000-8000-000000000001',STAFF='20000000-0000-4000-8000-000000000001';
export async function database(){
 const pg=new PGlite();
 await pg.exec(await fs.readFile(new URL('./schema-fixture.sql',import.meta.url),'utf8'));
 const sql=await fs.readFile(new URL('../supabase/migrations/001_serverless.sql',import.meta.url),'utf8');
 await pg.exec(sql);
 const access=await fs.readFile(new URL('../supabase/migrations/002_api_only_access.sql',import.meta.url),'utf8');
 await pg.exec(access);await pg.exec(access);
 await pg.exec(await fs.readFile(new URL('../supabase/migrations/004_ticket_entry.sql',import.meta.url),'utf8'));
 return {pg,sql};
}
export function clientFor(pg){
 return {
  auth:{getUser:async token=>token==='valid'?{data:{user:{id:STAFF}},error:null}:token==='no-role'?{data:{user:{id:'20000000-0000-4000-8000-000000000002'}},error:null}:{data:{user:null},error:{status:401}}},
  from(table){
   if(table!=='wedding_staff')throw Error('Unexpected table');
   return {
    select(){
     return {
      eq(_column,id){
       return {
        async maybeSingle(){
         try{return{data:(await pg.query('select role from public.wedding_staff where user_id=$1',[id])).rows[0]??null,error:null};}
         catch(error){return{data:null,error};}
        }
       };
      }
     };
    }
   };
  },
  async rpc(name,args={}){
   if(!/^wedding_api_[a-z_]+$/.test(name))throw Error('Invalid RPC');
   const entries=Object.entries(args);
   try{
    const {rows}=await pg.query('select public.'+name+'('+entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')+') as result',entries.map(([,v])=>v));
    return{data:rows[0].result,error:null};
   }catch(error){return{data:null,error:{code:error.code}};}
  }
 };
}
