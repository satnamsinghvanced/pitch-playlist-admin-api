import transporter from "./emailConfig.js"; // make sure to include .js extension
import dotenv from "dotenv";

dotenv.config();

export async function sendCompletionEmail(
  to,
  trackName,
  totalPlaylists,
  successCount,
  failedCount,
  userName
) {
  try {
    await transporter.sendMail({
      from: `"PitchPlaylists" <${process.env.FROM_EMAIL}>`,
      to,
      subject: "Your Spotify Pitching Submission is Complete ✅",
      text: `Hello ${userName},

Your track "${trackName}" has been submitted to ${totalPlaylists} playlist(s).

✅ Success: ${successCount}
❌ Failed: ${failedCount}

You can check your dashboard for more details.

Thanks,
PitchPlaylists Team`,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
  }
}
