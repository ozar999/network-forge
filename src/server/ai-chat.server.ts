const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export async function streamAIChat(messages: { role: string; content: string }[]) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: `You are NETSEM AI, an expert networking assistant. You help users with:
- Network design and topology planning
- Cisco IOS configuration and troubleshooting
- Subnetting, VLSM, and IP addressing
- Routing protocols (OSPF, EIGRP, BGP, RIP)
- Switching concepts (VLANs, STP, EtherChannel)
- Network security (ACLs, firewalls, VPNs)
- Troubleshooting methodology

Format responses with markdown. Use code blocks for CLI commands. Be concise and practical.`,
        },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (status === 402) throw new Error('Credits exhausted. Please add funds in Settings > Workspace > Usage.');
    throw new Error(`AI gateway error: ${status}`);
  }

  return response;
}