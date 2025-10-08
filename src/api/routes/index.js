import express from "express";

import curators from "./curators/index.js";

import pitchingTool from "./pitching-tool/index.js";


const router = express.Router();

router.use("/curators", curators);

router.use("/pitching-tool", pitchingTool);

export default router;
