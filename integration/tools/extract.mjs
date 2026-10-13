// Extract all ZIP files from "D:\1A Gopal\New folder" into ../data/raw/
// Run: node extract.mjs
import AdmZip from "adm-zip";
import { readdirSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_DIR = "D:\\1A Gopal\\New folder";
const OUT_DIR = join(HERE, "..", "data", "raw");

if (!existsSync(SOURCE_DIR)) {
  console.error(`Source folder not found: ${SOURCE_DIR}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const zips = readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith(".zip"));
if (!zips.length) {
  console.error(`No .zip files found in ${SOURCE_DIR}`);
  process.exit(1);
}

for (const z of zips) {
  const target = join(OUT_DIR, basename(z, ".zip"));
  try {
    const zip = new AdmZip(join(SOURCE_DIR, z));
    zip.extractAllTo(target, true);
    let n = 0;
    const walk = (d) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else n++;
      }
    };
    walk(target);
    console.log(`OK  ${z} -> data/raw/${basename(z, ".zip")} (${n} files)`);
  } catch (e) {
    console.error(`ERR ${z}: ${e.message}`);
  }
}
console.log("Extraction complete.");
