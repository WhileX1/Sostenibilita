"use client";

import { useOpenWindowOnMount } from "@/lib/windows/useOpenWindowOnMount";

export default function Page() {
  useOpenWindowOnMount("environmental/co2-emissions");
  return null;
}
