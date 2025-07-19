'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Loader, Info } from 'lucide-react';
import { formatFileSize, formatProcessingTime } from '@/utils/markdown';

interface ConversionResult {
  filename: string;
  markdown?: string;
  status: 'success' | 'error';
  size: number;
  pages?: number;
  processingTime?: number;
  error?: string;
}

interface UploadProgress {
  [filename: string]: number;
}

const PDFConverter: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    
    const selectedFiles = Array.from(event.target.files).filter(
      file => file.type === 'application/pdf'
    );
    
    const validFiles = selectedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} は50MBを超えています。より小さなファイルを選択してください。`);
        return false;
      }
      return true;
    });
    
    setFiles(validFiles);
    setResults([]);
    setUploadProgress({});
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    const validFiles = droppedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} は50MBを超えています。より小さなファイルを選択してください。`);
        return false;
      }
      return true;
    });
    
    setFiles(validFiles);
    setResults([]);
    setUploadProgress({});
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processFileOnServer = async (file: File): Promise<ConversionResult> => {
    const formData = new FormData();
    formData.append('pdf', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: percentComplete
          }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              filename: file.name,
              markdown: response.markdown,
              status: 'success',
              size: file.size,
              pages: response.pages,
              processingTime: response.processingTime
            });
          } catch (parseError) {
            console.error('Response parsing error:', parseError);
            reject(new Error('サーバーからの応答を解析できませんでした'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || `サーバーエラー: ${xhr.status}`));
          } catch (parseError) {
            console.error('Error response parsing error:', parseError);
            reject(new Error(`サーバーエラー: ${xhr.status} - ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => {
        console.error('Network error occurred');
        reject(new Error('ネットワークエラーが発生しました'));
      };
      
      xhr.ontimeout = () => {
        console.error('Request timeout');
        reject(new Error('リクエストがタイムアウトしました'));
      };
      
      xhr.timeout = 300000; // 5分
      xhr.open('POST', '/api/convert-pdf');
      xhr.send(formData);
    });
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setResults([]);

    const newResults: ConversionResult[] = [];

    for (const file of files) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const result = await processFileOnServer(file);
        newResults.push(result);
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } catch (conversionError) {
        console.error(`Conversion error for ${file.name}:`, conversionError);
        newResults.push({
          filename: file.name,
          status: 'error',
          error: conversionError instanceof Error ? conversionError.message : '不明なエラーが発生しました',
          size: file.size
        });
      }
    }

    setResults(newResults);
    setProcessing(false);
  };

  const downloadMarkdown = (result: ConversionResult) => {
    if (!result.markdown) return;
    
    const blob = new Blob([result.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename.replace('.pdf', '.md');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <FileText className="mx-auto h-16 w-16 text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PDF to Markdown Converter
          </h1>
          <p className="text-gray-600">
            最大50MBのPDFファイルをMarkdown形式に変換
          </p>
        </div>

        {/* 機能説明 */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">対応機能</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 最大50MBのPDFファイルに対応</li>
                <li>• サーバーサイド処理で高速変換</li>
                <li>• 複数ファイルの同時処理</li>
                <li>• リアルタイム進捗表示</li>
                <li>• 汎用的な構造認識とMarkdown変換</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ファイルアップロード */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6 hover:border-blue-400 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg text-gray-600 mb-2">
            PDFファイルをドラッグ&ドロップするか、クリックして選択
          </p>
          <p className="text-sm text-gray-500">
            最大50MB、複数ファイル対応
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* 選択されたファイル一覧 */}
        {files.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">
              選択されたファイル ({files.length}) - 
              合計: {formatFileSize(files.reduce((sum, file) => sum + file.size, 0))}
            </h3>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-red-600 mr-3" />
                      <div>
                        <span className="text-sm font-medium">{file.name}</span>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    {processing && uploadProgress[file.name] !== undefined && (
                      <div className="text-sm text-blue-600">
                        {uploadProgress[file.name].toFixed(1)}%
                      </div>
                    )}
                  </div>
                  
                  {processing && uploadProgress[file.name] !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button
              onClick={processFiles}
              disabled={processing}
              className="mt-4 w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center"
            >
              {processing ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  変換中...
                </>
              ) : (
                '変換開始'
              )}
            </button>
          </div>
        )}

        {/* 変換結果 */}
        {results.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">変換結果</h3>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
                      )}
                      <div>
                        <p className="font-medium">{result.filename}</p>
                        <div className="text-sm text-gray-600">
                          {result.status === 'success' ? (
                            <span>
                              {result.pages}ページ • {formatFileSize(result.size)}
                              {result.processingTime && (
                                <> • 処理時間: {formatProcessingTime(result.processingTime)}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-red-600">{result.error}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {result.status === 'success' && (
                      <button
                        onClick={() => downloadMarkdown(result)}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center text-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        ダウンロード
                      </button>
                    )}
                  </div>
                  
                  {result.status === 'success' && result.markdown && (
                    <div className="mt-3">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                          プレビューを表示
                        </summary>
                        <pre className="mt-2 p-3 bg-white border rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                          {result.markdown.substring(0, 800)}...
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 技術情報 */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-green-900">変換機能</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li>• 汎用的な文書構造認識</li>
              <li>• 見出し・リスト・表の自動検出</li>
              <li>• 多言語対応（日本語・英語等）</li>
              <li>• 可読性を重視したMarkdown出力</li>
            </ul>
          </div>
          
          <div className="p-6 bg-purple-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3 text-purple-900">技術仕様</h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li>• Next.js + TypeScript</li>
              <li>• PDF.js による高精度解析</li>
              <li>• Vercel Edge Functions</li>
              <li>• クライアントサイド進捗表示</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFConverter;