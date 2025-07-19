export function convertToMarkdown(text: string, filename: string): string {
  // PDFテキストをMarkdown形式に変換
  let markdown = text
    // 余分な空白と改行を整理
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // 基本的な構造化
  markdown = markdown
    // 章タイトルの検出（大文字で始まり、短い行）
    .replace(/^([A-Z][^.!?]*?)(?=\n)/gm, (match, title) => {
      if (title.length < 80 && !title.includes('  ')) {
        return `\n## ${title.trim()}\n`;
      }
      return match;
    })
    // 番号付きリストの検出
    .replace(/^(\d+\.\s+)/gm, '\n$1')
    // 箇条書きの検出
    .replace(/^([•·-]\s+)/gm, '\n- ');

  // ファイル情報をヘッダーに追加
  const header = `# ${filename}\n\n*Converted from PDF*\n\n---\n\n`;
  
  return header + markdown;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatProcessingTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds.toFixed(1)}秒`;
}