import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveOfficeQueueRollout,
  useServerOfficeQueueSource,
} from "./office-queue-rollout";

describe("office queue rollout", () => {
  it("uses browser queue by default when the office flag is off", () => {
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: false,
      isManager: true,
      guardCheck: { state: "not-required" },
    });
    assert.equal(resolution.source, "browser");
    assert.equal(resolution.indicator, "browser-default");
    assert.equal(useServerOfficeQueueSource(resolution), false);
  });

  it("uses server queue for managers when flag is on and guard is ready", () => {
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      guardCheck: { state: "ready", guardReady: true, blockedReasons: [] },
    });
    assert.equal(resolution.source, "server");
    assert.equal(resolution.indicator, "server-active");
  });

  it("falls back to browser for non-managers when the flag is on", () => {
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: false,
      guardCheck: { state: "not-required" },
    });
    assert.equal(resolution.source, "browser");
    assert.equal(resolution.indicator, "browser-rollback");
  });

  it("falls back to browser for managers when the guard is blocked", () => {
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      guardCheck: {
        state: "ready",
        guardReady: false,
        blockedReasons: ["2 mismatch(es) on matched records."],
      },
    });
    assert.equal(resolution.source, "browser");
    assert.equal(resolution.indicator, "browser-rollback");
    assert.ok(resolution.blockedReasons.length > 0);
  });

  it("stays on browser while guard check is pending", () => {
    const resolution = resolveOfficeQueueRollout({
      officeFlagEnabled: true,
      isManager: true,
      guardCheck: { state: "pending" },
    });
    assert.equal(resolution.source, "browser");
    assert.equal(useServerOfficeQueueSource(resolution), false);
  });
});
