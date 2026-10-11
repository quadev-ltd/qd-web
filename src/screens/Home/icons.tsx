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

export const MicrophoneIcon: React.FC = () => (
  <Icon>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Icon>
);

export const SoundWaveIcon: React.FC = () => (
  <Icon>
    <path d="M4 12h2" />
    <path d="M9 7v10" />
    <path d="M14 4v16" />
    <path d="M19 9v6" />
  </Icon>
);

export const DocumentIcon: React.FC = () => (
  <Icon>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
    <path d="M10 13h6" />
    <path d="M10 17h6" />
  </Icon>
);
