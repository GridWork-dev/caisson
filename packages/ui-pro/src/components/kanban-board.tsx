"use client";

import { useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";

import {
  columnCards,
  moveCard,
  type BoardCard,
  type BoardColumn,
  type BoardLane,
} from "../lib/board.ts";

import "./kanban-board.css";

export interface KanbanBoardProps<T extends BoardCard> {
  columns: readonly BoardColumn[];
  cards: readonly T[];
  onChange: (cards: T[]) => void;
  /** Optional swimlanes — one column grid per lane. Omit for a single-row board. */
  lanes?: readonly BoardLane[];
  renderCard: (card: T) => ReactNode;
  ariaLabel?: string;
}

/**
 * KanbanBoard — a drag-and-drop board with columns and optional swimlanes, dependency-free (native
 * HTML5 DnD, no library). Every drag has a keyboard-accessible equivalent: each card carries move
 * buttons (◀ ▶ across columns, ▲ ▼ within one), so the board is fully operable without a pointer.
 * All mutation routes through the pure `lib/board` `moveCard`, and state stays controlled — the
 * parent owns the card list.
 */
export function KanbanBoard<T extends BoardCard>({
  columns,
  cards,
  onChange,
  lanes,
  renderCard,
  ariaLabel = "Board",
}: KanbanBoardProps<T>) {
  const dragId = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const laneRows: readonly (BoardLane | null)[] = lanes ?? [null];

  const move = (id: string, colId: string, index: number, laneId?: string) =>
    onChange(moveCard(cards, id, colId, index, laneId));

  const onDrop = (colId: string, index: number, laneId?: string) => {
    const id = dragId.current;
    dragId.current = null;
    setOver(null);
    if (id) move(id, colId, index, laneId);
  };

  const allow = (e: DragEvent) => e.preventDefault();

  return (
    <div className="cs-kanban" role="group" aria-label={ariaLabel}>
      {laneRows.map((lane) => {
        const laneId = lane?.id;
        return (
          <div className="cs-kanban__lane" key={laneId ?? "_single"}>
            {lane ? (
              <div className="cs-kanban__lane-head">{lane.title}</div>
            ) : null}
            <div className="cs-kanban__cols">
              {columns.map((col, colIdx) => {
                const items = columnCards(cards, col.id, laneId);
                const overKey = `${laneId ?? ""}:${col.id}`;
                return (
                  <section
                    className="cs-kanban__col"
                    key={col.id}
                    data-over={over === overKey}
                    aria-label={`${col.title}${lane ? ` — ${lane.title}` : ""}`}
                    onDragOver={(e) => {
                      allow(e);
                      setOver(overKey);
                    }}
                    onDragLeave={() =>
                      setOver((o) => (o === overKey ? null : o))
                    }
                    onDrop={() => onDrop(col.id, items.length, laneId)}
                  >
                    <header className="cs-kanban__col-head">
                      <span className="cs-kanban__col-title">{col.title}</span>
                      <span className="cs-kanban__col-count">
                        {items.length}
                      </span>
                    </header>
                    <ul className="cs-kanban__list">
                      {items.map((card, i) => (
                        <li
                          className="cs-kanban__card"
                          key={card.id}
                          draggable
                          onDragStart={(e) => {
                            dragId.current = card.id;
                            e.dataTransfer.setData("text/plain", card.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={allow}
                          onDrop={(e) => {
                            e.stopPropagation();
                            onDrop(col.id, i, laneId);
                          }}
                        >
                          <div className="cs-kanban__card-body">
                            {renderCard(card)}
                          </div>
                          <div
                            className="cs-kanban__moves"
                            role="group"
                            aria-label="Move card"
                          >
                            <button
                              type="button"
                              aria-label="Move to previous column"
                              disabled={colIdx === 0}
                              onClick={() =>
                                move(
                                  card.id,
                                  columns[colIdx - 1]!.id,
                                  items.length,
                                  laneId,
                                )
                              }
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              aria-label="Move up"
                              disabled={i === 0}
                              onClick={() =>
                                move(card.id, col.id, i - 1, laneId)
                              }
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              aria-label="Move down"
                              disabled={i === items.length - 1}
                              onClick={() =>
                                move(card.id, col.id, i + 1, laneId)
                              }
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              aria-label="Move to next column"
                              disabled={colIdx === columns.length - 1}
                              onClick={() =>
                                move(
                                  card.id,
                                  columns[colIdx + 1]!.id,
                                  items.length,
                                  laneId,
                                )
                              }
                            >
                              ▶
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
