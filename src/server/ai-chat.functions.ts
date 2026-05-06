import { createServerFn } from '@tanstack/react-start';
import { streamAIChat } from './ai-chat.server';
import { z } from 'zod';

export const chatWithAI = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: unknown) => z.object({
      messages: z.array(z.object({ role: z.string(), content: z.string() })),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const response = await streamAIChat(data.messages as { role: string; content: string }[]);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
    let textBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullText += content;
        } catch {}
      }
    }

    return { content: fullText };
  });