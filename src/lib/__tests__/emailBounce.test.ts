import { test } from "node:test";
import assert from "node:assert/strict";
import { simpleParser } from "mailparser";
import { parseBounce } from "@/lib/emailInbound/bounce";
import { bounceInput } from "@/lib/emailInbound/bounceInput";

// A Gmail-style hard bounce, built the way it arrives (multipart/report with a delivery-status and
// the original headers).
const RAW = [
  "From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
  "To: sascha@cyprusvipestates.com",
  "Subject: Delivery Status Notification (Failure)",
  "Message-ID: <bounce-1@mx.google.com>",
  "X-Failed-Recipients: ashworth@example.com",
  'Content-Type: multipart/report; report-type=delivery-status; boundary="B"',
  "",
  "--B",
  "Content-Type: text/plain; charset=UTF-8",
  "",
  "Address not found",
  "Your message wasn't delivered to ashworth@example.com because the address couldn't be found.",
  "",
  "--B",
  "Content-Type: message/delivery-status",
  "",
  "Reporting-MTA: dns; googlemail.com",
  "",
  "Final-Recipient: rfc822; ashworth@example.com",
  "Action: failed",
  "Status: 5.1.1",
  "Diagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.",
  "",
  "--B",
  "Content-Type: text/rfc822-headers",
  "",
  "From: Sascha Dith <sascha@cyprusvipestates.com>",
  "To: ashworth@example.com",
  "Subject: Your enquiry",
  "Message-ID: <orig-42@cyprusvipestates.com>",
  "",
  "--B--",
  "",
].join("\r\n");

test("a real-shaped Gmail hard bounce yields the dead address, the reason and our original message", async () => {
  const b = parseBounce(bounceInput(await simpleParser(RAW)));
  assert.ok(b);
  assert.equal(b.recipient, "ashworth@example.com");
  assert.equal(b.status, "5.1.1");
  assert.match(b.reason, /^550 5\.1\.1/);
  assert.equal(b.originalMessageId, "<orig-42@cyprusvipestates.com>");
  assert.equal(b.structured, true);
});

test("a temporary failure (4.x.x) and an ordinary reply are not bounces", async () => {
  const soft = RAW.replace("Status: 5.1.1", "Status: 4.2.2").replace(/Diagnostic-Code: .*/, "Diagnostic-Code: smtp; 452 4.2.2 Mailbox full");
  assert.equal(parseBounce(bounceInput(await simpleParser(soft.replace(/Address not found[\s\S]*?found\./, "Mailbox full, will retry")))), null);
  const reply = "From: Ann <ann@example.com>\r\nSubject: Re: Your enquiry\r\nMessage-ID: <r1@example.com>\r\n\r\nThe user unknown to me is my husband.\r\n";
  assert.equal(parseBounce(bounceInput(await simpleParser(reply))), null);
});

test("a plain-text bounce from a mailer daemon without a DSN part is still read", async () => {
  const raw = "From: MAILER-DAEMON@mail.example.net\r\nSubject: Undelivered Mail Returned to Sender\r\n\r\n<old@example.org>: host mx.example.org said: 550 5.1.1 <old@example.org>: Recipient address rejected: User unknown\r\n";
  const b = parseBounce(bounceInput(await simpleParser(raw)));
  assert.equal(b?.recipient, "old@example.org");
  // Sender + subject only: trusted solely via one of our own Message-IDs (bounceHandler.ts).
  assert.equal(b?.structured, false);
});
