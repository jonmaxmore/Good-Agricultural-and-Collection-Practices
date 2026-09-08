"use client";
import {
    DtamDocumentLayout,
    DtamItemsTable,
    type DtamSignatureBlock,
    type DtamTableItem,
} from "@/components/document/gacpthai-document-layout";

/* ================================================================
   InvoiceDocument — ใบวางบิล/ใบแจ้งหนี้
   Matches real DTAM invoice format (reference photo 2)
   3-column signatures: ผู้รับบริการ / ผู้ให้บริการ / ผู้มีอำนาจลงนาม
   ================================================================ */

interface InvoiceDocumentProps {
    invoiceNumber: string;
    invoiceDate: string;
    quotationReference: string;
    /** Used to build the QR's payment-link value — see buildDocumentPaymentQrUrl. */
    applicationId?: string;
    applicantName: string;
    applicantCompany?: string;
    applicantTaxId?: string;
    applicantAddress: string;
    applicantPhone?: string;
    invoicePhase?: 1 | 2;
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

export default function InvoiceDocument({
    invoiceNumber,
    invoiceDate,
    quotationReference,
    applicationId,
    applicantName,
    applicantCompany,
    applicantTaxId,
    applicantAddress,
    applicantPhone,
    invoicePhase: _invoicePhase,
    items,
    totalAmount,
    totalAmountText,
    subtotal,
    vat,
    officerName = "นายรชต โมฆพันธุ์",
    officerPosition = "นักวิชาการสาธารณสุข",
}: InvoiceDocumentProps) {
    const tableItems: DtamTableItem[] = items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: "ต่อคำขอ",
    }));

    const signatures: DtamSignatureBlock[] = [
        {
            title: "ผู้รับบริการ",
            ...(applicantCompany !== undefined ? { companyName: applicantCompany } : {}),
            showDate: true,
        },
        {
            title: "ผู้ให้บริการ",
            name: `( ${officerName} )`,
            position: officerPosition,
            companyName: "ระบบรับรองมาตรฐาน GACP สมุนไพร",
            showDate: true,
        },
        {
            title: "ผู้มีอำนาจลงนาม",
            name: "( นายปรีชา หนูทิม )",
            position: "ผู้อำนวยการระบบรับรองมาตรฐาน GACP สมุนไพร",
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
            badgeTitle="ใบวางบิล/ใบแจ้งหนี้"
            badgeVariant="invoice"
            documentRefs={[
                { label: "เลขที่เอกสาร", value: invoiceNumber },
                { label: "วันที่เอกสาร", value: invoiceDate },
                { label: "ใบเสนอราคาอ้างถึง", value: quotationReference },
            ]}
            addresseeLines={addresseeLines}
            bodyParagraph="ระบบรับรองมาตรฐาน GACP สมุนไพรขอส่งใบวางบิล/ใบแจ้งหนี้ ดังรายการต่อไปนี้"
            signatures={signatures}
            // Stripe-only (operator 2026-09-06): no bank account, no cheque payee, no
            // scan-to-transfer QR — the บิล is settled by card on the system's payment
            // page. The retired block named a Krungthai account this flow never collects.
            footerNotes={[
                "การชำระเงิน: ชำระผ่านระบบด้วย PromptPay QR ที่หน้าชำระเงินของระบบ",
            ]}
        >
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

