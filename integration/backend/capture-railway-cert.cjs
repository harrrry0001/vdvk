#!/usr/bin/env node
/**
 * Capture the TLS certificate chain presented through the Railway connect
 * tunnel (localhost:PORT) and write it as PEM.
 *
 * Why: drizzle.config.ts refuses plain no-verify URLs — it forces either
 *   sslmode=require (treated as verify-full by current pg → fails on the
 *   self-signed chain) or sslmode=verify-full with a real sslrootcert.
 * Pointing DATABASE_CA_CERT at this captured chain makes verify-full pass.
 *
 * Usage: node capture-railway-cert.cjs [outFile] [port]
 * Re-run after every tunnel restart IF Railway presents a per-session cert
 * (check the printed validity dates/serial — a stable serial means you can
 * capture once).
 */
const tls = require("node:tls");
const fs = require("node:fs");
const path = require("node:path");

const out = path.resolve(process.argv[2] || path.join(__dirname, "railway-tunnel-chain.pem"));
const port = Number(process.argv[3] || 15432);

const socket = tls.connect(
  { host: "127.0.0.1", port, rejectUnauthorized: false, servername: "postgres.railway.internal" },
  () => {
    let chain = [];
    if (typeof socket.getPeerX509CertificateChain === "function") {
      chain = socket.getPeerX509CertificateChain();
    } else if (socket.getPeerCertificate()) {
      const c = socket.getPeerCertificate();
      if (c && c.raw) chain = [c];
    }
    if (!chain.length) {
      console.error("No certificate chain received.");
      process.exit(1);
    }
    const pems = chain.map((c) => c.toString()); // X509Certificate.toString() -> PEM
    fs.writeFileSync(out, pems.join("\n"), { mode: 0o600 });

    console.log(`Wrote ${chain.length} cert(s) -> ${out}`);
    for (const c of chain) {
      console.log(
        `  subject=${JSON.stringify(c.subject)} issuer=${JSON.stringify(c.issuer)}\n` +
          `  validFrom=${c.validFrom} validTo=${c.validTo} serial=${c.serialNumber}`
      );
    }
    socket.end();
    process.exit(0);
  }
);
socket.on("error", (e) => {
  console.error("TLS error:", e.message);
  process.exit(1);
});
setTimeout(() => {
  console.error("Timeout waiting for TLS handshake");
  process.exit(1);
}, 10000);
