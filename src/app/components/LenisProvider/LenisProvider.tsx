// src/components/LenisProvider/LenisProvider.tsx
"use client";

import { useLenis } from "@/hooks/useLenis";

const LenisProvider = () => {
  useLenis();
  return null;
};

export default LenisProvider;
