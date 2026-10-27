import { test } from "node:test";
import assert from "node:assert/strict";
import { dropRegistered, enquiryCountry } from "@/lib/crm/partnerEnquiries";
import { PARTNER_ENQUIRY } from "@/lib/crm/leadBucket";

test("an enquiry is a PARTNER lead without a partner account link", () => {
  assert.deepEqual(PARTNER_ENQUIRY, { source: "PARTNER", partnerId: null });
});

test("the country comes from the form route's notes line", () => {
  assert.equal(enquiryCountry("Partner / cooperation enquiry · Country: Germany"), "Germany");
  assert.equal(enquiryCountry("Partner / cooperation enquiry"), null);
  assert.equal(enquiryCountry(null), null);
});

test("enquirers who registered on the portal (same email, any case) drop out", () => {
  const rows = [{ email: "Fawad@Example.com" }, { email: "new@x.de" }, { email: null }];
  assert.deepEqual(dropRegistered(rows, ["fawad@example.com "]), [{ email: "new@x.de" }, { email: null }]);
});
