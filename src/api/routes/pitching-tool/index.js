import express from "express";
import Track from "../../../models/track/index.js";
import axios from "axios";
import PlaylistModel from "../../../models/playlist/index.js";
import calculateResponseRate from "../../helpers/calculateResponseRate.js";
import auth from "../../../middleware/auth.js";
import SubmittedTracks from "../../../models/submittedTracks/index.js";
import Genres from "../../../models/genres/index.js";
import playlist from "../../../models/playlist/index.js";
import track from "../../../models/track/index.js";
import mongoose from "mongoose";
import submittedTracks from "../../../models/submittedTracks/index.js";
import pLimit from "p-limit";
import admin from "../../../models/admin/index.js"
import { sendCompletionEmail } from "../../helpers/sendCompletionEmail.js";
async function withRetry(fn, retries = 2, delayMs = 1000) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt); // 1s, 2s
        console.warn(`⚠️ Retry ${attempt + 1}/${retries} after error: ${err.message}`);
        await delay(wait);
      }
    }
  }
  throw lastErr;
}

const router = express.Router();
const delay = (ms) => new Promise((res) => setTimeout(res, ms));


axios.interceptors.response.use(null, async (error) => {
  if (error.response && error.response.status === 429) {
    const retryAfter = error.response.headers["retry-after"];
    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
    console.warn(`Rate limited. Retrying after ${waitTime}ms...`);
    await delay(waitTime);
    return axios(error.config);
  }
  return Promise.reject(error);
});
router.post("/submit-song", auth, async (req, res) => {
  try {
    const io = req.app.get("io");
    const authHeader = req.header("SpotifyToken");
    const { trackId, playlistIds, submissionAmount, userId } = req.body;
     const userProfileResponse = await axios({
      url: "https://api.spotify.com/v1/me",
      method: "get",
      headers: { Authorization: authHeader },
      timeout: 10000,
    });

    const userProfile = userProfileResponse?.data;
      const { id: spotifyId } = userProfile;
    // Limit processing to submissionAmount
    const selectedPlaylistsIds = playlistIds.slice(0, submissionAmount);

    // ✅ Respond immediately
    res.status(202).json({
      msg: "Submission started. You will receive email when its updates.",
      status: "accepted",
    });

    // ✅ Run background job (non-blocking)
    setImmediate(() => {
      processSubmission({
        selectedPlaylistsIds,
        userId,
        spotifyId,
        trackId,
        authHeader,
        io,
      }).catch((err) => {
        console.error("Background job failed:", err.message);
      });
    });
  } catch (err) {
    console.error("Pitching tool api fail:", err.message);
    res.status(500).send({ msg: err.message });
  }
});
async function processSubmission({
  selectedPlaylistsIds,
  userId,
  spotifyId,
  trackId,
  authHeader,
}) {
  try {
    const totalPlaylists = selectedPlaylistsIds.length;
    const savedTrackIds = [];
    const playlistUrls = [];
    const chunkSize = 100; 
    const limit = pLimit(2); 

    const track = (await withRetry(() =>
      axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: authHeader },
        timeout: 10000,
      })
    )).data;

    const artist = (await withRetry(() =>
      axios.get(`https://api.spotify.com/v1/artists/${track.artists[0].id}`, {
        headers: { Authorization: authHeader },
        timeout: 10000,
      })
    )).data;

    const withTimeout = (promise, ms, playlistId) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout on ${playlistId}`)), ms)
        ),
      ]);

    // Process playlists in concurrent but memory-safe batches
    for (let i = 0; i < totalPlaylists; i += chunkSize) {
      const batch = selectedPlaylistsIds.slice(i, i + chunkSize);

      const tasks = batch.map((playlistId) =>
        limit(async () => {
          try {
            await withTimeout(
              withRetry(async () => {
                const singlePlaylist = await PlaylistModel.findById(playlistId);
                if (!singlePlaylist) throw new Error("Playlist not found");

                if (singlePlaylist.playlistUrl) playlistUrls.push(singlePlaylist.playlistUrl);

                singlePlaylist.totalSubmissions =
                  (singlePlaylist.totalSubmissions || 0) + 1;
                await singlePlaylist.save();

                const newSong = new Track({
                  playlist: playlistId,
                  spotifyId,
                  track: {
                    artistName: artist?.name,
                    artists: track?.artists,
                    artistsArr: [
                      {
                        artistName: artist?.name,
                        artistId: artist?.id,
                        artistUrl: artist?.external_urls.spotify,
                        totalFollowers: artist?.followers.total,
                      },
                    ],
                    trackImageUrl: track?.album.images[1]?.url,
                    trackName: track?.name,
                    preview_url: track?.preview_url,
                    trackId,
                    trackUrl: track?.external_urls.spotify,
                    uri: track?.uri,
                  },
                  status: "pending",
                });

                const saved = await newSong.save();
                savedTrackIds.push(saved._id); // store only _id to save memory
                await delay(50); // give GC breathing room
              }),
              15000,
              playlistId
            );
          } catch (err) {
            console.error(`❌ Playlist ${playlistId} failed:`, err.message);
          }
        })
      );

      await Promise.allSettled(tasks); // wait for batch to finish
    }

    // Save SubmittedTracks in chunks
    for (let i = 0; i < savedTrackIds.length; i += chunkSize) {
      const chunkedTrackIds = savedTrackIds.slice(i, i + chunkSize);
      const chunkedPlaylistUrls = playlistUrls.slice(i, i + chunkSize);

      await new SubmittedTracks({
        trackId,
        totalSubmitted: totalPlaylists,
        userId,
        spotifyId,
        tracksIds: { [`chunk-${i / chunkSize}`]: chunkedTrackIds },
        playlistUrl: { [`chunk-${i / chunkSize}`]: chunkedPlaylistUrls },
      }).save();
    }

    // Send completion email
    const user = await admin.findById(userId);
    if (user?.email) {
      await sendCompletionEmail(
       "amrinder02.2000@gmail.com",
        track.name,
        totalPlaylists,
        savedTrackIds.length,
        totalPlaylists - savedTrackIds.length,
        user.firstName || "Admin"
      );
    }

    console.log("✅ Submission completed successfully.");
  } catch (error) {
    console.error("❌ Background processing failed:", error.message);
    // optional: send failure email
    const user = await admin.findById(userId);
    if (user?.email) {
      await sendCompletionEmail(
       "amrinder02.2000@gmail.com",
        trackId,
        0,
        0,
        0,
        user.firstName || "Admin",
        error.message
      );
    }
  }
}


router.get("/submitted-tracks", auth, async (req, res) => {
  try {
    const { userId, page = 1, limit = 10, search } = req.query;

    if (!userId) {
      return res.status(400).send({ msg: "User ID is required" });
    }

    const numericPage = parseInt(page, 10);
    const numericLimit = parseInt(limit, 10);
    const skip = (numericPage - 1) * numericLimit;

    // ✅ Build query
     const query = { userId, removed: false };

    // Add search filter only if search term is provided
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ trackId: regex }];
    }

    const totalTracks = await SubmittedTracks.countDocuments(query);

    const tracks = await SubmittedTracks.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(numericLimit);

    if (!tracks.length) {
      return res.status(200).send({ msg: "No tracks found for the specified user" });
    }

    res.status(200).json({
      msg: "Submitted by admin",
      tracks,
      totalTracks,
      currentPage: numericPage,
      totalPages: Math.ceil(totalTracks / numericLimit),
    });

    // ✅ Background task (non-blocking)
    setImmediate(async () => {
      try {
        await calculateResponseRate();
      } catch (error) {
        console.error("Error calculating response rate:", error.message);
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ msg: "Server Error" });
  }
});


// router.get("/track-status", auth, async (req, res) => {
//   try {
//     const { id } = req.query;
//     const submittedTrack = await SubmittedTracks.findById(id).lean();

//     const chunkedMap = submittedTrack.tracksIds;
//     const allTrackIds = Object.values(chunkedMap).flat();

//     // const { tracksIds } = submittedTrack;

//     const pendingTracks = await Track.find({
//       _id: { $in: allTrackIds },
//       status: "pending",
//     })
//       .populate("playlist")
//       .lean();
//     const approvedTracks = await Track.find({
//       _id: { $in: allTrackIds },
//       status: "approved",
//     })
//       .populate("playlist")
//       .lean();
//     const declinedTracks = await Track.find({
//       _id: { $in: allTrackIds },
//       status: "declined",
//     })
//       .populate("playlist")
//       .lean();

//     const totalSubmitted = submittedTrack.playlistUrl.length;
//     const totalApprove = approvedTracks.length;
//     const totalPending = pendingTracks.length;
//     const totalDeclined = declinedTracks.length;
//     res.status(200).json({
//       msg: "Track Details",
//       totalSubmitted,
//       totalApprove,
//       totalPending,
//       totalDeclined,
//       submittedTrack,
//       approvedTracks,
//       declinedTracks,
//       pendingTracks,
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send({ msg: "Server Error" });
//   }
// });

router.get("/track-status", auth, async (req, res) => {
  try {
    const { id } = req.query;

    const submittedTrack = await SubmittedTracks.findById(id).lean();
    if (!submittedTrack) {
      return res.status(404).json({ msg: "Submitted track not found" });
    }

    // Normalize track IDs (support array or chunked object)
    let allTrackIds = [];

    if (Array.isArray(submittedTrack.tracksIds)) {
      allTrackIds = submittedTrack.tracksIds;
    } else if (
      typeof submittedTrack.tracksIds === "object" &&
      submittedTrack.tracksIds !== null
    ) {
      allTrackIds = Object.values(submittedTrack.tracksIds).flat();
    }

    // Convert all to ObjectId
    allTrackIds = allTrackIds.map((id) => new mongoose.Types.ObjectId(id));

    // Debugging logs (optional)
    // console.log("Total track IDs to query:", allTrackIds.length);
    // if (allTrackIds.length > 0) {
    //   console.log("Sample track ID:", allTrackIds[0]);
    // }

    // Fetch tracks by status
    const [pendingTracks, approvedTracks, declinedTracks] = await Promise.all([
      Track.find({ _id: { $in: allTrackIds }, status: "pending" })
        .populate("playlist")
        .lean(),
      Track.find({ _id: { $in: allTrackIds }, status: "approved" })
        .populate("playlist")
        .lean(),
      Track.find({ _id: { $in: allTrackIds }, status: "declined" })
        .populate("playlist")
        .lean(),
    ]);
    const totalSubmitted = Object.values(submittedTrack.playlistUrl).flat()
      .length;
    const totalApprove = approvedTracks.length;
    const totalPending = pendingTracks.length;
    const totalDeclined = declinedTracks.length;

    res.status(200).json({
      msg: "Track Details",
      totalSubmitted,
      totalApprove,
      totalPending,
      totalDeclined,
      submittedTrack,
      approvedTracks,
      declinedTracks,
      pendingTracks,
    });
  } catch (err) {
    console.error("Error in track-status:", err.message);
    res.status(500).send({ msg: "Server Error" });
  }
});

// router.get("/genre", async (req, res) => {
//   try {
//     const { trackId, selectedGenres } = req.query;
//     let tracks;
//     if (!trackId) {
//       tracks = [];
//     } else {
//       tracks = await Track.find({ "track.trackId": trackId });
//     }

//     let playlistIds = [];
//     if (tracks.length) {
//       playlistIds = [...new Set(tracks.map((val) => val.playlist))];
//     }
//     let query = { isActive: true };
//     if (playlistIds.length) {
//       query._id = { $nin: playlistIds };
//     }
//     const allGenre = await Genres.find({});
//     const allPlaylist = await PlaylistModel.find(query);
//     const genre = await Promise.all(
//       allGenre.map(async (val) => {
//         const genreId = val.id;
//         const genreName = val.name;
//         if (
//           selectedGenres &&
//           selectedGenres.length > 0 &&
//           !selectedGenres.includes(genreName) &&
//           !selectedGenres.includes(genreId.toString())
//         ) {
//           return null;
//         }
//         const playlistsWithGenre = allPlaylist.filter((playlist) =>
//           playlist.genres.some((g) => g.id === genreId || g.name === genreName)
//         );
//         return {
//           ...val.toObject(),
//           playlists: playlistsWithGenre,
//         };
//       })
//     );
//     const filteredGenres = genre.filter((g) => g !== null);
//     res.status(200).json({ msg: "Genre List", genre: filteredGenres });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send({ msg: "Server Error" });
//   }
// });
router.get("/genre",  async (req, res) => {
  try {
    const { trackId } = req.query;
    let tracks;
    if (!trackId) {
      tracks = [];
    } else {
      tracks = await Track.find({ "track.trackId": trackId });
    }

    let playlistIds = [];
    if (tracks.length) {
      playlistIds = [...new Set(tracks.map((val) => val.playlist))];
    }
    let query = { isActive: true };
    if (playlistIds.length) {
      query._id = { $nin: playlistIds };
    }
    const allGenre = await Genres.find({});
    const allPlaylist = await PlaylistModel.find(query);
    const genre = await Promise.all(
      allGenre.map(async (val) => {
        const genreId = val.id;
        const playlistsWithGenre = allPlaylist.filter((playlist) =>
          playlist.genres.some((g) => g.id === genreId)
        );
        return {
          ...val.toObject(),
          playlists: playlistsWithGenre,
        };
      })
    );
    res.status(200).json({ msg: "Genre List", genre });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ msg: "Server Error" });
  }
});

router.get("/all-genre", async (req, res)=>{
  try {
    const allGenre = await Genres.find();
   const categories = [...new Set(allGenre.map(genre => genre.category))];
    return res.status(200).json({categories , message:" Genre Fetch Successfull"})
  } catch (error) {
    return res.status(500).json({erro:error.message})
  }
})

router.get("/genre-category", async (req, res)=>{
  try {
    const category = req.body;
    const categoryGenres = await Genres.find(category)
       const allPlaylist = await PlaylistModel.find({}, { _id: 1, genres: 1 });
       const genre = await Promise.all(
      categoryGenres.map(async (val) => {
        const genreId = val.id;

        const matchingPlaylistIds = allPlaylist
          .filter((playlist) =>
            playlist.genres.some((g) => g.id === genreId)
          )
          .map((playlist) => playlist._id); 

        return {
          ...val.toObject(),
          playlists: matchingPlaylistIds,
        };
      })
    );
    return res.status(200).json({genre , message:" Genre category Fetch Successfull"})
  } catch (error) {
      return res.status(500).json({erro:error.message})
  }
})

router.put("/remove-track", auth, async (req, res) => {
  try {
    const { id } = req.body;
    const updatedFields = { removed: true };
    await SubmittedTracks.findOneAndUpdate(
      { _id: id },
      { $set: updatedFields },
      { new: true, upsert: true }
    );
    res.status(200).json({ msg: " Track removed " });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ msg: "err.message" });
  }
});

router.put("/cancel-campaign", auth, async (req, res) => {
  try {
    const { id } = req.body;
    const submittedTrack = await SubmittedTracks.findById(id);
   
   let allTracksIds = Array.from(submittedTrack.tracksIds.values()).flat();

    allTracksIds = allTracksIds
      .map((tid) => tid.toString())
      .filter((tid) => mongoose.Types.ObjectId.isValid(tid));

    console.log("Total Track IDs collected:", allTracksIds.length);

    if (allTracksIds.length === 0) {
      return res.status(400).json({ msg: "No valid tracks found to delete" });
    }
    console.log("Total Track IDs collected:", allTracksIds.length);
     const result  = await Track.deleteMany({
      _id: { $in: allTracksIds },
      status: "pending",
    });
     submittedTrack.removed = true;
    await submittedTrack.save();
    res.status(200).json({ msg: " Tracks removed and campaign cancelled ", deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ msg: err.message });
  }
});

router.get("/search-playlist", async (req, res) => {
  try {
    const { search, trackId } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { playlistName: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
      ];
    }
    const playlists = await playlist.find(query).sort({ totalFollowers: -1 });

    if (!trackId) {
      return res.status(200).json({
        message: "Successfully fetched playlists",
        playlists,
      });
    }

    const playlistIds = playlists.map((p) => p._id);

    const recentTrackSubmissions = await track
      .find({
        playlist: { $in: playlistIds },
        "track.trackId": trackId,
      })
      .select("playlist track")
      .lean();

    const submittedPlaylistSet = new Set(
      recentTrackSubmissions.map((t) => t.playlist.toString())
    );

    const playlistsWithFlags = playlists.map((p) => {
      return {
        ...p.toObject(),
        isAlreadyAdded: submittedPlaylistSet.has(p._id.toString()),
      };
    });

    return res.status(200).json({
      message: "Successfully fetched playlists",
      playlists: playlistsWithFlags,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({ msg: error.message });
  }
});

export default router;

