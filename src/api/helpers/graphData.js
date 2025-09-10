import moment from "moment/moment.js";
export const determineIntervalType = (startDate, endDate) => {
  const start = moment(startDate, "DD-MM-YYYY");
  const end = moment(endDate, "DD-MM-YYYY");
  const daysDiff = end.diff(start, "days");

  if (daysDiff <= 7) {
    return "daily";
  } else if (daysDiff <= 31) {
    return "daily";
    //return "weekly";
  } else {
    return "monthly";
  }
};

export const groupByInterval = (data, intervalType) => {
  const groupedData = {};

  data.forEach((playlist) => {
    const createdAt = moment(playlist.createdAt);
    let key;

    if (intervalType === "daily") {
      key = createdAt.format("DD-MM");
    } else if (intervalType === "weekly") {
      key =
        createdAt.startOf("week").format("DD-MM") +
        " to " +
        createdAt.endOf("week").format("DD-MM");
    } else {
      key = createdAt.format("MMM YYYY");
    }

    if (!groupedData[key]) {
      groupedData[key] = 0;
    }
    groupedData[key]++;
  });

  return groupedData;
};

export const generateResultFormat = (
  startDate,
  endDate,
  intervalType,
  groupedData
) => {
  const start = moment(startDate, "DD-MM-YYYY");
  const end = moment(endDate, "DD-MM-YYYY").endOf("day");
  const result = [];

  if (intervalType === "daily") {
    for (let m = moment(start); m.isBefore(end); m.add(1, "days")) {
      const label = m.format("DD.MM.YYYY");
      const findBy = m.format("DD-MM");
      result.push({ label, data: groupedData[findBy] || 0 });
    }
  } else if (intervalType === "weekly") {
    for (let m = moment(start); m.isBefore(end); m.add(1, "weeks")) {
      const findBy =
        m.startOf("week").format("DD-MM") +
        " to " +
        m.endOf("week").format("DD-MM");
      const label =
        m.startOf("week").format("DD.MM.YYYY") +
        " to " +
        m.endOf("week").format("DD.MM.YYYY");
      result.push({ label, data: groupedData[findBy] || 0 });
    }
  } else {
    let currentMonth = moment(start).startOf("month");
    while (currentMonth.isSameOrBefore(end, "month")) {
      const label = currentMonth.format("MMM YYYY");
      result.push({ label, data: groupedData[label] || 0 });
      currentMonth.add(1, "month");
    }
  }

  return result;
};

export const groupByIntervalAmount = (data, intervalType) => {
  const groupedData = {};

  data.forEach((transaction) => {
    const createdAt = moment(transaction.createdAt);
    let key;

    if (intervalType === "daily") {
      key = createdAt.format("DD-MM");
    } else if (intervalType === "weekly") {
      key =
        createdAt.startOf("week").format("DD-MM") +
        " to " +
        createdAt.endOf("week").format("DD-MM");
    } else {
      key = createdAt.format("MMM YYYY");
    }

    if (!groupedData[key]) {
      groupedData[key] = 0;
    }
    groupedData[key] += transaction.amount;
  });

  return groupedData;
};
