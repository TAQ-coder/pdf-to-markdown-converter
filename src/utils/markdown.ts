// src/utils/markdown.ts - 改良版

export function convertToMarkdown(text: string, filename: string): string {
  // PDFテキストをより構造化されたMarkdownに変換
  
  // 1. 基本的なクリーニング
  let markdown = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // 2. フォーム構造の検出と変換
  markdown = convertFormStructure(markdown);
  
  // 3. 表構造の検出と変換
  markdown = convertTableStructure(markdown);
  
  // 4. 見出しの改善
  markdown = improveHeadings(markdown);
  
  // 5. リスト形式の改善
  markdown = improveLists(markdown);

  // ファイル情報をヘッダーに追加
  const header = `# ${filename}\n\n*Converted from PDF - Enhanced Structure*\n\n---\n\n`;
  
  return header + markdown;
}

function convertFormStructure(text: string): string {
  // フォーム項目の検出と構造化
  return text
    // 質問項目を見出しに変換
    .replace(/(\d+)\.\s*([^：\n]+)[:：]\s*/g, '\n## $1. $2\n\n')
    // 選択肢やフィールドを整理
    .replace(/第\s*(\d+)\s*候補/g, '- **第$1候補**:')
    .replace(/([必須|任意])\s*$/gm, ' *($1)*')
    // チェックボックス形式に変換
    .replace(/【([^】]+)】/g, '- [ ] $1');
}

function convertTableStructure(text: string): string {
  // 表形式データの検出と変換
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 役員情報や株主情報のような構造化データを検出
    if (line.match(/^(役員|株主)\s*\d+/)) {
      if (!inTable) {
        result.push('\n### ' + line + '\n');
        result.push('| 項目 | 詳細 |');
        result.push('|------|------|');
        inTable = true;
      }
      continue;
    }
    
    // フォーム項目をテーブル行に変換
    if (inTable && line.includes('：')) {
      const [key, value] = line.split('：', 2);
      result.push(`| ${key.trim()} | ${value ? value.trim() : ''} |`);
      continue;
    }
    
    // テーブル終了条件
    if (inTable && (line === '' || line.match(/^[^\|：]+$/))) {
      inTable = false;
      result.push('\n');
    }
    
    if (!inTable) {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

function improveHeadings(text: string): string {
  return text
    // 法人設立質問書のようなタイトルを最上位見出しに
    .replace(/^(法人設立[^。\n]*)/m, '# $1\n')
    // 情報セクションを見出しに
    .replace(/^(取締役情報|株主情報|事業コード)/gm, '\n## $1\n')
    // 番号付き項目を適切な見出しレベルに
    .replace(/^(\d+\.\s*[^：\n]+)/gm, '\n### $1\n');
}

function improveLists(text: string): string {
  return text
    // 箇条書きの改善
    .replace(/^([•·▪▫-]\s*)/gm, '- ')
    // 番号付きリストの改善
    .replace(/^(\d+[.)])\s+/gm, '$1 ')
    // 注意事項や補足をblockquoteに
    .replace(/^(\*[^*\n]+)/gm, '> $1')
    // URLを適切なMarkdownリンクに
    .replace(/(https?:\/\/[^\s\)]+)/g, '[$1]($1)');
}

// より高度な構造認識のための関数
export function enhancedStructureDetection(text: string): {
  structure: string;
  metadata: any;
} {
  const sections = text.split(/\n(?=\d+\.\s|\n[^\s])/);
  const metadata = {
    documentType: 'form',
    language: 'ja',
    sections: sections.length,
    hasTable: text.includes('：'),
    hasCheckboxes: text.includes('【'),
    pageCount: (text.match(/Page \d+/g) || []).length
  };
  
  return {
    structure: convertToMarkdown(text, 'enhanced'),
    metadata
  };
}

// 特定のフォーム形式に特化した変換
export function convertCorporateForm(text: string): string {
  let result = text;
  
  // 会社設立フォーム特有の構造を認識
  const formSections = [
    { pattern: /法人設立質問書/, title: '# 法人設立質問書' },
    { pattern: /取締役情報/, title: '## 取締役情報' },
    { pattern: /株主情報/, title: '## 株主情報' }
  ];
  
  formSections.forEach(section => {
    result = result.replace(section.pattern, section.title);
  });
  
  // 必須/任意の表示を改善
  result = result.replace(/([^:：]+)[：:]\s*(必須|任意)?/g, (match, field, required) => {
    const req = required ? ` *(${required})*` : '';
    return `**${field.trim()}**${req}:`;
  });
  
  return result;
}