import { BookOpenIcon, GaugeIcon, HelpCircleIcon, LibraryIcon } from "lucide-react";

import type { SectionKey } from "@/lib/knowledge/sections";

export const SECTION_ICONS: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
  sources: LibraryIcon,
  context: BookOpenIcon,
  evaluation: GaugeIcon,
  questions: HelpCircleIcon,
};
