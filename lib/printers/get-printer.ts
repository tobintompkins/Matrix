import { getPrinterById } from "./data";
import type { PrinterDetail } from "./types";

/**
 * Data access layer for printer details.
 * Replace this function with a database query when Prisma is added.
 */
export async function getPrinter(id: string): Promise<PrinterDetail | null> {
  return getPrinterById(id);
}
