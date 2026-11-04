import { notFound } from "next/navigation";

/** Any unknown partner-host path renders the portal's own 404. */
export default function PartnerCatchAll() {
  notFound();
}
