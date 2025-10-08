import mongoose from "mongoose";

const PageSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: false },
    description: { type: String, required: false },
  },
  { _id: false }
);

const artistCuratorSectionSchema = new mongoose.Schema(
  {
    first_image: {
      url: { type: String },
      alt: { type: String },
      caption: { type: String },
    },
    first_title: { type: String },
    first_description: { type: String },

    second_image: {
      url: { type: String },
      alt: { type: String },
      caption: { type: String },
    },
    second_title: { type: String },
    second_description: { type: String },

    third_image: {
      url: { type: String },
      alt: { type: String },
      caption: { type: String },
    },
    third_title: { type: String },
    third_description: { type: String },
  },
  { _id: false }
);

const contentTypeSchema = new mongoose.Schema(
  {
    acf: {
      banner_section: {
        title: { type: String },
        sub_heading_1: { type: String },
        sub_heading_2: { type: String },
      },
      top: {
        heading: { type: String },
        sub_heading_1: { type: String },
        sub_heading_2: { type: String },
      },
      playlist_section: {
        heading: { type: String },
        sub_heading_1: { type: String },
        sub_heading_2: { type: String },
      },
      submit_playlist_section: {
        heading: { type: String },
        sub_heading_1: { type: String },
        sub_heading_2: { type: String },
      },
      features_section: {
        heading: { type: String },
        sub_heading_1: { type: String },
        sub_heading_2: { type: String },
      },
      for_artists_curators: {
        type: [artistCuratorSectionSchema],
        required: true,
      },
      for_artists_section: {
        heading: { type: String },
        sub_heading_1: { type: String },
        sub_heading_2: { type: String },
      },
      review_section: {
        heading: { type: String },
        sub_heading: { type: String },
      },
      blog_section: {
        heading: { type: String },
        sub_heading: { type: String },
      },
      faq_section: {
        heading: { type: String },
      },
      home: { type: PageSectionSchema, required: false },
      contact_us: { type: PageSectionSchema, required: false },
      reviews: { type: PageSectionSchema, required: false },
      faq: { type: PageSectionSchema, required: false },
      sitemap: { type: PageSectionSchema, required: false },
      terms_and_conditions: { type: PageSectionSchema, required: false },
    },
  },
  { timestamps: true }
);

const ContentType = mongoose.model("ContentType", contentTypeSchema);

export default ContentType;
