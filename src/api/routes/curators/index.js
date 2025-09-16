
import generateCuratorList from "../../helpers/generateCuratorList.js";
import TopCuratorAdminList from "../../../models/topCuratorAdminList/index.js";
import auth from "../../../middleware/auth.js";
import express from "express";

const router = express.Router();

router.get("/curator-statistics", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    await generateCuratorList(startDate, endDate);

    const latestEntry = await TopCuratorAdminList.findOne().sort({
      createdAt: -1,
    });
    if (!latestEntry)
      return res.status(404).json({ msg: "No curator list found" });

    const latestDate = new Date(latestEntry.createdAt);
    latestDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(latestDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const topCurator = await TopCuratorAdminList.find({
      createdAt: { $gte: latestDate, $lt: nextDay },
    }).populate("userId");

    const topCuratorChart = await Promise.all(
      topCurator.map(async (val) => {
        const userId = val.userId?._id;

        const [warning, active] = await Promise.all([
          // getWarningsDetail(userId, startDate, endDate),
          UserVisit.findOne({ userId }).sort({ createdAt: -1 }),
        ]);

        return {
          ...val.toObject(),
          lastActive: active?.createdAt || null,
        };
      })
    );

    res.status(200).json(topCuratorChart);
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ msg: err.message });
  }
});
export default router;