
import React, { useState, useRef, useEffect } from 'react';
import { extractTextFromPdf, chunkText } from './services/pdfService.ts';
import { findRelevantChunks } from './services/vectorService.ts';
import { generateRAGResponse } from './services/geminiService.ts';
import { Message, MessageRole, DocumentChunk, ProcessingState } from './types.ts';
import { Upload, Send, Bot, User, Loader2, FileText, Globe, Trash2, ShieldCheck, Info } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [docChunks, setDocChunks] = useState<DocumentChunk[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle', message: '' });
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a valid PDF file.");
      return;
    }

    setFileName(file.name);
    setProcessingState({ status: 'loading', message: 'Extracting text from PDF...' });

    try {
      const pages = await extractTextFromPdf(file);
      setProcessingState({ status: 'loading', message: 'Creating multilingual chunks...' });
      const chunks = chunkText(pages);
      setDocChunks(chunks);
      setProcessingState({ status: 'success', message: `Indexed ${chunks.length} segments from ${pages.length} pages.` });
    } catch (error) {
      console.error(error);
      setProcessingState({ status: 'error', message: 'Failed to process PDF. Please try a different file.' });
    }
  };

  const clearChat = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: MessageRole.USER,
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const relevantChunks = findRelevantChunks(input, docChunks);
      const aiResponseContent = await generateRAGResponse(input, relevantChunks, messages);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: MessageRole.ASSISTANT,
        content: aiResponseContent,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: MessageRole.ASSISTANT,
        content: "Error: Could not retrieve a response. Please check your API configuration or connection.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">PolyGlot RAG</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Multi-lingual AI Document Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100 text-sm font-semibold"
          >
            <Upload className="w-4 h-4" />
            {fileName ? 'Change PDF' : 'Upload PDF'}
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear Chat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {processingState.status !== 'idle' && (
          <div className={`px-6 py-2 flex items-center gap-3 text-sm font-medium border-b ${
            processingState.status === 'loading' ? 'bg-blue-50 text-blue-700 border-blue-100' :
            processingState.status === 'success' ? 'bg-green-50 text-green-700 border-green-100' :
            'bg-red-50 text-red-700 border-red-100'
          }`}>
            {processingState.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
             processingState.status === 'success' ? <ShieldCheck className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {processingState.message}
            {fileName && <span className="ml-auto font-mono text-xs opacity-70">{fileName}</span>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="bg-gray-100 p-4 rounded-full">
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Chat with your PDF</h2>
              <p className="text-gray-500">
                Upload a document to start a conversation. PolyGlot RAG supports any language and cites its sources using Gemini 3 Pro reasoning.
              </p>
              {!fileName && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
                >
                  Upload PDF to Begin
                </button>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-4 max-w-[85%] ${msg.role === MessageRole.USER ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                    msg.role === MessageRole.USER ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-indigo-600'
                  }`}>
                    {msg.role === MessageRole.USER ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                  </div>
                  <div className={`p-4 rounded-2xl shadow-sm leading-relaxed ${
                    msg.role === MessageRole.USER 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</div>
                    <div className={`mt-2 text-[10px] opacity-50 font-medium ${msg.role === MessageRole.USER ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="flex gap-4 max-w-[85%]">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-indigo-600 shadow-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">Assistant is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-gray-200">
          <form 
            onSubmit={handleSendMessage}
            className="max-w-4xl mx-auto relative flex items-center"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={docChunks.length > 0 ? "Ask a question about the document..." : "First, upload a PDF to chat"}
              disabled={docChunks.length === 0 || isProcessing}
              className="w-full pl-6 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 text-gray-800"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing || docChunks.length === 0}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-300 shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center mt-3 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Grounding provided by Gemini 3 Pro
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;
