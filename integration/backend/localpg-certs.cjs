#!/usr/bin/env node
/**
 * localpg-certs.cjs — generate a throwaway local CA + localhost server cert
 * for the LOCAL PostgreSQL used by the dev app.
 *
 * Why: vdvk-backend's tools always set a TLS option (ca.pem → verify-full,
 * missing ca.pem → rejectUnauthorized:false, drizzle-kit → sslmode=require).
 * A plain SSL-less local server breaks all of them, so we give local postgres
 * a real cert chain signed by a local CA, and point DATABASE_CA_CERT at it.
 *
 * Output (default C:\Users\hs333\pgsql-local\certs\):
 *   ca.pem      — root CA cert        (goes into DATABASE_CA_CERT)
 *   server.crt  — server cert (CN=localhost, SAN localhost+127.0.0.1)
 *   server.key  — server private key (postgresql.conf ssl_key_file)
 */
const fs = require("node:fs");
const path = require("node:path");
const selfsigned = require("selfsigned");

const OUT = process.argv[2] || "C:\\Users\\hs333\\pgsql-local\\certs";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
// 1. root CA
const ca = await selfsigned.generate(
  [{ name: "commonName", value: "VDVK-Local-CA" }],
  {
    keySize: 2048,
    days: 3650,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", critical: true, cA: true },
      { name: "keyUsage", critical: true, keyCertSign: true, cRLSign: true, digitalSignature: true },
    ],
  }
);

// 2. server cert signed by that CA
const server = await selfsigned.generate(
  [{ name: "commonName", value: "localhost" }],
  {
    keySize: 2048,
    days: 3650,
    algorithm: "sha256",
    ca: { key: ca.private, cert: ca.cert },
    extensions: [
      { name: "basicConstraints", critical: true, cA: false },
      { name: "keyUsage", critical: true, digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] },
    ],
  }
);

fs.writeFileSync(path.join(OUT, "ca.pem"), ca.cert + "\n");
fs.writeFileSync(path.join(OUT, "server.crt"), server.cert + "\n");
fs.writeFileSync(path.join(OUT, "server.key"), server.private + "\n");
console.log(`wrote ca.pem, server.crt, server.key → ${OUT}`);
})();
