import cron from "node-cron";
import User from "../models/user/index.js";
import ResponseRate from "../models/responseRate/index.js";
import Track from "../models/track/index.js";
import TopCurator from "../models/topCurator/index.js";
import getCountryName from "../api/helpers/getCountryName.js";
import trackStatus from "../api/helpers/trackStatus.js";
import curatorResponse from "../api/helpers/curatorResponse.js";
import { getStartAndEndDate } from "../api/helpers/getStartAndEndDate.js";
import Playlist from "../models/playlist/index.js";
// import moment from "moment";
import moment from "moment-timezone";
import sendMail from "../api/helpers/commanSendMail.js";
import terms from "../models/terms/index.js";
import express from "express";
import DeleteEmailLogs from "../api/helpers/deleteEmailLogs.js";
import calculateResponseRate from "../api/helpers/calculateResponseRate.js";
import generateCuratorListMonth from "../api/helpers/generateCuratorListMonth.js";
import generateCuratorListSevenDays from "../api/helpers/generateCuratorListSevenDays.js";
import generateCuratorListYear from "../api/helpers/generateCuratorListYear.js";
import generateCuratorList from "../api/helpers/generateCuratorList.js";
import topCurator from "../models/topCurator/index.js";
const router = express.Router();

function getNextMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilNextMonday = dayOfWeek === 1 ? 7 : 8 - dayOfWeek;

  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);

  return nextMonday;
}

const isCreditUpdateDateToday = (creditUpdateDate) => {
  const today = new Date();
  const creditDate = new Date(creditUpdateDate);
  today.setHours(0, 0, 0, 0);
  creditDate.setHours(0, 0, 0, 0);

  return creditDate <= today;
};

const isUserActive = async () => {
  try {
    const playlists = await Playlist.find({ isActive: true });
    const userIds = [...new Set(playlists.map((val) => val.playlistOwnerId))];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

    await Promise.all(
      userIds.map(async (userId) => {
        const user = await User.findOne({ spotifyId: userId });

        if (!user) return;

        const recentTracks = await Track.find({
          spotifyId: userId,
          status: "pending",
          createdAt: { $lte: sevenDaysAgo },
        });

        const olderTracks = await Track.find({
          spotifyId: userId,
          status: "pending",
          createdAt: { $lte: twentyDaysAgo },
        });

        if (recentTracks.length) {
          if (!user.responseDate) {
            user.currentStatus = olderTracks.length
              ? "Not Active Recently"
              : "Active Recently";
          }
          await user.save();
        }
      })
    );
  } catch (error) {
    console.error("Error in isUserActive:", error.message);
  }
};

cron.schedule("30 0 * * *", async () => {
  console.log("🗑 Running daily penalty expiry cleanup...");

  const now = new Date();

  try {
    const users = await User.find({ "penalties.expiresAt": { $lte: now } });

    for (const user of users) {
      user.penalties = user.penalties.filter(
        (p) => !p.expireDate || new Date(p.expireDate) > now
      );
      await user.save();
      console.log(`✅ Expired penalties removed for user: ${user._id}`);
    }
  } catch (err) {
    console.error("❌ Error cleaning expired penalties:", err);
  }
});

cron.schedule("30 05 * * *", async () => {
  console.log("Running a task at 05:30 AM every day to check track status");

  try {
    await trackStatus();
  } catch (err) {
    console.error(err.message);
  }
});
//calculate top 20 curator

