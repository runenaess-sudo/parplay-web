// Server delivery helper; contains no credentials or user-facing provider errors.
export type SuggestionMail={id:string;owner_id:string;subject:string;body:string;contact_email:string|null};
export function suggestionEmail(row:SuggestionMail) {
 // Plain text avoids HTML injection; header subject contains no user input.
 return {from:'ParPlay <support@parplay.no>',to:['support@parplay.no'],
  subject:'ParPlay improvement suggestion',
  text:`Suggestion: ${row.id}\nUser: ${row.owner_id}\nContact: ${row.contact_email??'Not available'}\nSource: status_updates\n\n${row.subject}\n\n${row.body}`};
}
export async function sendSuggestion(row:SuggestionMail,key:string,transport:typeof fetch=fetch) {
 try {
  const response=await transport('https://api.resend.com/emails',{method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`status-suggestion-v1/${row.id}`},
   body:JSON.stringify(suggestionEmail(row)),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {state:response.status>=500||response.status===409?'unknown':'failed',provider:null,error:`HTTP_${response.status}`} as const;
  const value:unknown=await response.json();
  if(typeof value==='object'&&value!==null&&'id' in value&&typeof value.id==='string'&&value.id.length>0&&value.id.length<=200)
   return {state:'sent',provider:value.id,error:null} as const;
 } catch { /* Provider may have accepted the request before the connection failed. */ }
 return {state:'unknown',provider:null,error:'OUTCOME_UNKNOWN'} as const;
}
