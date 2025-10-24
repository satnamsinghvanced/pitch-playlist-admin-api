import User from "../../models/user/index.js";
import Playlist from "../../models/playlist/index.js";
import ResponseRate from "../../models/responseRate/index.js";
import Track from "../../models/track/index.js";
import Referral from "../../models/referral/index.js";

const calculateResponseRate = async () => {
  try {
    const playlists = await Playlist.find({ });
    const userIds = [...new Set(playlists.map((val) => val.playlistOwnerId))];

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const batchSize = 100; // process 100 users at a time

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchUserIds = userIds.slice(i, i + batchSize);

      const [allUsers, allTracks, allReferrals] = await Promise.all([
        User.find({ spotifyId: { $in: batchUserIds } }),
        Track.find({ playlist: { $in: playlists.map((p) => p?._id) } }, "_id status playlist updatedAt"),
        Referral.find({ createdAt: { $gte: startDate, $lte: endDate } }),
      ]);

      const userMap = allUsers.reduce((acc, user) => {
        acc[user.spotifyId] = user;
        return acc;
      }, {});

      const trackMap = allTracks.reduce((acc, track) => {
        const playlistId = track.playlist.toString();
        if (!acc[playlistId]) acc[playlistId] = [];
        acc[playlistId].push(track);
        return acc;
      }, {});

      const referralMap = allReferrals.reduce((acc, referral) => {
        const userId = referral.referredBy.toString();
        if (!acc[userId]) acc[userId] = 0;
        acc[userId]++;
        return acc;
      }, {});

      const userData = await Promise.all(
        batchUserIds.map(async (userId) => {
          const user = userMap[userId];
          const allPlaylist = playlists.filter((p) => p.playlistOwnerId === userId);
          const playlistIds = allPlaylist.map((playlist) => playlist._id.toString());

          const userTracks = playlistIds.reduce((acc, id) => acc.concat(trackMap[id] || []), []);
          const submittedTracks = userTracks.filter((track) => track.updatedAt >= startDate && track.updatedAt <= endDate);
          const approvedTracks = submittedTracks.filter((track) => track.status === "approved");
          const feedBackGiven = submittedTracks.filter((track) => ["approved", "declined"].includes(track.status));
          const expiredTrack = userTracks.filter((track) => track.status === "expired").length;
          const totalApproved = userTracks.filter((track) => track.status === "approved").length;
          const totalFeedBackGiven = userTracks.filter((track) => ["approved", "declined"].includes(track.status)).length;
          const bonusPoint = referralMap[user?._id.toString()] || 0;
          const responseRate = submittedTracks.length === 0 ? 0 : feedBackGiven.length / submittedTracks.length;
          const notResponded = submittedTracks.length - feedBackGiven.length;

          return {
            user: user._id,
            userPlaylist: allPlaylist.length,
            submittedTracks: submittedTracks.length,
            totalFeedBackGiven,
            approvedTracks: approvedTracks.length,
            expiredTrack,
            totalSubmittedTracks: userTracks.length,
            notResponded,
            responseRate,
            bouncePoint: bonusPoint,
            feedBackGiven: feedBackGiven.length,
            totalApproved,
          };
        })
      );

      // save/update ResponseRate
      for (const val of userData) {
        const { user, userPlaylist, expiredTrack, totalSubmittedTracks, responseRate, bouncePoint, totalFeedBackGiven } = val;
        const alreadyExist = await ResponseRate.findOne({ userId: user });
        if (alreadyExist) {
          alreadyExist.responseRate = responseRate;
          alreadyExist.totalSongs = totalSubmittedTracks;
          alreadyExist.totalPlaylist = userPlaylist;
          alreadyExist.bouncePoint = bouncePoint;
          alreadyExist.feedbackGiven = totalFeedBackGiven;
          alreadyExist.expiredTrack = expiredTrack;
          await alreadyExist.save();
        } else {
          const newRate = new ResponseRate({
            userId: user,
            responseRate,
            totalSongs: totalSubmittedTracks,
            totalPlaylist: userPlaylist,
            bouncePoint: bouncePoint,
            feedbackGiven: totalFeedBackGiven,
            expiredTrack,
          });
          await newRate.save();
        }
      }
    }
  } catch (err) {
    console.error(err.message);
  }
};

export default calculateResponseRate;
