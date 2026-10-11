export interface ArcsProps {
  /** home: the public home. auth: the sign-in and sign-up screens. */
  variant?: 'home' | 'auth';
}

const ARC = 'pointer-events-none absolute box-border rounded-full';

const VARIANTS = {
  home: [
    'size-[980px] border-[100px] border-white/6 -right-[360px] -top-[330px]',
    'size-[640px] border-[64px] border-sky/14 -left-[270px] -bottom-[220px]',
  ],
  auth: [
    'size-[920px] border-[96px] border-white/6 -right-[330px] -top-[300px]',
    'size-[640px] border-[64px] border-sky/14 -left-[260px] -bottom-[280px]',
  ],
};

/**
 * The two decorative circles behind the brand-coloured screens. The parent must
 * be `relative overflow-hidden`; the circles are hidden from assistive technology.
 */
export const Arcs: React.FC<ArcsProps> = ({ variant = 'home' }) => (
  <div aria-hidden="true" data-testid="arcs">
    {VARIANTS[variant].map(className => (
      <div key={className} className={`${ARC} ${className}`} />
    ))}
  </div>
);

export default Arcs;
