const dateDifference = (date1, date2) => {
  // Ensure date1 is the earlier date
  if (date1 > date2) {
    [date1, date2] = [date2, date1];
  }

  const msInSecond = 1000;
  const msInMinute = msInSecond * 60;
  const msInHour = msInMinute * 60;
  const msInDay = msInHour * 24;

  // Add an extra day to include both start and end dates
  const diff = date2 - date1 + msInDay;

  const days = Math.floor(diff / msInDay);
  const hours = Math.floor((diff % msInDay) / msInHour);
  const minutes = Math.floor((diff % msInHour) / msInMinute);
  const seconds = Math.floor((diff % msInMinute) / msInSecond);

  return { days, hours, minutes, seconds };
};

export default dateDifference;
