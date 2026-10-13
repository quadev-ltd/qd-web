export interface FieldCounterProps {
  id: string;
  /** How many characters the field holds. */
  length: number;
  /** How many it may hold. */
  max: number;
}

const NUMBER = new Intl.NumberFormat('en');

/**
 * "19 / 100" under a field with a limit, on the right. Past the limit it turns red and
 * bold; the field's own message says what to do about it.
 */
export const FieldCounter: React.FC<FieldCounterProps> = ({
  id,
  length,
  max,
}) => (
  <p
    id={id}
    className={`ml-auto flex-none text-[13px] leading-[1.45] whitespace-nowrap ${
      length > max ? 'font-bold text-danger' : 'text-muted'
    }`}>
    {`${NUMBER.format(length)} / ${NUMBER.format(max)}`}
  </p>
);

export default FieldCounter;
