// simple-text-processor.js
class SimpleTextProcessor {
    constructor() {
        this.expressionsData = null;

        // マークアップ記号のマッピング
        this.markupMap = {
            '||': '!SP:',    // Spoiler
            '```': '!CB:',   // Code block
            '`': '!CO:',     // Code inline
            '**': '!BO:',    // Bold
            '__': '!IT:',    // Italic
            '*': '!EM:',     // Emphasis
            '>': '!QT:',     // Quote
            '![': '!IMG:',   // Image
            '[': '!LNK:',    // Link
            '📎[': '!ATT:'   // Attachment
        };

        // 逆マッピング
        this.reverseMarkupMap = {
            '!SP:': '||',
            '!CB:': '```',
            '!CO:': '`',
            '!BO:': '**',
            '!IT:': '__',
            '!EM:': '*',
            '!QT:': '>',
            '!IMG:': '![',
            '!LNK:': '[',
            '!ATT:': '📎['
        };
    }

    // URLセーフエンコーディング（日本語文字をそのまま保持）
    encodeURLSafe(str) {
        return str.split('').map(char => {
            if (/[A-Za-z0-9\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char)) {
                return char;
            }
            if (char === ' ') return '+';
            if ([',', ':', ';', '.'].includes(char)) return char;
            try {
                return encodeURIComponent(char);
            } catch (e) {
                console.warn('エンコードできない文字を検出:', char);
                return char;
            }
        }).join('');
    }

    // URLセーフデコーディング（日本語文字対応）
    decodeURLSafe(str) {
        try {
            return decodeURIComponent(str);
        } catch (e) {
            console.error('デコードエラー:', e);
            return str;
        }
    }

