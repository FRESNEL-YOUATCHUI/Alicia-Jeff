export function parseCsv(input){
 const rows=[];let row=[],field='',quoted=false;
 input=input.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('CSV has an unterminated quoted field.');
 if(field||row.length){row.push(field);rows.push(row);}
 const headers=rows.shift();
 if(!headers?.length)throw Error('CSV has no header.');
 return rows.map(values=>{
  if(values.length!==headers.length)throw Error('CSV row does not match its header.');
  return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
 });
}
