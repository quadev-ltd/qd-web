import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#5050C3', // purpleBlue
      dark: '#2c2e87',
    },
    secondary: {
      main: '#000000', // black
    },
    error: {
      main: '#FF0000', // red
    },
    background: {
      default: '#f0f0f0', // offWhite
      paper: '#5050C3', // purpleBlue
    },
    text: {
      primary: '#000000', // black
      secondary: '#FFFFFF', // white
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});
