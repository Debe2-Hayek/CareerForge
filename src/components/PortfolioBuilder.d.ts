import type { ComponentType } from "react";
import type { BuilderState, PublishedState } from "@/lib/portfolio-site";

/** Type boundary for the owner's supplied JSX component (plus CareerForge's optional save hooks). */
declare const PortfolioBuilder: ComponentType<{
  initialState?: BuilderState;
  onStateChange?: (state: BuilderState) => void;
}>;
export default PortfolioBuilder;

/** Read-only published website view of the builder's portfolio. */
export declare const PublishedPortfolio: ComponentType<{ state: PublishedState }>;
