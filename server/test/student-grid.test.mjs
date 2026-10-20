import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, run } from "../db.mjs";
import { studentGrid } from "../student-grid.mjs";

test("student grid sorts and filters the entire dataset before selecting a page, preserves legacy paging", () => {
  const db = openDatabase(":memory:");
  try {
    for (let i = 0; i < 125; i++)
      run(
        db,
        "INSERT INTO students(code,first_name,last_name,phone,status,search_text) VALUES(?,?,?,?,?,?)",
        "GRID-" + String(i).padStart(3, "0"),
        "کیان",
        "هنرجو " + i,
        "+98912" + String(i).padStart(7, "0"),
        i % 2 ? "active" : "inactive",
        "کیان هنرجو " + i,
      );
    const query = {
      startRow: "100",
      endRow: "125",
      sortModel: JSON.stringify([{ colId: "code", sort: "asc" }]),
    };
    const page = studentGrid(db, query);
    assert.equal(page.total, 125);
    assert.equal(page.items.length, 25);
    assert.equal(page.items[0].code, "GRID-100");
    assert.equal(page.items.at(-1).code, "GRID-124");
    const legacy = studentGrid(db, { page: "2" });
    assert.equal(legacy.items.length, 20);
    assert.equal(legacy.items[0].code, "GRID-104");
    const filter = {
      name: { filterType: "text", type: "startsWith", filter: "كيان" },
      status: { filterType: "text", type: "equals", filter: "فعال" },
    };
    const active = studentGrid(db, {
      startRow: "0",
      endRow: "10",
      filterModel: JSON.stringify(filter),
      sortModel: query.sortModel,
    });
    assert.equal(active.total, 62);
    assert.equal(active.items[0].code, "GRID-001");
    assert.equal(active.items.at(-1).code, "GRID-019");
    const combined = studentGrid(db, {
      filterModel: JSON.stringify({
        code: {
          operator: "OR",
          conditions: [
            { filterType: "text", type: "equals", filter: "GRID-001" },
            { filterType: "text", type: "equals", filter: "GRID-124" },
          ],
        },
      }),
    });
    assert.equal(combined.total, 2);
    assert.equal(
      studentGrid(db, {
        filterModel: JSON.stringify({
          code: { filterType: "text", type: "contains", filter: "%" },
        }),
      }).total,
      0,
    );
  } finally {
    db.close();
  }
});

test("student grid rejects unsafe fields, malformed models and oversized blocks", () => {
  const db = openDatabase(":memory:");
  try {
    for (const query of [
      {
        sortModel: JSON.stringify([
          { colId: "id;DROP TABLE students", sort: "asc" },
        ]),
      },
      { sortModel: JSON.stringify([{ colId: "code", sort: "asc;DROP" }]) },
      { filterModel: "{" },
      {
        filterModel: JSON.stringify({
          password: { filterType: "text", type: "contains", filter: "a" },
        }),
      },
      { startRow: "0", endRow: "10000" },
      {
        filterModel: JSON.stringify({
          name: {
            filterType: "text",
            operator: "OR",
            conditions: [{ operator: "OR" }],
          },
        }),
      },
    ])
      assert.throws(() => studentGrid(db, query));
    assert.equal(studentGrid(db, {}).total, 0);
  } finally {
    db.close();
  }
});
