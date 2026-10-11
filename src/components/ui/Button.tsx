import { type ComponentProps } from 'react';

import { buttonClassName, type ButtonStyleProps } from './buttonStyles';

export type ButtonProps = ComponentProps<'button'> & ButtonStyleProps;

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  className,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={buttonClassName({ variant, size, className })}
    {...props}
  />
);

export default Button;
