
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface DocumentChunk {
  text: string;
  page: number;
  id: string;
}

export interface ProcessingState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}