cron.schedule("35 0 * * 1", async () => {
  console.log("Running a task every Monday at midnight");
  try {
    const result = await topCurator.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} documents from TopCurator.`);

    const { startDate, endDate } = await getStartAndEndDate();
    const responseRate = await curatorResponse(startDate, endDate);

    const maxResponseRate = Math.max(
      ...responseRate.map((r) => r.responseRate || 0),
      1
    );
    const maxFeedbackGivenDaysCount = Math.max(
      ...responseRate.map((r) => r.feedBackGivenDaysCount || 0),
      1
    );
    const maxUserFeedBacks = Math.max(
      ...responseRate.map((r) => r.feedBackGiven || 0),
      1
    );
    const maxPlaylistCount = Math.max(
      ...responseRate.map((r) => r.maxPlaylistCount || 0),
      1
    );
    const maxBonusPoint = Math.max(
      ...responseRate.map((r) => r.maxBonusPoint || 0),
      1
    );

    const safeDivide = (numerator, denominator) =>
      denominator === 0 ? 0 : numerator / denominator;
    const logNormalize = (value, max) =>
      max === 0 ? 0 : Math.log(value + 1) / Math.log(max + 1);

    const highestEngagementScore = Math.max(
      ...responseRate.map((rate) => {
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

    const sortedResponseRates = responseRate
      .map((rate) => {
        const responseRateValue = rate.responseRate || 0;
        const feedbackDaysValue = rate.feedBackGivenDaysCount || 0;
        const submittedPlaylist = rate.submittedPlaylist || 0;
        const maxPlaylistCountValue = rate.maxPlaylistCount || 1;
        const bonusPoint = rate.bonusPoint || 0;
        const maxBonusPointValue = rate.maxBonusPoint || 1;
        const feedBackGiven = rate.feedBackGiven || 0;
        const maxUserFeedBacksValue = maxUserFeedBacks || 1;
        const warningReceived = rate.warningReceived || 0;

        const responseRateRatio =
          safeDivide(responseRateValue, maxResponseRate) * 0.3;
        const feedbackDaysRatio =
          safeDivide(feedbackDaysValue, maxFeedbackGivenDaysCount) * 0.2;
        const playlistRatio =
          safeDivide(submittedPlaylist, maxPlaylistCountValue) * 0.15;
        const bonusRatio = safeDivide(bonusPoint, maxBonusPointValue) * 0.1;
        const compositeRatio =
          safeDivide(responseRateValue, feedBackGiven) *
          safeDivide(feedBackGiven, maxUserFeedBacksValue) *
          0.15;
        const logFeedbackRatio =
          logNormalize(feedBackGiven, maxUserFeedBacksValue) * 0.1;
        const penaltyFactor = 1 - Math.min(safeDivide(warningReceived, 15), 1);

        const baseScore =
          responseRateRatio +
          feedbackDaysRatio +
          playlistRatio +
          bonusRatio +
          compositeRatio +
          logFeedbackRatio;
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
          score: weightedScore,
          engagementScore: normalizedEngagementScore,
        };
      })
      .sort((a, b) => b.score - a.score);
    // .slice(0, 20);

    await ResponseRate.bulkWrite(
      sortedResponseRates.map((rate) => ({
        updateOne: {
          filter: { userId: rate.userId },
          update: { $set: { engagementScore: rate.engagementScore } },
        },
      }))
    );

  const sortedByScore = sortedResponseRates; // already sorted above

const topUsersWithPosition = await Promise.all(
  sortedByScore.map(async (rate, index) => {
    const place = index + 1;

    let responseRateDoc = await ResponseRate.findOne({
      userId: rate.userId._id,
    });

    if (!responseRateDoc) {
      responseRateDoc = new ResponseRate({
        userId: rate.userId._id,
        engagementScore: rate.engagementScore || 0,
        responseRate: rate.responseRate,
        totalSongs: rate.submittedTracks,
        totalPlaylist: rate.submittedPlaylist,
        bouncePoint: rate.bonusPoint,
        feedbackGiven: rate.feedBackGiven,
        peak: place,
        weekInTopChart: place <= 20 ? 1 : 0,
      });
    }

        const oldPosition = responseRateDoc?.lastWeek;
        if (responseRateDoc?.peak > place || responseRateDoc?.peak === 0) {
          responseRateDoc.peak = place;
        }
        responseRateDoc.lastWeek = place;
        if (responseRateDoc.lastWeek <= 20) {
          responseRateDoc.weekInTopChart += 1;
        }

        const res = await responseRateDoc.save();
        const allPlaylists = await Playlist.find({
          isActive: true,
          userId: rate?.userId,
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
          userId: rate.userId?._id,
          responseRate: rate.responseRate,
          totalSongs: rate.submittedTracks,
          totalPlaylist: rate.submittedPlaylist,
          lastWeek: oldPosition,
          peak: res.peak,
          weekInTopChart: res.weekInTopChart,
          allGenres,
          referral: rate.bonusPoint,
          bouncePoint: rate.bonusPoint,
          weightedScore: rate.score,
          feedbackGiven: rate.feedBackGiven,
          countryName,
        };
      })
    );
    await Promise.all(
      topUsersWithPosition.map(async (val) => {
        const {
          position,
          userId,
          responseRate,
          lastWeek,
          peak,
          weekInTopChart,
          totalSongs,
          totalPlaylist,
          allGenres,
          referral,
          bouncePoint,
          weightedScore,
          feedbackGiven,
          countryName,
        } = val;
        const newList = new TopCurator({
          position,
          userId,
          responseRate,
          lastWeek,
          peak,
          weekInTopChart,
          totalSongs,
          totalPlaylist,
          allGenres,
          referral,
          bouncePoint,
          weightedScore,
          feedbackGiven,
          countryName,
        });
        await newList.save();
      })
    );
  } catch (err) {
    console.error(err.message);
  }
});

//check user response

cron.schedule("0 1 * * *", async () => {
  console.log("Running a task at midnight");
  try {
    const users = await User.find({
      responseDate: { $exists: true, $ne: null, $ne: "" },
    });
    if (users) {
      await Promise.all(
        users.map(async (val) => {
          const givenDate = new Date(val.responseDate);
          const currentDate = new Date();
          const diffInMilliseconds = currentDate - givenDate;
          const diffInSeconds = diffInMilliseconds / 1000;
          const diffInMinutes = diffInSeconds / 60;
          const diffInHours = diffInMinutes / 60;
          const diffInDays = diffInHours / 24;
          if (diffInDays > 21) {
            const updatedFields = { currentStatus: "Not Active Recently" };

            await User.findOneAndUpdate(
              { _id: val._id },
              { $set: updatedFields },
              { new: true, upsert: true }
            );
          } else if (diffInDays > 8) {
            const updatedFields = { currentStatus: "Active Recently" };

            await User.findOneAndUpdate(
              { _id: val._id },
              { $set: updatedFields },
              { new: true, upsert: true }
            );
          }
        })
      );
    }
    await isUserActive();
  } catch (err) {
    console.error(err.message);
  }
});

// expire track

cron.schedule("0 2 * * *", async () => {
  console.log("Running a task at midnight");
  try {
    const date21DaysAgo = new Date(
      new Date().getTime() - 21 * 24 * 60 * 60 * 1000
    );

    const allTrack = await Track.find({
      status: "pending",
      createdAt: { $lte: date21DaysAgo },
    });
    if (allTrack.length) {
      await Promise.all(
        allTrack.map(async (val) => {
          const track = await Track.findById(val._id);
          const playlistData = await Playlist.findById(track.playlist);
          track.status = "expired";
          await track.save();
          if (playlistData.totalSubmissions > 0) {
            playlistData.totalSubmissions = playlistData.totalSubmissions - 1;
            await playlistData.save();
          }
        })
      );
    }
  } catch (err) {
    console.error(err.message);
  }
});

cron.schedule("50 0 * * *", async () => {
  console.log(" Running User reminder email Cron Job...");
  try {
    const twentyFourHoursAgoStart = moment()
      .subtract(24, "hours")
      .startOf("minute")
      .toDate();
    const twentyFourHoursAgoEnd = moment()
      .subtract(24, "hours")
      .endOf("minute")
      .toDate();

    console.log(moment().toDate());

    const usersToRemind = await User.find({
      createdAt: { $gte: twentyFourHoursAgoStart, $lte: twentyFourHoursAgoEnd },
      usedCredits: { $eq: 0 },
      emailReceiver: true,
      reminderSent: { $ne: true },
    });

    console.log(twentyFourHoursAgoStart);

    if (usersToRemind.length === 0) {
      console.log(" No users need a Song submission reminder.");
      return;
    }

    for (const user of usersToRemind) {
      await sendMail(
        user.email,
        "Ready to Share Your Music? Submit Your First Track!",
        "reminderEmail.html",
        {
          userName: user.name,
          dashboardLink: "https://pitchplaylists.com/dashboard",
          userMail: user.email,
          Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${user.spotifyId}`,
        },
        "artist"
      );
      console.log(` Reminder sent to ${user.email}`);
      await User.updateOne({ _id: user._id }, { reminderSent: true });
    }
  } catch (error) {
    console.error(" Error in cron job:", error);
  }
});

