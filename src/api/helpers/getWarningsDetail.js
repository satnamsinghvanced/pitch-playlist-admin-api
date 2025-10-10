import TrackStatus from "../../models/trackStatus/index.js";
import Playlist from "../../models/playlist/index.js";
import WarningDays from "../../models/warningDays/index.js";
import dateDifference from "./dateDifference.js";
import moment from "moment";

export const getWarningsDetail = async (userId, startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) {
      const start = moment(startDate, "DD-MM-YYYY").toDate();
      if (!isNaN(start.getTime())) {
        dateFilter.$gte = start;
      } else {
        console.error("Invalid startDate:", startDate);
      }
    }

    if (endDate) {
      const end = moment(endDate, "DD-MM-YYYY").toDate();
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      } else {
        console.error("Invalid endDate:", endDate);
      }
    }
     const updatedFilter = { $gt: new Date("2025-05-26T00:00:00Z") };
    const allPlaylist = await Playlist.find({ userId,createdAt: updatedFilter, });
    const warningDay = await WarningDays.find({});
    const day = warningDay[0]?.noOfDays;
    if (!allPlaylist.length) {
      console.log("No Playlist found");
      return;
    }
    const playlistIds = allPlaylist.map((playlist) => playlist._id);
    const trackStatus = await TrackStatus.find({
      playlist: { $in: playlistIds },
      stillInPlaylist: false,
      ...(Object.keys(dateFilter).length && {
        removedFromPlaylist: dateFilter,
        createdAt: updatedFilter,
      }),
    });
    const warnings = await Promise.all(
      trackStatus.map(async (val) => {
        const startDate = val.approvedOn;
        const endDate = val.removedFromPlaylist;
        const diff = dateDifference(startDate, endDate);
        let warning;
        if (diff.days < day) {
          warning = true;
        } else {
          warning = false;
        }
        return { ...val.toObject(), warning };
      })
    );
    const warningReceived = warnings.filter((val) => val.warning === true);

    return warningReceived.length;
  } catch (err) {
    console.error(err);
    throw new Error({ msg: err.message });
  }
};

// export const getWarningsDetail = async (userId, startDate, endDate) => {
//   try {
//     const dateFilter = {};
//     if (startDate) {
//       const start = moment(startDate, "DD-MM-YYYY").startOf("day").toDate();
//       if (!isNaN(start.getTime())) dateFilter.$gte = start;
//     }
//     if (endDate) {
//       const end = moment(endDate, "DD-MM-YYYY").endOf("day").toDate();
//       if (!isNaN(end.getTime())) dateFilter.$lte = end;
//     }

//     const allPlaylist = await Playlist.find({ userId });
//     if (!allPlaylist.length) return 0;
//     const playlistIds = allPlaylist.map((p) => p._id);

//     const warningDayDoc = await WarningDays.findOne({});
//     const warningDays = warningDayDoc?.noOfDays ?? 7;

//     const warnings = await TrackStatus.aggregate([
//       {
//         $match: {
//           playlist: { $in: playlistIds },
//           stillInPlaylist: false,
//           removedFromPlaylist: { $ne: null, ...(Object.keys(dateFilter).length ? dateFilter : {}) },
//           approvedOn: { $ne: null },
//         },
//       },
//       {
//         $project: {
//           diffInDays: {
//             $divide: [
//               { $subtract: ["$removedFromPlaylist", "$approvedOn"] },
//               1000 * 60 * 60 * 24,
//             ],
//           },
//         },
//       },
//       {
//         $match: {
//           diffInDays: { $gte: 0, $lt: warningDays },
//         },
//       },
//       { $count: "count" },
//     ]);

//     return warnings[0]?.count || 0;
//   } catch (err) {
//     console.error("Error in getWarningsDetail:", err);
//     throw new Error(err.message);
//   }
// };

export const getPlaylistWarnings = async (playlistId, dateFilter) => {
  try {
    const warningDay = await WarningDays.find({});
    const day = warningDay[0]?.noOfDays;
    const trackStatus = await TrackStatus.find({
      playlist: playlistId,
      stillInPlaylist: false,
      ...(Object.keys(dateFilter).length && {
        removedFromPlaylist: dateFilter,
        createdAt: { $gt: new Date("2025-05-26T00:00:00Z") },
      }),
    });

    const warnings = await Promise.all(
      trackStatus.map(async (val) => {
        const startDate = val.approvedOn;
        const endDate = val.removedFromPlaylist;
        const diff = dateDifference(startDate, endDate);
        let warning;
        if (diff.days < day) {
          warning = true;
        } else {
          warning = false;
        }
        return { ...val.toObject(), warning };
      })
    );
    const warningReceived = warnings.filter((val) => val.warning === true);

    return warningReceived.length;
  } catch (err) {
    console.error(err);
    throw new Error({ msg: err.message });
  }
};

export const getTrackWarning = async (playlistId, dateFilter) => {
  try {
    const warningDay = await WarningDays.find({});
    const day = warningDay[0]?.noOfDays;
    const trackStatus = await TrackStatus.find({
      playlist: playlistId,
      stillInPlaylist: false,
      ...(Object.keys(dateFilter).length && {
        removedFromPlaylist: dateFilter,
        createdAt: { $gt: new Date("2025-05-26T00:00:00Z") },
      }),
    });
    const warningsList = await Promise.all(
      trackStatus.map(async (val) => {
        const startDate = val.approvedOn;
        const endDate = val.removedFromPlaylist;
        const diff = dateDifference(startDate, endDate);
        let warning;
        if (diff.days < day) {
          warning = true;
        } else {
          warning = false;
        }
        return { ...val.toObject(), warning };
      })
    );
    const warnings = warningsList.filter((val) => val.warning === true);
    return warnings;
  } catch (err) {
    console.error(err);
    throw new Error({ msg: err.message });
  }
};
