import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientsList from './pages/ClientsList';
import ClientProfile from './pages/ClientProfile';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';
import Loans from './pages/Loans';
import Reports from './pages/Reports';
import Statements from './pages/Statements';
import LoanApprovals from './pages/LoanApprovals';
import LoanRecords from './pages/LoanRecords';
import LoanRepayments from './pages/LoanRepayments';
import LoanRepay from './pages/LoanRepay';
import TxnApprovals from './pages/TxnApprovals';
import LoanRepayApprovals from './pages/LoanRepayApprovals';
import Users from './pages/Users';
import SuperBin from './pages/SuperBin';
import Config from './pages/Config';
import Activity from './pages/Activity';
import MyAccount from './pages/MyAccount';
import LoanStatements from './pages/LoanStatements';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="my-account" element={<MyAccount />} />
        <Route path="clients" element={<ClientsList />} />
        <Route path="clients/new" element={<ClientProfile />} />
        <Route path="clients/:accountNumber" element={<ClientProfile />} />
        <Route path="transactions/deposit" element={<Deposit />} />
        <Route path="transactions/withdraw" element={<Withdraw />} />
        <Route path="transactions/approvals" element={<TxnApprovals />} />
        <Route path="statements" element={<Statements />} />
        <Route path="loans" element={<Loans />} />
        <Route path="loans/approvals" element={<LoanApprovals />} />
        <Route path="loans/records" element={<LoanRecords />} />
        <Route path="loans/repayments" element={<LoanRepayments />} />
        <Route path="loans/repay" element={<LoanRepay />} />
        <Route path="loans/repay/approvals" element={<LoanRepayApprovals />} />
        <Route path="loans/statements" element={<LoanStatements />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="activity" element={<Activity />} />
        <Route path="super-bin" element={<SuperBin />} />
        <Route path="config" element={<Config />} />
      </Route>
    </Routes>
  );
}
