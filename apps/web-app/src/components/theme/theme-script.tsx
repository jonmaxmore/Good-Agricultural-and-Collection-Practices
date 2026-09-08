export function ThemeScript() {
  const script = `
    (function () {
      try {
        var stored = localStorage.getItem('theme');
        var hasExplicitPreference = localStorage.getItem('theme:explicit') === '1';
        // ผู้ใช้เลือกเองแล้ว = ชนะเสมอ · ยังไม่เคยเลือก = ถามเครื่องเขา
        //
        // เดิมบรรทัดนี้ตอบ 'light' ตายตัวโดยไม่เคยถาม prefers-color-scheme และยัง
        // เขียนค่านั้นลง localStorage ด้วย · ผลคือเครื่องที่ตั้งโหมดมืดได้จอสว่าง
        // แล้วค่านั้นติดค้างถาวร แม้แก้บั๊กแล้วผู้ใช้เดิมก็ยังสว่างอยู่ดี
        // (วัดจริง 2026-09-08: prefersDark=true แต่ body bg = rgb(244,246,245))
        //
        // ไม่เขียน localStorage เมื่อยังไม่ได้เลือกเอง — ค่าที่ระบบเดาให้ ไม่ใช่
        // การตัดสินใจของผู้ใช้ และการบันทึกมันทำให้เปลี่ยนใจภายหลังไม่มีผล
        var resolved;
        if (hasExplicitPreference && (stored === 'light' || stored === 'dark')) {
          resolved = stored;
        } else {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        var dark = resolved === 'dark';
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.setAttribute('data-color-scheme', dark ? 'dark' : 'light');
      } catch (error) {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-color-scheme', 'light');
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
