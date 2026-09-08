import type { Metadata } from 'next';
import FeeQueueClient from './client-view';

export const metadata: Metadata = {
  title: 'ค่าธรรมเนียม | เจ้าหน้าที่บัญชี',
};

export default function AccountingPage() {
  return <FeeQueueClient />;
}
