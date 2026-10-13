import Icon from '@/components/Icon';

export interface SearchFieldProps {
  /** What is searched: the name of the field, also shown while it is empty. */
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A search box that filters what is on the page as the visitor types. */
export const SearchField: React.FC<SearchFieldProps> = ({
  label,
  value,
  onChange,
}) => (
  <div className="flex h-control items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 text-muted has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring)">
    <Icon name="search" />
    <input
      type="search"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-10 min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-muted"
    />
  </div>
);

export default SearchField;
