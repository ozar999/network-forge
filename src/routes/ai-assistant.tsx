import { createFileRoute } from '@tanstack/react-router';
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatWithAI } from '../server/ai-chat.functions';

export const Route = createFileRoute('/ai-assistant')({
  head: () => ({
    meta: [
      { title: 'AI Network Assistant — NETSEM' },
      { name: 'description', content: 'AI-powered networking assistant for configuration help and troubleshooting' },
    ],
  }),
  component: AIAssistantPage,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

function AIAssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('netsem-ai-conversations') || '[]');
    } catch { return []; }
  });
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const messages = activeConv?.messages || [];

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages.length]);

  useEffect(() => {
    localStorage.setItem('netsem-ai-conversations', JSON.stringify(conversations));
  }, [conversations]);

  const startNewConversation = () => {
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      timestamp: Date.now(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setError(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    setError(null);

    let convId = activeConvId;
    if (!convId) {
      const conv: Conversation = {
        id: `conv-${Date.now()}`,
        title: input.trim().slice(0, 50),
        messages: [],
        timestamp: Date.now(),
      };
      setConversations(prev => [conv, ...prev]);
      convId = conv.id;
      setActiveConvId(conv.id);
    }

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...(conversations.find(c => c.id === convId)?.messages || []), userMsg];

    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, messages: updatedMessages, title: c.messages.length === 0 ? input.trim().slice(0, 50) : c.title }
        : c
    ));
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatWithAI({
        data: { messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) },
      });

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.content };
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, messages: [...updatedMessages, assistantMsg] } : c
      ));
    } catch (e: any) {
      setError(e.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col">
        <div className="p-3 border-b border-border">
          <button
            onClick={startNewConversation}
            className="w-full px-3 py-2 text-xs rounded border border-terminal text-terminal hover:bg-terminal/10 transition-colors font-display"
          >
            + NEW CHAT
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-border/50 transition-colors group ${
                activeConvId === conv.id ? 'bg-terminal/10 text-terminal' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              onClick={() => { setActiveConvId(conv.id); setError(null); }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{conv.title}</p>
                <p className="text-[9px] opacity-50">{new Date(conv.timestamp).toLocaleDateString()}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                className="text-[10px] text-noc-red opacity-0 group-hover:opacity-100 ml-2"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !activeConvId && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-display text-terminal text-glow mb-2">NETSEM AI</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Your networking assistant. Ask about subnetting, Cisco IOS commands, routing protocols, troubleshooting, and more.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'How do I configure OSPF on a router?',
                    'Explain VLSM subnetting',
                    'What is STP and how does it work?',
                    'Troubleshoot: PC can\'t reach gateway',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-left p-3 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-terminal/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-terminal/10 border border-terminal/20 text-foreground'
                  : 'bg-secondary border border-border text-foreground'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none text-xs [&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded [&_code]:text-terminal [&_h1]:text-terminal [&_h2]:text-terminal [&_h3]:text-terminal [&_strong]:text-terminal-bright">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                  <span className="ml-2">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <div className="bg-noc-red/10 border border-noc-red/30 rounded-lg px-4 py-2 text-xs text-noc-red">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about networking, Cisco IOS, subnetting..."
              className="flex-1 bg-input border border-border rounded-lg px-4 py-3 text-xs text-foreground outline-none focus:border-terminal resize-none min-h-[44px] max-h-32 font-mono"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 rounded-lg bg-terminal text-primary-foreground text-xs font-display disabled:opacity-50 hover:shadow-[0_0_12px_var(--terminal)] transition-all"
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}