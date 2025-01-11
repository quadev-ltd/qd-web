import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Container,
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import Footer from './Footer';
import QuaDevIconAlpha from '../assets/images/QuaDevIconAlphaNoWording.png';

const MainLayout: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      sx={{
        backgroundColor: isLandingPage
          ? theme.palette.primary.main
          : theme.palette.background.default,
        color: isLandingPage
          ? theme.palette.primary.contrastText
          : theme.palette.text.primary,
      }}
    >
      <AppBar
        position="static"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.primary.dark,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {/* Left Section: Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Link
              to="/"
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <img
                src={QuaDevIconAlpha}
                alt="QuaDev Logo"
                style={{ height: '40px', marginRight: '1rem' }}
              />
              <Typography
                variant="h6"
                sx={{
                  color: 'white',
                  fontWeight: 'bold',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                QuaDev
              </Typography>
            </Link>
          </Box>

          {/* Right Section: Links */}
          <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link
              to="/privacy-policy"
              style={{
                color: theme.palette.text.secondary,
                textDecoration: 'none',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-and-conditions"
              style={{
                color: theme.palette.text.secondary,
                textDecoration: 'none',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Terms and Conditions
            </Link>
          </Box>
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ flexGrow: 1, display: 'flex' }}>
        <Outlet />
      </Container>
      <Footer />
    </Box>
  );
};

export default MainLayout;
