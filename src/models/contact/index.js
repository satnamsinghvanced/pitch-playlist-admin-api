import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema({
  title: String,
  description: String,
  items: {
    instagram: String,
    discord: String,
    facebook: String,
  },
});

const Contact = mongoose.model("Contact", ContactSchema);

export default Contact;
