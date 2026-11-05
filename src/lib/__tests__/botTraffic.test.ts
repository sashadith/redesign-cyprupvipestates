import { test } from "node:test";
import assert from "node:assert/strict";
import { isBotTraffic, isBotUA, isCrawlerIp } from "@/lib/analytics/botTraffic";

const FLEET = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const CURRENT_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1";

test("the frozen Chrome 145 fleet UA is a bot, exactly that string only", () => {
  assert.equal(isBotUA(FLEET), true);
  assert.equal(isBotUA(CURRENT_MAC), false);
  assert.equal(isBotUA(FLEET.replace("145.0.0.0", "146.0.0.0")), false);
  assert.equal(isBotUA(IPHONE), false);
});

test("self-identifying crawlers stay bots", () => {
  assert.equal(isBotUA("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBotUA("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"), true);
  assert.equal(isBotUA(""), false);
});

test("Meta network ranges are crawlers, neighbouring and ISP addresses are not", () => {
  assert.equal(isCrawlerIp("2a03:2880:f814:47::"), true);
  assert.equal(isCrawlerIp("2A03:2880:15FF:42::"), true);
  assert.equal(isCrawlerIp("57.141.20.57"), true);
  assert.equal(isCrawlerIp("::ffff:57.141.20.57"), true);
  assert.equal(isCrawlerIp("173.252.127.255"), true);
  assert.equal(isCrawlerIp("173.252.128.0"), false);
  assert.equal(isCrawlerIp("57.140.255.255"), false);
  assert.equal(isCrawlerIp("2a03:2881::1"), false);
  assert.equal(isCrawlerIp("85.12.200.4"), false);
  assert.equal(isCrawlerIp("0.0.0.0"), false);
  assert.equal(isCrawlerIp("not-an-ip"), false);
});

test("isBotTraffic combines both signals", () => {
  assert.equal(isBotTraffic(CURRENT_MAC, "57.141.1.1"), true);
  assert.equal(isBotTraffic(FLEET, "85.12.200.4"), true);
  assert.equal(isBotTraffic(CURRENT_MAC, "85.12.200.4"), false);
});
