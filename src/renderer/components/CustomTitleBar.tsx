import React from "react";
import { TrendingUp, Menu, Minus, Maximize2, X } from "./icons";

export function CustomTitleBar() {
  return (
    <div
      className="flex items-center justify-between h-10 px-4 select-none shrink-0 border-b border-[var(--border)]"
      style={{
        background: "var(--bg-topbar, var(--bg-surface))",
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      {/* Left controls (Mac traffic lights usually sit around pl-16 or so if inset) */}
      <div className="flex items-center gap-4 ml-16 md:ml-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <Menu size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary-600 flex items-center justify-center">
            <TrendingUp size={10} className="text-white" />
          </div>
          <span className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wide uppercase">
            TradeMAX
          </span>
        </div>
      </div>


    </div>
  );
}
