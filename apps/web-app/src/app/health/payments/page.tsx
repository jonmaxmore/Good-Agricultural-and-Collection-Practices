import type { Metadata } from 'next';
import FeeStatusView from './client-view';

export const metadata: Metadata = {
  title: 'ค่าธรรมเนียม | ระบบรับรอง GACP',
};

export default function PaymentsPage() {
  return <FeeStatusView />;
}
