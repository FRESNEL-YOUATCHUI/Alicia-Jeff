import {createHash,createHmac,randomBytes} from 'node:crypto';
import {ApiError} from './http.mjs';
import {isBoundRsvpRef,matchesRsvpRef} from '../shared/rsvp-reference.mjs';
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
      if(['PGRST202','PGRST205','42883','42P01','42703'].includes(error.code)){const failure=new ApiError(503,'schema_required','Le service attend la validation de son schéma de données.');failure.missingTicketActivation=name==='confirm'&&error.code==='PGRST202';throw failure;}
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
  async rsvp(input){
    const {client_ref,...fields}=input,p_input={...fields,ref_hash:hashRef(client_ref)};
    // Bind modern references to the entire payload BEFORE any read/write. Different
    // payloads cannot race through the historical SQL upsert under the same hash.
    if(isBoundRsvpRef(client_ref)&&!await matchesRsvpRef(client_ref,fields))throw new ApiError(409,'rsvp_reference_mismatch','Cette référence appartient à une autre confirmation. Choisissez « Confirmer pour une autre personne ».');
    const existing=await this.findRsvp('ref_hash',p_input.ref_hash);
    if(existing){
      if(existing.first_name!==fields.first_name||existing.last_name!==fields.last_name)throw new ApiError(409,'rsvp_reference_mismatch','Cette référence appartient à une autre personne. Récupérez son billet ou commencez une nouvelle confirmation.');
      return {...await this.restoreTicket(client_ref),message_published:false};
    }
    // Old browser-wide references remain recoverable, but must never create or
    // overwrite another guest. New confirmations use payload-bound references.
    if(!isBoundRsvpRef(client_ref))throw new ApiError(409,'fresh_confirmation_required','Rechargez le site pour commencer une nouvelle confirmation individuelle.');
    try{return await this.rpc('confirm',{p_input,p_token:randomBytes(32).toString('base64url')});}
    catch(error){
      if(!(error instanceof ApiError)||!error.missingTicketActivation)throw error;
      // Explicit pre-activation compatibility; never simulates an entry authorization.
      return {...await this.rpc('rsvp',{p_input}),entry_verification_ready:false};
    }
  }
  async findRsvp(column,value){
    const {data,error}=await this.client.from('wedding_rsvps').select('ref_hash,first_name,last_name').eq(column,value).maybeSingle();
    if(error)throw new ApiError(503,'database_unavailable','Les données sont momentanément indisponibles.');
    return data;
  }
  async restoreByToken(token){
    const entryToken=/^[0-9a-f-]{36}$/i.test(token)?await this.resolveLegacyTicket(token):token;
    const guest=entryToken?await this.lookupTicket(entryToken):null;
    const row=guest?await this.findRsvp('id',guest.rsvp_id):null;
    if(!row)throw new ApiError(404,'not_found','Ce code ne correspond à aucun billet.');
    return this.rpc('ticket_restore',{p_ref_hash:row.ref_hash,p_token:entryToken});
  }
  restoreTicket(ref){return this.rpc('ticket_restore',{p_ref_hash:hashRef(ref),p_token:randomBytes(32).toString('base64url')});}
  async resolveLegacyTicket(id){
    const {data,error}=await this.client.from('wedding_rsvps').select('ref_hash').eq('id',id.toLowerCase()).maybeSingle();
    if(error)throw new ApiError(503,'database_unavailable','Les données sont momentanément indisponibles.');
    if(!data)return null;
    try{
      const restored=await this.rpc('ticket_restore',{p_ref_hash:data.ref_hash,p_token:randomBytes(32).toString('base64url')});
      return restored.ticket.qr_token;
    }catch(error){if(error instanceof ApiError&&error.status===404)return null;throw error;}
  }
  lookupTicket(token){return this.rpc('ticket_lookup',{p_token:token});}
  enterTicket(token,version,name){return this.rpc('ticket_enter',{p_token:token,p_expected_updated_at:version,p_name_hash:hashRef(name)});}
  message(input){const {client_ref,...fields}=input;return this.rpc('message',{p_input:{...fields,ref_hash:hashRef(client_ref)}});}
  publicState(){return this.rpc('public_state');}
  messages(page){return this.rpc('messages',{p_offset:page});}
  publicPhotos(album,page){return this.rpc('public_photos',{p_album:album,p_offset:page});}
  publicPhoto(id){return this.rpc('public_photo',{p_id:id});}
  adminState(){return this.rpc('admin_state');}
  adminPhotos(album,page){return this.rpc('admin_photos',{p_album:album,p_offset:page});}
  adminMessages(page){return this.rpc('admin_messages',{p_offset:page});}
  mutate(kind,id,patch,staff){return this.rpc('mutate',{p_kind:kind,p_id:id,p_patch:patch,p_staff:staff.id});}
  async draftUploadsReady(){try{return await this.rpc('upload_draft_ready')===true;}catch(error){if(error instanceof ApiError&&error.code==='schema_required')return false;throw error;}}
  async reserve(input,staff){
    if(!await this.draftUploadsReady())throw new ApiError(503,'draft_uploads_required','L’import sécurisé attend l’activation des brouillons.');
    return this.rpc('upload_reserve',{p_input:input,p_staff:staff.id});}
  claim(id,staff){return this.rpc('upload_claim',{p_id:id,p_staff:staff.id});}
  complete(id,nonce,staff){return this.rpc('upload_complete_draft',{p_id:id,p_nonce:nonce,p_staff:staff.id});}
  release(id,nonce,staff){return this.rpc('upload_release',{p_id:id,p_nonce:nonce,p_staff:staff.id});}
  cancel(id,staff){return this.rpc('upload_cancel',{p_id:id,p_staff:staff.id});}
  cleanup(){return this.rpc('cleanup_claim');}
  cleaned(ids){return this.rpc('cleanup_done',{p_ids:ids});}
}
