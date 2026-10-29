// A developer contract PDF (2026-10-29) — admins and the owner only, the same
// people who may upload one (contractActions.ts). The file lives outside
// public/ (src/lib/contractStorage.ts), so this route is the only way to it.
// Middleware does not cover /api/admin, hence the session check right here.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { readContractFile } from "@/lib/contractStorage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCrmUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (!canAssignLeads(user)) return new NextResponse(null, { status: 403 });
  const row = await prisma.developerContract.findUnique({ where: { id: params.id }, select: { fileKey: true, fileName: true } });
  if (!row) return new NextResponse(null, { status: 404 });
  let buf: Buffer;
  try {
    buf = await readContractFile(row.fileKey);
  } catch {
    return new NextResponse("The contract file is missing on the server.", { status: 404 });
  }
  const ascii = row.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
