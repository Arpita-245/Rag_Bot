import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 4000;

app.get('/', (req, res) => res.json({ ok: true }));

app.post('/api/query', async (req, res) => {
  try {
    const { query, context = [], history = [] } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    // Build system instruction + context text
    const contextText = (context || []).map(c => `[Page ${c.page}]: ${c.text}`).join('\n\n');
    const systemInstruction = `You are an intelligent assistant called PolyGlot RAG. Use the context provided below to answer the user's question accurately.\nCONSTRAINTS: 1. STRICTLY answer based ONLY on the provided context. 2. If the user asks in a specific language, answer in that language. 3. If the answer is not in the context, explicitly state: "I do not have enough information to answer this based on the provided documents." 4. Do not make up facts. 5. Cite page numbers.\nCONTEXT:\n${contextText}`;

    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_APIKEY;
    if (!apiKey) {
      // No API key: return a synthesized fallback from the provided chunks
      if (!context || context.length === 0) {
        return res.json({ answer: "I do not have enough information to answer this based on the provided documents." });
      }
      const sample = context.slice(0, 3).map(c => `Page ${c.page}: ${c.text.slice(0, 800)}`).join('\n\n');
      const pages = Array.from(new Set(context.map(c => c.page))).join(', ');
      return res.json({ answer: `Based on the document (pages ${pages}):\n\n${sample}\n\n(Answer synthesized from indexed document segments.)` });
    }

    // Perform Gemini API call
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const chatHistory = (history || []).slice(-6).map((msg) => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        ...chatHistory,
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return res.json({ answer: response.text || "I'm sorry, I couldn't generate a response." });
  } catch (err) {
    console.error('API error', err);
    return res.status(500).json({ error: 'Could not retrieve a response. Please try again.' });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://127.0.0.1:${PORT}`));
