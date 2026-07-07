import { describe, expect, test } from "bun:test";

import { columnCards, moveCard, type BoardCard } from "./board";

interface Card extends BoardCard {
  title: string;
}

const cards: Card[] = [
  { id: "1", columnId: "todo", title: "Draft SPEC" },
  { id: "2", columnId: "todo", title: "Lock ADR" },
  { id: "3", columnId: "doing", title: "Build gate" },
  { id: "4", columnId: "done", title: "Ship PR" },
];

describe("columnCards", () => {
  test("returns a column's cards in order", () => {
    expect(columnCards(cards, "todo").map((c) => c.id)).toEqual(["1", "2"]);
    expect(columnCards(cards, "done").map((c) => c.id)).toEqual(["4"]);
    expect(columnCards(cards, "empty")).toEqual([]);
  });
});

describe("moveCard", () => {
  test("moves a card to another column at an index", () => {
    const next = moveCard(cards, "1", "doing", 0);
    expect(columnCards(next, "doing").map((c) => c.id)).toEqual(["1", "3"]);
    expect(columnCards(next, "todo").map((c) => c.id)).toEqual(["2"]);
  });

  test("reorders within the same column", () => {
    const next = moveCard(cards, "2", "todo", 0);
    expect(columnCards(next, "todo").map((c) => c.id)).toEqual(["2", "1"]);
  });

  test("dropping into an empty column lands the card there", () => {
    const next = moveCard(cards, "4", "empty", 0);
    expect(columnCards(next, "empty").map((c) => c.id)).toEqual(["4"]);
    expect(columnCards(next, "done")).toEqual([]);
  });

  test("clamps an out-of-range index to append", () => {
    const next = moveCard(cards, "3", "todo", 99);
    expect(columnCards(next, "todo").map((c) => c.id)).toEqual(["1", "2", "3"]);
  });

  test("an unknown card id is a no-op copy", () => {
    const next = moveCard(cards, "nope", "done", 0);
    expect(next).toEqual(cards);
    expect(next).not.toBe(cards);
  });

  test("moves across swimlanes when a lane id is given", () => {
    const laned: Card[] = [
      { id: "a", columnId: "todo", laneId: "team-1", title: "A" },
      { id: "b", columnId: "todo", laneId: "team-2", title: "B" },
    ];
    const next = moveCard(laned, "a", "todo", 0, "team-2");
    expect(columnCards(next, "todo", "team-2").map((c) => c.id)).toEqual([
      "a",
      "b",
    ]);
    expect(columnCards(next, "todo", "team-1")).toEqual([]);
  });
});
