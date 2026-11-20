import {Suspense,lazy} from 'react';
const Invitation=lazy(()=>import('./App'));
const Photographer=lazy(()=>import('./PhotographerPage'));
const Entry=lazy(()=>import('./EntryPage'));
export default function Root(){const photographer=/^\/photographe\/?$/.test(window.location.pathname);const entry=/^\/entree\/?$/.test(window.location.pathname);return <Suspense fallback={<p role="status">Ouverture…</p>}>{entry?<Entry/>:photographer?<Photographer/>:<Invitation/>}</Suspense>;}
