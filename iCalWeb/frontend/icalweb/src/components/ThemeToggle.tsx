import { useEffect, useState } from "react";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    const root = document.documentElement;

    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <div className="flex items-center space-x-2">
      <Switch className="data-[state=checked]:bg-slate-400 data-[state=unchecked]:bg-zinc-700" id="dark-mode" checked={dark} onCheckedChange={setDark} />
      <Label htmlFor="dark-mode">Dark Mode</Label>
    </div>
    
  );
}