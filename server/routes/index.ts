import { Router } from "express";
import projectsRouter from "./projects";
import financialsRouter from "./financials";
import contractsRouter from "./contracts";
import llcRouter from "./llc";
import systemRouter from "./system";
import exhibitsRouter from "./exhibits";

const router = Router();

router.use(projectsRouter);
router.use(financialsRouter);
router.use(contractsRouter);
router.use(llcRouter);
router.use(systemRouter);
router.use(exhibitsRouter);

export default router;
