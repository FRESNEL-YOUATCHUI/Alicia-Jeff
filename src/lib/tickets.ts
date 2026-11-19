import QRCode from 'qrcode';
import type {Ticket} from './types';
export function ticketQrValue(ticket:Ticket,origin=import.meta.env?.VITE_PUBLIC_SITE_URL||'https://alicia-jeff.vercel.app'){
  const modern=/^[A-Za-z0-9_-]{43}$/.test(ticket.qr_token);
  const legacy=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(ticket.qr_token);
  if(!modern&&!legacy)throw new Error('Le billet doit être récupéré à nouveau.');
  // Every newly downloaded card is a real link, including an existing confirmation.
  const base=new URL(origin);
  if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new Error('Utilisez une adresse sécurisée pour le billet.');
  const url=new URL('/api/tickets/open',base.origin);url.searchParams.set('token',ticket.qr_token);return url.href;
}

export async function ticketImage(ticket:Ticket):Promise<string> {
  const image=new Image();image.src='/wedding/invitation.png';await image.decode();
  const width=1800,cardHeight=Math.round(width*image.naturalHeight/image.naturalWidth),footerHeight=390;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=cardHeight+footerHeight;
  const c=canvas.getContext('2d');if(!c)throw new Error('Le billet ne peut pas être généré sur cet appareil.');
  c.fillStyle='#fffdfa';c.fillRect(0,0,width,canvas.height);
  // Fit the complete original card using its actual aspect ratio, without cropping.
  c.drawImage(image,0,0,width,cardHeight);
  c.strokeStyle='#da9a83';c.lineWidth=2;c.strokeRect(16,cardHeight+14,width-32,footerHeight-30);
  c.fillStyle='#58654d';c.font='22px Arial';c.fillText('VOTRE INVITATION PERSONNELLE',60,cardHeight+65);
  c.fillStyle='#393e34';
  const maxWidth=1320;let font=44;c.font=`${font}px Georgia`;
  while(c.measureText(ticket.guest_full_name).width>maxWidth && font>25){font--;c.font=`${font}px Georgia`;}
  const words=ticket.guest_full_name.split(/\s+/);let line='';const lines:string[]=[];
  for(const word of words){if(line && c.measureText(line+' '+word).width>maxWidth){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
  if(line)lines.push(line);
  // One exceptionally long word is scaled to the available width rather than cut.
  lines.slice(0,2).forEach((value,i)=>c.fillText(value,60,cardHeight+124+i*42,maxWidth));
  c.fillStyle='#393e34';c.font='26px Arial';c.fillText('Invitation individuelle · Vendredi 18 décembre 2026',60,cardHeight+215);
  c.fillStyle='#9e5e4e';c.font='24px Arial';c.fillText(`Invitation ${ticket.ticket_number}`,60,cardHeight+265);
  c.fillStyle='#737868';c.font='21px Arial';c.fillText('15 h · Ambassade du Cameroun au Sénégal   |   19 h · Fun Time, Bourguiba',60,cardHeight+314);
  c.font='20px Arial';c.fillText('Votre présence nous fera un immense plaisir.',60,cardHeight+351);
  const qr=new Image();qr.src=await QRCode.toDataURL(ticketQrValue(ticket),{width:260,margin:3,errorCorrectionLevel:'M'});await qr.decode();c.drawImage(qr,width-320,cardHeight+60,260,260);
  c.font='18px Arial';c.fillText('Scanner ou cliquer sur le QR',width-330,cardHeight+350);
  return canvas.toDataURL('image/png');
}
export async function downloadTicket(ticket:Ticket,format:'png'|'pdf') {
  const data=await ticketImage(ticket);
  if(format==='pdf'){
    const {jsPDF}=await import('jspdf');
    const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'landscape',compress:true});
    const properties=pdf.getImageProperties(data),pageWidth=pdf.internal.pageSize.getWidth(),pageHeight=pdf.internal.pageSize.getHeight(),margin=8;
    const scale=Math.min((pageWidth-2*margin)/properties.width,(pageHeight-2*margin)/properties.height);
    const width=properties.width*scale,height=properties.height*scale;
    pdf.addImage(data,'PNG',(pageWidth-width)/2,(pageHeight-height)/2,width,height,undefined,'FAST');
    pdf.link((pageWidth-width)/2+(properties.width-320)*scale,
      (pageHeight-height)/2+(properties.height-390+60)*scale,260*scale,260*scale,
      {url:ticketQrValue(ticket)});
    await pdf.save(`Invitation-${ticket.ticket_number}.pdf`,{returnPromise:true});
  }else{
    const blob=await(await fetch(data)).blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`Invitation-${ticket.ticket_number}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);
  }
}
