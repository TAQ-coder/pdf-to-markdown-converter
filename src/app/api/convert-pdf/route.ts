import { NextRequest, NextResponse } from 'next/server';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.jsのWorkerファイルのパスを設定
if (typeof window === 'undefined') {
  // サーバーサイドでのworker設定
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// ファイルサイズ制限を50MBに設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function convertPdfToMarkdown(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await pdfjsLib.getDocument({
      data: pdfBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    }).promise;

    let markdown = '';
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // テキストアイテムを位置でソート
      const textItems = textContent.items.map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        height: item.height || 12,
        width: item.width || 0
      }));

      // Y座標でソート（PDFでは上が大きい値）
      textItems.sort((a, b) => b.y - a.y);

      let pageMarkdown = `\n## Page ${pageNum}\n\n`;
      let currentLine = '';
      let lastY = textItems[0]?.y || 0;

      for (const item of textItems) {
        // 新しい行の判定（Y座標の差が一定以上）
        if (Math.abs(item.y - lastY) > item.height * 0.5) {
          if (currentLine.trim()) {
            pageMarkdown += currentLine.trim() + '\n\n';
          }
          currentLine = item.text;
        } else {
          currentLine += item.text;
        }
        lastY = item.y;
      }

      // 最後の行を追加
      if (currentLine.trim()) {
        pageMarkdown += currentLine.trim() + '\n\n';
      }

      markdown += pageMarkdown;
    }

    return markdown;
  } catch (error) {
    console.error('PDF変換エラー:', error);
    throw new Error(`PDF変換に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // リクエストサイズをチェック
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB制限
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます。50MB以下のファイルをアップロードしてください。' },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 400 }
      );
    }

    // ファイルタイプをチェック
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDFファイルのみサポートしています' },
        { status: 400 }
      );
    }

    // ファイルサイズをチェック
    if (file.size > 50 * 1024 * 1024) { // 50MB制限
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます。50MB以下のファイルをアップロードしてください。' },
        { status: 413 }
      );
    }

    const pdfBuffer = await file.arrayBuffer();
    const markdown = await convertPdfToMarkdown(pdfBuffer);

    return NextResponse.json({
      success: true,
      markdown,
      filename: file.name
    });

  } catch (conversionError) {
    console.error('変換処理エラー:', conversionError);
    
    // エラーの種類に応じて適切なステータスコードを返す
    if (conversionError instanceof Error) {
      if (conversionError.message.includes('Invalid PDF')) {
        return NextResponse.json(
          { error: '無効なPDFファイルです。別のファイルを試してください。' },
          { status: 400 }
        );
      }
      
      if (conversionError.message.includes('Memory')) {
        return NextResponse.json(
          { error: 'ファイルが大きすぎてメモリ不足です。より小さなファイルを試してください。' },
          { status: 413 }
        );
      }
    }

    return NextResponse.json(
      { error: 'PDF変換中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}