import { type ReactNode } from 'react';

const Icon: React.FC<{ children: ReactNode }> = ({ children }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    {children}
  </svg>
);

export const AccountAddIcon: React.FC = () => (
  <Icon>
    <circle cx="10" cy="8" r="4" />
    <path d="M2 21a8 8 0 0 1 14-5" />
    <path d="M19 14v6" />
    <path d="M16 17h6" />
  </Icon>
);

export const ProfileCardIcon: React.FC = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <circle cx="9" cy="11" r="2" />
    <path d="M14 10h4" />
    <path d="M14 14h4" />
    <path d="M6 16c1-2 5-2 6 0" />
  </Icon>
);

export const DeleteIcon: React.FC = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
);
