import moment from "moment";
export const getStartAndEndDate = async () => {
  const today = new Date();
  const lastMonday = new Date(
    today.setDate(today.getDate() - today.getDay() + 1 - 7)
  );
  const lastSunday = new Date(
    today.setDate(today.getDate() - today.getDay() + 7)
  );

  // Adjusting lastSunday to be the last day of the week
  lastSunday.setHours(23, 59, 59, 999);

  return { startDate: lastMonday, endDate: lastSunday };
};

export const getWeekDates = async (date) => {
  const givenDate = moment(date, "DD-MM-YYYY").toDate();
  const day = givenDate.getDay();
  const difference = day === 0 ? -6 : 1 - day; // adjust when day is Sunday
  const monday = new Date(givenDate.setDate(givenDate.getDate() + difference));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { startDate: monday, endDate: sunday };
};
