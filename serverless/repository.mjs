import {createHash,createHmac} from 'node:crypto';
import {ApiError} from './http.mjs';
export const hashRef=value=>createHash('sha256').update(value).digest('hex');
export class Repository {
  constructor(client){this.client=client;}
  async rpc(name,args={}) {
    const {data,error}=await this.client.rpc('wedding_api_'+name,args);
    if(error){
      const codes={AJ404:[404,'not_found','Cet élément n’existe plus.'],AJ409:[409,'conflict','Cette opération est déjà en cours ou sa référence a changé.'],AJ410:[410,'expired','Cette autorisation a expiré. Recommencez l’import.'],AJ429:[429,'rate_limited','Trop de demandes. Réessayez dans quelques instants.'],AJ400:[400,'invalid_input','Les informations envoyées ne sont pas valides.']};
      const known=codes[error.code];
      if(known)throw new ApiError(...known,known[0]===429?{'Retry-After':'60'}:{});
      // Schema/cache errors remain actionable without exposing SQL or private SDK details.
      if(['PGRST202','PGRST205','42883','42P01','42703'].includes(error.code))throw new ApiError(503,'schema_required','Le service attend la validation de son schéma de données.');
      throw new ApiError(503,'database_unavailable','Les données sont momentanément indisponibles.');
    }
    return data;
  }
  async rate(req,scope,limit,seconds,secret) {
    // Vercel's trusted client-IP header cannot be supplied through request JSON.
    const ip=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown';
    const key=createHmac('sha256',secret).update(scope+':'+String(ip).split(',')[0].trim()).digest('hex');
    await this.rpc('rate',{p_key:key,p_limit:limit,p_seconds:seconds});
  }
  rsvp(input){const {client_ref,...fields}=input;return this.rpc('rsvp',{p_input:{...fields,ref_hash:hashRef(client_ref)}});}
  message(input){const {client_ref,...fields}=input;return this.rpc('message',{p_input:{...fields,ref_hash:hashRef(client_ref)}});}
  publicState(){return this.rpc('public_state');}
  messages(page){return this.rpc('messages',{p_offset:page});}
  publicPhotos(album,page){return this.rpc('public_photos',{p_album:album,p_offset:page});}
  publicPhoto(id){return this.rpc('public_photo',{p_id:id});}
  adminState(){return this.rpc('admin_state');}
  adminPhotos(album,page){return this.rpc('admin_photos',{p_album:album,p_offset:page});}
  adminMessages(page){return this.rpc('admin_messages',{p_offset:page});}
  mutate(kind,id,patch,staff){return this.rpc('mutate',{p_kind:kind,p_id:id,p_patch:patch,p_staff:staff.id});}
  reserve(input,staff){return this.rpc('upload_reserve',{p_input:input,p_staff:staff.id});}
  claim(id,staff){return this.rpc('upload_claim',{p_id:id,p_staff:staff.id});}
  complete(id,nonce,staff){return this.rpc('upload_complete',{p_id:id,p_nonce:nonce,p_staff:staff.id});}
  release(id,nonce,staff){return this.rpc('upload_release',{p_id:id,p_nonce:nonce,p_staff:staff.id});}
  cancel(id,staff){return this.rpc('upload_cancel',{p_id:id,p_staff:staff.id});}
  cleanup(){return this.rpc('cleanup_claim');}
  cleaned(ids){return this.rpc('cleanup_done',{p_ids:ids});}
}
