export interface RsvpFields {first_name:string;last_name:string;song?:string;message?:string;}
export function isBoundRsvpRef(value:unknown):boolean;
export function canonicalRsvp(input:RsvpFields):RsvpFields & {participants:1;song:string;message:string};
export function createRsvpRef(input:RsvpFields):Promise<string>;
export function matchesRsvpRef(ref:string,input:RsvpFields):Promise<boolean>;
