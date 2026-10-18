import { AppError } from "../../middleware/error.js";
import { findAll, findById, findByName, create, update, remove, UpdatePlanData } from "./plans.repository.js";
import { createPlanSchema } from "./plans.schema.js";


export const listPlans = () => findAll()

export async function getPlanById(id: number) {
  const plan = await findById(id);
  if (!plan) {
    throw new AppError(404, "PLAN_NOT_FOUND", "Plan not found");
  }
  return plan
}

export async function createPlan(data: unknown) {
  const parsed = createPlanSchema.parse(data);

const existingPlan = await findByName(parsed.name);
  if (existingPlan) {
    throw new AppError(409, "PLAN_EXISTS", "A plan with this name already exists");
  }

  return create(parsed);
}



