import User from "../../models/user/index.js";
import Playlist from "../../models/playlist/index.js";
import Track from "../../models/track/index.js";
import Referral from "../../models/referral/index.js";
import ResponseRate from "../../models/responseRate/index.js";
import TopCuratorAdminListJs from "../../models/topCuratorAdminList/index.js";
import getCountryName from "./getCountryName.js";
import { getWarningsDetail } from "./getWarningsDetail.js";
import moment from "moment";
import topCuratorAdminListSevenDays from "../../models/topCuratorAdminListSevenDays/index.js";
import topCuratorAdminListMonth from "../../models/topCuratorAdminListMonth/index.js";
import topCuratorAdminListYear from "../../models/topCuratorAdminListYear/index.js";


export const generateCuratorList = async (startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) {
      const start = moment(startDate, "DD-MM-YYYY").startOf("day").toDate();
      if (!isNaN(start.getTime())) dateFilter.$gte = start;
    }
    if (endDate) {
      const end = moment(endDate, "DD-MM-YYYY").endOf("day").toDate();
      if (!isNaN(end.getTime())) dateFilter.$lte = end;
    }
    const userIdSet = new Set();
    const playlistCursor = Playlist.find({}).cursor();
    for await (const playlist of playlistCursor) {
      userIdSet.add(playlist.playlistOwnerId);
    }
    const userIds = Array.from(userIdSet);

    const BATCH_SIZE = 200;
    const cleanData = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batchUserIds = userIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batchUserIds.map(async (userId) => {
          const user = await User.findOne({ spotifyId: userId });
          if (!user) return null;

          const userPlaylists = [];
          const userPlaylistCursor = Playlist.find({ playlistOwnerId: userId }).cursor();
          for await (const p of userPlaylistCursor) {
            userPlaylists.push(p);
          }
          const playlistIds = userPlaylists.map((p) => p._id);
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
                    $group: { _id: "$playlistOwnerId", count: { $sum: 1 } },
                  },
                  { $sort: { count: -1 } },
                  { $limit: 1 },
                ],
              },
            },
          ]);
          const totalPlaylist = playlistStats[0].totalPlaylists[0]?.count || 0;
          const submittedPlaylist = playlistStats[0].submittedPlaylist[0]?.count || 0;
          const maxPlaylistCount = playlistStats[0].maxPlaylistCount[0]?.count || 0;

          const trackMatch = {
            playlist: { $in: playlistIds },
            ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
          };
          const trackStats = await Track.aggregate([
            { $match: trackMatch },
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
          const submittedTracks = trackStats[0].submittedTracks[0]?.count || 0;
          const feedBackGiven = trackStats[0].feedBackGiven[0]?.count || 0;
          const expiredTrack = trackStats[0].expiredTrack[0]?.count || 0;
          const responseRate = submittedTracks === 0 ? 0 : feedBackGiven / submittedTracks;

          const feedbackDaysResult = await Track.aggregate([
            {
              $match: {
                playlist: { $in: playlistIds },
                status: { $in: ["approved", "declined"] },
                ...(Object.keys(dateFilter).length && { updatedAt: dateFilter }),
              },
            },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
              },
            },
            { $count: "dayCount" },
          ]);
          const feedBackGivenDaysCount = feedbackDaysResult[0]?.dayCount || 0;

          const referralStats = await Referral.aggregate([
            {
              $facet: {
                bonusPoint: [
                  {
                    $match: {
                      referredBy: user._id,
                      ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
                    },
                  },
                  { $count: "count" },
                ],
                maxBonusPoint: [
                  ...(Object.keys(dateFilter).length ? [{ $match: { createdAt: dateFilter } }] : []),
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
          const bonusPoint = referralStats[0].bonusPoint[0]?.count || 0;
          const maxBonusPoint = referralStats[0].maxBonusPoint[0]?.count || 0;

          const warningReceived = await getWarningsDetail(user._id, startDate, endDate);

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
            warningReceived,
          };
        })
      );

      cleanData.push(...batchResults.filter(Boolean));
    }

    const calculateEngagementScore = (rate) => {
      return (
        (rate.responseRate / 10) * 0.5 +
        (Math.log(rate.feedBackGiven + 1) / Math.log(101)) * 10 * 0.3 +
        (rate.feedBackGivenDaysCount / 7) * 10 * 0.2
      );
    };

    const maxResponseRate = Math.max(...cleanData.map((r) => r.responseRate || 0));
    const maxFeedbackGivenDaysCount = Math.max(...cleanData.map((r) => r.feedBackGivenDaysCount || 0));
    const maxUserFeedBacks = Math.max(...cleanData.map((r) => r.feedBackGiven || 0));
    const highestEngagementScore = Math.max(...cleanData.map((r) => calculateEngagementScore(r)));

    const scoredData = cleanData
      .map((rate) => {
        const safeDivide = (num, den) => (den === 0 ? 0 : num / den);
        const logNormalize = (val, max) => (max === 0 ? 0 : Math.log(val + 1) / Math.log(max + 1));

        const score =
          (safeDivide(rate.responseRate, maxResponseRate) * 0.3 +
            safeDivide(rate.feedBackGivenDaysCount, maxFeedbackGivenDaysCount) * 0.2 +
            safeDivide(rate.submittedPlaylist, rate.maxPlaylistCount) * 0.15 +
            safeDivide(rate.bonusPoint, rate.maxBonusPoint) * 0.1 +
            safeDivide(rate.responseRate, rate.feedBackGiven) *
              safeDivide(rate.feedBackGiven, maxUserFeedBacks) *
              0.15 +
            logNormalize(rate.feedBackGiven, maxUserFeedBacks) * 0.1) *
          (1 - Math.min(safeDivide(rate.warningReceived, 15), 1));

        const engagementScore =
          highestEngagementScore === 0
            ? 0
            : (calculateEngagementScore(rate) / highestEngagementScore) * 10;

        return {
          ...rate,
          score,
          engagementScore,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.engagementScore !== a.engagementScore) return b.engagementScore - a.engagementScore;
        return b.feedBackGiven - a.feedBackGiven;
      });

    const bulkOps = scoredData.map((rate) => ({
      updateOne: {
        filter: { userId: rate.userId._id },
        update: { $set: { engagementScore: rate.engagementScore } },
        upsert: true,
      },
    }));
    if (bulkOps.length > 0) {
      await ResponseRate.bulkWrite(bulkOps);
    }

    await TopCuratorAdminListJs.deleteMany({});

    let position = 1;
    for (const rate of scoredData) {

      const allPlaylists = [];
      const playlistCursor = Playlist.find({ isActive: true, userId: rate.userId._id }).cursor();
      for await (const p of playlistCursor) {
        allPlaylists.push(p);
      }

      const uniqueGenres = allPlaylists
        .flatMap((val) => val.genres || [])
        .reduce((acc, genre) => {
          if (!acc.has(genre.id)) acc.set(genre.id, genre);
          return acc;
        }, new Map());

      const allGenres = Array.from(uniqueGenres.values());
      const country = rate?.userId?.country !== "UK" ? rate?.userId?.country : "GB";
      const countryName = getCountryName(country);

      const newEntry = new TopCuratorAdminListJs({
        position: position++,
        userId: rate.userId._id,
        responseRate: rate.responseRate,
        totalSongs: rate.submittedTracks,
        expiredTrack: rate.expiredTrack,
        totalPlaylist: rate.submittedPlaylist,
        allGenres,
        referral: rate.bonusPoint,
        bouncePoint: rate.bonusPoint,
        weightedScore: rate.score,
        feedbackGiven: rate.feedBackGiven,
        countryName,
        feedbackGivenDays: rate.feedBackGivenDaysCount,
        warningReceived: rate.warningReceived,
        engagementScore: rate.engagementScore,
      });

      await newEntry.save();
    }

    return { message: "Top curators generated and stored successfully." };
  } catch (err) {
    console.error("generateCuratorList error:", err.message);
    throw new Error("Failed to generate curator list");
  }
};

