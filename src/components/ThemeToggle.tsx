import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  return (
    <button
      aria-label="Alternar tema"
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        localStorage.setItem("tema", dark ? "escuro" : "claro");
      }}
      className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground"
    >
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
    </button>
  );
}
