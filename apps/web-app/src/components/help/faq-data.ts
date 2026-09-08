/**
 * faq-data.ts — Iter 28 FAQ content (Thai).
 *
 * Centralised Q&A entries organised by topic. The help center
 * landing, /help/faq, and any inline help drawer can all consume
 * this source so the answers stay consistent across surfaces.
 *
 * Content owner: Customer Success
 * Update cadence: every iteration as policy / fee schedule shifts.
 */

import type { FaqItem } from './FaqAccordion';
// Fee answers interpolate the constants instead of printing numbers: the answer
// below carried the totals of the retired platform-only-VAT formula, which are
// lower than what applicants are charged today (W14). F-G4-64 T9.
import { GACP_PHASE1_TOTAL, GACP_PHASE2_TOTAL } from '@/constants/fees';

export type FaqTopic = {
    id: string;
    title: string;
    description: string;
    items: ReadonlyArray<FaqItem>;
};

export const FAQ_TOPICS: ReadonlyArray<FaqTopic> = [
    {
        id: 'application',
        title: 'การสมัคร',
        description: 'การเตรียมเอกสาร การกรอกข้อมูล และเงื่อนไขผู้สมัคร',
        items: [
            {
                id: 'app-docs',
                question: 'ใช้เอกสารอะไรบ้างในการสมัคร?',
                answer:
                    'เอกสารหลัก ได้แก่ สำเนาบัตรประชาชน สำเนาทะเบียนบ้าน เอกสารสิทธิ์ที่ดิน (โฉนด/นส.3/สัญญาเช่า) แผนผังฟาร์ม รูปถ่ายแปลงปลูก และรายการพืชสมุนไพรที่ขอรับรอง สำหรับนิติบุคคลเพิ่มหนังสือรับรองและสำเนา ภพ.20',
                keywords: ['เอกสาร', 'document', 'ยื่น'],
            },
            {
                id: 'app-entity',
                question: 'สมัครได้ทั้งบุคคลธรรมดาและนิติบุคคลใช่หรือไม่?',
                answer:
                    'ใช่ ผู้สมัครสามารถเป็นบุคคลธรรมดา วิสาหกิจชุมชน สหกรณ์ หรือบริษัทจำกัดได้ แต่ละประเภทใช้ชุดเอกสารต่างกัน ระบบจะแสดงรายการที่ต้องเตรียมตามประเภทที่เลือก',
                keywords: ['บุคคล', 'นิติบุคคล', 'วิสาหกิจ'],
            },
            {
                id: 'app-multi-plant',
                question: 'ต้องสมัครซ้ำทุกพืชสมุนไพรหรือไม่?',
                answer:
                    'ไม่ต้องสมัครแยกต่อพืช แต่ละคำขอครอบคลุมหลายชนิดพืชภายในฟาร์มเดียวกัน อย่างไรก็ตามแต่ละชนิดพืชอาจมีเกณฑ์การตรวจประเมินเพิ่มเติม',
                keywords: ['พืช', 'หลายชนิด'],
            },
            {
                id: 'app-multi-farm',
                question: 'ฟาร์มหลายแปลงต้องยื่นกี่คำขอ?',
                answer:
                    'หลักการคือ 1 ฟาร์ม = 1 คำขอ = 1 ใบรับรอง หากมีหลายแปลงในที่ตั้งใกล้กันสามารถรวมเป็นคำขอเดียวได้ หากอยู่คนละจังหวัดต้องแยกคำขอ',
                keywords: ['ฟาร์ม', 'แปลง', 'หลายแปลง'],
            },
            {
                id: 'app-edit',
                question: 'สามารถแก้ไขคำขอหลังจากยื่นแล้วได้หรือไม่?',
                answer:
                    'ก่อนเจ้าหน้าที่ตรวจสอบ สามารถถอนคำขอเพื่อแก้ไขแล้วยื่นใหม่ได้ หากเจ้าหน้าที่มีคำสั่งให้แก้ไข (CAR) ระบบจะเปิดให้แก้ไขเฉพาะส่วนที่ระบุ',
                keywords: ['แก้ไข', 'edit', 'CAR'],
            },
            {
                id: 'app-time',
                question: 'ระยะเวลาตั้งแต่ยื่นถึงรับใบรับรองนานเท่าไหร่?',
                answer:
                    'โดยทั่วไป 45-90 วันทำการ ขึ้นกับความครบถ้วนของเอกสาร การนัดตรวจฟาร์ม และการชำระเงินตามงวด',
                keywords: ['เวลา', 'นาน', 'ระยะเวลา'],
            },
        ],
    },
    {
        id: 'payment',
        title: 'การชำระเงิน',
        description: 'ค่าธรรมเนียม งวดการชำระ ช่องทาง และใบเสร็จ',
        items: [
            {
                id: 'pay-two-installments',
                question: 'ทำไมต้องโอนเงิน 2 ครั้งต่อหนึ่งคำขอ?',
                answer:
                    'ค่าธรรมเนียมแบ่งเป็นงวดที่ 1 (ค่าตรวจเอกสาร) ชำระหลังยื่นคำขอ และงวดที่ 2 (ค่าตรวจฟาร์ม) ชำระก่อนนัดตรวจ การแบ่งจ่ายช่วยให้ผู้สมัครไม่ต้องวางเงินก้อนใหญ่ทีเดียว',
                keywords: ['งวด', 'แบ่งจ่าย', 'สองงวด'],
            },
            {
                id: 'pay-state-fee',
                question: 'ค่าธรรมเนียมรัฐ 5,000 บาท ทำไมต้องจ่ายเข้ากรมบัญชีกลาง?',
                answer:
                    'ค่าธรรมเนียมรัฐเป็นรายได้แผ่นดิน ต้องนำส่งเข้าบัญชีของกรมบัญชีกลางตามระเบียบการคลัง ส่วนค่าธรรมเนียมบริการเทคนิคชำระเข้าบัญชีของหน่วยรับรอง (CB)',
                keywords: ['ค่าธรรมเนียม', 'รัฐ', 'กรมบัญชีกลาง'],
            },
            {
                id: 'pay-promptpay',
                question: 'ระบบรับชำระผ่าน PromptPay หรือไม่?',
                answer:
                    'รับ ระบบสร้าง QR Code PromptPay สำหรับชำระเงินทันที พร้อมระบุเลขที่อ้างอิงให้จับคู่กับคำขอโดยอัตโนมัติ นอกจากนี้ยังรองรับการโอนผ่าน Mobile Banking',
                keywords: ['promptpay', 'qr', 'โอน'],
            },
            {
                id: 'pay-refund',
                question: 'ขอคืนเงินได้หรือไม่?',
                answer:
                    'การคืนเงินทำได้ในกรณีที่ยังไม่เกิดบริการ เช่น ยกเลิกก่อนเจ้าหน้าที่เริ่มตรวจสอบเอกสาร หรือก่อนวันนัดตรวจฟาร์ม โดยต้องยื่นคำร้องและรอการพิจารณา 15-30 วันทำการ',
                keywords: ['คืนเงิน', 'refund'],
            },
            {
                id: 'pay-scope-fee',
                question: 'ค่าธรรมเนียมต่อ scope คือเท่าไหร่?',
                answer:
                    `งวดที่ 1 ค่าตรวจเอกสาร ${GACP_PHASE1_TOTAL.toLocaleString('th-TH')} บาทต่อขอบเขต `
                    + `และงวดที่ 2 ค่าตรวจประเมินหน้างาน ${GACP_PHASE2_TOTAL.toLocaleString('th-TH')} บาทต่อขอบเขต `
                    + 'สองยอดนี้รวมค่าบริการรับรองมาตรฐาน ค่าบริการแพลตฟอร์ม และ VAT 7% แล้ว '
                    + 'จำนวนขอบเขตระบุตามจำนวนพืชและพื้นที่ในคำขอ ยอดที่ต้องชำระจริงยึดตามใบเสนอราคาที่คุณกดยอมรับ',
                keywords: ['scope', 'ขอบเขต', 'ค่าธรรมเนียม'],
            },
        ],
    },
    {
        id: 'audit',
        title: 'การตรวจฟาร์ม',
        description: 'ขั้นตอน ระยะเวลา การเตรียมตัว และการตรวจซ้ำ',
        items: [
            {
                id: 'audit-duration',
                question: 'การตรวจฟาร์มใช้เวลานานเท่าไหร่?',
                answer:
                    'โดยทั่วไป 0.5-1 วันต่อฟาร์ม ขึ้นกับขนาดพื้นที่และจำนวนชนิดพืช เจ้าหน้าที่จะตรวจเอกสาร พื้นที่ปลูก ระบบน้ำ การจัดเก็บ และการเก็บเกี่ยว',
                keywords: ['ตรวจ', 'audit', 'เวลา'],
            },
            {
                id: 'audit-presence',
                question: 'ผู้สมัครต้องอยู่ที่ฟาร์มด้วยหรือไม่?',
                answer:
                    'ต้องมีผู้สมัครหรือผู้รับมอบอำนาจอยู่ในวันตรวจ เพื่อให้ข้อมูล ตอบคำถาม และนำชมพื้นที่ หากไม่มีผู้แทน เจ้าหน้าที่ขอเลื่อนการตรวจ',
                keywords: ['ผู้สมัคร', 'อยู่', 'ฟาร์ม'],
            },
            {
                id: 'audit-fail',
                question: 'หากไม่ผ่านการตรวจ ต้องเริ่มใหม่หรือไม่?',
                answer:
                    'ไม่ต้องเริ่มใหม่ เจ้าหน้าที่จะออกคำสั่งให้แก้ไข (CAR) ภายใน 30 วัน ผู้สมัครต้องดำเนินการแก้ไขและส่งหลักฐาน หากแก้ไขผ่านสามารถเข้าสู่ขั้นออกใบรับรองได้',
                keywords: ['ไม่ผ่าน', 'CAR', 'แก้ไข'],
            },
            {
                id: 'audit-recheck',
                question: 'การตรวจซ้ำเสียค่าธรรมเนียมเพิ่มหรือไม่?',
                answer:
                    'การตรวจซ้ำครั้งแรกในรอบ CAR ไม่คิดค่าธรรมเนียมเพิ่ม หากไม่ผ่านซ้ำและต้องตรวจครั้งที่ 3 จะเรียกเก็บค่าตรวจเพิ่มเติมตามอัตราจริง',
                keywords: ['ตรวจซ้ำ', 'recheck'],
            },
            {
                id: 'audit-schedule',
                question: 'จะรู้วันนัดตรวจได้อย่างไร?',
                answer:
                    'เจ้าหน้าที่จะนัดหมายล่วงหน้าไม่น้อยกว่า 7 วันทำการผ่านระบบและอีเมล สามารถดูปฏิทินการตรวจในหน้า "คำขอของฉัน"',
                keywords: ['นัด', 'ตรวจ', 'schedule'],
            },
        ],
    },
    {
        id: 'certificate',
        title: 'ใบรับรอง',
        description: 'การออก ดาวน์โหลด สูญหาย และการตรวจสอบใบรับรอง',
        items: [
            {
                id: 'cert-format',
                question: 'ใบรับรองอยู่ในรูปแบบใด?',
                answer:
                    'ใบรับรองดิจิทัล (PDF) พร้อมลายเซ็นอิเล็กทรอนิกส์ของผู้มีอำนาจ และ QR Code สำหรับตรวจสอบความถูกต้อง ฉบับพิมพ์ใช้ดาวน์โหลดจากระบบเองได้',
                keywords: ['รูปแบบ', 'pdf', 'ดิจิทัล'],
            },
            {
                id: 'cert-lost',
                question: 'หากใบรับรองสูญหายต้องทำอย่างไร?',
                answer:
                    'ดาวน์โหลดสำเนาใหม่ได้ทันทีจากหน้า "ใบรับรอง" เนื่องจากใบรับรองเป็นดิจิทัล จึงไม่มีปัญหาสูญหาย กรณีต้องการใบใหม่ที่มีตราประทับสามารถยื่นคำร้องขอออกซ้ำได้',
                keywords: ['หาย', 'lost', 'ออกซ้ำ'],
            },
            {
                id: 'cert-verify',
                question: 'ใครสามารถตรวจสอบใบรับรองได้?',
                answer:
                    'ผู้ที่มี QR Code หรือเลขที่ใบรับรองสามารถตรวจสอบผ่านหน้า /verify ของระบบได้ ไม่ต้องลงชื่อเข้าใช้ การตรวจสอบจะแสดงสถานะ (Active / Expired) และข้อมูลฟาร์มสาธารณะ',
                keywords: ['ตรวจสอบ', 'verify', 'qr'],
            },
            {
                id: 'cert-validity',
                question: 'ใบรับรองมีอายุนานแค่ไหน?',
                answer:
                    'ใบรับรอง GACP มีอายุ 1 ปี นับจากวันที่ออก หลังจากนั้นต้องยื่นต่ออายุ ระบบจะแจ้งเตือนล่วงหน้า 60/30/15 วันก่อนหมดอายุ',
                keywords: ['อายุ', 'validity'],
            },
            {
                id: 'cert-renewal',
                question: 'การต่ออายุยุ่งยากเหมือนสมัครใหม่ไหม?',
                answer:
                    'ไม่ ระบบจะดึงข้อมูลคำขอเดิมมาให้ ผู้สมัครเพียงอัปเดตเอกสารที่หมดอายุและยืนยัน เจ้าหน้าที่จะตรวจประเมินสั้นกว่าครั้งแรก (Surveillance)',
                keywords: ['ต่ออายุ', 'renewal'],
            },
        ],
    },
    {
        id: 'refund',
        title: 'การคืนเงิน',
        description: 'เงื่อนไข ระยะเวลา และวิธีขอคืนเงิน',
        items: [
            {
                id: 'refund-conditions',
                question: 'เงื่อนไขการคืนเงินมีอะไรบ้าง?',
                answer:
                    'คืนได้เต็มจำนวนหากบริการยังไม่เริ่ม คืนบางส่วนหากตรวจเอกสารแล้วแต่ยังไม่ตรวจฟาร์ม ไม่คืนหากตรวจฟาร์มเสร็จสมบูรณ์แล้ว',
                keywords: ['เงื่อนไข', 'คืนเงิน'],
            },
            {
                id: 'refund-process',
                question: 'ต้องทำอย่างไรเพื่อขอคืนเงิน?',
                answer:
                    'ยื่นคำร้องที่หน้า "การชำระเงิน" ของคำขอ ระบุเหตุผลและเลขบัญชีรับโอน ระบบจะส่งให้ฝ่ายการเงินพิจารณา',
                keywords: ['ขอคืน', 'process'],
            },
            {
                id: 'refund-time',
                question: 'ใช้เวลาเท่าไหร่กว่าจะได้รับเงินคืน?',
                answer:
                    'หลังอนุมัติ 15-30 วันทำการ ขึ้นกับช่องทางการรับเงิน หากเป็นเงินรัฐ (5,000) จะใช้เวลานานกว่าค่าบริการเทคนิคเล็กน้อย',
                keywords: ['เวลา', 'นาน', 'คืน'],
            },
            {
                id: 'refund-cap',
                question: 'มีค่าธรรมเนียมในการคืนเงินหรือไม่?',
                answer:
                    'ไม่มีค่าธรรมเนียมการคืนเงิน แต่ระบบจะหักค่าบริการที่เกิดขึ้นแล้ว (เช่น ค่าตรวจเอกสารหากผ่านขั้นนั้นไปแล้ว) ก่อนคืนยอดสุทธิ',
                keywords: ['หัก', 'cap'],
            },
        ],
    },
    {
        id: 'pdpa',
        title: 'PDPA และความเป็นส่วนตัว',
        description: 'การเก็บข้อมูล สิทธิเจ้าของข้อมูล และการลบบัญชี',
        items: [
            {
                id: 'pdpa-storage',
                question: 'ข้อมูลของผู้สมัครถูกเก็บไว้อย่างไร?',
                answer:
                    'จัดเก็บในศูนย์ข้อมูลที่ตั้งในประเทศไทย เข้ารหัสทั้งระหว่างส่งและขณะจัดเก็บ (TLS + AES-256) เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้นเข้าถึงได้',
                keywords: ['เก็บ', 'storage', 'pdpa'],
            },
            {
                id: 'pdpa-delete',
                question: 'ขอลบบัญชีและข้อมูลส่วนบุคคลได้หรือไม่?',
                answer:
                    'ได้ ผู้ใช้สามารถยื่นคำขอลบบัญชีผ่านอีเมล privacy@gacpth.com โดยข้อมูลที่กฎหมายกำหนดให้เก็บ (เช่น เอกสารใบรับรอง 5 ปี) จะถูกเก็บแยกเป็นข้อมูลที่ไม่ใช้ระบุตัวบุคคล',
                keywords: ['ลบ', 'delete', 'บัญชี'],
            },
            {
                id: 'pdpa-export',
                question: 'ข้อมูลถูกส่งออกนอกประเทศหรือไม่?',
                answer:
                    'ไม่ ข้อมูลส่วนบุคคลถูกเก็บในประเทศไทยทั้งหมด ระบบไม่มีการส่งข้อมูลไปประมวลผลในต่างประเทศ',
                keywords: ['ส่งออก', 'ต่างประเทศ'],
            },
            {
                id: 'pdpa-rights',
                question: 'มีสิทธิอะไรบ้างในฐานะเจ้าของข้อมูล?',
                answer:
                    'มีสิทธิเข้าถึงข้อมูลของตนเอง ขอแก้ไข ขอลบ ขอระงับการประมวลผล และขอเคลื่อนย้ายข้อมูล ตาม พรบ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
                keywords: ['สิทธิ', 'rights', 'pdpa'],
            },
            {
                id: 'pdpa-cookie',
                question: 'เว็บไซต์ใช้คุกกี้อะไรบ้าง?',
                answer:
                    'ใช้คุกกี้จำเป็น (Session, CSRF) เท่านั้น ไม่มี Tracking หรือ Advertising Cookies ดูรายละเอียดได้ในหน้านโยบายคุกกี้',
                keywords: ['cookie', 'คุกกี้'],
            },
        ],
    },
];

