import axios from "axios";
import config from "../../../config.js";
const { PAYPAL_CLIENT_ID, PAYPAL_SECRET_ID, PAYPAL_API } = config;

const generatePaypalAccessToken = async () => {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_ID}`).toString(
    "base64"
  );

  const response = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
};

export default generatePaypalAccessToken;
