import assert from "node:assert/strict";
import test from "node:test";
import { nextMobileWork, prioritizeMobileWork } from "./mobile-work-queue";
type Job = Parameters<typeof nextMobileWork>[0][number];
const now = new Date(2026, 8, 11, 12);
const job = (id: string, changes: Partial<Job> = {}): Job => ({
  id, assignedTechnician: "Alex", secondaryTechnician: "",
  status: "ASSIGNED", priority: "NORMAL",
  scheduledStart: new Date(2026, 8, 11, 9).toISOString(), ...changes,
});
test("active work comes before critical; input is not mutated", () => {
  const jobs = [job("critical", { priority: "CRITICAL" }), job("active", { status: "ON_SITE" })];
  assert.equal(nextMobileWork(jobs, "Alex", now)?.id, "active");
  assert.equal(jobs[0].id, "critical");
});
test("next job excludes other technicians, blocked, closed, drafts, and future work", () => {
  const jobs = [job("other", { assignedTechnician: "Sam" }),
    ...(["WAITING_FOR_PARTS", "WAITING_FOR_CUSTOMER", "ON_HOLD", "COMPLETED", "CANCELLED", "CLOSED", "DRAFT"] as const).map(status => job(status, {status})),
    job("future", {scheduledStart: new Date(2026, 8, 12, 9).toISOString()}),
    job("secondary", {assignedTechnician: "Sam", secondaryTechnician: "Alex"})];
  assert.equal(nextMobileWork(jobs, "Alex", now)?.id, "secondary");
  assert.equal(nextMobileWork(jobs, "", now), undefined);
});
test("critical precedes overdue and overdue precedes today's work", () => {
  const jobs = [job("today"), job("late", {scheduledStart:new Date(2026,8,10,9).toISOString()}), job("critical",{priority:"CRITICAL"})];
  assert.deepEqual(prioritizeMobileWork(jobs, now).map(x=>x.id), ["critical","late","today"]);
});
test("invalid dates are not recommended; unscheduled work is supported", () => {
  assert.equal(nextMobileWork([job("invalid",{scheduledStart:"invalid"})], "Alex", now), undefined);
  assert.equal(nextMobileWork([job("unscheduled",{scheduledStart:null})], "Alex", now)?.id, "unscheduled");
});
test("sorting retains blocked and completed records for list filters", () => {
  const jobs = [job("closed",{status:"CLOSED"}), job("waiting",{status:"WAITING_FOR_PARTS"}), job("ready")];
  assert.deepEqual(prioritizeMobileWork(jobs, now).map(x=>x.id), ["ready","waiting","closed"]);
});
