export class ApiError extends Error {
  constructor(status, code, message, headers = {}) { super(message); this.name='ApiError'; this.status=status; this.code=code; this.headers=headers; }
}
export function sendJson(res, status, data, extra = {}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extra});
  res.end(JSON.stringify(data));
}
export function sendError(res, error) {
  if(error instanceof ApiError) return sendJson(res,error.status,{error:error.message,code:error.code},error.headers);
  // Never serialize SDK errors, request bodies, signed URLs, or environment values.
  return sendJson(res,500,{error:'Le service est momentanément indisponible. Réessayez dans un instant.',code:'internal_error'});
}
export async function readJson(req, maxBytes=16_384) {
  const declared=Number(req.headers['content-length']||0);
  if(declared>maxBytes)throw new ApiError(413,'body_too_large','Le formulaire est trop volumineux.');
  const contentType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(contentType!=='application/json')throw new ApiError(415,'json_required','Ce formulaire doit être envoyé au format JSON.');
  let raw;
  if(req.body!==undefined){raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(raw)>maxBytes)throw new ApiError(413,'body_too_large','Le formulaire est trop volumineux.');}
  else{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw new ApiError(413,'body_too_large','Le formulaire est trop volumineux.');chunks.push(chunk);}raw=Buffer.concat(chunks).toString('utf8');}
  try{const result=JSON.parse(raw);if(!result||typeof result!=='object'||Array.isArray(result))throw new Error();return result;}catch{throw new ApiError(400,'invalid_json','Le formulaire est incomplet.');}
}
export function routeFromRequest(req) {
  const url=new URL(req.url,'http://local.invalid');
  const rewritten=req.query?.__wedding_route??url.searchParams.get('__wedding_route');
  let route=rewritten===undefined||rewritten===null?url.pathname:'/api/'+(Array.isArray(rewritten)?rewritten.join('/'):String(rewritten));
  try{route=decodeURIComponent(route);}catch{throw new ApiError(400,'invalid_path','Adresse non valide.');}
  if(route.includes('\\')||route.split('/').some(s=>s==='.'||s==='..')||route.includes('\0'))throw new ApiError(400,'invalid_path','Adresse non valide.');
  return {route:route.replace(/\/$/,''),query:url.searchParams};
}
export function requireMethod(req, methods) {
  if(!methods.includes(req.method))throw new ApiError(405,'method_not_allowed','Méthode non autorisée.',{Allow:methods.join(', ')});
}
export function checkOrigin(req, allowedOrigins=[]) {
  const origin=req.headers.origin;if(!origin)return;
  let parsed;try{parsed=new URL(origin);}catch{throw new ApiError(403,'origin_forbidden','Origine non autorisée.');}
  if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')throw new ApiError(403,'origin_forbidden','Origine non autorisée.');
  if(parsed.host!==req.headers.host&&!allowedOrigins.includes(parsed.origin))throw new ApiError(403,'origin_forbidden','Origine non autorisée.');
}
