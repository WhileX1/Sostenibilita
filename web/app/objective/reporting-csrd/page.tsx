"use client";

import { useOpenWindowOnMount } from "@/lib/windows/useOpenWindowOnMount";

export default function Page() {
  useOpenWindowOnMount("objective/reporting-csrd");
  return null;
}