const countryToTimezone = {
  AF: "Asia/Kabul",
  AL: "Europe/Tirane",
  DZ: "Africa/Algiers",
  AD: "Europe/Andorra",
  AO: "Africa/Luanda",
  AR: "America/Argentina/Buenos_Aires",
  AM: "Asia/Yerevan",
  AU: "Australia/Sydney",
  AT: "Europe/Vienna",
  AZ: "Asia/Baku",
  BH: "Asia/Bahrain",
  BD: "Asia/Dhaka",
  BY: "Europe/Minsk",
  BE: "Europe/Brussels",
  BZ: "America/Belize",
  BJ: "Africa/Porto-Novo",
  BT: "Asia/Thimphu",
  BO: "America/La_Paz",
  BA: "Europe/Sarajevo",
  BW: "Africa/Gaborone",
  BR: "America/Sao_Paulo",
  BG: "Europe/Sofia",
  BF: "Africa/Ouagadougou",
  BI: "Africa/Bujumbura",
  KH: "Asia/Phnom_Penh",
  CM: "Africa/Douala",
  CA: "America/Toronto",
  CV: "Atlantic/Cape_Verde",
  CF: "Africa/Bangui",
  TD: "Africa/Ndjamena",
  CL: "America/Santiago",
  CN: "Asia/Shanghai",
  CO: "America/Bogota",
  KM: "Indian/Comoro",
  CD: "Africa/Kinshasa",
  CG: "Africa/Brazzaville",
  CR: "America/Costa_Rica",
  HR: "Europe/Zagreb",
  CU: "America/Havana",
  CY: "Asia/Nicosia",
  CZ: "Europe/Prague",
  DK: "Europe/Copenhagen",
  DJ: "Africa/Djibouti",
  DO: "America/Santo_Domingo",
  EC: "America/Guayaquil",
  EG: "Africa/Cairo",
  SV: "America/El_Salvador",
  EE: "Europe/Tallinn",
  ET: "Africa/Addis_Ababa",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GA: "Africa/Libreville",
  GM: "Africa/Banjul",
  GE: "Asia/Tbilisi",
  DE: "Europe/Berlin",
  GH: "Africa/Accra",
  GR: "Europe/Athens",
  GT: "America/Guatemala",
  HN: "America/Tegucigalpa",
  HK: "Asia/Hong_Kong",
  HU: "Europe/Budapest",
  IS: "Atlantic/Reykjavik",
  IN: "Asia/Kolkata",
  ID: "Asia/Jakarta",
  IR: "Asia/Tehran",
  IQ: "Asia/Baghdad",
  IE: "Europe/Dublin",
  IL: "Asia/Jerusalem",
  IT: "Europe/Rome",
  JP: "Asia/Tokyo",
  JO: "Asia/Amman",
  KZ: "Asia/Almaty",
  KE: "Africa/Nairobi",
  KW: "Asia/Kuwait",
  LA: "Asia/Vientiane",
  LV: "Europe/Riga",
  LB: "Asia/Beirut",
  LY: "Africa/Tripoli",
  LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg",
  MG: "Indian/Antananarivo",
  MY: "Asia/Kuala_Lumpur",
  MV: "Indian/Maldives",
  ML: "Africa/Bamako",
  MT: "Europe/Malta",
  MX: "America/Mexico_City",
  MC: "Europe/Monaco",
  MA: "Africa/Casablanca",
  MZ: "Africa/Maputo",
  MM: "Asia/Yangon",
  NA: "Africa/Windhoek",
  NP: "Asia/Kathmandu",
  NL: "Europe/Amsterdam",
  NZ: "Pacific/Auckland",
  NI: "America/Managua",
  NE: "Africa/Niamey",
  NG: "Africa/Lagos",
  NO: "Europe/Oslo",
  OM: "Asia/Muscat",
  PK: "Asia/Karachi",
  PA: "America/Panama",
  PG: "Pacific/Port_Moresby",
  PY: "America/Asuncion",
  PE: "America/Lima",
  PH: "Asia/Manila",
  PL: "Europe/Warsaw",
  PT: "Europe/Lisbon",
  QA: "Asia/Qatar",
  RO: "Europe/Bucharest",
  RU: "Europe/Moscow",
  RW: "Africa/Kigali",
  SA: "Asia/Riyadh",
  SN: "Africa/Dakar",
  RS: "Europe/Belgrade",
  SG: "Asia/Singapore",
  SK: "Europe/Bratislava",
  SI: "Europe/Ljubljana",
  ZA: "Africa/Johannesburg",
  KR: "Asia/Seoul",
  ES: "Europe/Madrid",
  LK: "Asia/Colombo",
  SD: "Africa/Khartoum",
  SE: "Europe/Stockholm",
  CH: "Europe/Zurich",
  SY: "Asia/Damascus",
  TW: "Asia/Taipei",
  TZ: "Africa/Dar_es_Salaam",
  TH: "Asia/Bangkok",
  TN: "Africa/Tunis",
  TR: "Europe/Istanbul",
  UG: "Africa/Kampala",
  UA: "Europe/Kyiv",
  AE: "Asia/Dubai",
  GB: "Europe/London",
  US: "America/New_York",
  UY: "America/Montevideo",
  UZ: "Asia/Tashkent",
  VE: "America/Caracas",
  VN: "Asia/Ho_Chi_Minh",
  YE: "Asia/Aden",
  ZW: "Africa/Harare",
};

