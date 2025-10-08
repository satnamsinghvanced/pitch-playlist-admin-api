import ResponseRate from "../../models/responseRate/index.js";
import TopCuratorAdminListJs from "../../models/topCuratorAdminList/index.js";
import Playlist from "../../models/playlist/index.js";
import getCountryName from "./getCountryName.js";
import curatorResponse from "./curatorResponse.js";
import topCuratorAdminListMonth from "../../models/topCuratorAdminListMonth/index.js";

const generateCuratorListMonth = async (startDate, endDate) => {
  try {
    // Clear old leaderboard
    await topCuratorAdminListMonth.deleteMany({});

    // Get user stats (memory-safe)
    const responseRate = await curatorResponse(startDate, endDate);

    // Calculate scores
    const calculateEngagementScore = (rate) => {
      return (
        (rate.responseRate / 10) * 0.5 +
        (Math.log(rate.feedBackGiven + 1) / Math.log(101)) * 10 * 0.3 +
        (rate.feedBackGivenDaysCount / 7) * 10 * 0.2
      );
    };

    const maxResponseRate = responseRate?.reduce(
      (max, rate) => Math.max(max, rate.responseRate || 0),
      0
    );
    const maxFeedbackGivenDaysCount = responseRate?.reduce(
      (max, rate) => Math.max(max, rate.feedBackGivenDaysCount || 0),
      0
    );
    const maxUserFeedBacks = responseRate?.reduce(
      (max, rate) => Math.max(max, rate.feedBackGiven || 0),
      0
    );
    const highestEngagementScore = Math.max(
      ...responseRate?.map((r) => calculateEngagementScore(r))
    );

    // Compute normalized scores
    const sortedResponseRates = responseRate
      ?.map((rate) => {
        const safeDivide = (numerator, denominator) =>
          denominator === 0 ? 0 : numerator / denominator;

        const logNormalize = (value, max) =>
          max === 0 ? 0 : Math.log(value + 1) / Math.log(max + 1);

        const responseRateRatio = safeDivide(rate.responseRate, maxResponseRate) * 0.3;
        const feedbackDaysRatio = safeDivide(rate.feedBackGivenDaysCount, maxFeedbackGivenDaysCount) * 0.2;
        const playlistRatio = safeDivide(rate.submittedPlaylist, rate.maxPlaylistCount) * 0.15;
        const bonusRatio = safeDivide(rate.bonusPoint, rate.maxBonusPoint) * 0.1;
        const compositeRatio = safeDivide(rate.responseRate, rate.feedBackGiven) *
                               safeDivide(rate.feedBackGiven, maxUserFeedBacks) * 0.15;
        const logFeedbackRatio = logNormalize(rate.feedBackGiven, maxUserFeedBacks) * 0.1;
        const penaltyFactor = 1 - Math.min(safeDivide(rate.warningReceived, 15), 1);

        const baseScore = responseRateRatio + feedbackDaysRatio + playlistRatio +
                          bonusRatio + compositeRatio + logFeedbackRatio;

        const finalScore = baseScore * penaltyFactor;

        const engagementScore = calculateEngagementScore(rate);
        const normalizedEngagementScore =
          highestEngagementScore === 0 ? 0 : (engagementScore / highestEngagementScore) * 10;

        return { ...rate, score: finalScore, engagementScore: normalizedEngagementScore };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);

    // Sort by score, engagementScore, feedback given
    const sortedByScore = sortedResponseRates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.engagementScore !== a.engagementScore) return b.engagementScore - a.engagementScore;
      return b.feedBackGiven - a.feedBackGiven;
    });

    // Process users in batches to avoid memory spike
    const batchSize = 20;
    const finalLeaderboard = [];

    for (let i = 0; i < sortedByScore.length; i += batchSize) {
      const batch = sortedByScore.slice(i, i + batchSize);

      for (let index = 0; index < batch.length; index++) {
        const rate = batch[index];
        const place = i + index + 1;

        // Fetch playlists for genres (lean to save memory)
        const allPlaylists = await Playlist.find(
          { playlistOwnerId: rate.userId._id, isActive: true },
          { genres: 1 }
        ).lean();

        const uniqueGenres = allPlaylists
          .flatMap((p) => p.genres)
          .reduce((acc, genre) => {
            if (!acc.has(genre.id)) acc.set(genre.id, genre);
            return acc;
          }, new Map());

        const allGenres = Array.from(uniqueGenres.values());

        const country = rate.userId.country !== "UK" ? rate.userId.country : "GB";
        const countryName = getCountryName(country);

        finalLeaderboard.push({
          position: place,
          userId: rate.userId._id,
          responseRate: rate.responseRate,
          totalSongs: rate.submittedTracks,
          totalPlaylist: rate.submittedPlaylist,
          allGenres,
          referral: rate.bonusPoint,
          bouncePoint: rate.bonusPoint,
          weightedScore: rate.score,
          feedbackGiven: rate.feedBackGiven,
          countryName,
          expiredTrack: rate.expiredTrack,
          feedbackGivenDays: rate.feedBackGivenDaysCount,
          warningReceived: rate.warningReceived,
          engagementScore: rate.engagementScore,
        });
      }
    }

    // Bulk insert final leaderboard
    if (finalLeaderboard.length > 0) {
      await topCuratorAdminListMonth.insertMany(finalLeaderboard);
    }

    console.log("Curator leaderboard generated successfully.");
  } catch (err) {
    console.error("Error in generateCuratorList:", err.message);
  }
};

export default generateCuratorListMonth;
