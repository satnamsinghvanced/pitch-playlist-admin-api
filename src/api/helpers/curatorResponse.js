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
      let start = moment(startDate, "DD-MM-YYYY").toDate();
      if (!isNaN(start.getTime())) {
        dateFilter.$gte = start;
      } else {
        console.error("Invalid startDate:", startDate);
      }
    }

    if (endDate) {
      let end = moment(endDate, "DD-MM-YYYY").toDate();
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      } else {
        console.error("Invalid endDate:", endDate);
      }
    }
    const playlists = await Playlist.find({});
    const userIds = [...new Set(playlists.map((val) => val.playlistOwnerId))];
    const userDate = await Promise.all(
      userIds.map(async (userId) => {
        const user = await User.findOne({ spotifyId: userId });
        const allPlaylist = await Playlist.find({
          // isActive: true,
          playlistOwnerId: userId,
        });
        const playlistIds = allPlaylist.map((playlist) => playlist._id);
        const totalPlaylist = await Playlist.countDocuments();
        const maxPlaylists = await Playlist.aggregate([
          {
            $group: {
              _id: "$userId",
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 1,
          },
        ]);
        const maxPlaylistCount = maxPlaylists[0]?.count ;
        // console.log("max" ,maxPlaylistCount )
        const submittedPlaylist = await Playlist.countDocuments({
          // isActive: true,
          playlistOwnerId: userId,
          // ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        });

        const submittedTracks = await Track.countDocuments({
          playlist: { $in: playlistIds },
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
        });
        const feedBackGiven = await Track.countDocuments({
          playlist: { $in: playlistIds },
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
          status: { $in: ["approved", "declined"] },
        });
        const expiredTrack = await Track.countDocuments({
          playlist: { $in: playlistIds },
          status: "expired",
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
        });
        const bonusPoint = await Referral.countDocuments({
          referredBy: user._id,
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        });

        const result = await Referral.aggregate([

          {
            $group: {
              _id: "$referredBy",
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 1,
          },
        ]);
        const maxBonusPoint = result[0]?.count || 0;
        //  console.log("maxsfdsfsfasd" ,maxBonusPoint )
        const responseRate =
          submittedTracks === 0 ? 0 : feedBackGiven / submittedTracks;
        const filter = {
          status: { $in: ["approved", "declined"] },
          ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
        };
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
          {
            $count: "dayCount",
          },
        ]);
        const feedBackGivenDaysCount = feedBackGivenDays[0]?.dayCount || 0;
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
    return userDate;
  } catch (err) {
    console.error(err.message, "error");
  }
};

export default curatorResponse;
