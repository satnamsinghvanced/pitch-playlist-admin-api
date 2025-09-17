import User from "../../models/user/index.js";
import Playlist from "../../models/playlist/index.js";
import Track from "../../models/track/index.js";
import Referral from "../../models/referral/index.js";
import moment from "moment";
import { getWarningsDetail } from "./getWarningsDetail.js";

const curatorResponse = async (startDate, endDate) => {
  try {
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      const start = moment(startDate, "DD-MM-YYYY").toDate();
      if (!isNaN(start.getTime())) dateFilter.$gte = start;
      else console.error("Invalid startDate:", startDate);
    }
    if (endDate) {
      const end = moment(endDate, "DD-MM-YYYY").toDate();
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      } else console.error("Invalid endDate:", endDate);
    }

    // Fetch all playlist owners
    const playlists = await Playlist.find({}, { playlistOwnerId: 1 }).lean();
    const userIds = [...new Set(playlists.map((p) => p.playlistOwnerId))];

    const batchSize = 20; // process 20 users at a time
    const userDate = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      for (const userId of batch) {
        // Fetch user fields only
        const user = await User.findOne({ spotifyId: userId }, { _id: 1, country: 1 }).lean();
        if (!user) continue;

        // Fetch user's playlists with only necessary fields
        const allPlaylists = await Playlist.find(
          { playlistOwnerId: userId },
          { _id: 1, genres: 1, createdAt: 1 }
        ).lean();

        const playlistIds = allPlaylists.map((p) => p._id);

        // Submitted playlists count
        const submittedPlaylist = await Playlist.countDocuments({
          playlistOwnerId: userId,
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        });

        // Submitted tracks count
        const submittedTracks = await Track.countDocuments({
          playlist: { $in: playlistIds },
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
        });

        // Feedback given
        const feedBackGiven = await Track.countDocuments({
          playlist: { $in: playlistIds },
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
          status: { $in: ["approved", "declined"] },
        });

        // Expired tracks
        const expiredTrack = await Track.countDocuments({
          playlist: { $in: playlistIds },
          status: "expired",
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
        });

        // Bonus points
        const bonusPoint = await Referral.countDocuments({
          referredBy: user._id,
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        });

        // Max playlist count
        const maxPlaylistsAgg = await Playlist.aggregate([
          { $group: { _id: "$playlistOwnerId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ]);
        const maxPlaylistCount = maxPlaylistsAgg[0]?.count || 0;

        // Max bonus points
        const maxBonusAgg = await Referral.aggregate([
          { $group: { _id: "$referredBy", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ]);
        const maxBonusPoint = maxBonusAgg[0]?.count || 0;

        // Calculate response rate
        const responseRate = submittedTracks === 0 ? 0 : feedBackGiven / submittedTracks;

        // Feedback given days
        const feedBackGivenDaysAgg = await Track.aggregate([
          {
            $match: {
              playlist: { $in: playlistIds },
              status: { $in: ["approved", "declined"] },
              ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
            },
          },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } } } },
          { $count: "dayCount" },
        ]);
        const feedBackGivenDaysCount = feedBackGivenDaysAgg[0]?.dayCount || 0;

        // Warnings
        const warningReceived = await getWarningsDetail(user._id, startDate, endDate);

        userDate.push({
          userId: user,
          responseRate,
          bonusPoint,
          maxBonusPoint,
          expiredTrack,
          feedBackGiven,
          submittedTracks,
          submittedPlaylist,
          maxPlaylistCount,
          feedBackGivenDaysCount,
          warningReceived,
        });
      }
    }

    return userDate;
  } catch (err) {
    console.error(err.message, "error");
  }
};

export default curatorResponse;
