export type DeviceType = "mobile" | "tablet" | "desktop";

export function detectDeviceType(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return "desktop";
  if (/iPad|Android(?!.*Mobile)|Tablet|Kindle|Silk/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry/i.test(userAgent)) return "mobile";
  return "desktop";
}
