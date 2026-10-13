#!/usr/bin/env node
const { X509Certificate } = require("node:crypto");
const fs = require("node:fs");
const D = "C:/Users/hs333/pgsql-local/certs";
const ca = new X509Certificate(fs.readFileSync(`${D}/ca.pem`));
const srv = new X509Certificate(fs.readFileSync(`${D}/server.crt`));
console.log("server subject :", srv.subjectName);
console.log("server SAN     :", srv.subjectAltName);
console.log("server verify  :", srv.verify(ca.publicKey), "(must be true)");
console.log("ca is CA       :", ca.ca);
