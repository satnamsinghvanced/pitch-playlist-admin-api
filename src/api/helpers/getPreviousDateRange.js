const getPreviousDateRange = async (startDate, endDate) => {
  const start = new Date(startDate.split("-").reverse().join("-"));
  const end = new Date(endDate.split("-").reverse().join("-"));

  // Calculate the difference in days
  const differenceInTime = end.getTime() - start.getTime();
  const differenceInDays = differenceInTime / (1000 * 3600 * 24);

  // Calculate the previous start and end dates
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - differenceInDays - 1);

  const previousEnd = new Date(end);
  previousEnd.setDate(end.getDate() - differenceInDays - 1);

  // Format the previous dates to the desired format (dd-mm-yyyy)
  const formatToDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const previousStartDate = formatToDate(previousStart);
  const previousEndDate = formatToDate(previousEnd);

  return {
    previousStartDate,
    previousEndDate,
  };
};
export default getPreviousDateRange;
