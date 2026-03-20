"use client";

import { motion } from "framer-motion";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import BatchAnalysis from "@/components/dashboard/batch-analysis";

export default function BatchAnalysisPage() {
  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <Header />

      <main
        className="pt-16 transition-all duration-300"
        style={{ marginLeft: "16rem" }}
      >
        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-white">Batch Analysis</h1>
            <p className="mt-1 text-sm text-gray-500">
              Analyze multiple wallet addresses in a dedicated workflow
            </p>
          </motion.div>

          <BatchAnalysis />
        </div>
      </main>
    </div>
  );
}
