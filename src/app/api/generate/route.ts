import { documentGenerateHandlers } from "@/lib/ai/handlers";
import { aiProvider, authorizeAi } from "@/lib/ai/server";

// Compatibility URL required by the owner's byte-for-byte PortfolioBuilder.jsx.
export const maxDuration = 60;
const { compatibilityPOST } = documentGenerateHandlers(authorizeAi, aiProvider);
export { compatibilityPOST as POST };
