import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  findAll,
  findById,
  create,
  update,
  refund,
  remove,
} from "./payments.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", findAll);
router.get("/:id", findById);
router.post("/", create);
router.patch("/:id", update);
router.post("/:id/refund", refund);
router.delete("/:id", remove);

export const paymentRouter = router;
