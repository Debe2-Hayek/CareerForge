import { adminWorkshopHandlers } from "@/lib/certified-workshops-handlers";
import { authorizeWorkshopAdmin } from "@/lib/certified-workshops-server";

export const { POST } = adminWorkshopHandlers(authorizeWorkshopAdmin);
