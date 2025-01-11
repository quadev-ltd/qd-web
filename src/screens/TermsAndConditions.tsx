import { Typography, Container, Link, Box } from '@mui/material';

const TermsAndConditions = () => {
  const sectionUnderline = {
    fontWeight: 'bold',
    borderBottom: '2px solid #ccc',
    pb: 1,
    mb: 3,
  };
  const paragraphStyle = { lineHeight: 1.8, fontSize: '1rem' };
  return (
    <Container sx={{ mt: 5, mb: 5 }}>
      <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Terms and Conditions
      </Typography>
      <Typography component="p" mb={2} sx={paragraphStyle}>
        Effective Date: 10th January 2025
      </Typography>
      <Typography component="p" mb={4} sx={paragraphStyle}>
        Welcome to QuaDev! These Terms and Conditions ("Terms") govern your
        access and use of the QuaDev mobile application (the "App"). By signing
        up, signing in, or using any part of the App, you agree to these Terms.
        Please read them carefully. If you do not agree, do not use the App.
      </Typography>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        1. Use of the App
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.1. By using the App, you confirm that you are at least 18 years old
          or have the legal authority to consent to these Terms.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.2. You agree to use the App responsibly and only for lawful
          purposes. Prohibited uses include, but are not limited to, fraudulent
          activities, unauthorized access to our systems, or interference with
          the App's operation.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.3. QuaDev reserves the right to suspend or terminate accounts for
          violations of these Terms or suspected misuse of the App.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        2. Account Creation and Security
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.1. You are responsible for ensuring the accuracy of the information
          you provide during sign-up and keeping it up to date.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.2. Your login credentials must be kept secure and confidential.
          Sharing your credentials with others is strictly prohibited.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.3. Notify us immediately at{' '}
          <Link
            href="mailto:support@quadev.com"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            support@quadev.com
          </Link>{' '}
          if you suspect unauthorized access to your account or a security
          breach.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        3. Authentication Services
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          3.1. The App uses microservices and Firebase Authentication for user
          authentication. By signing in through any method, including Google
          SSO, you consent to the processing of your authentication data as
          described in our{' '}
          <Link
            href="/privacy-policy"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            Privacy Policy
          </Link>
          .
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          3.2. QuaDev uses JWT tokens to maintain sessions. Ensure you sign out
          of your account when using shared or public devices to prevent
          unauthorized access.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        4. Privacy and Data Usage
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          4.1. QuaDev values your privacy. By using the App, you consent to the
          collection, storage, and processing of your data as outlined in our{' '}
          <Link
            href="/privacy-policy"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            Privacy Policy
          </Link>
          .
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          4.2. Data collected during sign-up, sign-in, and App use may include
          authentication information, session data, and device details.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          4.3. QuaDev does not share your personal data with third parties
          except as necessary to provide the App's services or comply with legal
          requirements.
        </Typography>
      </Box>
    </Container>
  );
};

export default TermsAndConditions;
