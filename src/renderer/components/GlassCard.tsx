import { type PropsWithChildren } from "react";

export function GlassCard(props: PropsWithChildren<{ className?: string; title?: string; subtitle?: string }>) {
    return (
        <section className={`glass p-4 md:p-5 ${props.className || ""}`}>
            {props.title ? (
                <header className="mb-4">
                    <h3 className="text-base font-semibold tracking-wide">{props.title}</h3>
                    {props.subtitle ? <p className="text-xs text-muted">{props.subtitle}</p> : null}
                </header>
            ) : null}
            {props.children}
        </section>
    );
}
