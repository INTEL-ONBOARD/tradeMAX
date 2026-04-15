import { motion } from "framer-motion";
import { Sidebar } from "../components/Sidebar";
import { PositionsPanel } from "../components/PositionsPanel";
import { TradesPanel } from "../components/TradesPanel";
import { LiveLogPanel } from "../components/LiveLogPanel";

export function DashboardPage() {
  return (
    <div className="h-screen w-screen flex">
      <Sidebar />

      <main className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PositionsPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TradesPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <LiveLogPanel />
        </motion.div>
      </main>
    </div>
  );
}
