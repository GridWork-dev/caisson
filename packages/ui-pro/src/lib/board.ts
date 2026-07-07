/**
 * Pure Kanban board operations behind KanbanBoard — moving and reordering cards across columns and
 * optional swimlanes. Cards are a flat array; a card carries its own `columnId` (and optional
 * `laneId`), so board state is one immutable list and these functions return a new list. No React, no
 * DOM: the drag-drop handlers and the keyboard-move buttons both route through `moveCard`.
 */

export interface BoardCard {
  id: string;
  columnId: string;
  /** Swimlane membership; omit on a lane-less board. */
  laneId?: string;
}

export interface BoardColumn {
  id: string;
  title: string;
}

export interface BoardLane {
  id: string;
  title: string;
}

/** Cards in `columnId` (and `laneId`, when given), in their current array order. */
export function columnCards<T extends BoardCard>(
  cards: readonly T[],
  columnId: string,
  laneId?: string,
): T[] {
  return cards.filter(
    (c) =>
      c.columnId === columnId && (laneId === undefined || c.laneId === laneId),
  );
}

/**
 * Move card `cardId` to `toColumnId` (and `toLaneId`, when the board has swimlanes), inserting it at
 * `toIndex` within that column/lane's slice. `toIndex` is clamped to the slice, so an out-of-range
 * index appends. Dropping into an empty column works (the card lands at the column's position).
 * Returns a NEW array; an unknown `cardId` yields an unchanged copy.
 */
export function moveCard<T extends BoardCard>(
  cards: readonly T[],
  cardId: string,
  toColumnId: string,
  toIndex: number,
  toLaneId?: string,
): T[] {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return [...cards];

  const laneId = toLaneId !== undefined ? toLaneId : card.laneId;
  const moved: T = { ...card, columnId: toColumnId, laneId };
  const without = cards.filter((c) => c.id !== cardId);

  // Positions in `without` that belong to the destination column/lane.
  const targetPositions: number[] = [];
  without.forEach((c, i) => {
    if (
      c.columnId === toColumnId &&
      (laneId === undefined || c.laneId === laneId)
    ) {
      targetPositions.push(i);
    }
  });

  const clamped = Math.max(0, Math.min(toIndex, targetPositions.length));
  const insertAt =
    clamped < targetPositions.length
      ? targetPositions[clamped]!
      : targetPositions.length > 0
        ? targetPositions[targetPositions.length - 1]! + 1
        : without.length;

  const next = [...without];
  next.splice(insertAt, 0, moved);
  return next;
}
