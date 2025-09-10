import TrackStatus from "../../models/trackStatus/index.js";
import Playlist from "../../models/playlist/index.js";
import WarningDays from "../../models/warningDays/index.js";
import dateDifference from "./dateDifference.js";
import moment from "moment";


// export const getWarningsDetail = async (userId, startDate, endDate) => {
//   try {
//     const dateFilter = {};
//     if (startDate) {
//       const start = moment(startDate, "DD-MM-YYYY").toDate();
//       if (!isNaN(start.getTime())) {
//         dateFilter.$gte = start;
//       } else {
//         console.error("Invalid startDate:", startDate);
//       }
//     }

//     if (endDate) {
//       const end = moment(endDate, "DD-MM-YYYY").toDate();
//       if (!isNaN(end.getTime())) {
//         end.setHours(23, 59, 59, 999);
//         dateFilter.$lte = end;
//       } else {
//         console.error("Invalid endDate:", endDate);
//       }
//     }
//     const allPlaylist = await Playlist.find({ userId });
//     const warningDay = await WarningDays.find({});
//     const day = warningDay[0]?.noOfDays;
//     if (!allPlaylist.length) {
//       console.log("No Playlist found");
//       return;
//     }
//     const playlistIds = allPlaylist.map((playlist) => playlist._id);
//     const trackStatus = await TrackStatus.find({
//       playlist: { $in: playlistIds },
//       stillInPlaylist: false,
//       ...(Object.keys(dateFilter).length && {
//         removedFromPlaylist: dateFilter,
//       }),
//     });
//     const warnings = await Promise.all(
//       trackStatus.map(async (val) => {
//         const startDate = val.approvedOn;
//         const endDate = val.removedFromPlaylist;
//         const diff = dateDifference(startDate, endDate);
//         let warning;
//         if (diff.days < day) {
//           warning = true;
//         } else {
//           warning = false;
//         }
//         return { ...val.toObject(), warning };
//       })
//     );
//     const warningReceived = warnings.filter((val) => val.warning === true);

//     return warningReceived.length;
//   } catch (err) {
//     console.error(err);
//     throw new Error({ msg: err.message });
//   }
// };

export const getWarningsDetail = async (userId, startDate, endDate) => {
  try {
    const dateFilter = {};

    if (startDate) {
      const start = moment(startDate, "DD-MM-YYYY").toDate();
      if (!isNaN(start.getTime())) {
        dateFilter.$gte = start;
      }
    }

    if (endDate) {
      const end = moment(endDate, "DD-MM-YYYY").toDate();
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }

    // Get user's playlists
    const allPlaylist = await Playlist.find({ userId });
    if (!allPlaylist.length) return 0;

    const playlistIds = allPlaylist.map((p) => p._id);

    // Get the warning day count (default to 7)
    const warningDayDoc = await WarningDays.findOne({});
    const warningDays = warningDayDoc?.noOfDays ?? 7;

    // Fetch removed tracks that were approved earlier
    const rawTrackStatus = await TrackStatus.find({
      playlist: { $in: playlistIds },
      stillInPlaylist: false ,
      removedFromPlaylist: { $ne: null, ...(Object.keys(dateFilter).length ? dateFilter : {}) },
      approvedOn: { $ne: null }
    });

    const warnings = rawTrackStatus.filter((val) => {
      const approvedDate = new Date(val.approvedOn);
      const removedDate = new Date(val.removedFromPlaylist);

      if (
        !(approvedDate instanceof Date) || isNaN(approvedDate.getTime()) ||
        !(removedDate instanceof Date) || isNaN(removedDate.getTime())
      ) {
        return false;
      }

      const timeDiffInDays = (removedDate - approvedDate) / (1000 * 60 * 60 * 24);
      
      return timeDiffInDays >= 0 && timeDiffInDays < warningDays;
    });

    return warnings.length;

  } catch (err) {
    console.error("Error in getWarningsDetail:", err);
    throw new Error(err.message);
  }
};


export const getPlaylistWarnings = async (playlistId, dateFilter) => {
  try {
    const warningDay = await WarningDays.find({});
    const day = warningDay[0]?.noOfDays;
    const trackStatus = await TrackStatus.find({
      playlist: playlistId,
      stillInPlaylist: false,
      ...(Object.keys(dateFilter).length && {
        removedFromPlaylist: dateFilter,
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
    return warnings;
  } catch (err) {
    console.error(err);
    throw new Error({ msg: err.message });
  }
};
