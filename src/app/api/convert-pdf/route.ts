import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { convertToMarkdown } from '@/utils/markdown';

// Next.js App Router用の設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ファイルサイズ制限を設定
export async function POST(request: NextRequest) {
  try {
    // Content-Lengthをチェック
    const contentLength = request.headers.get('content-length');
    const MAX_SIZE = 50 * 1024 * 1024; // 50MBに制限を下げる
    
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      return NextResponse.json({ 
        error: `ファイルサイズが大きすぎます。最大50MBまでです。` 
      }, { status: 413 });
    }

    // FormDataを取得（タイムアウト設定）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト
    
    let formData;
    try {
      formData = await request.formData();
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: 'ファイルの読み込みに失敗しました。ファイルサイズを確認してください。' 
      }, { status: 400 });
    }

    const file = formData.get('pdf') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    // ファイルサイズの再チェック
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: `ファイルサイズ ${Math.round(file.size / 1024 / 1024)}MB は制限値 50MB を超えています。` 
      }, { status: 413 });
    }

    // ファイルタイプチェック
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ 
        error: 'PDFファイルのみ対応しています。' 
      }, { status: 400 });
    }

    // ArrayBufferに変換（メモリ効率を考慮）
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (error) {
      return NextResponse.json({ 
        error: 'ファイルの読み込み中にエラーが発生しました。' 
      }, { status: 500 });
    }

    const buffer = Buffer.from(arrayBuffer);
    
    const startTime = Date.now();
    
    // PDFを解析（オプションでメモリ使用量を制限）
    let data;
    try {
      data = await pdf(buffer, {
        max: 1000, // 最大1000ページに制限
        version: 'v1.10.100'
      });
    } catch (error) {
      console.error('PDF parsing error:', error);
      return NextResponse.json({ 
        error: 'PDFの解析に失敗しました。ファイルが破損している可能性があります。' 
      }, { status: 422 });
    }

    const processingTime = (Date.now() - startTime) / 1000;
    
    // Markdownに変換
    let markdown;
    try {
      markdown = convertToMarkdown(data.text, file.name);
    } catch (error) {
      console.error('Markdown conversion error:', error);
      return NextResponse.json({ 
        error: 'Markdown変換中にエラーが発生しました。' 
      }, { status: 500 });
    }

    // レスポンスサイズをチェック（10MBまでに制限）
    const responseSize = Buffer.byteLength(markdown, 'utf8');
    if (responseSize > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: '変換結果が大きすぎます。より小さなPDFファイルを使用してください。' 
      }, { status: 413 });
    }

    return NextResponse.json({
      markdown,
      pages: data.numpages,
      processingTime,
      fileSize: file.size,
      outputSize: responseSize
    });

  } catch (error) {
    console.error('API error:', error);
    
    // エラーの種類に応じて適切なレスポンスを返す
    if (error instanceof Error) {
      if (error.message.includes('AbortError')) {
        return NextResponse.json({ 
          error: '処理がタイムアウトしました。より小さなファイルを使用してください。' 
        }, { status: 408 });
      }
      
      return NextResponse.json({ 
        error: `エラーが発生しました: ${error.message}` 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: '不明なエラーが発生しました。' 
    }, { status: 500 });
  }
}