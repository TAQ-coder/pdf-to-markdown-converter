'use client';

import { useState, useRef, useCallback } from 'react';

interface ConversionResponse {
  success: boolean;
  markdown?: string;
  filename?: string;
  error?: string;
}

interface ProgressState {
  stage: string;
  progress: number;
}

export default function PDFConverter() {
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ stage: '', progress: 0 });
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setError('');
    setResult('');
    setFileName('');
    setProgress({ stage: '', progress: 0 });
    setCopySuccess(false);
  };

  const validateFile = (file: File): string | null => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (file.size > maxSize) {
      return 'ファイルサイズが大きすぎます。50MB以下のファイルをアップロードしてください。';
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'PDFファイルのみサポートしています。';
    }

    return null;
  };

  const updateProgress = (stage: string, progress: number) => {
    setProgress({ stage, progress });
  };

  const handleFileUpload = async (file: File) => {
    resetState();
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setConverting(true);
    setFileName(file.name);

    try {
      updateProgress('ファイルを準備中...', 10);
      
      const formData = new FormData();
      formData.append('file', file);

      updateProgress('サーバーにアップロード中...', 30);

      const response = await fetch('/api/convert-pdf', {
        method: 'POST',
        body: formData,
      });

      updateProgress('レスポンスを処理中...', 70);

      // レスポンスのContent-Typeをチェック
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        // エラーレスポンスの処理
        let errorMessage = `サーバーエラー: ${response.status}`;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error('エラーレスポンスのパース失敗:', parseError);
          }
        } else {
          // JSONでない場合（例：413エラーでHTMLが返される場合）
          const textResponse = await response.text();
          console.error('非JSONレスポンス:', textResponse);
          
          if (response.status === 413) {
            errorMessage = 'ファイルサイズが大きすぎます。より小さなファイルをお試しください。';
          } else if (response.status === 504) {
            errorMessage = 'リクエストがタイムアウトしました。より小さなファイルをお試しください。';
          } else if (response.status === 502) {
            errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
          }
        }
        
        throw new Error(errorMessage);
      }

      // 成功レスポンスの処理
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('サーバーから無効なレスポンスが返されました。');
      }

      updateProgress('変換結果を処理中...', 90);
      
      const data: ConversionResponse = await response.json();
      
      if (data.success && data.markdown) {
        setResult(data.markdown);
        updateProgress('変換完了！', 100);
      } else {
        throw new Error(data.error || '変換に失敗しました。');
      }

    } catch (fetchError) {
      console.error('変換エラー:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : '不明なエラーが発生しました。');
    } finally {
      setConverting(false);
      setTimeout(() => setProgress({ stage: '', progress: 0 }), 2000);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
      e.dataTransfer.clearData();
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗:', err);
      // フォールバック: テキストエリアを使用
      const textArea = document.createElement('textarea');
      textArea.value = result;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.pdf', '.md') || 'converted.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearResult = () => {
    resetState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            PDF to Markdown Converter
          </h1>
          <p className="text-lg text-gray-600">
            PDFファイルを高品質なMarkdownに変換します
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            } ${converting ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={converting}
            />
            
            <div className="text-gray-600">
              <div className="mb-4">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              
              <p className="text-xl mb-2 font-medium">
                PDFファイルをここにドロップ
              </p>
              <p className="text-gray-500 mb-4">または</p>
              
              <button
                onClick={openFileSelector}
                disabled={converting}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ファイルを選択
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                最大ファイルサイズ: 50MB | 対応形式: PDF
              </p>
            </div>
          </div>

          {converting && (
            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-blue-800 font-medium mb-2">{progress.stage}</p>
                
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
                
                <p className="text-sm text-blue-600">{progress.progress}%</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-8 bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">変換結果</h2>
              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    copySuccess
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copySuccess ? '✓ コピー済み' : 'クリップボードにコピー'}
                </button>
                
                <button
                  onClick={downloadMarkdown}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  ダウンロード
                </button>
                
                <button
                  onClick={clearResult}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  クリア
                </button>
              </div>
            </div>
            
            <div className="border rounded-lg bg-gray-50">
              <div className="border-b bg-gray-100 px-4 py-2 rounded-t-lg">
                <p className="text-sm text-gray-600 font-medium">
                  {fileName} → {fileName.replace('.pdf', '.md')}
                </p>
              </div>
              
              <div className="p-4 max-h-96 overflow-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                  {result}
                </pre>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>ヒント:</strong> 変換されたMarkdownをさらに編集したい場合は、
                お好みのMarkdownエディタにコピーしてご利用ください。
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>© 2024 PDF to Markdown Converter. 高品質な変換をお楽しみください。</p>
        </div>
      </div>
    </div>
  );
}