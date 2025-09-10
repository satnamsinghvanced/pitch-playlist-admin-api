

const extractId = (url, pattern) => {
  const match = url.match(pattern);
  return match ? match[1] : null;
};
export default extractId;
