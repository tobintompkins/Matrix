import type { MatrixUserProfile } from "@/lib/auth/types";
import { fieldApiActor } from "./api-authorization";

export type AuthorizedFieldSyncOperation = {
  operationId: string;
  type: string;
  workOrderId: string | null;
  printerId: string | null;
  payload: Record<string, unknown>;
  dependsOn: string[];
};

export function buildFieldSyncReceipt(
  profile: MatrixUserProfile,
  userId: string,
  operation: AuthorizedFieldSyncOperation,
) {
  return {
    operationId: operation.operationId,
    type: operation.type,
    userId,
    technicianName: fieldApiActor(profile),
    workOrderId: operation.workOrderId,
    printerId: operation.printerId,
    payload: JSON.stringify(operation.payload),
    dependsOnJson: JSON.stringify(operation.dependsOn),
  };
}
