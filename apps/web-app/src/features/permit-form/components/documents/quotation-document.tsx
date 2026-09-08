"use client";
import {
    DtamDocumentLayout,
    DtamItemsTable,
    type DtamSignatureBlock,
    type DtamTableItem,
} from "@/components/document/gacpthai-document-layout";

/* ================================================================
   QuotationDocument — ใบเสนอราคา
   Matches real DTAM quotation format (reference photo 1)
   ================================================================ */

interface QuotationDocumentProps {
    quotationNumber: string;
    quotationDate: string;
    /**
     * The day the offer stands until, already formatted (F-G4-64 final round
     * R21). The footer note below says the document is valid for 30 days from
     * issue; the register holds the date itself, and past it the acceptance
     * door refuses this document (QUOTATION_EXPIRED), so the applicant who is
     * asked to accept it is shown the deadline rather than asked to count.
     */
    validUntil?: string;
    /** Used to build the QR's payment-link value — see buildDocumentPaymentQrUrl. */
    applicationId?: string;
    applicantName: string;
    applicantCompany?: string;
    applicantTaxId?: string;
    applicantAddress: string;
    applicantPhone?: string;
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
    }>;
    totalAmount: number;
    totalAmountText: string;
    /** Pre-VAT subtotal + VAT amount for the table foot (VAT as its own line). */
    subtotal?: number;
    vat?: number;
    officerName?: string;
    officerPosition?: string;
}

export default function QuotationDocument({
    quotationNumber,
    quotationDate,
    validUntil,
    applicationId,
    applicantName,
    applicantCompany,
    applicantTaxId,
    applicantAddress,
    applicantPhone,
    items,
    totalAmount,
    totalAmountText,
    subtotal,
    vat,
    officerName = "นายปรีชา หนูทิม",
    officerPosition = "ผู้อำนวยการระบบรับรองมาตรฐาน GACP สมุนไพร",
}: QuotationDocumentProps) {
    const tableItems: DtamTableItem[] = items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: "ต่อคำขอ",
    }));

    const signatures: DtamSignatureBlock[] = [
        {
            title: "ยืนยันคำขอรับการตรวจสอบและประเมิน",
            showDate: true,
        },
        {
            title: "ในนาม ระบบรับรองมาตรฐาน GACP สมุนไพร",
            name: `( ${officerName} )`,
            position: officerPosition,
            subPosition: "ปฏิบัติราชการแทน ผู้อำนวยการ GACP Thai",
            showDate: true,
        },
    ];

    const addresseeLines = [
        { label: "เรียน", value: applicantName },
        ...(applicantCompany ? [{ label: "หน่วยงาน/ผู้รับบริการ:", value: applicantCompany }] : []),
        ...(applicantTaxId ? [{ label: "เลขประจำตัวผู้เสียภาษี:", value: applicantTaxId }] : []),
        { label: "ที่อยู่:", value: applicantAddress },
        ...(applicantPhone ? [{ label: "ผู้ประสานงาน:", value: applicantPhone }] : []),
    ];

    return (
        <DtamDocumentLayout
            /* Company logo, not the ministry seal — this is a commercial document
               issued in the company's name (operator 2026-09-06). */
            logoSrc="/images/company-logo.png"
            badgeTitle="ใบเสนอราคา"
            badgeVariant="quotation"
            documentRefs={[
                { label: "เลขที่เอกสาร", value: quotationNumber },
                { label: "วันที่เอกสาร", value: quotationDate },
                ...(validUntil ? [{ label: "ใช้ได้ถึง", value: validUntil }] : []),
            ]}
            addresseeLines={addresseeLines}
            bodyParagraph="ระบบรับรองมาตรฐาน GACP สมุนไพร โดยระบบรับรองมาตรฐาน GACP สมุนไพร มีความยินดีที่จะเสนอราคาค่าบริการตรวจประเมินและรับรองมาตรฐานการเพาะปลูกและเก็บเกี่ยวที่ดีของพืชกัญชา (Good Agricultural and Collection Practices) ดังรายการต่อไปนี้"
            signatures={signatures}
            // Stripe-only (operator 2026-09-06: "เราจ่ายเงินผ่าน strip เท่านั้น").
            // No bank account, no PromptPay/scan-to-transfer QR, no postal-submission
            // terms — the applicant pays by card on the system's payment page, and the
            // acceptance/expiry is enforced there. The retired lines named a Krungthai
            // account + a Google Form that this flow never uses.
            footerNotes={[
                validUntil
                    ? `หมายเหตุ: ใบเสนอราคานี้ใช้ได้ถึง ${validUntil}`
                    : "หมายเหตุ: ใบเสนอราคานี้มีผลบังคับใช้ตามวันที่ระบุด้านบน",
                "การชำระเงิน: ชำระผ่านระบบด้วย PromptPay QR ที่หน้าชำระเงินของระบบ",
            ]}
        >
            {/* Verification note */}
            <div style={{ marginBottom: "8px", fontSize: "12pt" }}>
                <p>ทั้งนี้ท่านได้ตรวจสอบรายการจำนวนและราคาข้างต้นเรียบร้อยแล้ว</p>
            </div>

            <DtamItemsTable
                items={tableItems}
                {...(typeof subtotal === "number" ? { subtotal } : {})}
                {...(typeof vat === "number" ? { vat } : {})}
                totalAmount={totalAmount}
                totalAmountText={totalAmountText}
            />
        </DtamDocumentLayout>
    );
}
