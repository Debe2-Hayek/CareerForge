import { diagnosticHandlers } from "@/lib/product-signals";
import { authorizeProductSignals, readDiagnosticSummary } from "@/lib/product-signals-server";

const handlers = diagnosticHandlers(authorizeProductSignals, readDiagnosticSummary);
export const { GET, POST } = handlers;
