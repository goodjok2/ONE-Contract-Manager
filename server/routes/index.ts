import { Router } from "express";
import projectsRouter from "./projects";
import financialsRouter from "./financials";
import contractsRouter from "./contracts";
import llcRouter from "./llc";
import systemRouter from "./system";
import exhibitsRouter from "./exhibits";
import stateDisclosuresRouter from "./state-disclosures";

const router = Router();

router.use(projectsRouter);
router.use(financialsRouter);
router.use(contractsRouter);
router.use(llcRouter);
router.use(systemRouter);
router.use(exhibitsRouter);
router.use(stateDisclosuresRouter);

export default router;
