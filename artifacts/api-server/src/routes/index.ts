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
import usersRouter from "./users";
import tenantsRouter from "./tenants";
import invoicesRouter from "./invoices";
import sseRouter from "./sse";
import reportsRouter from "./reports";

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
router.use(usersRouter);
router.use(tenantsRouter);
router.use(invoicesRouter);
router.use(sseRouter);
router.use(reportsRouter);

export default router;
