import ResponseRate from "../../models/responseRate/index.js";
import topCuratorAdminListMonth from "../../models/topCuratorAdminListMonth/index.js";
import Playlist from "../../models/playlist/index.js";
import getCountryName from "./getCountryName.js";
import curatorResponse from "./curatorResponse.js";

const generateCuratorListMonth = async (startDate, endDate) => {
  try {
    const result = await topCuratorAdminListMonth.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} documents from topCuratorAdminListMonth.`);

    const responseRate = await curatorResponse(startDate, endDate);


    const maxResponseRate = Math.max(...responseRate.map(r => r.responseRate || 0), 1);
    const maxFeedbackGivenDaysCount = Math.max(...responseRate.map(r => r.feedBackGivenDaysCount || 0), 1);
    const maxUserFeedBacks = Math.max(...responseRate.map(r => r.feedBackGiven || 0), 1);
    const maxPlaylistCount = Math.max(...responseRate.map(r => r.maxPlaylistCount || 0), 1);
    const maxBonusPoint = Math.max(...responseRate.map(r => r.maxBonusPoint || 0), 1);

    const safeDivide = (numerator, denominator) => denominator === 0 ? 0 : numerator / denominator;
    const logNormalize = (value, max) => max === 0 ? 0 : Math.log(value + 1) / Math.log(max + 1);

    const highestEngagementScore = Math.max(
      ...responseRate.map(rate => {
        const rateResponseRate = rate.responseRate || 0;
        const feedBackGivenDaysCount = rate.feedBackGivenDaysCount || 0;
        const feedBackGiven = rate.feedBackGiven || 0;

        return (
          (rateResponseRate / 10) * 0.5 +
          (Math.log(feedBackGiven + 1) / Math.log(101)) * 10 * 0.3 +
          (feedBackGivenDaysCount / 7) * 10 * 0.2
        );
      }),
      1
    );

    const sortedResponseRates = responseRate.map(rate => {

      const responseRateValue = rate.responseRate || 0;
      const feedbackDaysValue = rate.feedBackGivenDaysCount || 0;
      const submittedPlaylist = rate.submittedPlaylist || 0;
      const maxPlaylistCountValue = rate.maxPlaylistCount || 1;
      const bonusPoint = rate.bonusPoint || 0;
      const maxBonusPointValue = rate.maxBonusPoint || 1;
      const feedBackGiven = rate.feedBackGiven || 0;
      const maxUserFeedBacksValue = maxUserFeedBacks || 1;
      const warningReceived = rate.warningReceived || 0;

      const responseRateRatio = safeDivide(responseRateValue, maxResponseRate) * 0.3;
      const feedbackDaysRatio = safeDivide(feedbackDaysValue, maxFeedbackGivenDaysCount) * 0.2;
      const playlistRatio = safeDivide(submittedPlaylist, maxPlaylistCountValue) * 0.15;
      const bonusRatio = safeDivide(bonusPoint, maxBonusPointValue) * 0.1;
      const compositeRatio = safeDivide(responseRateValue, feedBackGiven) * safeDivide(feedBackGiven, maxUserFeedBacksValue) * 0.15;
      const logFeedbackRatio = logNormalize(feedBackGiven, maxUserFeedBacksValue) * 0.1;
      const penaltyFactor = 1 - Math.min(safeDivide(warningReceived, 15), 1);

      const baseScore = responseRateRatio + feedbackDaysRatio + playlistRatio + bonusRatio + compositeRatio + logFeedbackRatio;
      const weightedScore = baseScore * penaltyFactor;

      const engagementScore =
        (responseRateValue / 10) * 0.5 +
        (Math.log(feedBackGiven + 1) / Math.log(101)) * 10 * 0.3 +
        (feedbackDaysValue / 7) * 10 * 0.2;
        const normalizedEngagementScore =
          highestEngagementScore === 0
            ? 0
            : (engagementScore / highestEngagementScore) * 10;
      return {
        ...rate,
        weightedScore,
        engagementScore:normalizedEngagementScore,
      };
    });

  
    const sortedByScore = sortedResponseRates.sort((a, b) => {
      if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
      if (b.engagementScore !== a.engagementScore) return b.engagementScore - a.engagementScore;
      return (b.feedBackGiven || 0) - (a.feedBackGiven || 0);
    });

    const topUsersWithPosition = await Promise.all(
      sortedByScore.map(async (rate, index) => {
        const place = index + 1;
        const allPlaylists = await Playlist.find({ isActive: true, userId: rate.userId });
        const uniqueGenres = allPlaylists
          .flatMap(val => val.genres)
          .reduce((acc, genre) => {
            if (!acc.has(genre.id)) acc.set(genre.id, genre);
            return acc;
          }, new Map());

        const allGenres = Array.from(uniqueGenres.values());
        const country = rate?.userId?.country !== "UK" ? rate?.userId?.country : "GB";
        const countryName = getCountryName(country);

        return {
          position: place,
          userId: rate.userId._id,
          responseRate: rate.responseRate || 0,
          totalSongs: rate.submittedTracks || 0,
          totalPlaylist: rate.submittedPlaylist || 0,
          allGenres,
          referral: rate.bonusPoint || 0,
          bouncePoint: rate.bonusPoint || 0,
          weightedScore: rate.weightedScore || 0,
          feedbackGiven: rate.feedBackGiven || 0,
          countryName,
          expiredTrack: rate.expiredTrack || 0,
          feedbackGivenDays: rate.feedBackGivenDaysCount || 0,
          warningReceived: rate.warningReceived || 0,
          engagementScore: rate.engagementScore || 0,
        };
      })
    );

    await Promise.all(topUsersWithPosition.map(val => new topCuratorAdminListMonth(val).save()));

    console.log("✅ Top curator list generated successfully.");
  } catch (err) {
    console.error("Error generating curator list:", err.message);
  }
};

export default generateCuratorListMonth;
