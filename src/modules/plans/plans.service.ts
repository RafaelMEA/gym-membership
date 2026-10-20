import { AppError } from "../../middleware/error.js";
import { findAll, findById, findByName, create, update, remove, PlanRow } from "./plans.repository.js";
import { createPlanSchema, updatePlanSchema } from "./plans.schema.js";


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

export async function updatePlan(id: number, data: unknown): Promise<PlanRow> {
  const parsed = updatePlanSchema.parse(data)

  const plan = await findById(id)
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found')

  if (parsed.name && parsed.name !== plan.name) {          
  const existing = await findByName(parsed.name)
  if (existing) throw new AppError(409, 'PLAN_EXISTS', 'A plan with this name already exists')
  }

  const updated = await update (id, parsed)
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Plan not found')
  
  return updated
}

export async function removePlan(id: number, actor: { role: string}) {
  if (actor.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only admins may delete plans')
  }
  const affected = await remove(id)
  if (affected === 0) throw new AppError(404, 'NOT_FOUND', 'Plan not found')
}






