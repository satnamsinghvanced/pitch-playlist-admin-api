import ResponseRate from "../../models/responseRate/index.js";
import TopCuratorAdminListJs from "../../models/topCuratorAdminList/index.js";
import Playlist from "../../models/playlist/index.js";
import getCountryName from "./getCountryName.js";
import curatorResponse from "./curatorResponse.js";
const generateCuratorList = async (startDate, endDate) => {
  try {
    await TopCuratorAdminListJs.deleteMany({});
    const responseRate = await curatorResponse(startDate, endDate);
    const calculateEngagementScore = (rate) => {
      return (
        (rate.responseRate / 10) * 0.5 +
        (Math.log(rate.feedBackGiven + 1) / Math.log(101)) * 10 * 0.3 +
        (rate.feedBackGivenDaysCount / 7) * 10 * 0.2
      );
    };

    const maxResponseRate = responseRate?.reduce((max, rate) => {
      return Math.max(max, rate.responseRate || 0);
    }, 0);
    const maxFeedbackGivenDaysCount = responseRate?.reduce((max, rate) => {
      return Math.max(max, rate.feedBackGivenDaysCount || 0);
    }, 0);

    const maxUserFeedBacks = responseRate?.reduce((max, rate) => {
      return Math.max(max, rate.feedBackGiven || 0);
    }, 0);

    const highestEngagementScore = Math.max(
      ...responseRate?.map((r) => calculateEngagementScore(r))
    );

    const sortedResponseRates = responseRate
      ?.map((rate) => {
        const safeDivide = (numerator, denominator) =>
          denominator === 0 ? 0 : numerator / denominator;

        const logNormalize = (value, max) =>
          max === 0 ? 0 : Math.log(value + 1) / Math.log(max + 1);
        const responseRateRatio =
          safeDivide(rate.responseRate, maxResponseRate) * 0.3;
        const feedbackDaysRatio =
          safeDivide(rate.feedBackGivenDaysCount, maxFeedbackGivenDaysCount) *
          0.2;
        const playlistRatio =
          safeDivide(rate.submittedPlaylist, rate.maxPlaylistCount) * 0.15;
        const bonusRatio =
          safeDivide(rate.bonusPoint, rate.maxBonusPoint) * 0.1;

        const compositeRatio =
          safeDivide(rate.responseRate, rate.feedBackGiven) *
          safeDivide(rate.feedBackGiven, maxUserFeedBacks) *
          0.15;

        const logFeedbackRatio =
          logNormalize(rate.feedBackGiven, maxUserFeedBacks) * 0.1;

        const penaltyFactor =
          1 - Math.min(safeDivide(rate.warningReceived, 15), 1);

        const baseScore =
          responseRateRatio +
          feedbackDaysRatio +
          playlistRatio +
          bonusRatio +
          compositeRatio +
          logFeedbackRatio;

        const finalScore = baseScore * penaltyFactor;
        const score = finalScore;

        const engagementScore = calculateEngagementScore(rate);
        const normalizedEngagementScore =
          highestEngagementScore === 0
            ? 0
            : (engagementScore / highestEngagementScore) * 10;
        return { ...rate, score, engagementScore: normalizedEngagementScore };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);

    await ResponseRate.bulkWrite(
      sortedResponseRates.map((rate) => ({
        updateOne: {
          filter: { userId: rate.userId },
          update: { $set: { engagementScore: rate.engagementScore } },
        },
      }))
    );

    // const sortedByScore = sortedResponseRates.sort((a, b) => b.score - a.score);

    const sortedByScore = sortedResponseRates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Primary sort by score
      } else if (b.engagementScore !== a.engagementScore) {
        return b.engagementScore - a.engagementScore; // Secondary by engagementScore
      } else {
        return b.feedBackGiven - a.feedBackGiven; // Tertiary by feedBackGiven
      }
    });
    const topUsersWithPosition = await Promise.all(
      sortedByScore.map(async (rate, index) => {
        const place = index + 1;
        const allPlaylists = await Playlist.find({
          isActive: true,
          userId: rate.userId,
        });
        const uniqueGenres = allPlaylists
          .flatMap((val) => val.genres)
          .reduce((acc, genre) => {
            if (!acc.has(genre.id)) {
              acc.set(genre.id, genre);
            }
            return acc;
          }, new Map());

        const allGenres = Array.from(uniqueGenres.values());
        const country =
          rate?.userId?.country !== "UK" ? rate?.userId?.country : "GB";
        const countryName = getCountryName(country);

        return {
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
        };
      })
    );
    await Promise.all(
      topUsersWithPosition.map(async (val) => {
        const {
          position,
          userId,
          responseRate,
          totalSongs,
          totalPlaylist,
          expiredTrack,
          allGenres,
          referral,
          bouncePoint,
          weightedScore,
          feedbackGiven,
          countryName,
          feedbackGivenDays,
          warningReceived,
          engagementScore,
        } = val;
        const newList = new TopCuratorAdminListJs({
          position,
          userId,
          responseRate,
          totalSongs,
          expiredTrack,
          totalPlaylist,
          allGenres,
          referral,
          bouncePoint,
          weightedScore,
          feedbackGiven,
          countryName,
          feedbackGivenDays,
          warningReceived,
          engagementScore,
        });
        await newList.save();
      })
    );
  } catch (err) {
    console.error(err.message);
  }
};
export default generateCuratorList;
