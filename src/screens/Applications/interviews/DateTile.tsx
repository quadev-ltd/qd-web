import { zonedParts } from '@/core/profile/interviewTime';

/** The month and day of an interview, in a tile: tinted while coming up, grey once past. */
export const DateTile: React.FC<{
  startsAt: number;
  timeZone: string;
  past?: boolean;
}> = ({ startsAt, timeZone, past = false }) => {
  const { monthShort, day } = zonedParts(startsAt, timeZone);
  return (
    <span
      aria-hidden="true"
      className={`flex w-14 flex-none flex-col items-center rounded-[14px] py-2 ${
        past ? 'bg-border-faint text-muted' : 'bg-tint text-primary-dark'
      }`}>
      <span className="text-[12px] leading-[1.2] font-bold tracking-[0.08em] uppercase">
        {monthShort}
      </span>
      <span className="font-display text-[22px] leading-[1.1] font-bold">
        {day}
      </span>
    </span>
  );
};

export default DateTile;
