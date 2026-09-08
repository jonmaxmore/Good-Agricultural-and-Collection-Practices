/**
 * ยื่นคำขอ แล้วส่งต่อไปยังหน้าที่ถือใบเสนอราคาและประตูจ่ายเงิน — มีที่เดียว
 *
 * ก่อนหน้านี้ตรรกะชุดนี้อยู่ในหน้า `/health/applications/preview` ที่เดียว และแผน Task 11
 * ให้หน้ารีวิวขั้นที่ 6 ทำสิ่งเดียวกัน · แผนเขียนไว้ตรง ๆ ว่า "the wiring moves, the behavior
 * must not" — การคัดลอกไปไว้อีกหน้าหนึ่งจะกลายเป็นสองสำเนาที่แยกจากกันในวันแรกที่สายจ่ายเงิน
 * เปลี่ยน จึงย้ายมาที่นี่และให้ทั้งสองหน้าจอเรียกตัวเดียวกัน
 *
 * **โมดูลนี้ไม่ตัดสินใจเรื่องเงินเลย** ใต้ราง checkout มันไม่สร้างเอกสารการเงินอะไรทั้งสิ้น
 * (F-G4-64 วางด่านใบเสนอราคาไว้หน้า /payments/create และคำสั่งซื้อ checkout ถูกสร้างโดย
 * /health/payments หลังผู้ยื่นติ๊กยอมรับ) · ส่วนรางเดิมยังคงพฤติกรรมเดิมทุกตัวอักษร
 * เพราะการปิดมันเป็นการตัดสินใจของ operator ไม่ใช่ของการ refactor
 *
 * คืน "สิ่งที่เกิดขึ้น" ให้ผู้เรียกไปตัดสินใจเรื่อง route กับ error เอง — โมดูลนี้ไม่รู้จัก
 * router และไม่รู้จัก useState จึงทดสอบได้โดยไม่ต้อง mount อะไรเลย
 */
import { apiClient } from '@/lib/api/api-client';
import { isCheckoutUiEnabled } from '@/lib/config/checkout-mode';
import { quotationGateRefusalTh } from '@/lib/services/payment-service';
import { submitGateRefusalTh } from '@/lib/services/application-requirements';

export type SubmitOutcome =
    /** ยื่นไม่ผ่านด่าน — ยังไม่ได้ยื่น พูดเป็นภาษาไทย */
    | { kind: 'REFUSED'; message: string }
    /** ยื่นสำเร็จแล้ว แต่ขั้นถัดไปถูกปฏิเสธ — คำขอ *ถูกยื่นแล้ว* ต้องบอกและพาไปที่ที่แก้ได้ */
    | { kind: 'REFUSED_BUT_FILED'; message: string; href: string }
    /** แก้ไขแล้วส่งกลับ — ไม่มีขั้นจ่ายเงิน */
    | { kind: 'RESUBMITTED'; href: string }
    /** ยื่นแล้ว ส่งต่อไปหน้าชำระเงิน */
    | { kind: 'FILED'; href: string };

/** หน้าที่ผู้ยื่นถูกส่งไป ตั้งชื่อไว้ที่เดียว เพื่อให้คำปฏิเสธกับความสำเร็จไม่ชี้คนละที่ */
export function paymentsHrefFor(applicationId: string): string {
    return `/health/payments?app=${applicationId}&phase=1`;
}

