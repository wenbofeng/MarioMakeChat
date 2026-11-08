class MomoAI {
    constructor(runtime) {
        this.runtime = runtime;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = []; 
    }

    connectAI() {
        if (this.isConnected) return;
        
        this.ws = new WebSocket('ws://127.0.0.1:5001/ws_scratch');

        this.ws.onopen = () => {
            console.log("✅ 墨墨 AI 已连接");
            this.isConnected = true;
            
            // 把排队没发出去的消息全发出去
            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                this.ws.send(msg);
            }
        };

        this.ws.onmessage = (event) => {
            const reply = event.data;
            console.log("📩 收到 AI 回复:", reply);
            
            // 使用全局的 Scratch.vm.runtime，保证不报错
            if (window.Scratch && Scratch.vm && Scratch.vm.runtime) {
                const stage = Scratch.vm.runtime.getTargetForStage();
                if (stage) {
                    const varObj = stage.lookupVariableByNameAndType('AI回复内容', '');
                    if (varObj) varObj.value = reply;
                }
                
                Scratch.vm.runtime.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: '收到AI回复'
                });
            }
        };

        this.ws.onclose = () => {
            console.log("❌ 墨墨 AI 断开连接");
            this.isConnected = false;
        };
    }

    askAI(question) {
        if (!this.isConnected) {
            this.connectAI(); 
            this.messageQueue.push(question);
            return;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(question);
        }
    }

    getInfo() {
        return {
            id: 'momoAI',
            name: '墨墨 AI',
            blocks: [
                {
                    opcode: 'connect',
                    blockType: Scratch.BlockType.COMMAND,
                    text: '连接墨墨 AI 服务器'
                },
                {
                    opcode: 'ask',
                    blockType: Scratch.BlockType.COMMAND,
                    text: '向墨墨提问 [QUESTION]',
                    arguments: {
                        QUESTION: { type: Scratch.ArgumentType.STRING, defaultValue: '你好' }
                    }
                }
            ]
        };
    }

    connect() { this.connectAI(); }
    ask(args) { this.askAI(args.QUESTION); }
}

Scratch.extensions.register(new MomoAI());