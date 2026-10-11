import { Route, Routes } from 'react-router';

import MainLayout from '../components/MainLayout';
import Landing from '../screens/Landing';
import PrivacyPolicy from '../screens/PrivacyPolicy';
import TermsAndConditions from '../screens/TermsAndConditions';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Landing />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
