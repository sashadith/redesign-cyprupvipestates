"use client";

import { useEffect } from "react";

type Props = {
  title: string;
  projectId: string;
  price?: number | null;
  city?: string;
  propertyType?: string;
};

const MetaViewContentTracker = ({
  title,
  projectId,
  price,
  city,
  propertyType,
}: Props) => {
  const eventId = `${projectId}-${Date.now()}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.fbq) return;

    window.fbq("track", "ViewContent", {
      eventID: eventId,
      content_name: title,
      content_ids: [projectId],
      content_type: "property",
      content_category: "property",
      value: typeof price === "number" ? price : 0,
      currency: "EUR",
      city: city || "",
      property_type: propertyType || "",
      page_location: window.location.href,
    });
  }, [title, projectId, price, city, propertyType]);

  return null;
};

export default MetaViewContentTracker;
