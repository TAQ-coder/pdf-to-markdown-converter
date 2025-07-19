// src/utils/markdown.ts - 汎用的なPDF to Markdown変換

export function convertToMarkdown(text: string, filename: string): string {
  // PDFテキストを汎用的で可読性の高いMarkdownに変換
  
  // 1. 基本的なテキストクリーニング
  let markdown = cleanText(text);
  
  // 2. 構造化（汎用的）
  markdown = detectAndConvertStructure(markdown);
  
  // 3. 可読性の向上
  markdown = improveReadability(markdown);

  // ファイル情報をヘッダーに追加
  const header = `# ${filename.replace('.pdf', '')}\n\n*Converted from PDF*\n\n---\n\n`;
  
  return header + markdown;
}

function cleanText(text: string): string {
  return text
    // 余分な空白を整理
    .replace(/[ \t]+/g, ' ')
    // 過度な改行を削除
    .replace(/\n{4,}/g, '\n\n\n')
    // 行頭・行末の空白を削除
    .replace(/^\s+|\s+$/gm, '')
    // 全体をトリム
    .trim();
}

function detectAndConvertStructure(text: string): string {
  let result = text;
  
  // 1. 章・セクションのタイトルを検出
  result = detectHeadings(result);
  
  // 2. リスト形式を検出
  result = detectLists(result);
  
  // 3. 表形式データを検出
  result = detectTables(result);
  
  // 4. 引用・注釈を検出
  result = detectQuotes(result);
  
  // 5. URLとリンクを検出
  result = detectLinks(result);
  
  return result;
}

function detectHeadings(text: string): string {
  return text
    // 大きな見出し：短い行で、大文字または数字で始まる
    .replace(/^([A-Z0-9][^.\n]{2,50})$/gm, (match, heading) => {
      // 行が短く、文章的でない場合は見出しとして扱う
      if (heading.length < 50 && !heading.includes('。') && !heading.includes('、')) {
        return `\n# ${heading.trim()}\n`;
      }
      return match;
    })
    // 章番号付き見出し
    .replace(/^(第?\s*[0-9一二三四五六七八九十]+\s*[章節項目条]?\.?\s*)([^\n]+)/gm, '\n## $1$2\n')
    // 数字付き見出し（1. 2. 3.など）
    .replace(/^(\d+\.?\s*)([^.\n]{5,80})$/gm, (match, num, title) => {
      // タイトルっぽい場合のみ見出しに
      if (!title.includes('。') && title.length < 80) {
        return `\n### ${num}${title.trim()}\n`;
      }
      return match;
    })
    // アルファベット付き見出し（A. B. C.など）
    .replace(/^([A-Z]\.?\s*)([^.\n]{5,50})$/gm, '\n#### $1$2\n');
}

function detectLists(text: string): string {
  return text
    // 既存の箇条書き記号を統一
    .replace(/^[\s]*[•·▪▫◦‣⁃]\s*/gm, '- ')
    // 数字付きリスト
    .replace(/^[\s]*(\d+)[.)]\s*/gm, '$1. ')
    // アルファベット付きリスト
    .replace(/^[\s]*([a-zA-Z])[.)]\s*/gm, '- **$1)** ')
    // 日本語の箇条書き
    .replace(/^[\s]*[①②③④⑤⑥⑦⑧⑨⑩]/gm, (match) => {
      const nums = '①②③④⑤⑥⑦⑧⑨⑩';
      const index = nums.indexOf(match.trim()) + 1;
      return `${index}. `;
    })
    // ハイフンやダッシュでの箇条書き
    .replace(/^[\s]*[-−–—]\s*/gm, '- ');
}

function detectTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // コロンで区切られた項目（key: valueペア）を表として認識
    if (line.includes('：') || line.includes(':')) {
      const tableRows: string[] = [];
      let j = i;
      
      // 連続するkey:valueペアを収集
      while (j < lines.length && (lines[j].includes('：') || lines[j].includes(':'))) {
        const [key, ...valueParts] = lines[j].split(/[：:]/);
        const value = valueParts.join(':').trim();
        if (key.trim()) {
          tableRows.push(`| ${key.trim()} | ${value || ''} |`);
        }
        j++;
      }
      
      // 3行以上ある場合はテーブルとして出力
      if (tableRows.length >= 3) {
        result.push('\n| 項目 | 内容 |');
        result.push('|------|------|');
        result.push(...tableRows);
        result.push('');
        i = j;
        continue;
      }
    }
    
    result.push(line);
    i++;
  }
  
  return result.join('\n');
}

function detectQuotes(text: string): string {
  return text
    // 注意書きや補足事項
    .replace(/^[\s]*[※注意注記備考]\s*[：:]?\s*(.+)/gm, '> **注:** $1')
    // 括弧内の補足
    .replace(/^[\s]*[（(]([^）)]+)[）)]\s*$/gm, '> *($1)*')
    // 引用符で囲まれたテキスト
    .replace(/^[\s]*[「『"'""]([^」』"'""\n]+)[」』"'""][\s]*$/gm, '> "$1"');
}

function detectLinks(text: string): string {
  return text
    // URL を Markdown リンクに変換
    .replace(/(https?:\/\/[^\s\)]+)/g, '[$1]($1)')
    // メールアドレスをリンクに変換
    .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[$1](mailto:$1)');
}

function improveReadability(text: string): string {
  return text
    // 段落間の適切なスペーシング
    .replace(/\n{3,}/g, '\n\n')
    // 見出し前後のスペーシング調整
    .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
    .replace(/(#{1,6}[^\n]+)\n([^\n#])/g, '$1\n\n$2')
    // リスト項目間のスペーシング
    .replace(/(\n- [^\n]+)\n([^-\n])/g, '$1\n\n$2')
    // 強調表示の追加（重要そうなキーワード）
    .replace(/\b(重要|必須|注意|警告|禁止|推奨)\b/g, '**$1**')
    // コードブロックの検出（URLやパスっぽいもの）
    .replace(/([^\s]+\.(com|org|net|jp|pdf|doc|docx|xlsx?))/g, '`$1`')
    // 最終的なクリーンアップ
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ファイルサイズフォーマット
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 処理時間フォーマット
export function formatProcessingTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds.toFixed(1)}秒`;
}

// PDFの種類を推定（オプション機能）
export function detectDocumentType(text: string): string {
  const keywords = {
    form: ['申請', '質問書', '記入', '必須', '任意'],
    manual: ['手順', 'ステップ', '方法', '操作'],
    report: ['結果', '分析', 'データ', '統計'],
    contract: ['契約', '条項', '条件', '当事者'],
    invoice: ['請求', '金額', '合計', '支払い']
  };
  
  for (const [type, words] of Object.entries(keywords)) {
    if (words.some(word => text.includes(word))) {
      return type;
    }
  }
  
  return 'document';
}