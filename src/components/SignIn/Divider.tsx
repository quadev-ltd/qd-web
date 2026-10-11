// The web version of qd-mobile src/components/SignIn/Divider.tsx: the "or" between the
// Google and Apple buttons and the email form.

type DividerProps = {
  label: string;
};

export const Divider: React.FC<DividerProps> = ({ label }) => (
  <div className="flex items-center gap-3 text-sm leading-natural text-muted">
    <div aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
    <span>{label}</span>
    <div aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
  </div>
);

export default Divider;
