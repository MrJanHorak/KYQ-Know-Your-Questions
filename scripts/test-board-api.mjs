import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, deleteUser } from 'firebase/auth';
const vars=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const base='http://127.0.0.1:3197';
const app=initializeApp({apiKey:vars.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:vars.NEXT_PUBLIC_FIREBASE_APP_ID});
const auth=getAuth(app);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3197'],{env:{...process.env,PORT:'3197'},stdio:'inherit'});
try {
  let ready=false; for(let i=0;i<80;i++){try {await fetch(base);ready=true;break;} catch {await new Promise(r=>setTimeout(r,250));}} assert(ready,'Server did not start');
  const post=(path,body,cookie='')=>fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  assert.equal((await fetch(`${base}/api/boards`)).status,401);
  const login=await post('/api/admin',{password:vars.ADMIN_PASSWORD}); assert.equal(login.status,200,'Admin login failed'); const cookie=login.headers.get('set-cookie').split(';')[0];
  const created=await post('/api/boards',{name:'API test board',password:'test-passphrase-42'},cookie); assert.equal(created.status,200,'Board creation failed'); const {id}=await created.json();
  const user=(await signInAnonymously(auth)).user; const idToken=await user.getIdToken();
  assert.equal((await post('/api/boards/access',{boardId:id,password:'incorrect',idToken})).status,401);
  const access=await post('/api/boards/access',{boardId:id,password:'test-passphrase-42',idToken}); assert.equal(access.status,200,'Board access failed'); const token=(await access.json()).token;
  await signInWithCustomToken(auth,token); assert.equal((await auth.currentUser.getIdTokenResult()).claims.boardId,id);
  const patch=(body,cookie='')=>fetch(`${base}/api/boards/password`,{method:'PATCH',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  assert.equal((await patch({boardId:id,password:'new-test-passphrase'})).status,401,'Password change must require admin');
  assert.equal((await patch({boardId:id,password:'short'},cookie)).status,400,'Short password must be rejected');
  assert.equal((await patch({boardId:id,password:'new-test-passphrase'},cookie)).status,200,'Password change failed');
  assert.equal((await post('/api/boards/access',{boardId:id,password:'test-passphrase-42',idToken})).status,401,'Old password must stop working');
  const changedAccess=await post('/api/boards/access',{boardId:id,password:'new-test-passphrase',idToken}); assert.equal(changedAccess.status,200,'New password must work');
  await signInWithCustomToken(auth,(await changedAccess.json()).token); assert.equal((await auth.currentUser.getIdTokenResult()).claims.accessVersion,1,'New token should include updated access version');
  const root=`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const seed=await fetch(`${root}/boards/${id}/questions/test`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{question:{stringValue:'Test question'},authorName:{stringValue:'Tester'},status:{stringValue:'unanswered'},upvoteCount:{integerValue:'1'},createdAt:{timestampValue:'2026-01-01T00:00:00Z'},replies:{arrayValue:{values:[{mapValue:{fields:{author:{stringValue:'Teacher'},text:{stringValue:'Test response'},createdAt:{stringValue:'2026-01-01T00:00:00Z'}}}}]}}}})}); assert(seed.ok);
  assert.equal((await fetch(`${base}/api/boards/export?boardId=${id}&format=json`)).status,401);
  for(const format of ['json','md']) {const response=await fetch(`${base}/api/boards/export?boardId=${id}&format=${format}`,{headers:{cookie}});assert.equal(response.status,200); const content=await response.text();assert(content.includes('Test question') && content.includes('Test response'),`${format} export missing content`);}
  const nested=await fetch(`${root}/boards/${id}/questions/test/notes/test`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{text:{stringValue:'Nested test'}}})}); assert(nested.ok);
  assert.equal((await fetch(`${base}/api/boards/${id}`,{method:'DELETE'})).status,401,'Board deletion must require admin');
  assert.equal((await fetch(`${base}/api/boards/${id}`,{method:'DELETE',headers:{cookie}})).status,200,'Admin board deletion failed');
  for (const path of [`boards/${id}`,`boards/${id}/questions/test`,`boards/${id}/questions/test/notes/test`]) assert.equal((await fetch(`${root}/${path}`,{headers:{Authorization:'Bearer owner'}})).status,404,`${path} was not deleted`);
  console.log('Admin login, board access, password change, exports, and recursive deletion passed.');
} finally {if(auth.currentUser) await deleteUser(auth.currentUser).catch(()=>{}); await deleteApp(app); server.kill();}
