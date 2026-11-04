"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { writeAudit } from "@/lib/crm/audit";
import { isIdArg } from "@/lib/crm/commissionActions";
import { MAX_FILE_BYTES, dateToIso, looksLikePdf, parseContractFields } from "@/lib/developerContract";
import { saveContractFile, trashContractFile } from "@/lib/contractStorage";

// Developer contract writes (2026-10-29). Same rights as commission rates —
// admins and the owner — because a contract carries the commission terms.
// The guard is the first line of every export: a Server Action is a plain POST
// the panel layout never sees (see src/lib/__tests__/adminActionsAuth.test.ts,
// and developerContractGuards.test.ts for this file).

type Result = { ok: true } | { error: string };
const DENIED = { error: "Only admins can change contracts." } as const;

async function manager() {
  const u = await getCrmUser();
  return u && canAssignLeads(u) ? u : null;
}

// The multipart parser reads a file's name as Latin-1, so "Agreement – 2026.pdf"
// arrives as "Agreement â 2026.pdf". The form therefore also sends the name as
// an ordinary text field (UTF-8 intact), which wins when present.
async function readPdf(file: FormDataEntryValue | null, sentName: FormDataEntryValue | null): Promise<{ buf: Buffer; name: string } | { error: string } | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) return { error: "The PDF is larger than 20 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikePdf(buf.subarray(0, 5))) return { error: "That file is not a PDF." };
  const name = ((typeof sentName === "string" && sentName.trim()) || file.name || "contract.pdf").replace(/[\r\n"\\/]/g, "_").slice(0, 200);
  return { buf, name };
}

function revalidate(developerAccountId: string) {
  revalidatePath(`/admin/developments/developers/${developerAccountId}`);
  revalidatePath("/admin/developments", "layout");
}

/** Creates a contract (PDF required) or, with `id`, updates one (PDF optional — replaces the old one). */
export async function saveContractAction(formData: FormData): Promise<Result> {
  const actor = await manager();
  if (!actor) return DENIED;
  const id = formData.get("id");
  const developerAccountId = formData.get("developerAccountId");
  if (!isIdArg(developerAccountId)) return { error: "Developer missing — reload." };
  const parsed = parseContractFields({
    signedAt: formData.get("signedAt"), termMonths: formData.get("termMonths"), autoRenew: formData.get("autoRenew"),
    commissionPercent: formData.get("commissionPercent"), note: formData.get("note"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const f = parsed.value;
  const pdf = await readPdf(formData.get("file"), formData.get("fileName"));
  if (pdf && "error" in pdf) return pdf;

  const account = await prisma.developerAccount.findUnique({ where: { id: developerAccountId }, select: { id: true } });
  if (!account) return { error: "Developer not found — reload." };
  const fields = { signedAt: new Date(`${f.signedAt}T00:00:00Z`), termMonths: f.termMonths, autoRenew: f.autoRenew, commissionPercent: f.commissionPercent, note: f.note };

  if (!id) {
    if (!pdf) return { error: "Choose the contract PDF." };
    const fileKey = await saveContractFile(pdf.buf);
    try {
      await prisma.$transaction(async (tx) => {
        const row = await tx.developerContract.create({
          data: { developerAccountId, ...fields, fileName: pdf.name, fileKey, fileSize: pdf.buf.length, createdById: actor.id },
        });
        await writeAudit(actor, "developer_contract_create", "DeveloperContract", row.id, { developerAccountId, ...f, fileName: pdf.name }, tx);
      });
    } catch (e) {
      await trashContractFile(fileKey).catch(() => {});
      throw e;
    }
    revalidate(developerAccountId);
    return { ok: true };
  }

  if (!isIdArg(id)) return { error: "Contract not recognised — reload." };
  const existing = await prisma.developerContract.findUnique({ where: { id } });
  if (!existing || existing.developerAccountId !== developerAccountId) return { error: "This contract no longer exists — reload." };
  // New dates mean a new end date: both reminders have to be able to go out again.
  const datesChanged = dateToIso(existing.signedAt) !== f.signedAt || existing.termMonths !== f.termMonths || existing.autoRenew !== f.autoRenew;
  const newKey = pdf ? await saveContractFile(pdf.buf) : null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.developerContract.update({
        where: { id },
        data: {
          ...fields,
          ...(datesChanged ? { reminder14SentAt: null, reminder1SentAt: null } : {}),
          ...(pdf && newKey ? { fileName: pdf.name, fileKey: newKey, fileSize: pdf.buf.length } : {}),
        },
      });
      await writeAudit(actor, "developer_contract_update", "DeveloperContract", id, {
        developerAccountId,
        before: { signedAt: dateToIso(existing.signedAt), termMonths: existing.termMonths, autoRenew: existing.autoRenew, commissionPercent: existing.commissionPercent?.toNumber() ?? null },
        after: f,
        ...(pdf ? { fileReplaced: { from: existing.fileName, to: pdf.name } } : {}),
      }, tx);
    });
  } catch (e) {
    if (newKey) await trashContractFile(newKey).catch(() => {});
    throw e;
  }
  if (newKey) await trashContractFile(existing.fileKey).catch((e) => console.error("contract: old file not moved to trash", e));
  revalidate(developerAccountId);
  return { ok: true };
}

/** Removes the row; the PDF goes to CONTRACTS_DIR/trash, not away. */
export async function deleteContractAction(id: string): Promise<Result> {
  const actor = await manager();
  if (!actor) return DENIED;
  if (!isIdArg(id)) return { error: "Contract not recognised — reload." };
  const existing = await prisma.developerContract.findUnique({ where: { id } });
  if (!existing) return { error: "This contract no longer exists — reload." };
  await prisma.$transaction(async (tx) => {
    await tx.developerContract.delete({ where: { id } });
    await writeAudit(actor, "developer_contract_delete", "DeveloperContract", id, {
      developerAccountId: existing.developerAccountId, signedAt: dateToIso(existing.signedAt), termMonths: existing.termMonths, fileName: existing.fileName, fileKey: existing.fileKey,
    }, tx);
  });
  await trashContractFile(existing.fileKey).catch((e) => console.error("contract: file not moved to trash", e));
  revalidate(existing.developerAccountId);
  return { ok: true };
}
