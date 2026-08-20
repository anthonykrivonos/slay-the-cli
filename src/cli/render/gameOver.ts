// game-over screen renderer: the list screen with a big centered banner.

import type { SimpleListScreen } from "../state/view";
import type { Theme } from "./theme";
import { renderListScreen } from "./listScreen";

export function renderGameOver(screen: SimpleListScreen, width: number, height: number, theme: Theme): string[] {
  const banner = `===  ${screen.title}  ===`;
  return renderListScreen(screen, width, height, theme, { bigTitle: banner });
}
