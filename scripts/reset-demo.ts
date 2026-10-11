/** Deletes the database and recreates the demo data, pictures and demo files. Run: npm run reset-demo */
import fs from "node:fs";
import path from "node:path";
import { buildTemplateCsv } from "../src/lib/i18n/import";
import { parseCsv, toCsv } from "../src/lib/i18n/csv";
import { DATA_DIR, DB_FILE, db, closeDb } from "../src/server/db";
import { DEMO_PASSWORD, DEMO_USERS } from "../src/server/seed";
import { HILL_COUNTRY_SINHALA_PARTIAL, HILL_COUNTRY_TAMIL, hillCountryContent } from "../src/server/seed-content";
import "./make-images";

for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
fs.rmSync(path.join(DATA_DIR, "uploads"), { recursive: true, force: true });
db();
closeDb();

// Translation files "supplied by the client" for the language demo.
const demoDir = path.join(process.cwd(), "demo-files");
fs.mkdirSync(demoDir, { recursive: true });
const c = hillCountryContent();
c.settings.languages.push({ id: "ta", public: false }, { id: "si", public: false });
const fill = (locale: "ta" | "si", map: Record<string, string>) => {
  const rows = parseCsv(buildTemplateCsv(c, [locale]));
  return toCsv([rows[0], ...rows.slice(1).map((r) => [...r.slice(0, 5), map[r[0]] ?? ""])]);
};
fs.writeFileSync(path.join(demoDir, "tamil-translations.csv"), fill("ta", HILL_COUNTRY_TAMIL));
fs.writeFileSync(path.join(demoDir, "sinhala-translations-incomplete.csv"), fill("si", HILL_COUNTRY_SINHALA_PARTIAL));

console.log("Demo data ready.");
console.log(`Sign in with any of these (password: ${DEMO_PASSWORD}):`);
for (const u of DEMO_USERS) console.log(`  ${u.email.padEnd(24)} ${u.name} – ${u.title}`);
