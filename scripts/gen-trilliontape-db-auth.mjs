import { generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "data-host");
const KEYS = path.join(ROOT, "keys");
const TEN_YEARS_S = 10 * 365 * 24 * 60 * 60;

function b64url(value) {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buf.toString("base64url");
}

function jwt(privateKey, claims) {
  const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const sig = sign(null, Buffer.from(data), privateKey);
  return `${data}.${b64url(sig)}`;
}

fs.mkdirSync(KEYS, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pubPem = publicKey.export({ type: "spki", format: "pem" });
const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
const rawPub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
const now = Math.floor(Date.now() / 1000);
const token = jwt(privateKey, {
  a: "rw",
  id: "trilliontape",
  iat: now,
  exp: now + TEN_YEARS_S,
});

fs.writeFileSync(path.join(KEYS, "jwt.pub"), pubPem);
fs.writeFileSync(path.join(KEYS, "jwt.key"), privPem, { mode: 0o600 });
fs.writeFileSync(path.join(KEYS, "token"), `${token}\n`, { mode: 0o600 });
fs.writeFileSync(path.join(KEYS, "jwt.pub.b64url"), `${b64url(rawPub)}\n`);

const envLocal = `# TrillionTape data host — generated ${new Date().toISOString()}
# Do not reuse these on another project. Do not commit this file.

TRILLIONTAPE_DATABASE_URL=http://127.0.0.1:43148
TRILLIONTAPE_AUTH_TOKEN=${token}

# After \`fly deploy\` in data-host/:
# TRILLIONTAPE_DATABASE_URL=https://trilliontape-data.fly.dev
`;
fs.writeFileSync(path.join(ROOT, ".env.local"), envLocal, { mode: 0o600 });

process.stdout.write(`Wrote Ed25519 keys in ${KEYS}

Local Docker compose:
  TRILLIONTAPE_DATABASE_URL=http://127.0.0.1:43148
  TRILLIONTAPE_AUTH_TOKEN=<data-host/keys/token>

Fly.io (app name trilliontape-data only):
  fly secrets set SQLD_AUTH_JWT_KEY=$(cat data-host/keys/jwt.pub.b64url)
  Then set the Next.js process to:
  TRILLIONTAPE_DATABASE_URL=https://trilliontape-data.fly.dev
  TRILLIONTAPE_AUTH_TOKEN=<same token>

The private key and token stay in data-host/keys/ (gitignored).
`);
