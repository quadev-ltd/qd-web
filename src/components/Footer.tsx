import React from 'react';
import { Box, Typography, Link } from '@mui/material';

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: '#282c34',
        color: 'white',
        textAlign: 'center',
        py: 2,
        width: '100%',
      }}
    >
      <Typography variant="body2" sx={{ fontSize: 14 }}>
        © {new Date().getFullYear()} QuaDev. All rights reserved.
      </Typography>
      <Box
        sx={{
          mt: 1,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <Typography variant="body2">
          <strong>Address:</strong> Apartment 405, 1 Camberwell Passage, SE5
          0AU, London, UK
        </Typography>
        <Typography variant="body2">
          <strong>Email:</strong>{' '}
          <Link
            href="mailto:gmfranco@live.com.ar"
            sx={{
              color: '#61dafb',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            support@quadev.net
          </Link>
        </Typography>
        <Typography variant="body2">
          <strong>Phone:</strong>{' '}
          <Link
            href="tel:+447597300268"
            sx={{
              color: '#61dafb',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            +44 7597 300 268
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
