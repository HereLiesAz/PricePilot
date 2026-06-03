import { describe, expect, it } from "vitest";
import { parseImport } from "../src/import/parse.js";

describe("parseImport", () => {
  it("parses CSV with a header row", () => {
    const csv = [
      "title,url,targetPrice,qty",
      'Headphones,https://shop.example/hp,99.99,2',
      '"Cable, braided",https://shop.example/cable,,1',
    ].join("\n");
    const rows = parseImport("csv", csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "Headphones",
      url: "https://shop.example/hp",
      targetPrice: 99.99,
      qty: 2,
    });
    expect(rows[1]!.title).toBe("Cable, braided");
  });

  it("treats a headerless single column as urls or titles", () => {
    const rows = parseImport("csv", "https://shop.example/a\nJust a title");
    expect(rows[0]).toMatchObject({ url: "https://shop.example/a" });
    expect(rows[1]).toMatchObject({ title: "Just a title" });
  });

  it("parses JSON arrays and ignores rows without url or title", () => {
    const json = JSON.stringify([
      { url: "https://shop.example/x", target_price: "50" },
      { note: "no identifier" },
      { name: "By name" },
    ]);
    const rows = parseImport("json", json);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ url: "https://shop.example/x", targetPrice: 50 });
    expect(rows[1]).toMatchObject({ title: "By name" });
  });
});
