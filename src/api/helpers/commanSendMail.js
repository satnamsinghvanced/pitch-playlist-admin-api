import fs from "fs";
import path from "path";
import transporter from "./emailConfig.js";
import EmailLog from "../../models/emailLogs/index.js";

/**
 * Sends an email using the specified template.
 * @param {string} to - Recipient's email.
 * @param {string} subject - Email subject.
 * @param {string} templateName - Template file name (e.g., "submitSong.html").
 * @param {Object} replacements - Object containing dynamic data.
 */
const sendMail = async (to, subject, templateName, replacements,category) => {
    try {
        const templatePath = path.join(process.cwd(), "emailTemplates", templateName);
        let htmlContent = fs.readFileSync(templatePath, "utf-8");

        Object.keys(replacements).forEach((key) => {
            const regex = new RegExp(`{{${key}}}`, "g");
            htmlContent = htmlContent.replace(regex, replacements[key]);
        });
        await EmailLog.create({
            from:  `"Pitchplaylists" <${process.env.FROM_EMAIL}>`,
            to,
            subject,
            templateName,
            templateContent: htmlContent,
            category
          });
          console.log("Email log created successfully", EmailLog);
        const mailOptions = {
            from:  `"Pitchplaylists" <${process.env.FROM_EMAIL}>`, 
            to,
            subject,
            html: htmlContent,
        };

    

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to} successfully`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

export default sendMail;

