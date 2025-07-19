import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import pdf from 'pdf-parse';
import { convertToMarkdown } from '@/utils/markdown';

// Next.js App Router用の設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // FormDataを取得
    const formData = await request.formData();
    const file = formData.get('pdf') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // ファイルサイズチェック（100MB）
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: `File size ${file.size} exceeds limit of ${MAX_SIZE}` 
      }, { status: 413 });
    }

    // ファイルをBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const startTime = Date.now();
    
    // PDFを解析
    const data = await pdf(buffer, {
      max: 0, // 全ページ処理
      version: 'v1.10.100'
    });

    const processingTime = (Date.now() - startTime) / 1000;
    
    // Markdownに変換
    const markdown = convertToMarkdown(data.text, file.name);

    return NextResponse.json({
      markdown,
      pages: data.numpages,
      processingTime,
      fileSize: file.size
    });

  } catch (error) {
    console.error('PDF processing error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}