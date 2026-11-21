import { describe, expect, it } from "vitest";
import { validGuestName, validTestId } from "@/lib/turing";

describe("Turing guest registration", () => {
  it("requires a participant name", () => {
    expect(validGuestName("   ")).toBe(false);
    expect(validGuestName("Yury Slynko")).toBe(true);
  });
  it("accepts a unique test ID rather than arbitrary links", () => {
    expect(validTestId("357aa84e-66f1-4513-85b2-e1530911475b")).toBe(true);
    expect(validTestId("turing_test")).toBe(false);
  });
});