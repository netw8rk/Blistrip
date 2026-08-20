import {
  HeroSection,
  DestinationStripSection,
  HowItWorksSection,
  WhyBlistripSection,
  ExampleTripSection,
  CTASection,
} from "@/components/landing/sections";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <DestinationStripSection />
      <HowItWorksSection />
      <WhyBlistripSection />
      <ExampleTripSection />
      <CTASection />
    </>
  );
}
