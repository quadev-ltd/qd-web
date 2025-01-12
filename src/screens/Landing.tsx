import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import QuaDevIconAlpha from '../assets/images/QuaDevIconAlpha.png';

const Landing: React.FC = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flex: 1,
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'calc(10px + 2vmin)',
        color: 'white',
      }}
    >
      <Box
        component="img"
        src={QuaDevIconAlpha}
        alt="QuaDev Logo"
        sx={{
          height: '30vmin',
          mb: 3,
          pointerEvents: 'none',
        }}
      />
      <Typography
        variant="h4"
        sx={{
          fontSize: {
            xs: '1.2rem',
            sm: '1.4rem',
            md: '1.5rem',
          },
          color: 'white',
          mt: 1,
          fontWeight: 500,
        }}
      >
        Building Robust Software Solutions
      </Typography>
      <Typography
        component="p"
        sx={{
          fontSize: {
            xs: '0.9rem',
            sm: '1.1rem',
            md: '1.2rem',
          },
          color: 'white',
          mt: 3,
          fontWeight: 300,
          textAlign: 'center',
        }}
      >
        Users can securely sign in to access a foundational interface, designed
        to evolve into a gateway for innovative AI-powered features and
        capabilities. This platform also serves as a research and development
        project, advancing expertise in microservices, secure authentication,
        and AI integration.
      </Typography>
    </Box>
  );
};

export default Landing;
