// Administration is public and does not use authentication cookies. Preview
// proxies can change the request URL, so Origin is not an access requirement.
// Require JSON so ordinary cross-site HTML forms cannot submit game commands.
export async function readGameRequest(request) {
 const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
 if(type!=='application/json')throw Object.assign(new Error('Forespørselen må sendes som JSON.'),{status:415});
 let body;
 try{body=await request.json();}catch{throw Object.assign(new Error('Ugyldig forespørsel.'),{status:400});}
 if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(new Error('Ugyldig forespørsel.'),{status:400});
 return body;
}
