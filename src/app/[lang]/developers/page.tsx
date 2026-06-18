"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DevelopersPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.back(); // Navigate back to the previous page
  }, [router]);

  return null; // This page won't render because of the navigation
};

export default DevelopersPage;
