import { Typography, Container, Link, Box } from '@mui/material';

const PrivacyPolicy = () => {
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
        Privacy Policy
      </Typography>
      <Typography component="p" mb={2} sx={paragraphStyle}>
        Effective Date: 10th January 2025
      </Typography>
      <Typography component="p" mb={4} sx={paragraphStyle}>
        At QuaDev, we value your privacy and are committed to protecting your
        personal information. This Privacy Policy explains how we collect, use,
        and protect your data when you use our mobile application (the "App").
        By using the App, you agree to the terms outlined below.
      </Typography>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        1. Information We Collect
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.1. <strong>Personal Information:</strong> When you sign up or sign
          in, we may collect:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Your name and email address (via Google SSO).</li>
          <li>Your username and password (for manual sign-up/sign-in).</li>
        </ul>
        <Typography component="p" mt={2} mb={2} sx={paragraphStyle}>
          1.2. <strong>Technical and Usage Information:</strong> This includes
          device details, session data, login timestamps, and analytics data
          collected through Google Analytics.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.3. <strong>Crash Reports:</strong> Data related to app crashes and
          errors collected via Firebase Crashlytics.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        2. How We Use Your Information
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.1. To authenticate your identity and manage sessions using JWT
          tokens.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.2. To analyze usage patterns and improve the App using Google
          Analytics.
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.3. To monitor app performance and diagnose issues using Firebase
          Crashlytics.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        3. Sharing Your Information
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We do not sell your data. However, we may share it with:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            Service providers such as Google Analytics and Firebase for
            authentication, app analytics, and crash monitoring.
          </li>
          <li>Legal authorities, if required by law or regulation.</li>
        </ul>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        4. Data Retention
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We retain your data as long as necessary to fulfill the purposes
          outlined in this policy. Session data and JWT tokens expire after a
          set duration for security purposes.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        5. Your Privacy Rights
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Depending on your jurisdiction, you may have the right to:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Access: Request a copy of your data.</li>
          <li>Correct: Request updates to inaccurate or incomplete data.</li>
          <li>Delete: Request deletion of your data.</li>
          <li>
            Opt-out: Disable tracking and analytics through app settings or
            device permissions.
          </li>
        </ul>
        <Typography component="p" mt={2} sx={paragraphStyle}>
          For privacy-related requests, contact us at{' '}
          <Link
            href="mailto:support@quadev.com"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            support@quadev.com
          </Link>
          .
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        6. Data Security
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We implement reasonable measures to protect your data, including
          encryption and secure storage. However, no system is entirely secure,
          and we cannot guarantee absolute security.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        7. Children's Privacy
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev is not intended for children under 18. We do not knowingly
          collect personal data from children. If we learn that a child has
          provided data, we will delete it promptly.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        8. Third-Party Services
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev integrates third-party services such as Google Analytics and
          Firebase Crashlytics. By using these services, you agree to their
          respective privacy policies:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            <Link
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener"
            >
              Google Analytics Privacy Policy
            </Link>
          </li>
          <li>
            <Link
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noopener"
            >
              Firebase Privacy Policy
            </Link>
          </li>
        </ul>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        9. Changes to This Privacy Policy
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          This Privacy Policy may be updated periodically. We will notify you of
          significant changes through the App or email. Continued use of the App
          constitutes acceptance of the revised policy.
        </Typography>
      </Box>

      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        10. Contact Us
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          For questions, concerns, or feedback, contact us:
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Email:{' '}
          <Link
            href="mailto:support@quadev.com"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            support@quadev.com
          </Link>
        </Typography>
      </Box>
    </Container>
  );
};

export default PrivacyPolicy;
