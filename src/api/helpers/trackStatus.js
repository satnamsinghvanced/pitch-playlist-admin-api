import getSpotifyToken from "../../middleware/getSpotifyToken.js";
import Track from "../../models/track/index.js";
import TrackStatus from "../../models/trackStatus/index.js";
import axios from "axios";
import Playlist from "../../models/playlist/index.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Axios with retry + token refresh
 */
const axiosWithRetry = async (options, authHeaderRef, retries = 5, delay = 2000) => {
  try {
    options.headers.Authorization = authHeaderRef.token;
    const response = await axios(options);
    return response;
  } catch (error) {
    const status = error.response?.status;

    if (status === 401 && retries > 0) {
      console.warn("🔁 Token expired, refreshing...");
      const newAuthHeader = await getSpotifyToken();
      authHeaderRef.token = newAuthHeader;
      return axiosWithRetry(options, authHeaderRef, retries - 1, delay);
    }

    if (retries > 0 && (status === 429 || status >= 500 || error.code === "ECONNABORTED")) {
      const retryAfter = error.response?.headers?.["retry-after"];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
      console.warn(`⚠️ Retrying after ${waitTime / 1000}s (Status: ${status})... (${retries} attempts left)`);
      await sleep(waitTime);
      return axiosWithRetry(options, authHeaderRef, retries - 1, delay * 2);
    }

    console.error(`❌ Axios failed (Status: ${status || "N/A"}):`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch all tracks from a Spotify playlist (with retry and pagination)
 */
const fetchAllTracks = async (playlistId, authHeaderRef, fetchDelay = 200) => {
  let allTracks = [];
  let offset = 0;
  const limit = 100;
  let hasMoreTracks = true;

  while (hasMoreTracks) {
    const options = {
      url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      method: "get",
      headers: {},
      params: { offset, limit },
    };

    try {
      const response = await axiosWithRetry(options, authHeaderRef);
      const playlistData = response.data;

      allTracks = allTracks.concat(playlistData.items);
      offset += limit;

      if (playlistData.items.length < limit) hasMoreTracks = false;
      await sleep(fetchDelay); // prevent rate limit
    } catch (error) {
      console.error(`❌ Error fetching playlist ${playlistId} at offset ${offset}:`, error.message);
      hasMoreTracks = false;
    }
  }

  return allTracks;
};

/**
 * Main trackStatus job (optimized - no Mongo cursor timeouts)
 */
const trackStatus = async (saveDelay = 50, fetchDelay = 200, batchSize = 500) => {
  try {
    console.log("🚀 Starting trackStatus job...");
    const authHeaderRef = { token: await getSpotifyToken() };

    // Fetch all active playlists at once
    const playlists = await Playlist.find({ isActive: true }).lean();

    for (const playlist of playlists) {
      const playlistId = playlist.playlistId;
      const playlistMongoId = playlist._id;
      console.log(`🎧 Processing playlist: ${playlistId}`);

      // Fetch Spotify playlist tracks
      const spotifyTracks = await fetchAllTracks(playlistId, authHeaderRef, fetchDelay);
      const spotifyTrackIds = new Set(spotifyTracks.map((t) => t?.track?.id).filter(Boolean));

      // Batch process approved tracks to avoid timeouts
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const approvedTracks = await Track.find({
          status: "approved",
          playlist: playlistMongoId,
          updatedAt: { $gt: new Date("2025-05-26T00:00:00Z") },
        })
          .skip(skip)
          .limit(batchSize)
          .lean();

        if (approvedTracks.length === 0) {
          hasMore = false;
          break;
        }

        skip += batchSize;

        for (const track of approvedTracks) {
          const trackId = track.track.trackId;
          const trackExists = spotifyTrackIds.has(trackId);

          let trackStatusDoc = await TrackStatus.findOne({ track: track._id });

          if (trackStatusDoc) {
            trackStatusDoc.stillInPlaylist = trackExists;
            if (!trackExists && !trackStatusDoc.removedFromPlaylist) {
              trackStatusDoc.removedFromPlaylist = new Date();
            }
            await trackStatusDoc.save();
          } else {
            trackStatusDoc = new TrackStatus({
              track: track._id,
              playlist: playlistMongoId,
              trackId,
              playlistId,
              approvedOn: track.updatedAt,
              removedFromPlaylist: trackExists ? null : new Date(),
              stillInPlaylist: trackExists,
            });
            await trackStatusDoc.save();
          }

          console.log(`✅ Checked track ${trackId}: trackExists = ${trackExists}`);
          await sleep(saveDelay);
        }
      }

      console.log(`✅ Completed playlist: ${playlistId}`);
    }

    console.log("🎉 All playlists processed successfully!");
  } catch (err) {
    console.error("❌ trackStatus error:", err.message);
  }
};

export default trackStatus;

