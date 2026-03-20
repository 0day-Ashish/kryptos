"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import IntroSection from "@/components/sections/intro-section";
import MapSection from "@/components/sections/map-section";
import TaglineSection from "@/components/sections/tagline-section";
import FlowPathSection from "@/components/sections/flow-path-section";
import UseCasesSection from "@/components/sections/use-cases-section";
import StatsSection from "@/components/sections/stats-section";
import CommunitySection from "@/components/sections/community-section";
import CtaSection from "@/components/sections/cta-section";
import Footer from "@/components/layout/footer";
import PathBeamDivider from "@/components/ui/path-beam-divider";

const HeroSection = dynamic(
  () => import("@/components/sections/hero-section"),
  { ssr: false },
);

export default function Home() {
  return (
    <>
      <IntroSection />
      <PathBeamDivider />
      <TaglineSection />
      <PathBeamDivider />
      <FlowPathSection />
      <PathBeamDivider />
      <HeroSection />
      <PathBeamDivider />
      <UseCasesSection />
      <PathBeamDivider />
      <StatsSection />
      <PathBeamDivider />
      <CommunitySection />
      <PathBeamDivider />
      <CtaSection />
      <Footer />
    </>
  );
}