    // Base64エンコーディング
    encodeBase64URL(str) {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // Base64デコーディング
    decodeBase64URL(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
            str += '=';
        }
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            throw new Error('不正なエンコーディングです');
        }
    }

    // メタデータ生成
    createMetadata(user = '0', feel = '0', action = '0', ending = '0') {
        return { user, feel, action, ending };
    }

    // リッチテキスト記号を置換
    escapeMarkupSymbols(text) {
        if (!this.containsMarkupSymbols(text)) {
            return { text, hasMarkup: false };
        }
        let result = text;
        const patterns = [
            { regex: /!\[(.*?)\]\((https?:\/\/[^\s]+)\)/g, start: '![', end: '' },
            { regex: /\[(.*?)\]\((https?:\/\/[^\s]+)\)/g, start: '[', end: '' },
            { regex: /📎\s*\[(.*?)\]\(([^\s]+)\)/g, start: '📎[', end: '' },
            { regex: /\|\|(.*?)\|\|/g, start: '||', end: '||' },
            { regex: /```([\s\S]*?)```/g, start: '```', end: '```' },
            { regex: /`([^`]+)`/g, start: '`', end: '`' },
            { regex: /\*\*(.*?)\*\*/g, start: '**', end: '**' },
            { regex: /\__(.*?)\__/g, start: '__', end: '__' },
            { regex: /\*([^\*]+)\*/g, start: '*', end: '*' },
            { regex: /^>\s*(.*?)$/gm, start: '>', end: '' }
        ];
        for (const pattern of patterns) {
            result = result.replace(pattern.regex, (match, content, url) => {
                const startEsc = this.markupMap[pattern.start] || pattern.start;
                const endEsc = pattern.end ? (this.markupMap[pattern.end] || pattern.end) : '';
                if (pattern.start === '![' || pattern.start === '[' || pattern.start === '📎[') {
                    return `${startEsc}${content}][${url}${endEsc}`;
                }
                return startEsc + content + endEsc;
            });
        }
        return { text: result, hasMarkup: true };
    }

    // 置換された記号を元に戻す
    unescapeMarkupSymbols(text) {
        let result = text;
        result = result.replace(/!IMG:(.*?)\]\[(https?:\/\/[^\s]+)/g, '![$1]($2)');
        result = result.replace(/!LNK:(.*?)\]\[(https?:\/\/[^\s]+)/g, '[$1]($2)');
        result = result.replace(/!ATT:(.*?)\]\[([^\s]+)/g, '📎 [$1]($2)');
        Object.entries(this.reverseMarkupMap).forEach(([escaped, original]) => {
            if (['!IMG:', '!LNK:', '!ATT:'].includes(escaped)) return;
            const regex = new RegExp(escaped, 'g');
            result = result.replace(regex, original);
        });
        return result;
    }

    // マークアップ記号の有無を確認
    containsMarkupSymbols(text) {
        const patterns = [
            /!\[.*?\]\(https?:\/\/[^\s]+\)/,
            /\[.*?\]\(https?:\/\/[^\s]+\)/,
            /📎\s*\[.*?\]\([^\s]+\)/,
            /\|\|.*?\|\|/,
            /```[\s\S]*?```/,
            /`[^`]+`/,
            /\*\*.*?\*\*/,
            /\__.*?\__/,
            /\*[^\*]+\*/,
            /^>\s*.*$/m
        ];
        return patterns.some(pattern => pattern.test(text));
    }

    // 共有URL生成
    createShareableURL(text, metadata, useBase64 = true, title = '') {
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
        // !!! Markdownソースをそのままエンコードするため、escapeMarkupSymbols は呼び出さない !!!
        const processedText = text;
        const processedTitle = title;

        const encodedText = useBase64 ? this.encodeBase64URL(processedText) : this.encodeURLSafe(processedText);
        const encodedTitle = title ?
            (useBase64 ? this.encodeBase64URL(processedTitle) : this.encodeURLSafe(processedTitle)) : '';

        const metaString = `${metadata.user}|${metadata.feel}|${metadata.action}|${metadata.ending}`;
        const encodingFlag = useBase64 ? 'b' : 'u';
        // m1フラグは、表示側でMarkdownパーサーを使うかどうかのヒントには使えるかもしれない
        const hasMarkup = this.containsMarkupSymbols(text) || (title && this.containsMarkupSymbols(title));
        const markupFlag = hasMarkup ? 'm1' : 'm0';
        const titleParam = encodedTitle ? `&t=${encodedTitle}` : '';

        // view.html は、URLを受け取って表示するページの想定
        return `${baseUrl}view.html#${encodingFlag}=${encodedText}${titleParam}&${markupFlag}&m=${metaString}`;
    }

    // URL解析
    parseShareableURL(hash) {
        if (!hash || hash.length < 2) return null;
        try {
            const parts = hash.slice(1).split('&');
            let textPart = '';
            let titlePart = '';
            let metadataPart = '';
            let isBase64 = false;
            let hasMarkupFlag = false;

            for (const part of parts) {
                if (part.startsWith('b=')) {
                    textPart = this.decodeBase64URL(part.substring(2));
                    isBase64 = true;
                } else if (part.startsWith('u=')) {
                    textPart = this.decodeURLSafe(part.substring(2));
                } else if (part.startsWith('t=')) {
                    // デコード方法は textPart と合わせる
                    titlePart = isBase64 ? this.decodeBase64URL(part.substring(2)) : this.decodeURLSafe(part.substring(2));
                } else if (part.startsWith('m=')) {
                    metadataPart = part.substring(2);
                } else if (part === 'm1') {
                    hasMarkupFlag = true;
                }
            }

            if (!textPart && !titlePart) return null;

            // !!! デコードされたテキストはMarkdownソースなので、unescapeMarkupSymbols は呼び出さない !!!
            const parsedText = textPart;
            const parsedTitle = titlePart;

            const metadataParts = metadataPart.split('|');
            const users = this.expressionsData ? this.expressionsData.users : {'0': ''};
            const feels = this.expressionsData ? this.expressionsData.feels : {'0': ''};
            const actions = this.expressionsData ? this.expressionsData.actions : {'0': ''};
            const endings = this.expressionsData ? this.expressionsData.endings : {'0': ''};

            return {
                text: parsedText, // Markdownソースを返す
                title: parsedTitle, // Markdownソースを返す
                metadata: {
                    user: metadataParts[0] && users[metadataParts[0]] ? users[metadataParts[0]] : '',
                    feel: metadataParts[1] && feels[metadataParts[1]] ? feels[metadataParts[1]] : '',
                    action: metadataParts[2] && actions[metadataParts[2]] ? actions[metadataParts[2]] : '',
                    ending: metadataParts[3] && endings[metadataParts[3]] ? endings[metadataParts[3]] : ''
                },
                hasMarkup: hasMarkupFlag // Markdownが含まれる可能性を示すフラグ
            };
        } catch (error) {
            console.error('URLの解析に失敗:', error);
            // エラー時はnullを返すか、エラーオブジェクトを再スローする
            return null; // または throw new Error('URLの解析に失敗しました');
        }
    }

    // プレビュー用テキスト処理
    processTextForPreview(inputText) {
        return inputText; // 自動埋め込みは formatToHTML で対応
    }

    // フォーマット適用
    applyFormat(text, format, start, end) {
        const selectedText = text.substring(start, end);
        const isAlreadyFormatted = this.checkIfAlreadyFormatted(selectedText, format);
        let formattedText = '';

        if (isAlreadyFormatted) {
            formattedText = this.removeFormat(selectedText, format);
        } else {
            switch (format) {
                case 'bold': formattedText = `**${selectedText}**`; break;
                case 'italic': formattedText = `*${selectedText}*`; break;
                case 'spoiler': formattedText = `||${selectedText}||`; break;
                case 'code': formattedText = `\`${selectedText}\``; break;
                case 'codeblock': formattedText = `\`\`\`\n${selectedText}\n\`\`\``; break;
                case 'quote':
                    const lines = selectedText.split('\n');
                    formattedText = lines.map(line => `> ${line}`).join('\n');
                    break;
                case 'link': formattedText = `[${selectedText}](URL)`; break;
                case 'image': formattedText = `![${selectedText}](画像URL)`; break;
                case 'file': formattedText = `📎 [${selectedText}](ファイルURL)`; break;
            }
        }
        return {
            text: text.substring(0, start) + formattedText + text.substring(end),
            newStart: start,
            newEnd: start + formattedText.length
        };
    }

    // フォーマット適用済みチェック
    checkIfAlreadyFormatted(text, format) {
        switch (format) {
            case 'bold': return text.startsWith('**') && text.endsWith('**');
            case 'italic': return (text.startsWith('*') && text.endsWith('*') && !text.startsWith('**')) ||
                (text.startsWith('_') && text.endsWith('_'));
            case 'spoiler': return text.startsWith('||') && text.endsWith('||');
            case 'code': return text.startsWith('`') && text.endsWith('`') && !text.startsWith('```');
            case 'codeblock': return text.startsWith('```') && text.endsWith('```');
            case 'quote': return text.split('\n').every(line => line.trim().startsWith('>'));
            case 'link': return /\[.*\]\(.*\)/.test(text) && !text.startsWith('!');
            case 'image': return /!\[.*\]\(.*\)/.test(text);
            case 'file': return /📎\s*\[.*\]\(.*\)/.test(text);
            default: return false;
        }
    }

    // フォーマット削除
    removeFormat(text, format) {
        switch (format) {
            case 'bold': return text.slice(2, -2);
            case 'italic':
                if (text.startsWith('*') && text.endsWith('*')) return text.slice(1, -1);
                if (text.startsWith('_') && text.endsWith('_')) return text.slice(1, -1);
                return text;
            case 'spoiler': return text.slice(2, -2);
            case 'code': return text.slice(1, -1);
            case 'codeblock':
                if (text.startsWith('```\n') && text.endsWith('\n```')) return text.slice(4, -4);
                return text.slice(3, -3);
            case 'quote': return text.split('\n').map(line => line.replace(/^>\s*/, '')).join('\n');
            case 'link':
                const linkMatch = text.match(/\[(.*?)\]\((.*?)\)/);
                return linkMatch ? linkMatch[1] : text;
            case 'image':
                const imageMatch = text.match(/!\[(.*?)\]\((.*?)\)/);
                return imageMatch ? imageMatch[1] : text;
            case 'file':
                const fileMatch = text.match(/📎\s*\[(.*?)\]\((.*?)\)/);
                return fileMatch ? fileMatch[1] : text;
            default: return text;
        }
    }

    // クリップボードテキスト処理
    processClipboardText(clipboardText) {
        return clipboardText.trim();
    }

    // URL生成とクリップボードコピー
    async generateShareURL(text, metadata, useBase64, title = '') {
        if (!text.trim()) throw new Error('テキストを入力してください。');
        const url = this.createShareableURL(text, metadata, useBase64, title);
        try {
            await navigator.clipboard.writeText(url);
            return { url, message: '共有URLをクリップボードにコピーしました！' };
        } catch (err) {
            throw new Error('URLのコピーに失敗しました: ' + url);
        }
    }

    // URL長さ比較
    getURLLengthComparison(text, metadata, title = '') {
        if (!text.trim()) return '';
        const utf8Url = this.createShareableURL(text, metadata, false, title);
        const base64Url = this.createShareableURL(text, metadata, true, title);
        const utf8Length = utf8Url.length;
        const base64Length = base64Url.length;
        const diff = base64Length - utf8Length;
        const percent = ((base64Length / utf8Length) * 100 - 100).toFixed(0);
        return `URL長さ比較: 日本語そのまま ${utf8Length}文字 vs Base64 ${base64Length}文字 (${diff > 0 ? '+' : ''}${diff}文字, ${percent}% ${diff > 0 ? '長い' : '短い'})`;
    }

    // プレビュー用テキスト生成
    formatPreview(text, metadata, title = '') {
        if (!this.expressionsData) return text;
        let result = text;
        if (title && title.trim()) {
            result = `【${title}】\n\n${result}`;
        }
        if (!metadata) return result;
        if (metadata.user === '0' && metadata.feel === '0' && metadata.action === '0' && metadata.ending === '0') {
            return result;
        }
        let parts = [];
        if (metadata.user !== '0') parts.push(this.expressionsData.users[metadata.user]);
        if (metadata.feel !== '0') parts.push(this.expressionsData.feels[metadata.feel]);
        if (metadata.action !== '0') parts.push(this.expressionsData.actions[metadata.action]);
        const ending = metadata.ending !== '0' ? this.expressionsData.endings[metadata.ending] : '';
        if (parts.length > 0) {
            return `${result}\n\nと、${parts.join('')}${ending}`;
        } else if (ending) {
            return `${result}${ending}`;
        }
        return result;
    }

    // expressions.jsonから式データを非同期でロード
    async loadExpressions() {
        try {
            const response = await fetch('./expressions.json');
            this.expressionsData = await response.json();
            return this.expressionsData;
        } catch (error) {
            console.error('式データの読み込みに失敗:', error);
            return {
                users: { '0': ' ' },
                feels: { '0': ' ' },
                actions: { '0': ' ' },
                endings: { '0': ' ', '1': '。' }
            };
        }
    }
}

export default SimpleTextProcessor;
