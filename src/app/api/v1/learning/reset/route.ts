import { learningHandlers } from "@/lib/learning/handlers";
import { authorizeLearning } from "@/lib/learning/server";
const handlers = learningHandlers(authorizeLearning);
export const POST = handlers.reset;