export async function submitAndHandOver({
    applicationId,
    isInitialSubmit,
    isResubmit,
    declarationsAccepted,
}: {
    applicationId: string;
    isInitialSubmit: boolean;
    isResubmit: boolean;
    /** ส่งเฉพาะเมื่อผู้ยื่นเพิ่งติ๊กครบจริง — เซิร์ฟเวอร์เป็นคนประทับเวลาเอง */
    declarationsAccepted?: boolean;
}): Promise<SubmitOutcome> {
    const paymentsHref = paymentsHrefFor(applicationId);

    if (isInitialSubmit || isResubmit) {
        const body: Record<string, unknown> = { applicationId };
        // อ้างการยอมรับที่ไม่มีใครให้ไว้ไม่ได้: ส่งคีย์นี้ก็ต่อเมื่อมีคนติ๊กจริงเท่านั้น
        if (declarationsAccepted === true) { body.declarationsAccepted = true; }

        const submitResponse = await apiClient.post<{ status?: string }>('/applications/submit', body);

        if (!submitResponse.success) {
            // api-client ให้ความสำคัญกับ `.error` ก่อน `.message` โดยตั้งใจ (use-auto-save
            // พึ่ง `.error` ให้เป็นรหัสดิบ) ⇒ ข้อความไทยของ backend ถูกทิ้งไปกับ envelope
            // เหลือรอดแค่ `.meta.messageTh` · ถามคำปฏิเสธด้วย KIND ไม่ใช่ไล่เทียบรหัสทีละตัว
            // เพื่อไม่ให้คำปฏิเสธชนิดที่สามไปโผล่เป็น enum ดิบต่อหน้าเกษตรกรอีก
            const gateCopy = submitGateRefusalTh(
                submitResponse.code || submitResponse.error,
                submitResponse.meta,
            );
            return { kind: 'REFUSED', message: gateCopy || submitResponse.error || 'ไม่สามารถยื่นข้อมูลได้' };
        }

        // เส้นทางแก้ไขจบตรงนี้ — ไม่มีขั้นจ่ายเงิน เพราะงวดที่ 1 จ่ายไปแล้วในรอบเดิม
        if (isResubmit) {
            return { kind: 'RESUBMITTED', href: `/health/applications/${applicationId}` };
        }
    }

    // ใต้ราง checkout หน้านี้ไม่สร้างเอกสารการเงินใด ๆ — ส่งต่อให้หน้าที่ถือใบเสนอราคา
    // ปุ่มยอมรับ และประตูจ่ายเงิน
    if (isCheckoutUiEnabled()) {
        return { kind: 'FILED', href: paymentsHref };
    }

    // รางเดิม (ปิดธง): แถวใบแจ้งหนี้งวดที่ 1 ยังถูกสร้างที่นี่ตามเดิม
    const paymentResponse = await apiClient.post('/payments/create', { applicationId, phase: '1' });
    if (!paymentResponse.success) {
        // สองกรณี ไม่ใช่กรณีเดียว — และความต่างมีเหตุผล:
        //
        //   ด่านใบเสนอราคาปฏิเสธ → คำขอ *ถูกยื่นแล้ว* สิ่งที่ค้างคือปุ่มติ๊กยอมรับ ซึ่งอยู่อีกหน้าหนึ่ง
        //                            จึงบอกเป็นภาษาไทยแล้วพาไปที่นั่น
        //   ล้มด้วยเหตุอื่น        → ไม่รู้ว่าอีกหน้าจะช่วยอะไรได้ การผลักไปที่นั่นคือการพาผู้ใช้
        //                            ออกจากหน้าที่มีข้อความอธิบาย ไปยังหน้าที่ไม่มี · อยู่ที่เดิม
        //
        // (การยุบสองอันนี้เข้าด้วยกันตอนย้ายโค้ดทำให้เทสของหน้า preview แดงทันที ซึ่งเป็นเหตุผล
        //  ที่เทสนั้นมีอยู่)
        const gateCopy = quotationGateRefusalTh(paymentResponse.code || paymentResponse.error);
        if (gateCopy) {
            return { kind: 'REFUSED_BUT_FILED', message: gateCopy, href: paymentsHref };
        }
        return {
            kind: 'REFUSED',
            message: paymentResponse.error || 'ไม่สามารถสร้างรายการชำระเงินได้ กรุณาลองใหม่อีกครั้ง',
        };
    }

    return { kind: 'FILED', href: paymentsHref };
}
