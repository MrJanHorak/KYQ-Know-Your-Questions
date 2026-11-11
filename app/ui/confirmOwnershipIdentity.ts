import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth';

export async function confirmOwnershipIdentity(user:User) {
  const password=window.prompt('Confirm your password to change team ownership:');
  if (!password || !user.email) throw new Error('Password confirmation cancelled.');
  await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
  await user.getIdToken(true);
}
