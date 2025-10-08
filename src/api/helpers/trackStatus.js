import getSpotifyToken from "../../middleware/getSpotifyToken.js";
import Track from "../../models/track/index.js";
import TrackStatus from "../../models/trackStatus/index.js";
import axios from "axios";
import Playlist from "../../models/playlist/index.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const axiosWithRetry = async (options, authHeaderRef, retries = 5, delay = 2000) => {
  try {
    options.headers.Authorization = authHeaderRef.token;
    const response = await axios(options);
    return response;
  } catch (error) {
    const status = error.response?.status;

    if (status === 401 && retries > 0) {
      console.warn("Token expired, refreshing...");
      const newAuthHeader = await getSpotifyToken();
      authHeaderRef.token = newAuthHeader;
      return axiosWithRetry(options, authHeaderRef, retries - 1, delay);
    }

    if (retries > 0 && (status === 429 || status >= 500 || error.code === "ECONNABORTED")) {
      const retryAfter = error.response?.headers?.["retry-after"];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
      console.warn(`Retrying after ${waitTime / 1000}s (Status: ${status})... (${retries} attempts left)`);
      await sleep(waitTime);
      return axiosWithRetry(options, authHeaderRef, retries - 1, delay * 2);
    }

    console.error(`❌ Axios failed (Status: ${status || "N/A"}):`, error.response?.data || error.message);
    throw error;
  }
};

// Fetch all tracks from Spotify with delay between API calls
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

      // Delay between each API call to avoid rate-limiting
      await sleep(fetchDelay);
    } catch (error) {
      console.error(`❌ Error fetching playlist ${playlistId} at offset ${offset}:`, error.message);
      hasMoreTracks = false;
    }
  }

  return allTracks;
};

// Main trackStatus function with delays for DB and API
const trackStatus = async (saveDelay = 50, fetchDelay = 200) => {
  try {
    const authHeaderRef = { token: await getSpotifyToken() };
    const playlistCursor = Playlist.find({ isActive: true }).cursor();

    for (let playlist = await playlistCursor.next(); playlist != null; playlist = await playlistCursor.next()) {
      const playlistId = playlist.playlistId;
      const playlistMongoId = playlist._id;

      console.log(`🎧 Fetching tracks for playlist: ${playlistId}`);

      const spotifyTracks = await fetchAllTracks(playlistId, authHeaderRef, fetchDelay);
      const spotifyTrackIds = new Set(spotifyTracks.map((t) => t?.track?.id).filter(Boolean));

      const approvedCursor = Track.find({
        status: "approved",
        playlist: playlistMongoId,
        updatedAt: { $gt: new Date("2025-05-26T00:00:00Z") },
      }).cursor();

      for (let track = await approvedCursor.next(); track != null; track = await approvedCursor.next()) {
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
        await sleep(saveDelay); // Delay between DB saves
      }
    }

    console.log("✅ All playlists processed successfully.");
  } catch (err) {
    console.error("❌ trackStatus error:", err.message);
  }
};

export default trackStatus;
