import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    host: "email-smtp.eu-west-1.amazonaws.com", 
    port: 465, 
    secure: true, 
    auth: {
      user: process.env.AWS_SMTP_USERNAME, 
      pass: process.env.AWS_SMTP_PASSWORD, 
    },
  });

export default transporter;



