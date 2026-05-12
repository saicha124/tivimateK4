import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stalkerRouter from "./stalker";
import m3uRouter from "./m3u";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stalkerRouter);
router.use(m3uRouter);

export default router;
