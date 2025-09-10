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

    if (
      retries > 0 &&
      (status === 429 || status >= 500 || error.code === "ECONNABORTED")
    ) {
      const retryAfter = error.response?.headers?.["retry-after"];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
      console.warn(
        `Retrying after ${waitTime / 1000}s (Status: ${status})... (${retries} attempts left)`
      );
      await sleep(waitTime);
      return axiosWithRetry(options, authHeaderRef, retries - 1, delay * 2); 
    }

    console.error(
      `❌ Axios failed (Status: ${status || "N/A"}):`,
      error.response?.data || error.message
    );
    throw error;
  }
};

const fetchAllTracks = async (playlistId, authHeaderRef) => {
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

      if (playlistData.items.length < limit) {
        hasMoreTracks = false;
      }
    } catch (error) {
      console.error(
        `❌ Error fetching playlist ${playlistId} at offset ${offset}:`,
        error.message
      );
      hasMoreTracks = false; 
    }
  }

  return allTracks;
};

const trackStatus = async () => {
  try {
    let authHeaderRef = {token : await getSpotifyToken() };
    const allPlaylists = await Playlist.find({ isActive: true });

    for (const playlist of allPlaylists) {
      const playlistId = playlist.playlistId;
      const playlistMongoId = playlist._id;

      console.log(`🎧 Fetching tracks for playlist: ${playlistId}`);
      await sleep(2000); 

      const playlistTracks = await fetchAllTracks(playlistId, authHeaderRef);

      const approvedTracks = await Track.find({
        status: "approved",
        playlist: playlistMongoId,
      });

      for (const track of approvedTracks) {
        const trackId = track.track.trackId;
        const trackExists = playlistTracks.some(
          (item) => item?.track?.id === trackId
        );

        const existingStatus = await TrackStatus.findOne({ track: track._id });

        if (existingStatus) {
          existingStatus.stillInPlaylist = trackExists;

          if (!trackExists && !existingStatus.removedFromPlaylist) {
            existingStatus.removedFromPlaylist = new Date();
          }

          await existingStatus.save();
        } else {
          const newStatus = new TrackStatus({
            track: track._id,
            playlist: playlistMongoId,
            trackId,
            playlistId,
            approvedOn: track.updatedAt,
            removedFromPlaylist: trackExists ? null : new Date(),
            stillInPlaylist: trackExists,
          });

          await newStatus.save();
        }

        console.log(
          `✅ Checked track ${trackId}: trackExists = ${trackExists}`
        );
      }
    }
  } catch (err) {
    console.error("❌ trackStatus error:", err.message);
    throw new Error(err.message);
  }
};

export default trackStatus;
