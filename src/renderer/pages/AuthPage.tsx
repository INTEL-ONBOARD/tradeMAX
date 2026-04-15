import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { useAppStore } from "../store/appStore";

export function AuthPage() {
    const { authMode, setAuthMode, setScreen, setSession } = useAppStore();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError("");

        try {
            const response =
                authMode === "login"
                    ? await window.trademax.auth.login({ email, password })
                    : await window.trademax.auth.register({ name, email, password });

            setSession(response.session);
            setScreen("dashboard");
        } catch (err: any) {
            setError(err?.message || "Authentication failed");
        }
    }

    return (
        <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-screen items-center justify-center px-6"
        >
            <div className="glass w-full max-w-md p-6">
                <h2 className="font-display text-3xl">{authMode === "login" ? "Welcome Back" : "Create Account"}</h2>
                <p className="mt-2 text-sm text-muted">Secure account access for autonomous trading controls.</p>

                <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                    {authMode === "register" ? (
                        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    ) : null}
                    <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
                    <input className="input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />

                    {error ? <p className="text-sm text-red-400">{error}</p> : null}

                    <button className="btn-primary w-full" type="submit">
                        {authMode === "login" ? "Login" : "Register"}
                    </button>
                </form>

                <button
                    className="mt-4 text-xs text-muted underline"
                    onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                >
                    {authMode === "login" ? "Need an account? Register" : "Already registered? Login"}
                </button>
            </div>
        </motion.main>
    );
}
