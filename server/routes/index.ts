import { Router } from "express";
import projectsRouter from "./projects";
import financialsRouter from "./financials";
import contractsRouter from "./contracts";
import systemRouter from "./system";

const router = Router();

router.use(projectsRouter);
router.use(financialsRouter);
router.use(contractsRouter);
router.use(systemRouter);

export default router;
