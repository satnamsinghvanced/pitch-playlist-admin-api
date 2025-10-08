import Playlist from "../../models/playlist/index.js";
import axios from "axios";
const updatePlaylist = async (authHeader, userId) => {
  try {
    const userPlaylist = await Playlist.find({
      userId,
      isActive: true,
    });
    if (!userPlaylist.length) {
      return;
    }
    await Promise.all(
      userPlaylist.map(async (val) => {
        const userPlaylist = await Playlist.findById(val._id);
        const playlistId = val.playlistId;
        const options = {
          url: `https://api.spotify.com/v1/playlists/${playlistId}`,
          method: "get",
          headers: { Authorization: authHeader },
        };
        const playlistResponse = await axios(options);
        const playlist = playlistResponse.data;
        userPlaylist.playlistName = playlist.name;
        userPlaylist.ownerName = playlist.owner.display_name;
        userPlaylist.imageUrl = playlist.images[0].url;
        userPlaylist.totalTracks = playlist.tracks.total;
        userPlaylist.totalFollowers = playlist.followers.total;
        await userPlaylist.save();
      })
    );
  } catch (err) {
    console.error(err.message);
  }
};
export default updatePlaylist;
