import ResponseRate from "../../models/responseRate/index.js";
import TopCuratorAdminListJs from "../../models/topCuratorAdminList/index.js";
import Playlist from "../../models/playlist/index.js";
import getCountryName from "./getCountryName.js";
const generateDashboardCuratorList = async (start, end) => {
  try {
    const responseRate = await ResponseRate.find({
      updatedAt: {
        $gte: start,
        $lt: end,
      },
    }).populate("userId");
    const sortedResponseRates = responseRate
      .map((rate) => {
       const score =
        ((rate.submittedPlaylist/rate.totalPlaylist) * 0.4 + rate.responseRate * 0.4)*100+ rate.bonusPoint
        return { ...rate._doc, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    const sortedByScore = sortedResponseRates.sort((a, b) => b.score - a.score);
    const topUsersWithPosition = await Promise.all(
      sortedByScore.map(async (rate, index) => {
        const place = index + 1;
        const allPlaylists = await Playlist.find({
          isActive: true,
          userId: rate.userId,
        });
        const allGenres = allPlaylists.map((val) => val.genres).flat();
        const country =
          rate?.userId?.country !== "UK" ? rate?.userId?.country : "GB";
        const countryName = getCountryName(country);

        return {
          position: place,
          userId: rate.userId,
          responseRate: rate.responseRate,
          totalSongs: rate.totalSongs,
          totalPlaylist: rate.totalPlaylist,
          lastWeek: rate.lastWeek,
          peak: rate.peak,
          weekInTopChart: rate.weekInTopChart,
          allGenres,
          referral: rate.bouncePoint,
          bouncePoint: rate.bouncePoint,
          weightedScore: rate.score,
          feedbackGiven: rate.feedbackGiven,
          countryName,
        };
      })
    );
    return topUsersWithPosition;
  } catch (err) {
    console.error(err.message);
  }
};
export default generateDashboardCuratorList;
