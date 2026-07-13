import type {
  DigitalTwinMachine,
  MachineHealthBand,
  MachineHealthScore,
  MachineNetworkState,
  MachineStatus,
} from "./types";

/**
 * Placeholder health score until live telemetry / RRA is connected.
 * Uses status, open calls, alerts, PM remaining, network, and downtime.
 */
export function calculateMachineHealthScore(input: {
  status: MachineStatus;
  openServiceCalls: number;
  unresolvedAlertCount: number;
  pmMeterRemaining: number;
  networkStatus: MachineNetworkState;
  downtimeStatus: string;
}): MachineHealthScore {
  let score = 100;
  const factors: string[] = [];

  switch (input.status) {
    case "ONLINE":
      break;
    case "DEGRADED":
      score -= 15;
      factors.push("Machine degraded");
      break;
    case "SERVICE_REQUIRED":
      score -= 25;
      factors.push("Service required");
      break;
    case "OFFLINE":
      score -= 35;
      factors.push("Machine offline");
      break;
    case "DOWN":
      score -= 50;
      factors.push("Machine down");
      break;
    case "INSTALLATION":
      score -= 10;
      factors.push("Installation in progress");
      break;
    case "RETIRED":
      score = 0;
      factors.push("Retired");
      break;
  }

  if (input.openServiceCalls > 0) {
    const penalty = Math.min(20, input.openServiceCalls * 8);
    score -= penalty;
    factors.push(`${input.openServiceCalls} open service call(s)`);
  }

  if (input.unresolvedAlertCount > 0) {
    const penalty = Math.min(20, input.unresolvedAlertCount * 5);
    score -= penalty;
    factors.push(`${input.unresolvedAlertCount} active alert(s)`);
  }

  if (input.pmMeterRemaining <= 0) {
    score -= 20;
    factors.push("PM overdue");
  } else if (input.pmMeterRemaining < 25_000) {
    score -= 10;
    factors.push("PM due soon");
  }

  if (input.networkStatus === "DISCONNECTED") {
    score -= 15;
    factors.push("Network disconnected");
  } else if (input.networkStatus === "INTERMITTENT") {
    score -= 8;
    factors.push("Intermittent network");
  }

  if (/down|out of service/i.test(input.downtimeStatus)) {
    score -= 10;
    factors.push("Downtime flagged");
  }

  score = Math.max(0, Math.min(100, score));

  let band: MachineHealthBand = "HEALTHY";
  if (score < 40) band = "CRITICAL";
  else if (score < 60) band = "AT_RISK";
  else if (score < 80) band = "WATCH";

  if (factors.length === 0) factors.push("No active risk factors");

  return { score, band, factors };
}

export function withCalculatedHealth(
  machine: Omit<DigitalTwinMachine, "health">,
): DigitalTwinMachine {
  const unresolved = machine.alerts.filter((a) => !a.resolved).length;
  return {
    ...machine,
    health: calculateMachineHealthScore({
      status: machine.operational.status,
      openServiceCalls: machine.service.openServiceCalls,
      unresolvedAlertCount: unresolved,
      pmMeterRemaining: machine.service.currentPmMeterRemaining,
      networkStatus: machine.network.networkStatus,
      downtimeStatus: machine.service.downtimeStatus,
    }),
  };
}
