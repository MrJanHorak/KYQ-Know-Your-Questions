import { EmailAuthProvider, getMultiFactorResolver, reauthenticateWithCredential, TotpMultiFactorGenerator, type MultiFactorError, type User } from 'firebase/auth';
import { instructorAuth } from '../../lib/instructorFirebase';

export async function confirmOwnershipIdentity(user:User) {
  const password=window.prompt('Confirm your password to change team ownership:');
  if (!password || !user.email) throw new Error('Password confirmation cancelled.');
  try { await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password)); }
  catch(error) {
    if ((error as {code?:string}).code !== 'auth/multi-factor-auth-required') throw error;
    if (!instructorAuth) throw new Error('Instructor authentication is not configured.');
    const resolver=getMultiFactorResolver(instructorAuth,error as MultiFactorError);
    const factor=resolver.hints.find(hint=>hint.factorId===TotpMultiFactorGenerator.FACTOR_ID);
    if (!factor) throw new Error('No supported authenticator factor is available.');
    const code=window.prompt('Enter the code from your authenticator app:');
    if (!code) throw new Error('Authentication cancelled.');
    await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid,code.trim()));
  }
  await user.getIdToken(true);
}
