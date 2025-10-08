async function retrySpotifyCall(fn, maxRetries = 10) {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response.headers["retry-after"], 10) || 4;
        console.warn(`Rate limit hit. Retrying in ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        attempts++;
      } else {
        throw err;
      }
    }
  }

  throw new Error("Spotify API rate limit exceeded after retries.");
}

export default retrySpotifyCall;