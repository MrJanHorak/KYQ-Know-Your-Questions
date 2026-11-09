// Run only against Firebase emulators; never seed or delete production data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, scryptSync } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

assert(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Both Firebase emulators must be running.');
const projectId = process.env.GCLOUD_PROJECT || 'demo-kyq';
const app = initializeApp({projectId});
const auth = getAuth(app);
const db = getFirestore(app);
const base = 'http://127.0.0.1:3198';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3198'], {env:{...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID:projectId, SESSION_SECRET:'emulator-only-secret'}, stdio:'inherit'});
async function token(uid) {
  await auth.createUser({uid, email:`${uid}@example.test`, emailVerified:true});
  const custom = await auth.createCustomToken(uid);
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-key`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({token:custom, returnSecureToken:true})});
  assert(response.ok, 'Could not create emulator sign-in');
  return (await response.json()).idToken;
}
const request = (path, token, method='GET', body, cookie) => fetch(base+path, {method, headers:{...(token?{authorization:`Bearer ${token}`} : {}), ...(body?{'content-type':'application/json'}:{}), ...(cookie?{cookie}:{})}, ...(body?{body:JSON.stringify(body)}:{})});
try {
  let ready = false;
  for (let i=0; i<120; i++) { try { await fetch(base); ready=true; break; } catch { await new Promise(resolve=>setTimeout(resolve,250)); } }
  assert(ready, 'Server did not start');
  const suffix = Date.now().toString();
  const owner = await token(`owner${suffix}`), outsider = await token(`outsider${suffix}`);
  assert.equal((await request('/api/instructor/account', null, 'POST')).status, 401);
  assert.equal((await request('/api/instructor/account', owner, 'POST')).status, 200);
  assert.equal((await request('/api/instructor/account', outsider, 'POST')).status, 200);
  const created = await request('/api/instructor/boards', owner, 'POST', {name:'Team board',password:'test-password'});
  assert.equal(created.status, 200); const board = await created.json();
  const ownerList = await (await request('/api/instructor/boards', owner)).json();
  const outsiderList = await (await request('/api/instructor/boards', outsider)).json();
  assert(ownerList.boards.some(item=>item.id===board.id));
  assert(!outsiderList.boards.some(item=>item.id===board.id));
  assert.equal((await request('/api/admin', null, 'POST', {password:'legacy-test-password'})).status,405);
  assert.equal((await request('/api/boards', null)).status,404);
  const expires = String(Date.now() + 3600000);
  const signature = createHmac('sha256', 'emulator-only-secret').update(`kyq-admin:${expires}`).digest('hex');
  const cookie = `kyq-admin=${expires}.${signature}`;
  for (const credential of [{token:outsider},{cookie}]) {
    assert.equal((await request(`/api/boards/export?boardId=${board.id}&format=json`, credential.token, 'GET', null, credential.cookie)).status,401);
    assert.equal((await request('/api/boards/password', credential.token, 'PATCH', {boardId:board.id,password:'another-password'}, credential.cookie)).status,401);
    assert.equal((await request('/api/admin', credential.token, 'PATCH', {boardId:board.id,id:'question',operation:'delete'}, credential.cookie)).status,401);
    assert.equal((await request(`/api/boards/${board.id}`, credential.token, 'DELETE', null, credential.cookie)).status,401);
  }
  assert.equal((await request('/api/boards/access', null, 'POST', {boardId:board.id,password:'test-password',idToken:outsider})).status,200, 'Participants can unlock owned boards');
  const salt = 'a'.repeat(32);
  const unowned = await db.collection('boards').add({name:'Unassigned board',accessVersion:0,passwordHash:`${salt}:${scryptSync('test-password', salt, 64).toString('hex')}`});
  assert.equal((await request(`/api/boards/export?boardId=${unowned.id}&format=json`, owner)).status,401);
  assert.equal((await request('/api/boards/access', null, 'POST', {boardId:unowned.id,password:'test-password',idToken:outsider})).status,401);
  await db.collection('boards').doc(board.id).collection('questions').doc('question').set({question:'Test question',authorName:'Tester',status:'unanswered',upvoteCount:0,createdAt:new Date(),replies:[{author:'Teacher',text:'Test response'}]});
  for (const format of ['json', 'md']) {
    const response = await request(`/api/boards/export?boardId=${board.id}&format=${format}`, owner);
    assert.equal(response.status, 200);
    const content = await response.text();
    assert(content.includes('Test question') && content.includes('Test response'));
  }
  assert.equal((await request(`/api/boards/export?boardId=${board.id}&format=json`, owner)).status,200);
  assert.equal((await request('/api/boards/password', owner, 'PATCH', {boardId:board.id,password:'another-password'})).status,200);
  assert.equal((await request('/api/boards/access', null, 'POST', {boardId:board.id,password:'test-password',idToken:outsider})).status,401);
  assert.equal((await request('/api/boards/access', null, 'POST', {boardId:board.id,password:'another-password',idToken:outsider})).status,200);
  // Simulate an interrupted deletion, including data left in a nested collection.
  await db.collection('boards').doc(board.id).update({deleting:true, accessVersion:2});
  await db.collection('boards').doc(board.id).collection('questions').doc('remaining').set({question:'Remaining data'});
  const interruptedList = await (await request('/api/instructor/boards', owner)).json();
  assert.equal(interruptedList.boards.find(item=>item.id===board.id)?.deleting, true, 'Interrupted deletions must remain visible to the owner');
  const outsiderAfterInterruption = await (await request('/api/instructor/boards', outsider)).json();
  assert(!outsiderAfterInterruption.boards.some(item=>item.id===board.id));
  assert.equal((await request(`/api/boards/${board.id}`, owner, 'DELETE')).status,200);
  assert.equal((await db.collection('boards').doc(board.id).collection('questions').doc('remaining').get()).exists, false);
  console.log('Instructor authorization, participant access, and deletion recovery checks passed.');
} finally { server.kill(); }
