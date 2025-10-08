import fs from "fs";
import path from "path";
import transporter from "./emailConfig.js";

/**
 * Sends an email using the specified template.
 * @param {string} to - Recipient's email.
 * @param {string} subject - Email subject.
 * @param {string} templateName - Template file name (e.g., "submitSong.html").
 * @param {Object} replacements - Object containing dynamic data.
 */
const sendMailContact = async (to, subject, templateName, replacements) => {
    try {
        const templatePath = path.join(process.cwd(), "emailTemplates", templateName);
        let htmlContent = fs.readFileSync(templatePath, "utf-8");

        Object.keys(replacements).forEach((key) => {
            const regex = new RegExp(`{{${key}}}`, "g");
            htmlContent = htmlContent.replace(regex, replacements[key]);
        });

        const mailOptions = {
            from:  `"Pitchplaylists" <${process.env.CONTACT_EMAIL}>`, 
            to,
            subject,
            html: htmlContent,
        };

        // Send email
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to} successfully`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

export default sendMailContact;

