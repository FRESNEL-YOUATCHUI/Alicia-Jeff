
import { supabase } from './supabase';

export async function api<T>(
  route: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (typeof options.body === 'string' &&
      !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (route.startsWith('/api/admin/')) {
    const { data, error } =
      await supabase.auth.getSession();

    if (error || !data.session) {
      throw new Error(
        'Veuillez vous connecter à l’espace photographe.'
      );
    }

    headers.set(
      'Authorization',
      `Bearer ${data.session.access_token}`
    );
  }

  let response: Response;

  try {
    response = await fetch(route, {
      ...options,
      credentials: 'same-origin',
      headers,
    });
  } catch {
    throw new Error(
      'La connexion est interrompue. Réessayez.'
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      'Le service est momentanément indisponible.'
    );
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'Votre demande a échoué.';

    throw new Error(message);
  }

  return data as T;
}

export function persistentId(key: string): string {
  try {
    const previous = localStorage.getItem(key);

    if (previous) return previous;

    const value = crypto.randomUUID();
    localStorage.setItem(key, value);

    return value;
  } catch {
    return crypto.randomUUID();
  }
}





// export async function api<T>(route:string, options:RequestInit = {}):Promise<T> {
//   let response:Response;
//   try { response=await fetch(route,{...options,credentials:'same-origin',headers:{...(typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}}); }
//   catch { throw new Error('La connexion est interrompue. Réessayez dans quelques instants.'); }
//   let data;try{data=await response.json();}catch{throw new Error('Le service est momentanément indisponible. Réessayez dans quelques instants.');}
//   if(!response.ok)throw new Error(data.error||'Votre demande n’a pas pu être enregistrée.');
//   return data;
// }
// export function persistentId(key:string):string {
//   try {const previous=localStorage.getItem(key);if(previous)return previous;const value=crypto.randomUUID();localStorage.setItem(key,value);return value;}
//   catch {return crypto.randomUUID();}
// }
