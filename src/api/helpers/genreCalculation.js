export const getIndexesInRange = async (startIndex, endIndex) => {
  const range = [];
  const min = Math.min(startIndex, endIndex);
  const max = Math.max(startIndex, endIndex);

  for (let i = min; i <= max; i++) {
    if (i !== endIndex) range.push(i);
  }

  return range;
};
