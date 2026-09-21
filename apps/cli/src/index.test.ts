import { describe, expect, it } from "vitest";
import { runAcquisitionDemo } from "./demo.js";

describe("acquisition demo", () => {
  it("produces a verified, non-mutating recovery candidate", async () => {
    const result = await runAcquisitionDemo();
    expect(result.verification).toBe("verified");
    expect(result.guard).toBe("allow");
    expect(result.boundary).toContain("deployment-v18");
  });
});
