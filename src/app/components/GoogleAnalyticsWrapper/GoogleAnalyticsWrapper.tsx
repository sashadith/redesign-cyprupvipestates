"use client";

import Script from "next/script";

export default function GoogleAnalyticsWrapper() {
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-WLD3B6GN9P"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-WLD3B6GN9P');
        `}
      </Script>
    </>
  );
}