/** Flat list of all FAQ items — useful for search across topics. */
export const ALL_FAQ_ITEMS: ReadonlyArray<FaqItem & { topicId: string }> =
    FAQ_TOPICS.flatMap((topic) => topic.items.map((item) => ({ ...item, topicId: topic.id })));

/** Compute total count statically — used for telemetry headlines. */
export const FAQ_COUNT = ALL_FAQ_ITEMS.length;

/** Glossary entries — Thai accounting + GACP terms. */
export type GlossaryEntry = {
    id: string;
    /** Thai display form. Leads in Thai; carries an acronym only where the
     *  acronym is the legal name printed on the document itself. */
    term: string;
    /** English display form. */
    termEn: string;
    definition: string;
    definitionEn: string;
    /** Acronyms and spellings the search box must still match even when the
     *  active language no longer shows them. Translating the display must
     *  not quietly break how people look a term up. */
    aliases?: readonly string[];
    category: 'finance' | 'gacp' | 'audit' | 'general';
};

export const GLOSSARY_ENTRIES: ReadonlyArray<GlossaryEntry> = [
    {
        id: 'gacp',
        term: 'มาตรฐานการปฏิบัติทางการเกษตรและการเก็บเกี่ยวที่ดี (GACP)',
        termEn: 'GACP (Good Agricultural and Collection Practices)',
        definition:
            'มาตรฐานการปฏิบัติทางการเกษตรและการเก็บเกี่ยวที่ดีสำหรับพืชสมุนไพร กำกับดูแลโดยกรมการแพทย์แผนไทยและการแพทย์ทางเลือก',
        definitionEn:
            'The good agricultural and collection practice standard for herbal crops, administered by the Department of Thai Traditional and Alternative Medicine.',
        aliases: ['GACP'],
        category: 'gacp',
    },
    {
        id: 'scope',
        term: 'ขอบเขตการรับรอง',
        termEn: 'Scope',
        definition:
            'ชุดของชนิดพืช พื้นที่ และกระบวนการที่ยื่นขอใบรับรอง หนึ่งขอบเขตคิดค่าธรรมเนียมหนึ่งรายการ',
        definitionEn:
            'The set of crop types, areas, and processes covered by one certificate application. Each scope is charged as one fee item.',
        aliases: ['Scope'],
        category: 'gacp',
    },
    {
        id: 'car',
        term: 'คำสั่งแก้ไขข้อบกพร่อง',
        termEn: 'Corrective Action Request (CAR)',
        definition:
            'คำสั่งให้แก้ไขที่ออกหลังการตรวจประเมิน ระบุข้อบกพร่อง ระดับความรุนแรง และกำหนดเวลาที่ต้องดำเนินการ',
        definitionEn:
            'An instruction issued after an audit, stating the finding, its severity, and the deadline for putting it right.',
        aliases: ['CAR', 'Corrective Action Request'],
        category: 'audit',
    },
    {
        id: 'surveillance',
        term: 'การตรวจติดตามผล',
        termEn: 'Surveillance Audit',
        definition:
            'การตรวจติดตามประจำปีสำหรับผู้ที่ได้รับใบรับรองแล้ว เพื่อยืนยันว่ายังปฏิบัติตามมาตรฐานอย่างต่อเนื่อง',
        definitionEn:
            'The annual follow-up audit for certificate holders, confirming that the standard is still being met.',
        aliases: ['Surveillance Audit'],
        category: 'audit',
    },
    {
        id: 'cb',
        term: 'หน่วยรับรองมาตรฐาน',
        termEn: 'Certification Body (CB)',
        definition:
            'องค์กรอิสระที่ได้รับการรับรองให้ประเมินและออกใบรับรองมาตรฐาน',
        definitionEn:
            'The independent organisation accredited to assess applicants and issue the standard certificate.',
        aliases: ['CB', 'Certification Body'],
        category: 'gacp',
    },
    {
        id: 'invoice',
        term: 'ใบแจ้งหนี้',
        termEn: 'Invoice',
        definition:
            'เอกสารเรียกเก็บเงินก่อนชำระ ระบุยอด เลขที่อ้างอิง และวันครบกำหนด แต่ละงวดจะมีใบแจ้งหนี้แยก',
        definitionEn:
            'The demand for payment issued before you pay, stating the amount, reference number, and due date. Each instalment has its own invoice.',
        aliases: ['Invoice'],
        category: 'finance',
    },
    {
        id: 'tax-invoice',
        term: 'ใบกำกับภาษี',
        termEn: 'Tax Invoice',
        definition:
            'เอกสารทางภาษีที่ระบุยอดภาษีมูลค่าเพิ่มร้อยละ 7 สำหรับนิติบุคคลที่จดทะเบียนภาษีมูลค่าเพิ่ม ใช้ขอคืนภาษีซื้อ',
        definitionEn:
            'The tax document stating the 7% value added tax, used by VAT-registered companies to reclaim input tax.',
        aliases: ['Tax Invoice', 'VAT'],
        category: 'finance',
    },
    {
        id: 'wht',
        term: 'ภาษีหัก ณ ที่จ่าย',
        termEn: 'Withholding Tax (WHT)',
        definition:
            'ภาษีที่หักไว้ตามประมวลรัษฎากร โดยทั่วไปร้อยละ 3 สำหรับค่าบริการ ผู้จ่ายมีหน้าที่นำส่งกรมสรรพากร',
        definitionEn:
            'Tax withheld at source under the Revenue Code, generally 3% on service fees. The payer is responsible for remitting it to the Revenue Department.',
        aliases: ['WHT', 'Withholding Tax'],
        category: 'finance',
    },
    {
        id: 'pdpa',
        term: 'พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)',
        termEn: 'Personal Data Protection Act (PDPA)',
        definition:
            'กฎหมายคุ้มครองข้อมูลส่วนบุคคลของประเทศไทย พ.ศ. 2562 กำหนดสิทธิของเจ้าของข้อมูลและหน้าที่ของผู้ควบคุมข้อมูล',
        definitionEn:
            "Thailand's personal data protection law of 2019, setting out the rights of data subjects and the duties of data controllers.",
        aliases: ['PDPA'],
        category: 'general',
    },
    {
        id: 'promptpay',
        term: 'พร้อมเพย์',
        termEn: 'PromptPay',
        definition:
            'บริการโอนเงินของระบบธนาคารไทย โดยใช้เลขประจำตัวประชาชน เบอร์โทรศัพท์ หรือเลขกระเป๋าเงินอิเล็กทรอนิกส์',
        definitionEn:
            'The Thai banking transfer service addressed by national ID number, phone number, or e-wallet number.',
        aliases: ['PromptPay'],
        category: 'finance',
    },
];
