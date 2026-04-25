"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="切换主题"
      className="text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
      ) : (
        <Sun className="h-5 w-5 text-amber-500 dark:text-amber-300" />
      )}
    </Button>
  );
}
