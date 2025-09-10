import mongoose from "mongoose";



const PageSectionSchema = new mongoose.Schema(
  {
    title: { type: String },
    description: { type: String },
  },
  { _id: false }
);

// const artistSectionSchema = new mongoose.Schema(
//   {
//     image: {
//       url: { type: String },
//       alt: { type: String },
//       caption: { type: String },
//     },
//     title: { type: String },
//     description: { type: String },
//   },
//   { _id: false }
// );
// const CuratorSectionSchema = new mongoose.Schema(
//   {
//     image: {
//       url: { type: String },
//       alt: { type: String },
//       caption: { type: String },
//     },
//     title: { type: String },
//     description: { type: String },
//   },
//   { _id: false }
// );
const contentTypeSchema = new mongoose.Schema(
  {
    banner_section: {
      heading: { type: String },
      sub_heading_1: { type: String },
      sub_heading_2: { type: String },
    },
    top_curator: {
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
    },
    features_section: {
      heading: { type: String },
      sub_heading_1: { type: String },
    },
    artists_section: [
      {
        image: {type: String},
        alt:{type:String},
        title: { type: String },
        description: { type: String },
        _id:false,
      },
    ],
    curator_section: [
      {
        image: {type: String},
        alt:{type:String},
        title: { type: String },
        description: { type: String },
        _id:false
      },
    ],

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
    home: { type: PageSectionSchema },
    contact_us: { type: PageSectionSchema },
    reviews: { type: PageSectionSchema },
    faq: { type: PageSectionSchema },
    sitemap: { type: PageSectionSchema },
    terms_and_conditions: { type: PageSectionSchema },
  },
  { timestamps: true }
);

const contentType2 = mongoose.model("ContentType2", contentTypeSchema);

export default contentType2;
