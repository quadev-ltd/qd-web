import { type ComponentProps } from 'react';

export interface CardProps extends ComponentProps<'div'> {
  /** The element to render: a card that stands on its own is an article or a section. */
  as?: 'div' | 'article' | 'section';
  /** glass: translucent, on the brand background. surface: white, on light pages. */
  tone?: 'glass' | 'surface';
  /** Only for the surface tone. */
  elevation?: 'none' | 'raised' | 'floating';
  /** standard: 24px (22px for glass). roomy: up to 36px, for the sign-in cards. */
  padding?: 'standard' | 'roomy';
}

const TONES = {
  glass: 'border border-white/24 bg-white/10',
  surface: 'bg-surface text-text',
};

const PADDINGS = {
  standard: { glass: 'p-[22px]', surface: 'p-6' },
  roomy: {
    glass: 'p-[clamp(22px,6vw,36px)]',
    surface: 'p-[clamp(22px,6vw,36px)]',
  },
};

const ELEVATIONS = {
  none: '',
  raised: 'shadow-card',
  floating: 'shadow-floating',
};

export const Card: React.FC<CardProps> = ({
  as: Element = 'div',
  tone = 'surface',
  elevation = 'none',
  padding = 'standard',
  className,
  ...props
}) => (
  <Element
    // A white card is a light surface even on the brand background (focus ring colour).
    data-surface={tone === 'surface' ? 'light' : undefined}
    className={[
      'flex flex-col rounded-card',
      TONES[tone],
      PADDINGS[padding][tone],
      ELEVATIONS[elevation],
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
);

export default Card;
