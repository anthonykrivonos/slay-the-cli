// shop screen renderer — a straight numbered-list screen (see listScreen.ts).

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { renderListScreen } from "./listScreen";

export function renderShop(screen: SimpleListScreen, width: number, height: number, theme: Theme): string[] {
  return renderListScreen(screen, width, height, theme);
}
