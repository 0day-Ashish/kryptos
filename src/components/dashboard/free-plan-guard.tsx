"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { Crown, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface FreePlanGuardProps {
  children: React.ReactNode;
  feature?: string;
}

export default function FreePlanGuard({
  children,
  feature,
}: FreePlanGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useSession();

  const isFreePlan = !user || user.premium_tier === "free";
  const subscriptionStatus = user?.subscription_status;

  if (!isAuthenticated || !isFreePlan || subscriptionStatus === "active") {
    return <>{children}</>;
  }

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  return (
    <div className="relative min-h-[280px]">
      {/* Blurred preview of content */}
      <div className="pointer-events-none select-none opacity-40 blur-sm">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="mx-4 w-full max-w-sm rounded-2xl border border-[#1A1A1A] bg-[#0A0A0A]/95 p-8 text-center shadow-2xl backdrop-blur-md"
        >
          {/* Crown icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00FF94]/10 ring-1 ring-[#00FF94]/20">
            <Crown className="h-7 w-7 text-[#00FF94]" />
          </div>

          <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            {feature
              ? `${feature} is available for Pro members.`
              : "Unlock unlimited access to all features with the Pro plan."}
          </p>

          <button
            onClick={handleUpgrade}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-100 active:bg-gray-200"
          >
            Upgrade Now
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
