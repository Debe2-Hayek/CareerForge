import { workshopHandlers } from "@/lib/workshops/handlers";
import { authorizeWorkshops } from "@/lib/workshops/server";
import { workshopService } from "@/lib/workshops/service";
const handlers = workshopHandlers(authorizeWorkshops, () => workshopService.catalog());
export const PUT = handlers.bookmark;
