import Genre from "../../models/genres/index.js";
const getNextId = async () => {
  try {
    let nextId = 1;
    let exists = true;

    while (exists) {
      exists = await Genre.exists({ id: nextId });
      if (exists) {
        nextId += 1;
      }
    }

    return nextId;
  } catch (error) {
    console.error("Error getting the next id:", error.message);
    throw new Error("Failed to get the next id");
  }
};

export default getNextId;
