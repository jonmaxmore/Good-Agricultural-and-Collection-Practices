import type { Metadata } from 'next';
import VerifyCertificateView from './client-view';

export const metadata: Metadata = {
  title: 'ตรวจสอบใบรับรอง | ระบบรับรอง GACP',
  description: 'ตรวจสอบความถูกต้องของใบรับรอง GACP ด้วยเลขที่ใบรับรอง',
};

export default function VerifyPage() {
  return <VerifyCertificateView />;
}