function getRandomTime() {
  const randomHour = Math.floor(Math.random() * 4) + 12;
  const randomMinute = Math.floor(Math.random() * 60);
  return { hour: randomHour, minute: randomMinute };
}

const scheduledJobs = new Set();

async function scheduleWeeklyEmails() {
  try {
    const emailEnabledUsers = await terms
      .find({ emailNotification: true })
      .lean();
    const spotifyIds = emailEnabledUsers
      .map((user) => user.spotifyId)
      .filter(Boolean);

    const users = await User.find({
      spotifyId: { $in: spotifyIds },
      country: {
        $exists: true,
        $ne: null,
        $in: Object.keys(countryToTimezone),
      },
    }).lean();

    if (!users.length) {
      console.log("?? No users found with email notifications enabled.");
      return;
    }

    const usersByTimezone = {};
    for (const user of users) {
      const userTimezone = countryToTimezone[user.country];
      if (!userTimezone) continue;

      if (!usersByTimezone[userTimezone]) {
        usersByTimezone[userTimezone] = [];
      }
      usersByTimezone[userTimezone].push(user);
    }

    for (const [timezone, usersInTimezone] of Object.entries(usersByTimezone)) {
      if (!scheduledJobs.has(timezone)) {
        sendEmailsForTimezone(timezone, usersInTimezone);
        scheduledJobs.add(timezone);
      }
    }
  } catch (error) {
    console.error("? Error scheduling weekly emails:", error);
  }
}

async function sendEmailsForTimezone(timezone, users) {
  if (!users.length) {
    console.log(
      `?? No users in timezone ${timezone} with email notifications enabled.`
    );
    return;
  }

  const oneWeekAgo = moment().subtract(7, "days").toDate();
  const topCurators = await TopCurator.find({
    createdAt: { $gte: oneWeekAgo },
    position: { $gte: 1, $lte: 3 },
  })
    .populate("userId", "name image spotifyId")
    .sort({ position: 1 })
    .lean();

  if (!topCurators?.length) {
    console.log("?? No Top Curators found.");
    return;
  }

  const topCuratorsData = topCurators.map((curator) => ({
    position: curator.position,
    name: curator.userId?.name || "Unknown Curator",
    week: curator.weekInTopChart,
    responseRate:
      curator.responseRate != null
        ? (curator.responseRate * 100).toFixed(2) + "%"
        : "N/A",
    lastWeek: curator.lastWeek || "N/A",
    image:
      curator.userId?.image?.length > 0 ? curator.userId?.image?.[0]?.url : "",
  }));

  const { hour, minute } = getRandomTime();
  const cronTime = "0 13 * * 1";

  cron.schedule(
    cronTime,
    async () => {
      console.log(
        `?? Sending weekly emails for timezone ${timezone} at ${hour}:${minute} (${timezone})`
      );

      for (const user of users) {
        try {
          const emailData = {
            userName: user.name,
            top_1name: topCuratorsData[0]?.name || "N/A",
            top_1position: topCuratorsData[0]?.position || "N/A",
            top_1week: topCuratorsData[0]?.week,
            top_1responseRate: topCuratorsData[0]?.responseRate || "N/A",
            top1Image: topCuratorsData[0]?.image,

            top_2name: topCuratorsData[1]?.name || "N/A",
            top_2position: topCuratorsData[1]?.position || "N/A",
            top_2week: topCuratorsData[1]?.week,
            top_2responseRate: topCuratorsData[1]?.responseRate || "N/A",
            top2Image: topCuratorsData[1]?.image,

            top_3name: topCuratorsData[2]?.name || "N/A",
            top_3position: topCuratorsData[2]?.position || "N/A",
            top_3week: topCuratorsData[2]?.week,
            top_3responseRate: topCuratorsData[2]?.responseRate || "N/A",
            top3Image: topCuratorsData[2]?.image,

            dashboard_link: "https://pitchplaylists.com/top-curator-chart",
            userMail: user.email,
            Unsubscribe: `https://pitchplaylists.com/unsubscribe-newsletter?spotifyId=${user.spotifyId}`,
          };

          await sendMail(
            user.email,
            "?? Your Monday Top Curator Chart Update!",
            "mondayWeeklyUpdate.html",
            emailData,
            "newsletter"
          );

          console.log(
            `? Email sent successfully to ${user.email} at ${hour}:${minute} ${timezone}`
          );
        } catch (emailError) {
          console.error(`? Failed to send email to ${user.email}:`, emailError);
        }
      }
    },
    {
      scheduled: true,
      timezone,
    }
  );

  console.log(
    `Scheduled weekly email job for timezone ${timezone} at ${hour}:${minute}`
  );
}

