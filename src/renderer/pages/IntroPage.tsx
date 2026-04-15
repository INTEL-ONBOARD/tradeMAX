import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";

export function IntroPage() {
    const { setScreen, setAuthMode } = useAppStore();

    return (
        <motion.main
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45 }}
            className="relative flex min-h-screen items-center justify-center px-6"
        >
            <div className="pointer-events-none absolute inset-0 bg-radial" />
            <div className="z-10 w-full max-w-3xl text-center">
                <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.45 }}
                    className="font-display text-5xl font-bold tracking-tight md:text-7xl"
                >
                    Trade<span className="text-accent">MAX</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.45 }}
                    className="mx-auto mt-5 max-w-xl text-sm text-muted md:text-base"
                >
                    Autonomous crypto execution with hard risk controls, real-time intelligence, and manual emergency override.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.45 }}
                    className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
                >
                    <button
                        className="btn-primary"
                        onClick={() => {
                            setAuthMode("login");
                            setScreen("auth");
                        }}
                    >
                        Login
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => {
                            setAuthMode("register");
                            setScreen("auth");
                        }}
                    >
                        Register
                    </button>
                </motion.div>
            </div>
        </motion.main>
    );
}
