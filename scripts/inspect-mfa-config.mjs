// Read-only inspection; uses Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId=process.argv[2];
if (!projectId) throw new Error('Usage: node scripts/inspect-mfa-config.mjs PROJECT_ID');
const app=initializeApp({projectId,credential:applicationDefault()});
try {
  const config=await getAuth(app).projectConfigManager().getProjectConfig();
  const mfa=config.multiFactorConfig;
  console.log(JSON.stringify({projectId,mfaState:mfa?.state ?? 'not configured',providers:(mfa?.providerConfigs || []).map(provider=>({state:provider.state,totp:!!provider.totpProviderConfig}))},null,2));
} catch(error) {
  console.error('Could not read MFA project configuration:',error.code || error.message);
  process.exitCode=1;
}
