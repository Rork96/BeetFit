// Prints a fresh VAPID key (ES256 private key as JWK) for Web Push. Pipe it straight into the secret
// so it never shows on screen:   npm run vapid | npx wrangler secret put VAPID_JWK
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', kp.privateKey)
process.stdout.write(JSON.stringify({ kty, crv, x, y, d }))
