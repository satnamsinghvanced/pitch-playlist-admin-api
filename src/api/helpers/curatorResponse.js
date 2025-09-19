import User from "../../models/user/index.js";
import Playlist from "../../models/playlist/index.js";
import Track from "../../models/track/index.js";
import Referral from "../../models/referral/index.js";
import moment from "moment";
import { getWarningsDetail } from "./getWarningsDetail.js";

const curatorResponse = async (startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) {
      const start = moment(startDate, "DD-MM-YYYY").startOf("day").toDate();
      if (!isNaN(start.getTime())) {
        dateFilter.$gte = start;
      }
    }

    if (endDate) {
      const end = moment(endDate, "DD-MM-YYYY").endOf("day").toDate();
      if (!isNaN(end.getTime())) {
        dateFilter.$lte = end;
      }
    }

    const playlists = await Playlist.find({});
    const userIds = [...new Set(playlists.map((val) => val.playlistOwnerId))];

    const userData = await Promise.all(
      userIds.map(async (userId) => {
        const user = await User.findOne({ spotifyId: userId });
        if (!user) return null;

        const userPlaylists = await Playlist.find({ playlistOwnerId: userId });
        const playlistIds = userPlaylists.map((p) => p._id);

        // Playlist Stats
        const playlistStats = await Playlist.aggregate([
          {
            $facet: {
              totalPlaylists: [{ $count: "count" }],
              submittedPlaylist: [
                { $match: { playlistOwnerId: userId } },
                { $count: "count" },
              ],
              maxPlaylistCount: [
                {
                  $group: {
                    _id: "$playlistOwnerId",
                    count: { $sum: 1 },
                  },
                },
                { $sort: { count: -1 } },
                { $limit: 1 },
              ],
            },
          },
        ]);

        const totalPlaylist = playlistStats[0].totalPlaylists[0]?.count || 0;
        const submittedPlaylist =
          playlistStats[0].submittedPlaylist[0]?.count || 0;
        const maxPlaylistCount =
          playlistStats[0].maxPlaylistCount[0]?.count || 0;

        // Track Stats
        const trackStats = await Track.aggregate([
          {
            $match: {
              playlist: { $in: playlistIds },
              ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
            },
          },
          {
            $facet: {
              submittedTracks: [{ $count: "count" }],
              feedBackGiven: [
                { $match: { status: { $in: ["approved", "declined"] } } },
                { $count: "count" },
              ],
              expiredTrack: [
                { $match: { status: "expired" } },
                { $count: "count" },
              ],
            },
          },
        ]);

        const submittedTracks =
          trackStats[0].submittedTracks[0]?.count || 0;
        const feedBackGiven =
          trackStats[0].feedBackGiven[0]?.count || 0;
        const expiredTrack =
          trackStats[0].expiredTrack[0]?.count || 0;

        const responseRate =
          submittedTracks === 0 ? 0 : feedBackGiven / submittedTracks;

        // Feedback Days
        const feedBackGivenDays = await Track.aggregate([
          {
            $match: {
              playlist: { $in: playlistIds },
              status: { $in: ["approved", "declined"] },
              ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
              },
            },
          },
          { $count: "dayCount" },
        ]);
        const feedBackGivenDaysCount =
          feedBackGivenDays[0]?.dayCount || 0;

        // Referral Stats
        const referralStats = await Referral.aggregate([
          {
            $facet: {
              bonusPoint: [
                {
                  $match: {
                    referredBy: user._id,
                    ...(Object.keys(dateFilter).length && {
                      createdAt: dateFilter,
                    }),
                  },
                },
                { $count: "count" },
              ],
              maxBonusPoint: [
                ...(Object.keys(dateFilter).length
                  ? [{ $match: { createdAt: dateFilter } }]
                  : []),
                {
                  $group: {
                    _id: "$referredBy",
                    count: { $sum: 1 },
                  },
                },
                { $sort: { count: -1 } },
                { $limit: 1 },
              ],
            },
          },
        ]);

        const bonusPoint =
          referralStats[0].bonusPoint[0]?.count || 0;
        const maxBonusPoint =
          referralStats[0].maxBonusPoint[0]?.count || 0;

        // Return structured data
        return {
          userId: { ...user._doc },
          responseRate,
          bonusPoint,
          maxBonusPoint,
          expiredTrack,
          feedBackGiven,
          submittedTracks,
          submittedPlaylist,
          totalPlaylist,
          maxPlaylistCount,
          feedBackGivenDaysCount,
          warningReceived: await getWarningsDetail(
            user._id,
            startDate,
            endDate
          ),
        };
      })
    );

    return userData.filter(Boolean); 
  } catch (err) {
    console.error("curatorResponse error:", err.message);
    return [];
  }
};

export default curatorResponse;
