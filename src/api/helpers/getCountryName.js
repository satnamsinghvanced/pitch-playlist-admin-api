import Country from "i18n-iso-countries";
import fs from "fs";
const enLocale = JSON.parse(
  fs.readFileSync("node_modules/i18n-iso-countries/langs/en.json", "utf-8")
);
Country.registerLocale(enLocale);

const getCountryName = (countryCode) => {
  
  return Country?.getName(countryCode?.toUpperCase(), "en") || "Unknown Country";
};

export default getCountryName;
