import { Link, type LinkProps } from 'react-router';

import { buttonClassName, type ButtonStyleProps } from './buttonStyles';

export type ButtonLinkProps = Omit<LinkProps, 'className'> & ButtonStyleProps;

/** A link to another page that looks like a button. */
export const ButtonLink: React.FC<ButtonLinkProps> = ({
  variant,
  size,
  className,
  ...props
}) => (
  <Link className={buttonClassName({ variant, size, className })} {...props} />
);

export default ButtonLink;
