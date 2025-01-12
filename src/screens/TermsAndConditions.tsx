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
      {/* Title */}
      <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Terms and Conditions
      </Typography>

      {/* Effective Date */}
      <Typography component="p" mb={2} sx={paragraphStyle}>
        Effective Date: 10th January 2025
      </Typography>

      {/* Intro Paragraph */}
      <Typography component="p" mb={4} sx={paragraphStyle}>
        Welcome to QuaDev! These Terms and Conditions ("Terms") govern your
        access and use of the QuaDev mobile application (the "App"). By signing
        up, signing in, or using any part of the App, you agree to these Terms.
        Please read them carefully. If you do not agree, do not use the App.
      </Typography>

      {/* 1. Use of the App */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        1. Use of the App
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 1.1. Eligibility */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.1. <strong>Eligibility</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          By using the App, you confirm that you are at least 18 years old or
          have the legal authority to consent to these Terms.
        </Typography>

        {/* 1.2. Responsible Use */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          1.2. <strong>Responsible Use</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          You agree to use the App responsibly and only for lawful purposes.
          Prohibited uses include, but are not limited to:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Fraudulent activities.</li>
          <li>Unauthorized access to our systems or data.</li>
          <li>
            Interference with the App’s operation or other users’ experience.
          </li>
        </ul>

        {/* 1.3. Suspension or Termination */}
        <Typography component="p" mt={2} mb={2} sx={paragraphStyle}>
          1.3. <strong>Suspension or Termination</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev reserves the right to suspend or terminate accounts for
          violations of these Terms or suspected misuse of the App.
        </Typography>
      </Box>

      {/* 2. Account Creation and Security */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        2. Account Creation and Security
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 2.1. Accurate Information */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.1. <strong>Accurate Information</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          You are responsible for ensuring the accuracy of the information you
          provide during sign-up and keeping it up to date.
        </Typography>

        {/* 2.2. Credential Security */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.2. <strong>Credential Security</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Your login credentials must be kept secure and confidential. Sharing
          your credentials with others is strictly prohibited.
        </Typography>

        {/* 2.3. Notification of Breaches */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.3. <strong>Notification of Breaches</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Notify us immediately at{' '}
          <Link
            href="mailto:support@quadev.com"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            support@quadev.com
          </Link>{' '}
          if you suspect unauthorized access to your account or a security
          breach.
        </Typography>

        {/* 2.4. Account Responsibility */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          2.4. <strong>Account Responsibility</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          You are solely responsible for all activities performed under your
          account. QuaDev is not liable for damages resulting from unauthorized
          use of your account.
        </Typography>
      </Box>

      {/* 3. Authentication Services */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        3. Authentication Services
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 3.1. Authentication Methods */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          3.1. <strong>Authentication Methods</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          The App uses microservices and Firebase Authentication for user
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

        {/* 3.2. Session Management */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          3.2. <strong>Session Management</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev uses JWT tokens to maintain sessions. Ensure you sign out of
          your account when using shared or public devices to prevent
          unauthorized access.
        </Typography>

        {/* 3.3. Secure Connections */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          3.3. <strong>Secure Connections</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          All communications between the App and the server are encrypted using
          HTTPS to ensure data security.
        </Typography>
      </Box>

      {/* 4. Privacy and Data Usage */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        4. Privacy and Data Usage
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 4.1. Privacy Commitment */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          4.1. <strong>Privacy Commitment</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev values your privacy. By using the App, you consent to the
          collection, storage, and processing of your data as outlined in our{' '}
          <Link
            href="/privacy-policy"
            sx={{ color: 'primary.main', fontWeight: 'bold' }}
          >
            Privacy Policy
          </Link>
          .
        </Typography>

        {/* 4.2. Data Collected */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          4.2. <strong>Data Collected</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Data collected during sign-up, sign-in, and App use may include
          authentication information, session data, device details, and app
          usage statistics.
        </Typography>

        {/* 4.3. Third-Party Services */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          4.3. <strong>Third-Party Services</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev does not share your personal data with third parties except as
          necessary to provide the App’s services or comply with legal
          requirements. Third-party services integrated into the App include
          Google Analytics, Firebase Crashlytics, and Google SSO. Use of these
          services is governed by their respective privacy policies.
        </Typography>
      </Box>

      {/* 5. User Conduct */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        5. User Conduct
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 5.1. Prohibited Activities */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          5.1. <strong>Prohibited Activities</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          You agree not to:
        </Typography>
        <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
          <li>Engage in activities that could harm the App or its users.</li>
          <li>
            Use the App to distribute malware, spam, or other harmful content.
          </li>
          <li>
            Attempt to reverse-engineer or exploit any part of the App’s
            software.
          </li>
        </ul>

        {/* 5.2. Compliance with Laws */}
        <Typography component="p" mt={2} mb={2} sx={paragraphStyle}>
          5.2. <strong>Compliance with Laws</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          You must comply with all applicable laws and regulations when using
          the App.
        </Typography>
      </Box>

      {/* 6. Intellectual Property */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        6. Intellectual Property
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 6.1. Ownership */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          6.1. <strong>Ownership</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          All content, trademarks, logos, and software associated with the App
          are the property of QuaDev or its licensors. Unauthorized use of these
          materials is prohibited.
        </Typography>

        {/* 6.2. License to Use */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          6.2. <strong>License to Use</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev grants you a limited, non-exclusive, and revocable license to
          use the App for personal, non-commercial purposes. This license does
          not transfer any ownership rights.
        </Typography>
      </Box>

      {/* 7. Limitation of Liability */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        7. Limitation of Liability
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 7.1. No Warranty */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          7.1. <strong>No Warranty</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          The App is provided "as is" without warranties of any kind. QuaDev
          does not guarantee uninterrupted or error-free operation.
        </Typography>

        {/* 7.2. Liability Limitation */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          7.2. <strong>Liability Limitation</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev is not liable for any indirect, incidental, or consequential
          damages arising from your use of the App.
        </Typography>

        {/* 7.3. Maximum Liability */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          7.3. <strong>Maximum Liability</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev’s total liability for any claim related to the App is limited
          to the amount paid by you, if any, for accessing the App.
        </Typography>
      </Box>

      {/* 8. Updates and Changes */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        8. Updates and Changes
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 8.1. App Updates */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          8.1. <strong>App Updates</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          QuaDev may update or modify the App at any time to enhance
          functionality or address security concerns. Continued use of the App
          constitutes acceptance of such updates.
        </Typography>

        {/* 8.2. Changes to Terms */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          8.2. <strong>Changes to Terms</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          These Terms may be updated periodically. Significant changes will be
          communicated through the App or via email. Continued use of the App
          constitutes acceptance of the revised Terms.
        </Typography>
      </Box>

      {/* 9. Governing Law and Dispute Resolution */}
      <Typography variant="h5" gutterBottom sx={sectionUnderline}>
        9. Governing Law and Dispute Resolution
      </Typography>
      <Box sx={{ pl: 2, mb: 4 }}>
        {/* 9.1. Governing Law */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          9.1. <strong>Governing Law</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          These Terms are governed by and construed in accordance with the laws
          of England and Wales, without regard to its conflict of law
          principles. For users residing outside this jurisdiction, local
          consumer protection laws may apply to the extent required by law.
        </Typography>

        {/* 9.2. Dispute Resolution */}
        <Typography component="p" mb={2} sx={paragraphStyle}>
          9.2. <strong>Dispute Resolution</strong>
        </Typography>
        <Typography component="p" mb={2} sx={paragraphStyle}>
          Any disputes arising from these Terms will be resolved through
          negotiation, and if necessary, arbitration in accordance with Rules of
          the London Court of International Arbitration (LCIA).
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

      <Typography component="p" mb={2} sx={paragraphStyle}>
        By using the App, you agree to these Terms and Conditions. Thank you for
        choosing QuaDev!
      </Typography>
    </Container>
  );
};

export default TermsAndConditions;
