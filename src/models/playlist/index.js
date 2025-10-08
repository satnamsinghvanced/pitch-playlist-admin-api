import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema(
  {
    genres: [
      {
        id: {
          type: Number,
        },
        name: {
          type: String,
        },
        category: {
          type: String,
        },
      },
    ],
    submitConditions: {
      isArtist: {
        type: Boolean,
        default: false,
      },
      followUserUrls: {
        type: String,
      },
      followUserId: {
        type: String,
      },
      followPlaylistUrls: {
        type: String,
      },
      followPlaylistId: {
        type: String,
      },
      mailChimpConnected: {
        type: Boolean,
        default: false,
      },
      platformType: {
        type: String,
      },
      saveTrackUrl: {
        type: String,
      },
      saveTrackId: {
        type: String,
      },
    },
    followAccount: {
      type: String,
    },
    followPlaylist: {
      type: String,
    },
    saveSong: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    playlistName: {
      type: String,
    },
    ownerName: {
      type: String,
    },
    playlistId: {
      type: String,
    },
    playlistOwnerId: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    totalFollowers: {
      type: String,
    },
    totalSubmissions: {
      type: Number,
      default: 0,
    },
    totalTracks: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    playlistUrl: {
      type: String,
    },
    country: {
      type: String,
    },
    promoted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("playlist", playlistSchema);
