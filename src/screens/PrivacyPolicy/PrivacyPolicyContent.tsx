// Legal text: kept word for word, as literal JSX (see the lint exception in
// eslint.config.js). Styling comes from the .legal-document rules in global.css.
export const PrivacyPolicyContent: React.FC = () => (
  <>
    {/* Title */}
    <h1>Privacy Policy</h1>

    {/* Effective Date */}
    <p>Effective Date: 10th January 2025</p>

    {/* Intro Paragraph */}
    <p>
      At QuaDev, we value your privacy and are committed to protecting your
      personal information. This Privacy Policy explains how we collect, use,
      share, and protect your data when you use our mobile application (the
      "App"). By using the App, you agree to the terms outlined below.
    </p>

    {/* 1. Information We Collect */}
    <h2>1. Information We Collect</h2>
    <div>
      {/* 1.1. Personal Information */}
      <p>
        1.1. <strong>Personal Information</strong>
      </p>
      <p>We may collect the following personal information:</p>
      <ul>
        <li>Google Single Sign-On (SSO): Your name and email address.</li>
        <li>Manual Sign-Up/Sign-In: Your username and password.</li>
        <li>
          Account Verification: Email addresses used for account verification
          and notifications.
        </li>
      </ul>

      {/* 1.2. Technical and Usage Information */}
      <p>
        1.2. <strong>Technical and Usage Information</strong>
      </p>
      <p>
        We collect data to enhance user experience and app functionality,
        including:
      </p>
      <ul>
        <li>Device details (e.g., device model, operating system version).</li>
        <li>Session data (e.g., login timestamps, session duration).</li>
        <li>App usage data via Google Analytics.</li>
      </ul>

      {/* 1.3. Crash Reports */}
      <p>
        1.3. <strong>Crash Reports</strong>
      </p>
      <p>
        We collect crash and error data through Firebase Crashlytics to improve
        app stability.
      </p>

      {/* 1.4. Authentication Tokens */}
      <p>
        1.4. <strong>Authentication Tokens</strong>
      </p>
      <p>
        Session and JWT tokens are used to manage authenticated sessions
        securely.
      </p>
    </div>

    {/* 2. How We Use Your Information */}
    <h2>2. How We Use Your Information</h2>
    <div>
      {/* 2.1. Authentication and User Management */}
      <p>
        2.1. <strong>Authentication and User Management</strong>
      </p>
      <ul>
        <li>To authenticate your identity and manage user sessions.</li>
        <li>To send account verification emails and notifications.</li>
      </ul>

      {/* 2.2. Analytics and Improvement */}
      <p>
        2.2. <strong>Analytics and Improvement</strong>
      </p>
      <ul>
        <li>To analyze usage patterns and improve app performance.</li>
        <li>
          To identify and address technical issues through Firebase Crashlytics.
        </li>
      </ul>

      {/* 2.3. Security */}
      <p>
        2.3. <strong>Security</strong>
      </p>
      <ul>
        <li>
          To ensure secure interactions with the App through JWT tokens
          encrypted with RSA mechanisms.
        </li>
        <li>
          To maintain secure inter-service communication via TLS encryption.
        </li>
      </ul>

      {/* 2.4. Notifications */}
      <p>
        2.4. <strong>Notifications</strong>
      </p>
      <p>
        To send email notifications related to account activities or updates.
      </p>
    </div>

    {/* 3. Sharing Your Information */}
    <h2>3. Sharing Your Information</h2>
    <div>
      <p>We do not sell your data. However, we may share it with:</p>
      <ul>
        <li>
          <strong>Service Providers:</strong> Such as Google Analytics and
          Firebase for analytics, authentication, and crash reporting.
        </li>
        <li>
          <strong>Legal Authorities:</strong> If required to comply with laws or
          legal obligations.
        </li>
      </ul>
    </div>

    {/* 4. Data Retention */}
    <h2>4. Data Retention</h2>
    <div>
      <p>
        We retain your data only as long as necessary for the purposes described
        in this policy:
      </p>
      <ul>
        <li>
          Session and JWT tokens expire after a set duration to enhance
          security.
        </li>
        <li>
          Data collected for analytics and crash reporting is retained according
          to the policies of the third-party services.
        </li>
      </ul>
    </div>

    {/* 5. Your Privacy Rights */}
    <h2>5. Your Privacy Rights</h2>
    <div>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access: Request a copy of your data.</li>
        <li>Correct: Update inaccurate or incomplete data.</li>
        <li>Delete: Request deletion of your data.</li>
        <li>
          Opt-Out: Disable tracking and analytics via app settings or device
          permissions.
        </li>
      </ul>
      <p>
        To exercise these rights, contact us at{' '}
        <a href="mailto:support@quadev.com">support@quadev.com</a>.
      </p>
    </div>

    {/* 6. Data Security */}
    <h2>6. Data Security</h2>
    <div>
      <p>We take data security seriously and employ measures such as:</p>
      <ul>
        <li>Encryption of sensitive data during storage and transmission.</li>
        <li>Secure password hashing for stored user credentials.</li>
        <li>
          TLS-secured communication between microservices and client
          applications.
        </li>
      </ul>
      <p>
        However, no system is completely secure, and we cannot guarantee
        absolute security.
      </p>
    </div>

    {/* 7. Children's Privacy */}
    <h2>7. Children's Privacy</h2>
    <div>
      <p>
        QuaDev is not intended for children under the age of 18. We do not
        knowingly collect data from children. If we become aware of such data,
        we will delete it promptly.
      </p>
    </div>

    {/* 8. Third-Party Services */}
    <h2>8. Third-Party Services</h2>
    <div>
      <p>QuaDev integrates with the following third-party services:</p>
      <ul>
        <li>
          Google Analytics: For app usage analytics (
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer">
            Google Analytics Privacy Policy
          </a>
          ).
        </li>
        <li>
          Firebase Crashlytics: For crash and error monitoring (
          <a
            href="https://firebase.google.com/support/privacy"
            target="_blank"
            rel="noopener noreferrer">
            Firebase Privacy Policy
          </a>
          ).
        </li>
        <li>
          Google SSO: For user authentication (
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer">
            Google Privacy Policy
          </a>
          ).
        </li>
      </ul>
      <p>
        Your use of these services constitutes acceptance of their respective
        privacy policies.
      </p>
    </div>

    {/* 9. Changes to This Privacy Policy */}
    <h2>9. Changes to This Privacy Policy</h2>
    <div>
      <p>
        This Privacy Policy may be updated periodically. Significant changes
        will be communicated through the App or via email. Continued use of the
        App constitutes acceptance of the revised policy.
      </p>
    </div>

    {/* 10. Contact Us */}
    <h2>10. Contact Us</h2>
    <div>
      <p>For questions, concerns, or feedback, contact us:</p>
      <p>
        Email: <a href="mailto:support@quadev.com">support@quadev.com</a>
      </p>
      <p>Address: Apartment 405, 1 Camberwell Passage, SE5 0AU, London, UK</p>
    </div>

    {/* 11. Additional Information for Sensitive Data */}
    <h2>11. Additional Information for Sensitive Data</h2>
    <div>
      {/* 11.1. Data Minimization */}
      <p>
        11.1. <strong>Data Minimization</strong>
      </p>
      <p>
        We collect and process only the minimum data necessary for the App’s
        functionality.
      </p>

      {/* 11.2. Compliance with Google’s API Policies */}
      <p>
        11.2. <strong>Compliance with Google’s API Policies</strong>
      </p>
      <p>
        Our data collection, storage, and usage practices comply with Google’s
        API Services User Data Policy.
      </p>
    </div>

    <p>
      By using the App, you agree to this Privacy Policy. Thank you for trusting
      QuaDev with your personal information.
    </p>
  </>
);

export default PrivacyPolicyContent;
