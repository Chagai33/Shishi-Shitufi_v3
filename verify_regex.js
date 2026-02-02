
const regex = /טרמפ|הסעה|ride|carpool|יציאה|רכב|מקום|נהג/i;
const testStrings = [
  "יציאה מחולון",
  "טרמפ לתל אביב",
  "רכב מלא",
  "מקום פנוי",
  "סתם משהו"
];

testStrings.forEach(str => {
  console.log(`'${str}': ${regex.test(str)}`);
});
