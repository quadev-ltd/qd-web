import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router';

import AppRoutes from './routes/AppRoutes';
import { theme } from './theme/theme';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
