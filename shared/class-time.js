const parts = (instant, zone) => {
  const result = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(instant));
  const get = key => result.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
export function localToInstant(day, time, zone = 'Asia/Tehran') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('تاریخ یا ساعت نامعتبر است');
  const target = `${day}T${time}`;
  const nominal = Date.parse(target + ':00Z');
  if (!Number.isFinite(nominal)) throw Error('تاریخ نامعتبر است');
  const candidates = new Set();
  for (const hours of [-36,-12,0,12,36]) {
    const sample = nominal + hours * 3600000;
    const offset = Date.parse(parts(sample,zone) + ':00Z') - sample;
    const candidate = nominal - offset;
    if (parts(candidate, zone) === target) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw Error(candidates.size ? 'این ساعت با تغییر ساعت منطقه دو بار تکرار می‌شود؛ ساعت دیگری انتخاب کنید' : 'این ساعت در منطقه زمانی انتخابی وجود ندارد');
  return new Date([...candidates][0]).toISOString();
}
export function endTime(start, duration) {
  const [hour,minute] = start.split(':').map(Number);
  const total = hour*60+minute+Number(duration);
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}${total>=1440?' (روز بعد)':''}`;
}
export function proposeSessions(startDate, quota, schedules) {
  if (!startDate || !schedules.length) return [];
  const first = new Date(`${startDate}T00:00:00Z`), out=[];
  for (let offset=0;offset<7000 && out.length<quota;offset++) {
    const day = new Date(first); day.setUTCDate(first.getUTCDate()+offset);
    const iso = day.toISOString().slice(0,10);
    for (const row of schedules.filter(row=>Number(row.weekday)===day.getUTCDay())) {
      out.push({ startsAt:localToInstant(iso,row.startTime,row.timezone), timezone:row.timezone, durationMinutes:Number(row.durationMinutes), localDate:iso, startTime:row.startTime });
    }
  }
  return out.sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,quota);
}
