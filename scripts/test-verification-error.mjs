// Node 22.6+: node --experimental-strip-types scripts/test-verification-error.mjs
import assert from 'node:assert/strict';
import { verificationError } from '../lib/verificationError.ts';

for (const code of ['auth/invalid-verification-code','auth/code-expired']) {
  assert.equal(verificationError({code}).clearCode,true,`${code} should clear the code`);
}
for (const code of ['auth/network-request-failed','auth/timeout','auth/too-many-requests','auth/internal-error']) {
  assert.equal(verificationError({code}).clearCode,false,`${code} should preserve the code`);
}
assert.match(verificationError({code:'auth/network-request-failed'}).message,/connect/i);
assert.equal(verificationError(null).clearCode,false);
console.log('Authenticator verification error handling passed.');
