import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ChatInput = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
});

const SYSTEM_PROMPT = `You are NETSEM AI, an expert networking assistant. You help users with:
- Network design and topology planning
- Cisco IOS configuration and troubleshooting
- Subnetting, VLSM, and IP addressing
- Routing protocols (OSPF, EIGRP, BGP, RIP)
- Switching concepts (VLANs, STP, EtherChannel)
- Network security (ACLs, firewalls, VPNs)
- Troubleshooting methodology

Format responses with markdown. Use code blocks for CLI commands. Be concise and practical.`;

export const chatWithAI = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      messages: data.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return { content: text };
  });
