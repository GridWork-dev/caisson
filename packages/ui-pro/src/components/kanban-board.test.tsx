import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { BoardCard } from "../lib/board";
import { KanbanBoard } from "./kanban-board";

interface Card extends BoardCard {
  title: string;
}

const columns = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "In progress" },
  { id: "done", title: "Done" },
];

const cards: Card[] = [
  { id: "1", columnId: "todo", title: "Draft SPEC" },
  { id: "2", columnId: "doing", title: "Build gate" },
];

describe("KanbanBoard", () => {
  test("renders columns, cards, and keyboard move controls", () => {
    const html = renderToStaticMarkup(
      <KanbanBoard
        columns={columns}
        cards={cards}
        onChange={() => {}}
        renderCard={(c) => <span>{c.title}</span>}
      />,
    );
    expect(html).toContain('aria-label="To do"');
    expect(html).toContain("Draft SPEC");
    expect(html).toContain("Build gate");
    expect(html).toContain('draggable="true"');
    expect(html).toContain('aria-label="Move to next column"');
  });

  test("renders a lane header when swimlanes are given", () => {
    const html = renderToStaticMarkup(
      <KanbanBoard
        columns={columns}
        cards={[{ id: "1", columnId: "todo", laneId: "team-1", title: "A" }]}
        lanes={[{ id: "team-1", title: "Platform" }]}
        onChange={() => {}}
        renderCard={(c) => <span>{c.title}</span>}
      />,
    );
    expect(html).toContain("Platform");
    expect(html).toContain('aria-label="To do — Platform"');
  });
});
