import { adminDateTime } from "@/lib/adminTime";

// Phase 2 of the MCP connector: a draft Claude created is waiting for the
// approval code that only exists in the operator's preview email. There is
// deliberately no Send button here — the code path is the only send path.
export default function PendingDraftCard({
  draft,
  discardAction,
}: {
  draft: { id: string; subject: string; body: string; createdAt: Date; expiresAt: Date };
  discardAction: (formData: FormData) => Promise<void>;
}) {
  const preview = draft.body.length > 400 ? `${draft.body.slice(0, 400)}…` : draft.body;
  return (
    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#92400E]">✉ Email draft awaiting approval</h2>
          <p className="text-xs text-[#92400E]/80 mt-0.5">
            Created by Claude {adminDateTime(draft.createdAt)} · expires {adminDateTime(draft.expiresAt)} · approve with the code from the preview email in your mailbox, in the CVE LEADS chat.
          </p>
        </div>
        <form action={discardAction}>
          <input type="hidden" name="draftId" value={draft.id} />
          <button className="rounded-md border border-[#92400E] text-[#92400E] text-xs px-2 py-1 hover:bg-[#92400E] hover:text-white">Discard</button>
        </form>
      </div>
      <p className="text-sm font-medium mt-3">{draft.subject}</p>
      <pre className="text-sm whitespace-pre-wrap font-sans mt-1 text-[#374151]">{preview}</pre>
    </div>
  );
}
