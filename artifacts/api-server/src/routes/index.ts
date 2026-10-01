import { Router, type IRouter } from "express";
import communityRouter from "./community";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(communityRouter);

export default router;
