import { learningHandlers } from "@/lib/learning/handlers";
import { authorizeLearning } from "@/lib/learning/server";
export const { GET } = learningHandlers(authorizeLearning);
