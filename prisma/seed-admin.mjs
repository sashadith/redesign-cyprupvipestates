// Bootstrap the initial admin user on a fresh database. Run:
//   node --env-file=.env prisma/seed-admin.mjs
//
// CREATE-ONLY: if the account already exists, this is a no-op that never
// touches its password/role/isActive. Admins change their own password
// through the panel — a prior version of this script used `upsert`, which
// silently overwrote that real password back to whatever was in .env on
// every re-run (the cause of a recurring "admin login broken" investigation
// during the 2026-07 staging->production merge; see DEPLOYMENT.md).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = (process.env.ADMIN_EMAIL || "office@cyprusvipestates.com").toLowerCase();

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.log(`Admin already exists: ${existing.email} (role ${existing.role}) — nothing to do.`);
  await prisma.$disconnect();
  process.exit(0);
}

// No hardcoded password in source. Supply ADMIN_PASSWORD via the (gitignored)
// environment — only needed the very first time, to create this account.
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error("Refusing to create: set ADMIN_PASSWORD (>=12 chars) in the environment (.env).");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const user = await prisma.user.create({
  data: { email, password: hash, name: "Admin", role: "ADMIN" },
});
console.log(`Created admin: ${user.email} (role ${user.role})`);
await prisma.$disconnect();
