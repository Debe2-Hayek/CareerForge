import { portfolioSiteHandlers } from "@/lib/portfolio-site-handlers";
import { authorizePortfolioSite } from "@/lib/portfolio-site-server";
export const { GET, PUT } = portfolioSiteHandlers(authorizePortfolioSite);
