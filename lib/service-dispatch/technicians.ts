import type {
  TechnicianProfile,
  TechnicianRecommendation,
  TechnicianAvailabilityStatus,
} from "./types";

export const SEED_TECHNICIANS: TechnicianProfile[] = [
  {
    id: "tech-toby",
    name: "Toby Tompkins",
    status: "AVAILABLE",
    currentTicketId: null,
    nextTicketId: null,
    dailyTicketCount: 2,
    estimatedWorkloadHours: 3.5,
    territory: "Southern Maine",
    certifications: ["GD9630", "GL9730", "VALEZUS"],
    supportedModels: ["GD9630", "GL9730", "VALEZUS T1200", "VALEZUS T2100"],
    latitude: 43.66,
    longitude: -70.25,
    familiarCustomerIds: ["cust-sfx"],
    familiarPrinterIds: ["mx-gd-002", "MX-GD-002"],
  },
  {
    id: "tech-alex",
    name: "Alex Rivera",
    status: "ON_SITE",
    currentTicketId: null,
    nextTicketId: null,
    dailyTicketCount: 4,
    estimatedWorkloadHours: 6,
    territory: "Coastal NH",
    certifications: ["GD9630", "VALEZUS"],
    supportedModels: ["GD9630", "VALEZUS T1200"],
    latitude: 43.07,
    longitude: -70.76,
    familiarCustomerIds: ["cust-northstar"],
    familiarPrinterIds: [],
  },
  {
    id: "tech-jordan",
    name: "Jordan Lee",
    status: "TRAVELING",
    currentTicketId: null,
    nextTicketId: null,
    dailyTicketCount: 3,
    estimatedWorkloadHours: 5,
    territory: "Southern Maine",
    certifications: ["GD9630", "GL9730"],
    supportedModels: ["GD9630", "GL9730"],
    latitude: 43.5,
    longitude: -70.4,
    familiarCustomerIds: ["cust-sfx"],
    familiarPrinterIds: [],
  },
  {
    id: "tech-sam",
    name: "Sam Okonkwo",
    status: "AVAILABLE",
    currentTicketId: null,
    nextTicketId: null,
    dailyTicketCount: 1,
    estimatedWorkloadHours: 2,
    territory: "Northern New England",
    certifications: ["VALEZUS", "GD9630"],
    supportedModels: ["VALEZUS T1200", "VALEZUS T2100", "GD9630"],
    latitude: 44.3,
    longitude: -69.8,
    familiarCustomerIds: [],
    familiarPrinterIds: [],
  },
];

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function recommendTechnicians(input: {
  technicians: TechnicianProfile[];
  printerModel: string;
  customerId?: string;
  printerId?: string;
  siteLat?: number | null;
  siteLon?: number | null;
  priority: string;
  requiredPartsAvailableFor?: string[];
}): TechnicianRecommendation[] {
  const scored = input.technicians.map((t) => {
    const reasons: string[] = [];
    let score = 50;

    if (t.status === "AVAILABLE") {
      score += 25;
      reasons.push("Available now");
    } else if (t.status === "ASSIGNED") {
      score += 5;
      reasons.push("Already assigned elsewhere");
    } else if (t.status === "OFF_DUTY" || t.status === "OUT_OF_OFFICE") {
      score -= 40;
      reasons.push(t.status.replaceAll("_", " "));
    } else {
      score -= 10;
      reasons.push(`Currently ${t.status.replaceAll("_", " ").toLowerCase()}`);
    }

    if (t.supportedModels.some((m) => m.toLowerCase().includes(input.printerModel.toLowerCase().slice(0, 5)))) {
      score += 20;
      reasons.push("Certified / supports model");
    } else {
      score -= 15;
      reasons.push("Model not in supported list");
    }

    if (input.customerId && t.familiarCustomerIds.includes(input.customerId)) {
      score += 12;
      reasons.push("Familiar with customer");
    }
    if (input.printerId && t.familiarPrinterIds.includes(input.printerId)) {
      score += 15;
      reasons.push("Familiar with printer");
    }

    if (t.estimatedWorkloadHours <= 4) {
      score += 10;
      reasons.push("Light workload");
    } else if (t.estimatedWorkloadHours >= 7) {
      score -= 12;
      reasons.push("Heavy workload");
    }

    if (
      input.siteLat != null &&
      input.siteLon != null &&
      t.latitude != null &&
      t.longitude != null
    ) {
      const km = haversineKm(
        { lat: t.latitude, lon: t.longitude },
        { lat: input.siteLat, lon: input.siteLon },
      );
      if (km < 30) {
        score += 15;
        reasons.push(`Nearby (~${Math.round(km)} km)`);
      } else if (km > 120) {
        score -= 10;
        reasons.push(`Distant (~${Math.round(km)} km)`);
      }
    }

    if (input.priority === "CRITICAL" || input.priority === "HIGH") {
      if (t.status === "AVAILABLE") score += 8;
    }

    if (input.requiredPartsAvailableFor?.includes(t.id)) {
      score += 10;
      reasons.push("Has required parts");
    }

    return {
      technicianId: t.id,
      technicianName: t.name,
      score: Math.max(0, Math.min(100, score)),
      reasons,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function updateTechnicianStatus(
  tech: TechnicianProfile,
  status: TechnicianAvailabilityStatus,
  currentTicketId: string | null = tech.currentTicketId,
): TechnicianProfile {
  return { ...tech, status, currentTicketId };
}
