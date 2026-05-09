import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import vendorsRouter from "./vendors";
import procurementRouter from "./procurement";
import inventoryRouter from "./inventory";
import auditRouter from "./audit";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";
import workflowRouter from "./workflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(vendorsRouter);
router.use(procurementRouter);
router.use(inventoryRouter);
router.use(auditRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);
router.use(workflowRouter);

export default router;
