import { type ComponentProps } from 'react';

export interface CardProps extends ComponentProps<'div'> {
  /** The element to render: a card that stands on its own is an article or a section. */
  as?: 'div' | 'article' | 'section';
  /** glass: translucent, on the brand background. surface: white, on light pages. */
  tone?: 'glass' | 'surface';
  /** Only for the surface tone. */
  elevation?: 'none' | 'raised' | 'floating';
}

const TONES = {
  glass: 'border border-white/24 bg-white/10 p-[22px]',
  surface: 'bg-surface p-6 text-text',
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
  className,
  ...props
}) => (
  <Element
    className={[
      'flex flex-col rounded-card',
      TONES[tone],
      ELEVATIONS[elevation],
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
);

export default Card;
