import { learnerWorkshopHandlers } from "@/lib/certified-workshops-handlers";
import { authorizeLearner } from "@/lib/certified-workshops-server";

export const { POST } = learnerWorkshopHandlers(authorizeLearner);
