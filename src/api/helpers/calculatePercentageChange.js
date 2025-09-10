const calculatePercentageChange = async (oldValue, newValue) => {
  if (oldValue === 0) {
    const msg = "N/A";
    return msg;
  }
  const change = newValue - oldValue;
  const percentageChange = (change / oldValue) * 100;
  return percentageChange;
};
export default calculatePercentageChange;
