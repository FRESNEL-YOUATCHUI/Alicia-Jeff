import {ApiError} from './http.mjs';
export const MAX_PHOTO_BYTES=20*1024*1024;
export const PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
export function string(value, max, {required=false,field='champ',multiline=false}={}) {
  if(typeof value!=='string'||value.length>max)throw new ApiError(400,'invalid_input',`Vérifiez le champ ${field}.`);
  const result=value.normalize('NFC').trim().replace(/\r\n?/g,'\n');
  if((required&&!result)||[...result].some(c=>{const code=c.charCodeAt(0);return (code<32&&![9,10,13].includes(code))||code===127;})||(!multiline&&result.includes('\n')))throw new ApiError(400,'invalid_input',`Vérifiez le champ ${field}.`);
  return result;
}
export function uuid(value,field='identifiant') {if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new ApiError(400,'invalid_id',`Vérifiez le champ ${field}.`);return value.toLowerCase();}
export function clientRef(value){if(typeof value!=='string'||!/^[a-zA-Z0-9-]{32,64}$/.test(value))throw new ApiError(400,'invalid_reference','Veuillez recharger la page et réessayer.');return value;}
export function bool(value,field){if(typeof value!=='boolean')throw new ApiError(400,'invalid_input',`Vérifiez le champ ${field}.`);return value;}
export function offset(value){if(value===null||value===undefined)return 0;if(!/^\d+$/.test(String(value))||Number(value)>100_000)throw new ApiError(400,'invalid_offset','Page non valide.');return Number(value);}
export function rejectUnknown(body,allowed){if(Object.keys(body).some(k=>!allowed.includes(k)))throw new ApiError(400,'unexpected_field','Le formulaire contient un champ non pris en charge.');}
export function rsvpInput(body){
 rejectUnknown(body,['first_name','last_name','participants','song','message','website','client_ref']);
 if(body.website)throw new ApiError(400,'invalid_submission','Le formulaire n’a pas pu être envoyé.');
 if(body.participants!==undefined&&body.participants!==1)throw new ApiError(400,'invalid_participants','La confirmation est individuelle.');
 return {first_name:string(body.first_name,80,{required:true,field:'prénom'}),last_name:string(body.last_name,80,{required:true,field:'nom'}),participants:1,song:string(body.song??'',200,{field:'chanson'}),message:string(body.message??'',2000,{field:'message',multiline:true}),client_ref:clientRef(body.client_ref)};
}
export function messageInput(body){rejectUnknown(body,['author','body','client_ref','website']);if(body.website)throw new ApiError(400,'invalid_submission','Le message n’a pas pu être envoyé.');return{author:string(body.author,80,{required:true,field:'prénom'}),body:string(body.body,2000,{required:true,field:'message',multiline:true}),client_ref:clientRef(body.client_ref)};}
export function uploadInput(body){
 rejectUnknown(body,['album_id','client_ref','filename','content_type','size']);
 const filename=string(body.filename,200,{required:true,field:'nom de fichier'});
 if(!Number.isSafeInteger(body.size)||body.size<1||body.size>MAX_PHOTO_BYTES)throw new ApiError(413,'photo_too_large','Chaque photographie doit peser au maximum 20 Mo.');
 if(!PHOTO_TYPES.has(body.content_type))throw new ApiError(415,'unsupported_photo','Choisissez un fichier JPEG, PNG ou WebP.');
 if(!/\.(jpe?g|png|webp)$/i.test(filename)||(filename.includes('/')||filename.includes('\\')))throw new ApiError(400,'invalid_filename','Choisissez un nom de photographie sans chemin de dossier.');
 return{album_id:uuid(body.album_id,'album'),client_ref:uuid(body.client_ref,'référence de téléversement'),filename,content_type:body.content_type,size:body.size};
}
export function albumPatch(body){rejectUnknown(body,['title','published','hidden']);const patch={};if(body.title!==undefined)patch.title=string(body.title,120,{required:true,field:'titre'});if(body.published!==undefined)patch.published=bool(body.published,'publication');if(body.hidden!==undefined)patch.hidden=bool(body.hidden,'archivage');if(!Object.keys(patch).length)throw new ApiError(400,'empty_patch','Aucune modification demandée.');return patch;}
