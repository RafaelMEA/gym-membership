import type { Request, Response, NextFunction } from "express";
import {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  removePlan,
} from "./plans.service.js";

export async function findAll(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await listPlans();
    res.json({
      data: rows,
      meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await createPlan(req.body);
    res.status(201).location(`/api/plans/${plan.id}`).json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function findById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({
        error: { code: "INVALID_ID", message: "Invalid plan ID", details: [] },
      });
      return
  }

  try {
    const plan = await getPlanById(id);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction){
    const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({
        error: { code: "INVALID_ID", message: "Invalid plan ID", details: [] },
      });
      return
  }
  try {
      const plan = await updatePlan(id, req.body)
      res.json({ data: plan })
    } catch (err) {
      next(err)
    }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
    const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid plan ID', details: [] } })
    return
  }
  try{
    const actor = res.locals.staff
    await removePlan(id, actor)
    res.status(204).end()
  }catch (err) {
    next(err)
  }
}
