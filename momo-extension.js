(function(Scratch) {
    'use strict';
    class MoMoExtension {
        getInfo() {
            return {
                id: 'momoai',
                name: 'MoMo AI',
                color1: '#4a6cf7',
                blocks: [{
                    opcode: 'askMoMo',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'Ask MoMo [PROMPT]',
                    arguments: {
                        PROMPT: { type: Scratch.ArgumentType.STRING, defaultValue: 'Hello' }
                    }
                }]
            };
        }
        async askMoMo(args) {
            try {
                const response = await fetch('http://127.0.0.1:5001/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-local' },
                    body: JSON.stringify({
                        model: '3B Q4_K_M',
                        messages: [{ role: 'user', content: args.PROMPT }],
                        stream: false
                    })
                });
                const data = await response.json();
                let reply = data.choices[0].message.content;
                reply = reply.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
                reply = reply.replace(/<check>[\s\S]*?<\/check>/g, '');
                reply = reply.replace(/<answer>([\s\S]*?)<\/answer>/g, '$1');
                return reply.trim();
            } catch (error) {
                return 'Cannot connect to MoMo';
            }
        }
    }
    Scratch.extensions.register(new MoMoExtension());
})(Scratch);
