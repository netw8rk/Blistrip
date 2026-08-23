import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Deals",
  description: "Travel deals are coming soon on Blistrip.",
};

export default function DealsPage() {
  return (
    <ComingSoon
      eyebrow="Deals"
      title="Coming soon"
      description="We're putting together destination deals and seasonal picks. Check back shortly, or plan a trip in the meantime."
    />
  );
}
