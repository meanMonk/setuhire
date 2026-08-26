import { Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClientsListPage from "./pages/Clients/ListPage";
import ClientDetailPage from "./pages/Clients/DetailPage";
import VendorsListPage from "./pages/Vendors/ListPage";
import VendorDetailPage from "./pages/Vendors/DetailPage";
import JobsListPage from "./pages/Jobs/ListPage";
import JobDetailPage from "./pages/Jobs/DetailPage";
import AddJobPage from "./pages/Jobs/AddJobPage";
import CandidatesListPage from "./pages/Candidates/ListPage";
import CandidateDetailPage from "./pages/Candidates/DetailPage";
import AddCandidatePage from "./pages/Candidates/AddCandidatePage";
import InterviewsListPage from "./pages/Interviews/ListPage";
import ContractsListPage from "./pages/Contracts/ListPage";
import FinanceListPage from "./pages/Finance/ListPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <RequireRole>
              <Layout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientsListPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/vendors" element={<VendorsListPage />} />
        <Route path="/vendors/:id" element={<VendorDetailPage />} />
        <Route path="/jobs" element={<JobsListPage />} />
        <Route path="/jobs/new" element={<AddJobPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/candidates" element={<CandidatesListPage />} />
        <Route path="/candidates/new" element={<AddCandidatePage />} />
        <Route path="/candidates/:id" element={<CandidateDetailPage />} />
        <Route path="/interviews" element={<InterviewsListPage />} />
        <Route path="/contracts" element={<ContractsListPage />} />
        <Route path="/finance" element={<FinanceListPage />} />
      </Route>
    </Routes>
  );
}
