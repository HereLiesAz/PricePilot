import { describe, expect, it } from "vitest";
import { RateLimiter, isPathAllowed, parseRobots } from "../src/politeness.js";

describe("parseRobots / isPathAllowed", () => {
  const txt = `
User-agent: *
Disallow: /private
Allow: /private/public

User-agent: PricePilotBot
Disallow: /no-bots
`;

  it("selects the named user-agent group over the wildcard", () => {
    const rules = parseRobots(txt, "PricePilotBot/0.2");
    expect(rules.disallow).toContain("/no-bots");
    expect(rules.disallow).not.toContain("/private"); // that's the * group
  });

  it("falls back to the wildcard group for unknown agents", () => {
    const rules = parseRobots(txt, "SomeOtherBot/1.0");
    expect(rules.disallow).toContain("/private");
  });

  it("allows by default and honors longest-match Allow over Disallow", () => {
    const rules = parseRobots(txt, "OtherBot");
    expect(isPathAllowed("/catalog/item", rules)).toBe(true);
    expect(isPathAllowed("/private/secret", rules)).toBe(false);
    expect(isPathAllowed("/private/public/x", rules)).toBe(true); // longer Allow wins
  });

  it("treats an empty Disallow as allow-all", () => {
    const rules = parseRobots("User-agent: *\nDisallow:", "Bot");
    expect(isPathAllowed("/anything", rules)).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("spaces requests to the same host without delaying the first", async () => {
    const limiter = new RateLimiter(1000);
    let clock = 0;
    const slept: number[] = [];
    const now = () => clock;
    const sleep = async (ms: number) => {
      slept.push(ms);
      clock += ms;
    };

    await limiter.wait("a.test", now, sleep); // first call: no wait
    await limiter.wait("a.test", now, sleep); // second: must wait ~1000ms
    await limiter.wait("b.test", now, sleep); // different host: no wait

    expect(slept[0]).toBe(1000);
    expect(slept).toHaveLength(1);
  });
});
