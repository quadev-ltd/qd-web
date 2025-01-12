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
      {/* Title */}
      <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Privacy Policy
      </Typography>

      {/* Effective Date */}
      <Typography component="p" mb={2} sx={paragraphStyle}>
        Effective Date: 10th January 2025
      </Typography>

      {/* Intro Paragraph */}
      <Typography component="p" mb={4} sx={paragraphStyle}>
        At QuaDev, we value your privacy and are committed to protecting your
        personal information. This Privacy Policy explains how we collect, use,
        share, and protect your data when you use our mobile application (the
        "App"). By using the App, you agree to the terms outlined below.
      </Typography>

      {/* 1. Information We Collect */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        1. Information We Collect
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 1.1. Personal Information */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.1. <strong>Personal Information</strong>
        </Typography>
        <Typography component="p" mb={1} sx={paragraphStyle}>
          We may collect the following personal information:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Google Single Sign-On (SSO): Your name and email address.</li>
          <li>Manual Sign-Up/Sign-In: Your username and password.</li>
          <li>
            Account Verification: Email addresses used for account verification
            and notifications.
          </li>
        </ul>

        {/* 1.2. Technical and Usage Information */}
        <Typography component="p" mt={3} mb={2} sx={paragraphStyle}>
          1.2. <strong>Technical and Usage Information</strong>
        </Typography>
        <Typography component="p" mb={1} sx={paragraphStyle}>
          We collect data to enhance user experience and app functionality,
          including:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            Device details (e.g., device model, operating system version).
          </li>
          <li>Session data (e.g., login timestamps, session duration).</li>
          <li>App usage data via Google Analytics.</li>
        </ul>

        {/* 1.3. Crash Reports */}
        <Typography component="p" mt={3} mb={2} sx={paragraphStyle}>
          1.3. <strong>Crash Reports</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We collect crash and error data through Firebase Crashlytics to
          improve app stability.
        </Typography>

        {/* 1.4. Authentication Tokens */}
        <Typography component="p" mt={3} mb={2} sx={paragraphStyle}>
          1.4. <strong>Authentication Tokens</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Session and JWT tokens are used to manage authenticated sessions
          securely.
        </Typography>
      </Box>

      {/* 2. How We Use Your Information */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        2. How We Use Your Information
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 2.1. Authentication and User Management */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.1. <strong>Authentication and User Management</strong>
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>To authenticate your identity and manage user sessions.</li>
          <li>To send account verification emails and notifications.</li>
        </ul>

        {/* 2.2. Analytics and Improvement */}
        <Typography component="p" mt={3} mb={2} sx={paragraphStyle}>
          2.2. <strong>Analytics and Improvement</strong>
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>To analyze usage patterns and improve app performance.</li>
          <li>
            To identify and address technical issues through Firebase
            Crashlytics.
          </li>
        </ul>

        {/* 2.3. Security */}
        <Typography component="p" mt={3} mb={2} sx={paragraphStyle}>
          2.3. <strong>Security</strong>
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            To ensure secure interactions with the App through JWT tokens
            encrypted with RSA mechanisms.
          </li>
          <li>
            To maintain secure inter-service communication via TLS encryption.
          </li>
        </ul>

        {/* 2.4. Notifications */}
        <Typography component="p" mt={3} mb={2} sx={paragraphStyle}>
          2.4. <strong>Notifications</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          To send email notifications related to account activities or updates.
        </Typography>
      </Box>

      {/* 3. Sharing Your Information */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        3. Sharing Your Information
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We do not sell your data. However, we may share it with:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            <strong>Service Providers:</strong> Such as Google Analytics and
            Firebase for analytics, authentication, and crash reporting.
          </li>
          <li>
            <strong>Legal Authorities:</strong> If required to comply with laws
            or legal obligations.
          </li>
        </ul>
      </Box>

      {/* 4. Data Retention */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        4. Data Retention
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We retain your data only as long as necessary for the purposes
          described in this policy:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            Session and JWT tokens expire after a set duration to enhance
            security.
          </li>
          <li>
            Data collected for analytics and crash reporting is retained
            according to the policies of the third-party services.
          </li>
        </ul>
      </Box>

      {/* 5. Your Privacy Rights */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        5. Your Privacy Rights
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Depending on your jurisdiction, you may have the right to:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Access: Request a copy of your data.</li>
          <li>Correct: Update inaccurate or incomplete data.</li>
          <li>Delete: Request deletion of your data.</li>
          <li>
            Opt-Out: Disable tracking and analytics via app settings or device
            permissions.
          </li>
        </ul>
        <Typography component="p" mt={2} sx={paragraphStyle}>
          To exercise these rights, contact us at{' '}
          <Link
            href="mailto:support@quadev.com"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            support@quadev.com
          </Link>
          .
        </Typography>
      </Box>

      {/* 6. Data Security */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        6. Data Security
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We take data security seriously and employ measures such as:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Encryption of sensitive data during storage and transmission.</li>
          <li>Secure password hashing for stored user credentials.</li>
          <li>
            TLS-secured communication between microservices and client
            applications.
          </li>
        </ul>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          However, no system is completely secure, and we cannot guarantee
          absolute security.
        </Typography>
      </Box>

      {/* 7. Children's Privacy */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        7. Children's Privacy
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev is not intended for children under the age of 18. We do not
          knowingly collect data from children. If we become aware of such data,
          we will delete it promptly.
        </Typography>
      </Box>

      {/* 8. Third-Party Services */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        8. Third-Party Services
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev integrates with the following third-party services:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>
            Google Analytics: For app usage analytics (
            <Link
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener"
            >
              Google Analytics Privacy Policy
            </Link>
            ).
          </li>
          <li>
            Firebase Crashlytics: For crash and error monitoring (
            <Link
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noopener"
            >
              Firebase Privacy Policy
            </Link>
            ).
          </li>
          <li>
            Google SSO: For user authentication (
            <Link
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener"
            >
              Google Privacy Policy
            </Link>
            ).
          </li>
        </ul>
        <Typography component="p" mt={2} sx={paragraphStyle}>
          Your use of these services constitutes acceptance of their respective
          privacy policies.
        </Typography>
      </Box>

      {/* 9. Changes to This Privacy Policy */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        9. Changes to This Privacy Policy
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          This Privacy Policy may be updated periodically. Significant changes
          will be communicated through the App or via email. Continued use of
          the App constitutes acceptance of the revised policy.
        </Typography>
      </Box>

      {/* 10. Contact Us */}
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
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Address: Apartment 405, 1 Camberwell Passage, SE5 0AU, London, UK
        </Typography>
      </Box>

      {/* 11. Additional Information for Sensitive Data */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        11. Additional Information for Sensitive Data
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 11.1. Data Minimization */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          11.1. <strong>Data Minimization</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          We collect and process only the minimum data necessary for the App’s
          functionality.
        </Typography>

        {/* 11.2. Compliance with Google’s API Policies */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          11.2. <strong>Compliance with Google’s API Policies</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Our data collection, storage, and usage practices comply with Google’s
          API Services User Data Policy.
        </Typography>
      </Box>

      <Typography component="p" mb={2} sx={paragraphStyle}>
        By using the App, you agree to this Privacy Policy. Thank you for
        trusting QuaDev with your personal information.
      </Typography>
    </Container>
  );
};

export default PrivacyPolicy;
