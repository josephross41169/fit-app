// ─── lib/nativePushServer.ts ────────────────────────────────────────
// Sends notifications to the App Store / Play Store builds.
//   iOS     → Apple Push Notification service (APNs), straight from
//             here with a .p8 auth key. No Firebase needed for iPhone.
//   Android → Firebase Cloud Messaging (FCM) HTTP v1 API.
//
// Env vars (Vercel → Settings → Environment Variables):
//   APNS_KEY_ID        10-char Key ID of the APNs key
//   APNS_TEAM_ID       Apple Developer Team ID
//   APNS_PRIVATE_KEY   full contents of the downloaded AuthKey_XXXX.p8
//   APNS_BUNDLE_ID     com.liveleeapp.app (default)
//   FCM_SERVICE_ACCOUNT  full JSON of a Firebase service-account key
// Missing vars = that platform is silently skipped.
// Tokens live in native_push_tokens; dead tokens are deleted.
// ─────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import http2 from 'http2';

export interface NativePushPayload { title: string; body: string; url?: string; tag?: string }
type Admin = any;

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const pem = (k: string) => k.replace(/\\n/g, '\n').trim();

// ── APNs ─────────────────────────────────────────────────────────────
let apnsJwt: { token: string; at: number } | null = null;
function apnsToken(): string | null {
  const keyId = process.env.APNS_KEY_ID, teamId = process.env.APNS_TEAM_ID, key = process.env.APNS_PRIVATE_KEY;
  if (!keyId || !teamId || !key) return null;
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && now - apnsJwt.at < 50 * 60) return apnsJwt.token; // Apple: refresh within 60 min
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claims}`), { key: pem(key), dsaEncoding: 'ieee-p1363' });
  apnsJwt = { token: `${head}.${claims}.${b64url(sig)}`, at: now };
  return apnsJwt.token;
}

function apnsSend(host: string, deviceToken: string, jwt: string, p: NativePushPayload): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on('error', () => resolve({ status: 0 }));
    const headers: Record<string, string> = {
      ':method': 'POST', ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': process.env.APNS_BUNDLE_ID || 'com.liveleeapp.app',
      'apns-push-type': 'alert', 'apns-priority': '10',
    };
    if (p.tag) headers['apns-collapse-id'] = p.tag.slice(0, 64);
    const req = client.request(headers);
    let status = 0, data = '';
    req.on('response', (h) => { status = Number(h[':status']) || 0; });
    req.setEncoding('utf8');
    req.on('data', (c) => { data += c; });
    req.on('end', () => { client.close(); let reason: string | undefined; try { reason = JSON.parse(data).reason; } catch {} resolve({ status, reason }); });
    req.on('error', () => { client.close(); resolve({ status: 0 }); });
    req.setTimeout(10000, () => { req.close(); client.close(); resolve({ status: 0 }); });
    req.end(JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: 'default' }, url: p.url || '/feed' }));
  });
}

async function sendApns(token: string, p: NativePushPayload): Promise<'ok' | 'dead' | 'fail'> {
  const jwt = apnsToken();
  if (!jwt) return 'fail';
  let r = await apnsSend('api.push.apple.com', token, jwt, p);
  // Development builds (run from Xcode) register with Apple's sandbox.
  if (r.status === 400 && r.reason === 'BadDeviceToken') r = await apnsSend('api.sandbox.push.apple.com', token, jwt, p);
  if (r.status === 200) return 'ok';
  if (r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered') return 'dead';
  console.warn('[native-push] APNs', r.status, r.reason);
  return 'fail';
}

// ── FCM ──────────────────────────────────────────────────────────────
let fcmAuth: { token: string; exp: number; project: string } | null = null;
async function fcmAccess(): Promise<{ token: string; project: string } | null> {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  const now = Math.floor(Date.now() / 1000);
  if (fcmAuth && fcmAuth.exp - 60 > now) return fcmAuth;
  let sa: any;
  try { sa = JSON.parse(raw); } catch { console.warn('[native-push] FCM_SERVICE_ACCOUNT is not valid JSON'); return null; }
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claims}`), pem(sa.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) { console.warn('[native-push] FCM auth failed', res.status); return null; }
  const j = await res.json();
  fcmAuth = { token: j.access_token, exp: now + (j.expires_in || 3600), project: sa.project_id };
  return fcmAuth;
}

async function sendFcm(token: string, p: NativePushPayload): Promise<'ok' | 'dead' | 'fail'> {
  const auth = await fcmAccess();
  if (!auth) return 'fail';
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token, notification: { title: p.title, body: p.body }, data: { url: p.url || '/feed' },
      android: { priority: 'high', notification: p.tag ? { tag: p.tag } : {} },
    } }),
  });
  if (res.ok) return 'ok';
  const txt = await res.text();
  if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*registration/i.test(txt)) return 'dead';
  console.warn('[native-push] FCM', res.status, txt.slice(0, 200));
  return 'fail';
}

/** Push to every App Store / Play Store device this user signed in on. Never throws. */
export async function sendNativePushToUser(admin: Admin, userId: string, p: NativePushPayload): Promise<void> {
  try {
    const { data: rows, error } = await admin.from('native_push_tokens').select('id, token, platform').eq('user_id', userId);
    if (error || !rows?.length) return;
    await Promise.all(rows.map(async (r: any) => {
      const out = r.platform === 'ios' ? await sendApns(r.token, p) : await sendFcm(r.token, p);
      if (out === 'dead') await admin.from('native_push_tokens').delete().eq('id', r.id);
      else if (out === 'ok') await admin.from('native_push_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', r.id);
    }));
  } catch (e) {
    console.error('[native-push] unexpected', e);
  }
}
