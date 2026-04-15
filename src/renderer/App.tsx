import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IntroPage } from "./pages/IntroPage";
import { useAppStore } from "./store/appStore";

export default function App() {
    const { screen, setScreen, setSession, theme, setTheme } = useAppStore();

    useEffect(() => {
        window.trademax.auth.getSession().then((session) => {
            if (session?.session) {
                setSession(session.session);
                setTheme(session.session.themePreference || "dark");
                setScreen("dashboard");
            }
        });
    }, [setScreen, setSession, setTheme]);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    return (
        <div className="min-h-screen w-full bg-grid text-foreground">
            <AnimatePresence mode="wait">
                {screen === "intro" && <IntroPage key="intro" />}
                {screen === "auth" && <AuthPage key="auth" />}
                {screen === "dashboard" && <DashboardPage key="dashboard" />}
            </AnimatePresence>
        </div>
    );
}
