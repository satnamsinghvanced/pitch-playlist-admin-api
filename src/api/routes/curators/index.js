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




export default router;