export const getTopCurators = async (page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit;

    const data = await TopCuratorAdminListJs.find({})
      .sort({ position: 1 })
      .skip(skip)
      .limit(limit)
      .populate("userId","name email updatedAt");

    const total = await TopCuratorAdminListJs.countDocuments();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("getTopCurators error:", err.message);
    throw new Error("Failed to fetch top curators");
  }
};

export const getTopCuratorsSeven = async (page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit;

    const data = await topCuratorAdminListSevenDays.find({})
      .sort({ position: 1 })
      .skip(skip)
      .limit(limit)
      .populate("userId","name email updatedAt");

    const total = await topCuratorAdminListSevenDays.countDocuments();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("getTopCurators error:", err.message);
    throw new Error("Failed to fetch top curators");
  }
};

export const getTopCuratorsMonth = async (page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit;

    const data = await topCuratorAdminListMonth.find({})
      .sort({ position: 1 })
      .skip(skip)
      .limit(limit)
      .populate("userId","name email updatedAt");

    const total = await topCuratorAdminListMonth.countDocuments();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("getTopCurators error:", err.message);
    throw new Error("Failed to fetch top curators");
  }
};

export const getTopCuratorsYear = async (page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit;

    const data = await topCuratorAdminListYear.find({})
      .sort({ position: 1 })
      .skip(skip)
      .limit(limit)
      .populate("userId","name email updatedAt");

    const total = await topCuratorAdminListYear.countDocuments();

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("getTopCurators error:", err.message);
    throw new Error("Failed to fetch top curators");
  }
};