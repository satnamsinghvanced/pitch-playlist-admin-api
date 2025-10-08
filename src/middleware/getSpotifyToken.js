import config from "../../config.js";
import axios from "axios";
const { Client_ID, Client_secret } = config;

const getSpotifyToken = async () => {
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    method: "post",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(Client_ID + ":" + Client_secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  };

  try {
    const response = await axios(authOptions);
    return `Bearer ${response.data.access_token}`
  } catch (error) {
    console.error("Error getting Spotify token:", error.message);
    throw new Error("Failed to authenticate with Spotify");
  }
};
export default getSpotifyToken;