scheduleWeeklyEmails();

const getRandomDelays = () => {
  const minMinutes = 10 * 60;
  const maxMinutes = 16 * 60;
  return (
    Math.floor(Math.random() * (maxMinutes - minMinutes) + minMinutes) *
    60 *
    1000
  );
};

cron.schedule("20 0 * * 6", async () => {
  console.log(
    "?? Checking users who haven�t used any credits in the past week..."
  );

  try {
    const oneWeekAgo = moment().subtract(7, "days").toDate();
    console.log(`?? Checking inactive users since: ${oneWeekAgo}`);

    const inactiveUsers = await User.find({
      usedCredits: 0,
      updatedAt: { $gte: oneWeekAgo },
      emailReceiver: true,
    }).lean();

    if (!inactiveUsers.length) {
      console.log("? No users found who need a credit usage reminder.");
      return;
    }

    inactiveUsers.forEach(async (user) => {
      const timezone = countryToTimezone[user.country] || "UTC";
      const now = moment.tz(timezone);
      const saturdayAtMidnight = now
        .startOf("isoWeek")
        .add(6, "days")
        .add(10, "hours");
      const randomDelay = getRandomDelays();

      const delayUntilSend =
        saturdayAtMidnight.valueOf() + randomDelay - Date.now();

      if (delayUntilSend > 0) {
        console.log(
          `? Scheduling email for ${user.email} in ${timezone} at ${moment(
            saturdayAtMidnight.valueOf() + randomDelay
          ).format("YYYY-MM-DD HH:mm:ss z")}`
        );

        setTimeout(async () => {
          console.log(`?? Sending credit usage reminder to ${user.email}`);

          await sendMail(
            user.email,
            "Your Credits Miss You! Come Back and Submit",
            "creditUsageReminder.html",
            {
              userName: user.name,
              submitSong: "https://pitchplaylists.com/submit-song",
              userMail: user.email,
              Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${user.spotifyId}`,
            },
            "artist"
          );

          console.log(`? Email sent to ${user.email} at ${timezone}`);
        }, delayUntilSend);
      } else {
        console.log(
          `?? Skipping email for ${user.email}, time already passed.`
        );
      }
    });

    console.log("? Credit usage reminder emails scheduled successfully!");
  } catch (error) {
    console.error("? Error in credit usage reminder cron job:", error);
  }
});

const getRandomDelay = () => {
  const minMinutes = 10 * 60;
  const maxMinutes = 12 * 60;
  return (
    Math.floor(Math.random() * (maxMinutes - minMinutes) + minMinutes) *
    60 *
    1000
  );
};

cron.schedule("40 0 * * 1", async () => {
  console.log("?? Checking users eligible for weekly credit refill...");

  try {
    // const oneWeekAgo = moment().subtract(7, "days").toDate();

    const eligibleUsers = await User.find({
      // usedCredits: { $eq: 0 },
      // updatedAt: { $gte: oneWeekAgo },
      currentStatus: "Active",
      emailReceiver: true,
    }).lean();

    if (!eligibleUsers.length) {
      console.log("? No users found for weekly credit refill.");
      return;
    }

    eligibleUsers.forEach(async (user) => {
      const timezone = countryToTimezone[user.country] || "UTC";
      const now = moment.tz(timezone);
      const mondayAtMidnight = now.startOf("isoWeek").add(10, "hours");
      const randomDelay = getRandomDelay();

      const delayUntilSend =
        mondayAtMidnight.valueOf() + randomDelay - Date.now();

      if (delayUntilSend > 0) {
        console.log(
          `? Scheduling email for ${user.email} in ${timezone} at ${moment(
            mondayAtMidnight.valueOf() + randomDelay
          ).format("YYYY-MM-DD HH:mm:ss z")}`
        );

        setTimeout(async () => {
          console.log(
            `?? Refilling credits and sending email to ${user.email}`
          );

          // await User.updateOne({ _id: user._id }, { userCredits: 20 });

          const penaltyCount = user.penalties?.length || 0;
          let credits = 20;
          if (
            penaltyCount >= 10 &&
            penaltyCount < 15 &&
            user.userCredits > 10
          ) {
            credits -= 10;
          } else if (penaltyCount >= 15 && user.userCredits > 15) {
            credits -= 15;
          }
          await sendMail(
            user.email,
            "Your Weekly Credits Have Been Refilled",
            "weeklyCreditRefill.html",
            {
              userName: user.name,
              submitTrack: "https://pitchplaylists.com/submit-song",
              userMail: user.email,
              credits: credits,
              Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${user.spotifyId}`,
            },
            "artist"
          );

          console.log(`?? Email sent to ${user.email} at ${timezone}`);
        }, delayUntilSend);
      } else {
        console.log(
          `?? Skipping email for ${user.email}, time already passed.`
        );
      }
    });

    console.log("? Weekly credit refill emails scheduled successfully!");
  } catch (error) {
    console.error("? Error in weekly credit refill cron job:", error);
  }
});


