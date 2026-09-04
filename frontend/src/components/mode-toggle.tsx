import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getMode, setMode, watchMode, type Mode } from "@/lib/theme";

/** system → light → dark → system. */
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };

const ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ModeToggle() {
  // Read on mount, not during render: the inline script in index.html has
  // already applied the class, and touching localStorage while rendering would
  // break if this component is ever server-rendered.
  const [mode, setLocal] = useState<Mode>("system");
  useEffect(() => {
    setLocal(getMode());
    return watchMode(setLocal);
  }, []);

  const Icon = ICON[mode];
  const change = () => {
    const next = NEXT[mode];
    setMode(next);
    setLocal(next);
  };

  return (
    <Button variant="ghost" size="icon" onClick={change} aria-label={`Switch to ${NEXT[mode]} theme`}>
      <Icon />
    </Button>
  );
}
