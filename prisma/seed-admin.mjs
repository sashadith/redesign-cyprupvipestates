// Seed the initial admin user. Run: node --env-file=.env prisma/seed-admin.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = (process.env.ADMIN_EMAIL || "office@cyprusvipestates.com").toLowerCase();

// No hardcoded password in source. Supply ADMIN_PASSWORD via the (gitignored) environment.
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error("Refusing to seed: set ADMIN_PASSWORD (>=12 chars) in the environment (.env).");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const user = await prisma.user.upsert({
  where: { email },
  update: { password: hash, role: "ADMIN", isActive: true },
  create: { email, password: hash, name: "Admin", role: "ADMIN" },
});
console.log(`Seeded admin: ${user.email} (role ${user.role})`);
await prisma.$disconnect();
