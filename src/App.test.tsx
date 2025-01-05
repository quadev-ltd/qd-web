import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/Apartment 405, 1 Camberwell Passage, SE5 0AU, London, UK/i);
  expect(linkElement).toBeInTheDocument();
});
