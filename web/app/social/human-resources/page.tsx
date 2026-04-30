"use client";

import { useOpenWindowOnMount } from "@/lib/windows/useOpenWindowOnMount";

export default function Page() {
  useOpenWindowOnMount("social/human-resources");
  return null;
}
