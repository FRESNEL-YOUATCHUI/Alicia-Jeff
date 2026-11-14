import {ApiError} from './http.mjs';
import {MAX_PHOTO_BYTES} from './validation.mjs';
export const BUCKET='wedding-photos', SIGNED_TTL=600;
function invalid(){throw new ApiError(415,'invalid_photo','Le contenu de cette photographie n’est pas un JPEG, PNG ou WebP valide.');}
export function inspectImage(head,tail,size,mime){
  let width=0,height=0;
  if(mime==='image/png'){
    if(head.length<33||!head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||head.toString('ascii',12,16)!=='IHDR'||head.readUInt32BE(8)!==13||tail.length<12||tail.toString('ascii',tail.length-8,tail.length-4)!=='IEND')invalid();
    width=head.readUInt32BE(16);height=head.readUInt32BE(20);
  } else if(mime==='image/jpeg'){
    if(head[0]!==255||head[1]!==216||tail[tail.length-2]!==255||tail[tail.length-1]!==217)invalid();
    let at=2;
    while(at+4<=head.length){
      if(head[at++]!==255)invalid();while(head[at]===255)at++;
      const marker=head[at++];if(marker===0xDA||marker===0xD9)break;
      const n=head.readUInt16BE(at);if(n<2)invalid();
      if([0xC0,0xC1,0xC2].includes(marker)){if(at+7>head.length)invalid();height=head.readUInt16BE(at+3);width=head.readUInt16BE(at+5);break;}
      at+=n;
    }
  } else if(mime==='image/webp'){
    if(head.length<30||head.toString('ascii',0,4)!=='RIFF'||head.toString('ascii',8,12)!=='WEBP'||head.readUInt32LE(4)+8!==size)invalid();
    const tag=head.toString('ascii',12,16);
    if(tag==='VP8X'){width=1+head.readUIntLE(24,3);height=1+head.readUIntLE(27,3);}
    else if(tag==='VP8L'){if(head[20]!==0x2f)invalid();const bits=head.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
    else if(tag==='VP8 '){if(head[23]!==0x9d||head[24]!==1||head[25]!==0x2a)invalid();width=head.readUInt16LE(26)&0x3fff;height=head.readUInt16LE(28)&0x3fff;}
    else invalid();
  } else invalid();
  if(!width||!height||width>20000||height>20000||width*height>100_000_000)invalid();
  return {width,height};
}
async function readRange(url,start,end,fetcher){
  const response=await fetcher(url,{headers:{Range:'bytes='+start+'-'+end},redirect:'error',signal:AbortSignal.timeout(10_000)});
  if(!response.ok||!response.body)throw new ApiError(503,'storage_unavailable','La vérification de la photographie a échoué.');
  // Never buffer a full 20 MiB object if the upstream ignores Range.
  const cap=end-start+1,chunks=[];let length=0;
  const reader=response.body.getReader();
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>cap)throw new ApiError(503,'range_required','Le stockage ne permet pas cette vérification partielle.');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  if(length!==cap)invalid();
  if(start>0&&response.status!==206)invalid();
  return Buffer.concat(chunks);
}
export class PhotoStorage {
  constructor(client,fetcher=fetch){this.client=client;this.bucket=client.storage.from(BUCKET);this.fetcher=fetcher;}
  async privateBucket(){
    const {data,error}=await this.client.storage.getBucket(BUCKET);
    if(error||!data||data.public)throw new ApiError(503,'private_storage_required','Le stockage privé des photographies doit être vérifié.');
  }
  async uploadToken(intent){
    await this.privateBucket();
    const {data,error}=await this.bucket.createSignedUploadUrl(intent.storage_path,{upsert:false});
    if(error||!data)throw new ApiError(503,'storage_unavailable','L’import ne peut pas être autorisé pour le moment.');
    return{bucket:BUCKET,path:intent.storage_path,token:data.token};
  }
  async sign(rows,{download=false}={}){
    if(!rows.length)return[];
    await this.privateBucket();
    const {data,error}=await this.bucket.createSignedUrls(rows.map(p=>p.storage_path),SIGNED_TTL,download?{download:true}:undefined);
    if(error||!data||data.some(p=>p.error||!p.signedUrl))throw new ApiError(503,'storage_unavailable','Les photographies sont momentanément indisponibles.');
    return rows.map((p,i)=>{const {storage_path:_storagePath,...safe}=p;return{...safe,url:data[i].signedUrl,expires_at:new Date(Date.now()+SIGNED_TTL*1000).toISOString()};});
  }
  async verify(intent){
    await this.privateBucket();
    const {data,error}=await this.bucket.info(intent.storage_path);
    if(error||!data)throw new ApiError(409,'upload_incomplete','La photographie n’a pas terminé son transfert. Réessayez la finalisation.');
    // SDK versions return camelCase or snake_case metadata.
    const size=Number(data.size??data.metadata?.size),mime=data.contentType??data.content_type??data.metadata?.mimetype;
    if(!Number.isSafeInteger(size)||size<1||size>MAX_PHOTO_BYTES||size!==intent.size||mime!==intent.content_type)throw new ApiError(415,'photo_mismatch','Le fichier transféré ne correspond pas à l’autorisation.');
    const {data:signed,error:signError}=await this.bucket.createSignedUrl(intent.storage_path,60);
    if(signError||!signed)throw new ApiError(503,'storage_unavailable','La vérification de la photographie est indisponible.');
    const [head,tail]=await Promise.all([readRange(signed.signedUrl,0,Math.min(size,131072)-1,this.fetcher),readRange(signed.signedUrl,Math.max(0,size-12),size-1,this.fetcher)]);
    return inspectImage(head,tail,size,mime);
  }
  async remove(paths){if(!paths.length)return;const {error}=await this.bucket.remove(paths);if(error)throw new ApiError(503,'cleanup_pending','Le nettoyage sera repris au prochain passage.');}
}
