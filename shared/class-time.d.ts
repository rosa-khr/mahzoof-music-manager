export interface ScheduleInput { weekday:number|string; startTime:string; durationMinutes:number|string; timezone:string; }
export interface ProposedSession { startsAt:string; timezone:string; durationMinutes:number; localDate:string; startTime:string; }
export function localToInstant(day:string,time:string,zone?:string):string;
export function endTime(start:string,duration:number|string):string;
export function proposeSessions(startDate:string,quota:number,schedules:ScheduleInput[]):ProposedSession[];
