import { Link } from 'react-router';

// Legal text: kept word for word, as literal JSX (see the lint exception in
// eslint.config.js). Styling comes from the .legal-document rules in global.css.
export const TermsAndConditionsContent: React.FC = () => (
  <>
    {/* Title */}
    <h1>Terms and Conditions</h1>

    {/* Effective Date */}
    <p>Effective Date: 10th January 2025</p>

    {/* Intro Paragraph */}
    <p>
      Welcome to QuaDev! These Terms and Conditions ("Terms") govern your access
      and use of the QuaDev mobile application (the "App"). By signing up,
      signing in, or using any part of the App, you agree to these Terms. Please
      read them carefully. If you do not agree, do not use the App.
    </p>

    {/* 1. Use of the App */}
    <h2>1. Use of the App</h2>
    <div>
      {/* 1.1. Eligibility */}
      <p>
        1.1. <strong>Eligibility</strong>
      </p>
      <p>
        By using the App, you confirm that you are at least 18 years old or have
        the legal authority to consent to these Terms.
      </p>

      {/* 1.2. Responsible Use */}
      <p>
        1.2. <strong>Responsible Use</strong>
      </p>
      <p>
        You agree to use the App responsibly and only for lawful purposes.
        Prohibited uses include, but are not limited to:
      </p>
      <ul>
        <li>Fraudulent activities.</li>
        <li>Unauthorized access to our systems or data.</li>
        <li>
          Interference with the App’s operation or other users’ experience.
        </li>
      </ul>

      {/* 1.3. Suspension or Termination */}
      <p>
        1.3. <strong>Suspension or Termination</strong>
      </p>
      <p>
        QuaDev reserves the right to suspend or terminate accounts for
        violations of these Terms or suspected misuse of the App.
      </p>
    </div>

    {/* 2. Account Creation and Security */}
    <h2>2. Account Creation and Security</h2>
    <div>
      {/* 2.1. Accurate Information */}
      <p>
        2.1. <strong>Accurate Information</strong>
      </p>
      <p>
        You are responsible for ensuring the accuracy of the information you
        provide during sign-up and keeping it up to date.
      </p>

      {/* 2.2. Credential Security */}
      <p>
        2.2. <strong>Credential Security</strong>
      </p>
      <p>
        Your login credentials must be kept secure and confidential. Sharing
        your credentials with others is strictly prohibited.
      </p>

      {/* 2.3. Notification of Breaches */}
      <p>
        2.3. <strong>Notification of Breaches</strong>
      </p>
      <p>
        Notify us immediately at{' '}
        <a href="mailto:support@quadev.com">support@quadev.com</a> if you
        suspect unauthorized access to your account or a security breach.
      </p>

      {/* 2.4. Account Responsibility */}
      <p>
        2.4. <strong>Account Responsibility</strong>
      </p>
      <p>
        You are solely responsible for all activities performed under your
        account. QuaDev is not liable for damages resulting from unauthorized
        use of your account.
      </p>
    </div>

    {/* 3. Authentication Services */}
    <h2>3. Authentication Services</h2>
    <div>
      {/* 3.1. Authentication Methods */}
      <p>
        3.1. <strong>Authentication Methods</strong>
      </p>
      <p>
        The App uses microservices and Firebase Authentication for user
        authentication. By signing in through any method, including Google SSO,
        you consent to the processing of your authentication data as described
        in our <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>

      {/* 3.2. Session Management */}
      <p>
        3.2. <strong>Session Management</strong>
      </p>
      <p>
        QuaDev uses JWT tokens to maintain sessions. Ensure you sign out of your
        account when using shared or public devices to prevent unauthorized
        access.
      </p>

      {/* 3.3. Secure Connections */}
      <p>
        3.3. <strong>Secure Connections</strong>
      </p>
      <p>
        All communications between the App and the server are encrypted using
        HTTPS to ensure data security.
      </p>
    </div>

    {/* 4. Privacy and Data Usage */}
    <h2>4. Privacy and Data Usage</h2>
    <div>
      {/* 4.1. Privacy Commitment */}
      <p>
        4.1. <strong>Privacy Commitment</strong>
      </p>
      <p>
        QuaDev values your privacy. By using the App, you consent to the
        collection, storage, and processing of your data as outlined in our{' '}
        <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>

      {/* 4.2. Data Collected */}
      <p>
        4.2. <strong>Data Collected</strong>
      </p>
      <p>
        Data collected during sign-up, sign-in, and App use may include
        authentication information, session data, device details, and app usage
        statistics.
      </p>

      {/* 4.3. Third-Party Services */}
      <p>
        4.3. <strong>Third-Party Services</strong>
      </p>
      <p>
        QuaDev does not share your personal data with third parties except as
        necessary to provide the App’s services or comply with legal
        requirements. Third-party services integrated into the App include
        Google Analytics, Firebase Crashlytics, and Google SSO. Use of these
        services is governed by their respective privacy policies.
      </p>
    </div>

    {/* 5. User Conduct */}
    <h2>5. User Conduct</h2>
    <div>
      {/* 5.1. Prohibited Activities */}
      <p>
        5.1. <strong>Prohibited Activities</strong>
      </p>
      <p>You agree not to:</p>
      <ul>
        <li>Engage in activities that could harm the App or its users.</li>
        <li>
          Use the App to distribute malware, spam, or other harmful content.
        </li>
        <li>
          Attempt to reverse-engineer or exploit any part of the App’s software.
        </li>
      </ul>

      {/* 5.2. Compliance with Laws */}
      <p>
        5.2. <strong>Compliance with Laws</strong>
      </p>
      <p>
        You must comply with all applicable laws and regulations when using the
        App.
      </p>
    </div>

    {/* 6. Intellectual Property */}
    <h2>6. Intellectual Property</h2>
    <div>
      {/* 6.1. Ownership */}
      <p>
        6.1. <strong>Ownership</strong>
      </p>
      <p>
        All content, trademarks, logos, and software associated with the App are
        the property of QuaDev or its licensors. Unauthorized use of these
        materials is prohibited.
      </p>

      {/* 6.2. License to Use */}
      <p>
        6.2. <strong>License to Use</strong>
      </p>
      <p>
        QuaDev grants you a limited, non-exclusive, and revocable license to use
        the App for personal, non-commercial purposes. This license does not
        transfer any ownership rights.
      </p>
    </div>

    {/* 7. Limitation of Liability */}
    <h2>7. Limitation of Liability</h2>
    <div>
      {/* 7.1. No Warranty */}
      <p>
        7.1. <strong>No Warranty</strong>
      </p>
      <p>
        The App is provided "as is" without warranties of any kind. QuaDev does
        not guarantee uninterrupted or error-free operation.
      </p>

      {/* 7.2. Liability Limitation */}
      <p>
        7.2. <strong>Liability Limitation</strong>
      </p>
      <p>
        QuaDev is not liable for any indirect, incidental, or consequential
        damages arising from your use of the App.
      </p>

      {/* 7.3. Maximum Liability */}
      <p>
        7.3. <strong>Maximum Liability</strong>
      </p>
      <p>
        QuaDev’s total liability for any claim related to the App is limited to
        the amount paid by you, if any, for accessing the App.
      </p>
    </div>

    {/* 8. Updates and Changes */}
    <h2>8. Updates and Changes</h2>
    <div>
      {/* 8.1. App Updates */}
      <p>
        8.1. <strong>App Updates</strong>
      </p>
      <p>
        QuaDev may update or modify the App at any time to enhance functionality
        or address security concerns. Continued use of the App constitutes
        acceptance of such updates.
      </p>

      {/* 8.2. Changes to Terms */}
      <p>
        8.2. <strong>Changes to Terms</strong>
      </p>
      <p>
        These Terms may be updated periodically. Significant changes will be
        communicated through the App or via email. Continued use of the App
        constitutes acceptance of the revised Terms.
      </p>
    </div>

    {/* 9. Governing Law and Dispute Resolution */}
    <h2>9. Governing Law and Dispute Resolution</h2>
    <div>
      {/* 9.1. Governing Law */}
      <p>
        9.1. <strong>Governing Law</strong>
      </p>
      <p>
        These Terms are governed by and construed in accordance with the laws of
        England and Wales, without regard to its conflict of law principles. For
        users residing outside this jurisdiction, local consumer protection laws
        may apply to the extent required by law.
      </p>

      {/* 9.2. Dispute Resolution */}
      <p>
        9.2. <strong>Dispute Resolution</strong>
      </p>
      <p>
        Any disputes arising from these Terms will be resolved through
        negotiation, and if necessary, arbitration in accordance with Rules of
        the London Court of International Arbitration (LCIA).
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

    <p>
      By using the App, you agree to these Terms and Conditions. Thank you for
      choosing QuaDev!
    </p>
  </>
);

export default TermsAndConditionsContent;
