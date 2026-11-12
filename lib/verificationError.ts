export function verificationError(error:unknown): {clearCode:boolean;message:string} {
  const code=typeof error==='object' && error!==null && 'code' in error ? (error as {code?:unknown}).code : undefined;
  if(code==='auth/invalid-verification-code') return {clearCode:true,message:'That code is incorrect. Check your authenticator and try again.'};
  if(code==='auth/code-expired') return {clearCode:true,message:'The code or verification session expired. Try a fresh code; if it still fails, start again.'};
  if(code==='auth/network-request-failed' || code==='auth/timeout') return {clearCode:false,message:'Could not connect to the sign-in service. Check your connection and try again.'};
  if(code==='auth/too-many-requests') return {clearCode:false,message:'Too many attempts. Please wait before trying again.'};
  return {clearCode:false,message:'Could not verify your code right now. Please try again.'};
}
