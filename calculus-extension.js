class CalculusExtension {
    getInfo() {
        return {
            id: 'calculus',
            name: '微积分 (Calculus)',
            color1: '#3b82f6',
            blocks: [
                {
                    opcode: 'deriveSymbolic',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '求导 [expr]',
                    arguments: {
                        expr: { type: Scratch.ArgumentType.STRING, defaultValue: 'x^2' }
                    }
                },
                {
                    opcode: 'integrateSymbolic',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '积分 [expr]',
                    arguments: {
                        expr: { type: Scratch.ArgumentType.STRING, defaultValue: 'x^2' }
                    }
                },
                {
                    opcode: 'limit',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '当 x 趋近于 [a] 时，[expr] 的极限',
                    arguments: {
                        a: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
                        expr: { type: Scratch.ArgumentType.STRING, defaultValue: 'sin(x)/x' }
                    }
                }
            ]
        };
    }

    // 🌟 1. 符号求导（迷你版）
    deriveSymbolic(args) {
        let expr = args.expr.replace(/\s+/g, ''); // 去空格
        
        // 规则 1：常数求导为 0 (如果是纯数字)
        if (!isNaN(expr)) return "0";
        
        // 规则 2：x 求导为 1
        if (expr === 'x') return "1";

        // 规则 3：幂函数 x^n 求导为 n*x^(n-1)
        let powerMatch = expr.match(/^x\^(\d+)$/);
        if (powerMatch) {
            let n = parseInt(powerMatch[1]);
            if (n === 1) return "1";
            return `${n}*x^${n - 1}`;
        }

        // 规则 4：三角函数与指数函数
        if (expr === 'sin(x)') return "cos(x)";
        if (expr === 'cos(x)') return "-sin(x)";
        if (expr === 'e^x') return "e^x";

        // 规则 5：多项式加法 (简单拆分)
        if (expr.includes('+')) {
            let parts = expr.split('+');
            return parts.map(p => this.deriveSymbolic({expr: p})).join(' + ');
        }

        return "暂不支持该表达式";
    }

    // 🌟 2. 符号积分（迷你版）
    integrateSymbolic(args) {
        let expr = args.expr.replace(/\s+/g, '');
        
        // 规则 1：常数 a 积分为 a*x
        if (!isNaN(expr)) return `${expr}*x + C`;

        // 规则 2：x 积分为 x^2/2
        if (expr === 'x') return "x^2 / 2 + C";

        // 规则 3：幂函数 x^n 积分为 x^(n+1) / (n+1)
        let powerMatch = expr.match(/^x\^(\d+)$/);
        if (powerMatch) {
            let n = parseInt(powerMatch[1]);
            return `x^${n + 1} / ${n + 1} + C`;
        }

        // 规则 4：三角函数
        if (expr === 'cos(x)') return "sin(x) + C";
        if (expr === 'sin(x)') return "-cos(x) + C";
        if (expr === 'e^x') return "e^x + C";

        return "暂不支持该表达式";
    }

    // 🌟 3. 极限计算（采用数值逼近法计算趋近值）
    limit(args) {
        let a = Number(args.a);
        let expr = args.expr.replace(/\s+/g, '');

        // 我们把字符串表达式变成实际的 JS 代码来算数值
        // 注意：为了安全，这里只允许极简单的替换
        let jsExpr = expr.replace(/\^/g, '**')
                         .replace(/sin/g, 'Math.sin')
                         .replace(/cos/g, 'Math.cos')
                         .replace(/e\*\*x/g, 'Math.exp(x)');

        try {
            // 左边逼近 (a - 极小值)
            let h = 0.000001;
            let leftExpr = jsExpr.replace(/x/g, `(${a - h})`);
            let leftVal = eval(leftExpr);

            // 右边逼近 (a + 极小值)
            let rightExpr = jsExpr.replace(/x/g, `(${a + h})`);
            let rightVal = eval(rightExpr);

            // 如果左右逼近的值非常接近，那就说明极限存在
            if (Math.abs(leftVal - rightVal) < 0.001) {
                return Math.round((leftVal + rightVal) / 2 * 10000) / 10000; // 保留4位小数
            } else {
                return "不存在 (左右极限不相等)";
            }
        } catch(e) {
            return "表达式错误";
        }
    }
}
Scratch.extensions.register(new CalculusExtension());