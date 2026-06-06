const generateDates = () => {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Past 30 days + today + next 7 days
  for (let i = -30; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const dates = generateDates();
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

dates.forEach(item => {
  const isSelected = item.getDate() === new Date().getDate() && item.getMonth() === new Date().getMonth();
  const isToday =
    item.getDate() === new Date().getDate() &&
    item.getMonth() === new Date().getMonth() &&
    item.getFullYear() === new Date().getFullYear();

  const isFuture = item.getTime() > todayStart.getTime();
  
  if (isFuture) console.log("FUTURE", item.toString(), "isToday:", isToday);
  if (isToday) console.log("TODAY", item.toString(), "isToday:", isToday);
  if (!isFuture && !isToday) console.log("PAST", item.toString(), "isToday:", isToday);
});
