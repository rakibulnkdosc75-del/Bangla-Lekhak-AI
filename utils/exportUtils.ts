
/**
 * Simple PDF export using browser print functionality.
 * This is the most reliable way to preserve Bengali fonts across OS.
 */
export const exportToPdf = (title: string, content: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Hind Siliguri', sans-serif; padding: 40px; line-height: 1.6; }
        h1 { text-align: center; margin-bottom: 30px; }
        .content { white-space: pre-wrap; font-size: 16px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="content">${content}</div>
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Export to .doc format (Word) using a data blob.
 */
export const exportToWord = (title: string, content: string) => {
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title></head>
    <body style="font-family:'Courier New', Courier, monospace;">
      <h1>${title}</h1>
      <p style="white-space: pre-wrap;">${content}</p>
    </body>
    </html>`;
    
  const blob = new Blob(['\ufeff', header], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title || 'Bengali_Story'}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
