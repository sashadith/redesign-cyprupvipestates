"use client";
/** After create / save: copy link, open, and the partner's own mail program or WhatsApp with a prepared message. */
import type { PartnerDict } from "@/lib/partner/i18n";
import { presentationPreviewUrl } from "@/lib/partner/presentationBranding";
import type { ShareLinks } from "../../presentationBuilderActions";
import { CopyLink } from "../forms";

export function BuilderDone({ t, url, updated, share, onAgain }: {
  t: PartnerDict; url: string; updated: boolean; share: ShareLinks; onAgain: () => void;
}) {
  const P = t.presentations;
  const B = t.presBuilder;
  return (
    <div className="pp-done" role="status">
      <h2>{updated ? B.saved : P.created}</h2>
      <CopyLink value={url} copyLabel={P.copyLink} copiedLabel={P.copied} />
      {(share.mailto || share.whatsapp) && (
        <>
          <div className="pp-cta">
            {share.mailto && <a className="pp-btn" href={share.mailto}>{B.sendEmail}</a>}
            {share.whatsapp && <a className="pp-btn" href={share.whatsapp} target="_blank" rel="noopener noreferrer">{B.sendWhatsApp}</a>}
          </div>
          <p className="pp-muted pp-small">{B.shareHint}</p>
        </>
      )}
      <div className="pp-cta">
        <a className="pp-btn pp-btn-ghost" href={presentationPreviewUrl(url)} target="_blank" rel="noopener noreferrer">{P.open}</a>
        <button type="button" className="pp-btn pp-btn-ghost" onClick={onAgain}>{P.newTitle}</button>
      </div>
    </div>
  );
}