cron.schedule("20 0 * * 1", async () => {
  console.log(
    "?? Checking users who haven�t added a playlist within a week of registration..."
  );

  try {
    const oneWeekAgo = moment().subtract(14, "days").toDate();

    const users = await User.find({
      createdAt: {
        $lte: oneWeekAgo,
        $gt: moment(oneWeekAgo).subtract(1, "day").toDate(),
      },
      emailReceiver: true,
    }).lean();

    if (!users.length) {
      console.log("? No users found for playlist addition reminder.");
      return;
    }

    const userIds = users.map((user) => user._id);

    const usersWithoutPlaylists = await Promise.all(
      userIds.map(async (userId) => {
        const playlistCount = await Playlist.countDocuments({ userId });
        return playlistCount === 0 ? userId : null;
      })
    );

    const usersToNotify = users.filter((user) =>
      usersWithoutPlaylists.includes(user._id)
    );

    if (!usersToNotify.length) {
      console.log("? All users have added a playlist.");
      return;
    }

    const emailPromises = usersToNotify.map((user) => {
      console.log(`?? Sending playlist reminder email to ${user.email}`);
      return sendMail(
        user.email,
        "On the Lookout for New Playlists! Add Yours Today",
        "addPlaylistReminder.html",
        {
          userName: user.name,
          playlistSubmitLink: "https://pitchplaylists.com/add-playlist",
          userMail: user.email,
          Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${user.spotifyId}`,
        },
        "artist"
      );
    });

    await Promise.all(emailPromises);
    console.log("? Playlist reminder emails sent successfully!");
  } catch (error) {
    console.error("? Error in playlist reminder cron job:", error);
  }
});

const getRandomDelayForTop20 = () => {
  const minMinutes = 10 * 60;
  const maxMinutes = 15 * 60;
  return (
    Math.floor(Math.random() * (maxMinutes - minMinutes) + minMinutes) *
    60 *
    1000
  );
};
async function sendTop20Email(
  email,
  name,
  spotifyId,
  currentPosition,
  previousPosition
) {
  let subject = "";
  let emailContent = "";

  if (previousPosition === "Not Ranked") {
    subject = "You've Entered the Top 20!";
    emailContent = "top20CuratorsNewEntry.html";
  } else if (previousPosition > 20) {
    subject = "Welcome Back to the Top 20!";
    emailContent = "top20CuratorsWelcomeBack.html";
  } else if (currentPosition < previousPosition) {
    subject = "You Made the Top 20 Curators";
    emailContent = "top20CuratorsUp.html";
  } else if (currentPosition > previousPosition) {
    subject = "Keep Going! You Can Climb Back Up!";
    emailContent = "top20CuratorsDown.html";
  } else {
    subject = "Steady as You Go!";
    emailContent = "top20CuratorsNoChange.html";
  }

  await sendMail(
    email,
    subject,
    emailContent,
    {
      userName: name,
      position: currentPosition,
      topCuratorChart: "https://pitchplaylists.com/top-curator-chart",
      userMail: email,
      Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${spotifyId}`,
    },
    "curator"
  );
}

cron.schedule("10 1 * * 1", async () => {
  console.log("?? Checking Top 20 curators...");
  try {
    const oneWeekAgo = moment().subtract(7, "days").toDate();
    const topCurators = await TopCurator.find({
      createdAt: { $gte: oneWeekAgo },
    })
      .sort({ position: 1 })
      .limit(20);

    if (!topCurators.length) {
      return console.log("? No curators found in the Top 20.");
    }

    for (const curator of topCurators) {
      const user = await User.findOne({
        _id: curator.userId,
        emailReceiver: true,
      });
      if (!user) continue;

      const previousPosition = curator.lastWeek ?? "Not Ranked";
      const timezone = countryToTimezone[user.country] || "UTC";
      const now = moment.tz(timezone);
      const randomDelay = getRandomDelayForTop20();
      const sendTime =
        now.startOf("day").add(10, "hours").valueOf() + randomDelay;
      const delayUntilSend = sendTime - Date.now();

      console.log(
        `? Scheduling email for ${user.email} at ${moment(sendTime).format(
          "YYYY-MM-DD HH:mm:ss z"
        )} in ${timezone}`
      );

      setTimeout(async () => {
        try {
          console.log(`?? Sending email to ${user.email}...`);
          await sendTop20Email(
            user.email,
            user.name,
            user.spotifyId,
            curator.position,
            previousPosition
          );
          console.log(`? Email sent to ${user.email}`);
        } catch (error) {
          console.error(`? Failed to send email to ${user.email}:`, error);
        }
      }, delayUntilSend);
    }

    console.log("? All Top 20 emails have been scheduled.");
  } catch (error) {
    console.error("? Error processing Top 20 emails:", error);
  }
});

const getRandomDelayForExpire = () => {
  const minMinutes = 12 * 60;
  const maxMinutes = 18 * 60;
  return (
    Math.floor(Math.random() * (maxMinutes - minMinutes) + minMinutes) *
    60 *
    1000
  );
};

async function sendExpirationEmail(email, name, expiryDate, attempt = 1) {
  try {
    await sendMail(
      email,
      "Track Expiration Notice",
      "giveFeedback.html",
      {
        userName: name || "Playlist Owner",
        noOfSongs: 1,
        expiryDate: moment(expiryDate).format("LL"),
        userMail: email,
        dashboardLink: "https://pitchplaylists.com/dashboard",
        Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${spotifyId}`,
      },
      "curator"
    );

    console.log(`? Email sent to ${email} (Attempt ${attempt})`);
  } catch (error) {
    console.error(
      `? Failed to send email to ${email} (Attempt ${attempt}):`,
      error
    );
  }
}

cron.schedule("45 0 * * *", async () => {
  console.log(
    `[${moment().format()}] ?? Checking for tracks nearing expiration...`
  );

  try {
    const expirationWarningDate = moment()
      .subtract(20 - 3, "days")
      .startOf("day")
      .toDate();

    const expiringTracks = await Track.find({
      createdAt: {
        $gte: expirationWarningDate,
        $lt: moment(expirationWarningDate).endOf("day").toDate(),
      },
      status: "pending",
    }).lean();

    if (!expiringTracks.length) {
      return console.log(
        `[${moment().format()}] ? No tracks nearing expiration.`
      );
    }

    for (const track of expiringTracks) {
      const playlist = await Playlist.findById(track.playlist).lean();
      if (!playlist) continue;

      const owner = await User.findOne({
        _id: playlist.userId,
        emailReceiver: true,
      }).lean();
      if (!owner || !owner.email) continue;

      const timezone = countryToTimezone[owner.country] || "UTC";
      const now = moment.tz(timezone);
      const randomDelay = getRandomDelayForExpire();
      const sendTime =
        now.startOf("day").add(12, "hours").valueOf() + randomDelay;
      const delayUntilSend = sendTime - Date.now();

      console.log(
        `[${moment().format()}] ? Scheduling expiration email for ${
          owner.email
        } at ${moment(sendTime).format("YYYY-MM-DD HH:mm:ss z")} in ${timezone}`
      );

      setTimeout(async () => {
        try {
          console.log(
            `[${moment().format()}] ?? Sending email to ${owner.email}...`
          );
          await sendExpirationEmail(
            owner.email,
            owner.name,
            owner.spotifyId,
            moment(track.createdAt).add(20, "days")
          );
        } catch (error) {
          console.error(
            `[${moment().format()}] ? Critical error in sending email to ${
              owner.email
            }:`,
            error
          );
        }
      }, delayUntilSend);
    }

    console.log(
      `[${moment().format()}] ? All expiration emails have been scheduled.`
    );
  } catch (error) {
    console.error(
      `[${moment().format()}] ? Error processing track expiration emails:`,
      error
    );
  }
});
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

cron.schedule("0 13 * * *", async () => {
  try {
    console.log("Running daily curator email at 1 PM...");

    const today = new Date().toISOString().split("T")[0];
    const playlists = await Playlist.find();

    const playlistOwnerIds = [
      ...new Set(playlists.map((p) => p.userId.toString())),
    ];

    const users = await User.find({
      _id: { $in: playlistOwnerIds },
      emailReceiver: true,
    });

    for (const user of users) {
      try {
        const lastSent = user.lastEmailSend;
        const lastSentDate = lastSent?.toISOString().split("T")[0];

        if (lastSentDate === today) continue;

        if (
          !user.email ||
          typeof user.email !== "string" ||
          !user.email.includes("@")
        ) {
          console.trackStatus(
            `⚠️ Skipping invalid email for user ${user._id}: ${user.email}`
          );
          continue;
        }

        const userPlaylists = playlists.filter(
          (p) => p.userId.toString() === user._id.toString()
        );
        const playlistIds = userPlaylists.map((p) => p._id.toString());

        const pendingTracks = await Track.find({
          playlist: { $in: playlistIds },
          status: "pending",
        }).sort({ createdAt: -1 });

        if (!pendingTracks.length) continue;

        const template =
          pendingTracks.length === 1
            ? "singleSubmissionUpdate.html"
            : "dailySubmissionUpdate.html";

        await sendMail(
          user.email,
          "New Submissions for Your Playlist!",
          template,
          {
            userName: user.name,
            noOfSongs: pendingTracks.length,
            playlistName:
              userPlaylists.map((p) => p.playlistName).join(", ") ||
              "Your Playlist",
            reviewSubmission: "https://pitchplaylists.com/dashboard",
            userMail: user.email,
            Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${user.spotifyId}`,
          },
          "curator"
        );

        await User.updateOne({ _id: user._id }, { lastEmailSend: new Date() });

        console.log(
          `✅ Email sent to ${user.email} (${pendingTracks.length} tracks)`
        );
      } catch (error) {
        console.error(`❌ Error sending to ${user.email}:`, error.message);
      }

      // Delay between users to prevent SMTP throttling
      await delay(2000); // 2 seconds — increase to 3000–5000ms if needed
    }
  } catch (err) {
    console.error("❌ Error in daily curator digest cron job:", err);
  }
});

cron.schedule("0 19 * * *", async () => {
  console.log(
    "Running a task every 7pm for deleting email logs older than 14 days"
  );
  try {
    await DeleteEmailLogs();
  } catch (error) {
    console.error("Error deleting email logs");
  }
});

function formatDate(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0"); // Month is 0-based
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

let cronRunning = false;
cron.schedule("0 5 * * *", async () => {
  if (cronRunning) return; // Prevent overlapping executions
  cronRunning = true;

  try {
    console.log("Cron job started: Generating curator lists...");

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(todayStart.getDate() - 6);

    const monthAgo = new Date(todayStart);
    monthAgo.setDate(todayStart.getDate() - 30);

    const yearAgo = new Date(todayStart);
    yearAgo.setFullYear(todayStart.getFullYear() - 1);

    // Default list
    await generateCuratorList();
    console.log("✅ Default curator list generated");

    // 7 days list
    await generateCuratorListSevenDays(
      formatDate(sevenDaysAgo),
      formatDate(todayStart)
    );
    console.log("✅ 7 days curator list generated");

    // Monthly list
    await generateCuratorListMonth(
      formatDate(monthAgo),
      formatDate(todayStart)
    );
    console.log("✅ Monthly curator list generated");

    // Yearly list
    await generateCuratorListYear(formatDate(yearAgo), formatDate(todayStart));
    console.log("✅ Year curator list generated");
  } catch (error) {
    console.error("❌ Cron job failed:", error.message);
  } finally {
    cronRunning = false;
  }
});

cron.schedule("*/40 * * * *", async () => {
  console.log("running calculate response rate");
  await calculateResponseRate();
  console.log("Success Calculate response rate.");
});

// cron.schedule('* * * * *', () => {
//   const now = new Date();
//   console.log('Current server time:', now.toISOString());
// });

//calculate credits

// Reminder To new user if he dont submit a track/song
// cron.schedule('0 0 * * *', async () => {
//   console.log(' Running User reminder email Cron Job...');
//   try {
//     const twentyFourHoursAgo = moment().subtract(24, 'hours').toDate();
//     console.log(moment().toDate())
//     const usersToRemind = await User.find({
//       createdAt: { $gte: moment(twentyFourHoursAgo).subtract(1, 'minute').toDate() },
//       usedCredits: { $eq: 0 },
//       emailReceiver:true
//     });
//     console.log(twentyFourHoursAgo)
//     if (usersToRemind.length === 0) {
//       console.log(' No users need a Song submission reminder.');
//       return;
//     }

//     for (const user of usersToRemind) {
//       await sendMail(user.email, 'Ready to Share Your Music? Submit Your First Track!', "reminderEmail.html",
//         {
//           userName: user.name,
//           dashboardLink: "https://pitchplaylists.com/dashboard",
//           userMail: user.email,
//           Unsubscribe: `https://pitchplaylists.com/unsubscribe?spotifyId=${user.spotifyId}`,
//         },"artist");
//       console.log(` Reminder sent to ${user.email}`);
//       await User.updateOne({ _id: user._id }, { reminderSent: true });

//     }
//   } catch (error) {
//     console.error(' Error in cron job:', error);
//   }
// });

// router.get("/test-penalty-credits", async (req, res) => {
//   try {
//   const users = await User.find({});
//   const now = new Date();

//   for (const user of users) {
//     let credits = 20;
//     const penaltyStart = user.creditPenaltyStart;
//     const penaltyEnd = user.creditEndDate;

//     // --- Check if penalty period has ended (21-day reset) ---
//     if (penaltyStart) {
//       const daysSincePenaltyStart = Math.floor(
//         (now - penaltyStart) / (1000 * 60 * 60 * 24)
//       );
//       if (daysSincePenaltyStart >= 21) {
//         user.penaltyPoints = 0;
//         user.creditPenaltyStart = null;
//       }
//     }

//     // --- Apply reduced credits if still within penalty period ---
//     if (penaltyEnd && now < penaltyEnd) {
//       if (user.penaltyPoints >= 15) {
//         credits = 5;
//       } else if (user.penaltyPoints >= 10 && user.penaltyPoints < 15) {
//         credits = 10;
//       }
//     }

//     // --- Start new penalty period if needed ---
//     else if (user.penaltyPoints >= 10) {
//       user.creditPenaltyStart = now;
//       user.creditEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
//       if (user.penaltyPoints >= 15) {
//         credits = 5;
//       } else {
//         credits = 10;
//       }
//     }

//     // --- Full credits if no penalty ---
//     else {
//       credits = 20;
//       user.creditEndDate = null;
//     }

//     // --- Apply credit update ---
//     user.userCredits = credits;
//     user.usedCredits = 0;
//     user.creditUpdateDate = now;

//     await user.save();
//     console.log(`Credits set to ${credits} for user: ${user._id}`);
//   }
//     return res.status(200).json({ msg: "Manual penalty check complete ✅" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ msg: "Error running manual penalty check" });
//   }
// });

//check track status

// cron.schedule("0 0 * * 1", async () => {
//   console.log("Running weekly credit reset...");

//   try {
//     const users = await User.find({});
//     const nextMonday = getNextMonday();

//     await Promise.all(
//       users.map(async (user) => {
//         user.userCredits = 20; // Reset to 20 credits
//         user.usedCredits = 0;  // Reset used credits
//         user.creditUpdateDate = nextMonday;

//         await user.save();
//         console.log(`Credits reset for user: ${user._id}`);
//       })
//     );

//     console.log("All users' credits have been reset to 20.");
//   } catch (err) {
//     console.error("Error resetting credits:", err.message);
//   }
// });

// cron.schedule("0 0 * * 1", async () => {
//   console.log("Running weekly credit updater...");
//   const users = await User.find({});
//   const now = new Date();
//   for (const user of users) {
//     let credits = 20;
//     const penaltyStart = user.creditPenaltyStart;
//     const daysSincePenalty = penaltyStart
//       ? Math.floor((now - penaltyStart) / (1000 * 60 * 60 * 24))
//       : 0;
//     // Reset penalties if 21 days have passed
//     if (penaltyStart && daysSincePenalty >= 21) {
//       user.penaltyPoints = 0;
//       user.creditPenaltyStart = null;
//       credits = 20;
//     }
//     // If penalty is high, adjust credits
//     if (user.penaltyPoints >= 20) {
//       credits = 5;
//       // Only set creditPenaltyStart if not already set
//       if (!user.creditPenaltyStart) user.creditPenaltyStart = now;
//     } else if (user.penaltyPoints >= 10) {
//       credits = 10;
//       if (!user.creditPenaltyStart) user.creditPenaltyStart = now;
//     }
//     user.userCredits = credits;
//     user.usedCredits = 0;
//     user.creditUpdateDate = now;

//     await user.save();
//     console.log(`Credits set to ${credits} for user: ${user._id}`);
//   }
// });
