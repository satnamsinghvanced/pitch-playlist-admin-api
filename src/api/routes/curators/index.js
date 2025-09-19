// import generateCuratorList from "../../helpers/generateCuratorList.js";
import TopCuratorAdminList from "../../../models/topCuratorAdminList/index.js";
import auth from "../../../middleware/auth.js";
import express from "express";
import UserVisit from "../../../models/userVisit/index.js";
import { getTopCurators, generateCuratorList } from "../../helpers/allCurator.js";

const router = express.Router();

router.get("/curator-statistics", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      page = 1,
      limit = 100,
      refresh = "false", // optional query to force regeneration
    } = req.query;

    const numericPage = Number(page);
    const numericLimit = Number(limit);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const alreadyGenerated = await TopCuratorAdminList.findOne({
      createdAt: { $gte: todayStart },
    });

    // Only generate if:
    // - it's page 1
    // - AND (not generated today OR explicitly forced)
    
    if (
      numericPage === 1 &&
      (!alreadyGenerated || refresh.toLowerCase() === "true" || startDate && endDate)
    ) {
      console.log("Generating top curators...");
      await generateCuratorList(startDate, endDate);
    }

    // Get paginated list
    const { data, pagination } = await getTopCurators(numericPage, numericLimit);

    // Add last active timestamps
    const result = await Promise.all(
      data.map(async (entry) => {
        const userId = entry.userId?._id || entry.userId;
        const lastVisit = await UserVisit.findOne({ userId }).sort({ createdAt: -1 });

        return {
          ...entry.toObject(),
          lastActive: lastVisit?.createdAt || null,
        };
      })
    );

    return res.status(200).json({
      curators: result,
      pagination,
      message:
        numericPage === 1 && (!alreadyGenerated || refresh === "true")
          ? "Curator list regenerated."
          : "Curator list fetched from existing data.",
    });
  } catch (err) {
    console.error("Error in /curator-statistics:", err.message);
    return res.status(500).json({ msg: err.message });
  }
});

export default router;
