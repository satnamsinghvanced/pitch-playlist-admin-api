import express from "express";
import TopCuratorAdminList from "../../../models/topCuratorAdminList/index.js";
import topCuratorAdminListMonth from "../../../models/topCuratorAdminListMonth/index.js";
import topCuratorAdminListSevenDays from "../../../models/topCuratorAdminListSevenDays/index.js";
import topCuratorAdminListYear from "../../../models/topCuratorAdminListYear/index.js";
import generateCuratorList from "../../helpers/generateCuratorList.js";
import generateCuratorListMonth from "../../helpers/generateCuratorListMonth.js";
import generateCuratorListSevenDays from "../../helpers/generateCuratorListSevenDays.js";
import generateCuratorListYear from "../../helpers/generateCuratorListYear.js";
import UserVisit from "../../../models/userVisit/index.js";
import { getTopCurators, getTopCuratorsMonth, getTopCuratorsSeven, getTopCuratorsYear } from "../../helpers/allCurator.js";
import cron from "node-cron"

const router = express.Router();

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
router.get("/curator-statistics", async (req, res) => {
  try {
    let { startDate, endDate, page = 1, limit = 100, isSeven, isMonth, isYear } = req.query;

    page = Number(page);
    limit = Number(limit);

    // Convert string "true"/"false" to boolean
    isSeven = isSeven === "true";
    isMonth = isMonth === "true";
    isYear = isYear === "true";

    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;

    if (start) start = toStartOfDay(start);
    if (end) end = toStartOfDay(end);

    if (start && end && start > end) {
      [start, end] = [end, start];
    }

    let diffDays = null;
    if (start && end) {
      diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    const todayStart = toStartOfDay(new Date());

    let alreadyGenerated;

    if (isSeven) {
      alreadyGenerated = await topCuratorAdminListSevenDays.findOne({
        createdAt: { $gte: todayStart },
      });
    } else if (isMonth) {
      alreadyGenerated = await topCuratorAdminListMonth.findOne({
        createdAt: { $gte: todayStart },
      });
    } else if (isYear) {
      alreadyGenerated = await topCuratorAdminListYear.findOne({
        createdAt: { $gte: todayStart },
      });
    } else {
      alreadyGenerated = await TopCuratorAdminList.findOne({
        createdAt: { $gte: todayStart },
      });
    }

    if (page === 1) {
      if (!alreadyGenerated) {
        if (isSeven) {
          console.log("Generating 7 days top curators...");
          await generateCuratorListSevenDays(start, end);
        } else if (isMonth) {
          console.log("Generating monthly top curators...");
          await generateCuratorListMonth(start, end);
        } else if (isYear) {
          console.log("Generating year top curators...");
          await generateCuratorListYear(start, end);
        } else {
          console.log("Generating default top curators...");
          await generateCuratorList(start, end);
        }
      }
    }

    let data, pagination;

    if (isSeven) {
      ({ data, pagination } = await getTopCuratorsSeven(page, limit, topCuratorAdminListSevenDays));
    } else if (isMonth) {
      ({ data, pagination } = await getTopCuratorsMonth(page, limit, topCuratorAdminListMonth));
    } else if (isYear) {
      ({ data, pagination } = await getTopCuratorsYear(page, limit, topCuratorAdminListYear));
    } else {
      ({ data, pagination } = await getTopCurators(page, limit, TopCuratorAdminList));
    }

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
        page === 1 && (!alreadyGenerated || (start && end))
          ? "Curator list regenerated."
          : "Curator list fetched from existing data.",
    });
  } catch (err) {
    console.error("Error in /curator-statistics:", err);
    return res.status(500).json({ msg: err.message });
  }
});


 
cron.schedule("*/3 * * * *", async () => {
  try {
    console.log("Cron job started: Generating curator lists...");

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 7 days ago
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(todayStart.getDate() - 7);

    // 30 days ago
    const monthAgo = new Date(todayStart);
    monthAgo.setDate(todayStart.getDate() - 30);

    const yearAgo = new Date(todayStart);
    yearAgo.setDate(todayStart.getDate() - 365);

    // Generate 7 days list
    // await generateCuratorListSevenDays(
    //   sevenDaysAgo.toISOString(),
    //   todayStart.toISOString()
    // );
    // console.log("✅ 7 days curator list generated");

    // Generate month list
    // await generateCuratorListMonth(
    //   monthAgo.toISOString(),
    //   todayStart.toISOString()
    // );
    // console.log("✅ Monthly curator list generated");

    // Generate overall/default list
    await generateCuratorList();
    console.log("✅ Default curator list generated");

    // await generateCuratorListYear(
    //   yearAgo.toISOString(),
    //   todayStart.toISOString()
    // );
    // console.log("✅ Year curator list generated");
  } catch (error) {
    console.error("❌ Cron job failed:", error.message);
  }
});
export default router;
