import { staffWorkshopHandlers } from "@/lib/certified-workshops-handlers";
import { authorizeStaff } from "@/lib/certified-workshops-server";

export const { POST } = staffWorkshopHandlers(authorizeStaff);
