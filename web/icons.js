// Icon mapping with Pexels images
const ICON_CACHE = {};

const ICON_MAPPING = {
    '🏦': 'bank building',
    '📊': 'chart graph',
    '⚠️': 'warning sign',
    '📈': 'stock market',
    '🔬': 'laboratory science',
    '💾': 'save disk',
    '🔄': 'refresh reload',
    '📥': 'download arrow',
    '🎲': 'dice game',
    '📰': 'newspaper',
    '🎯': 'target bullseye',
    '🔗': 'chain link',
    '✅': 'green checkmark',
    '❌': 'red cross',
    '🟢': 'green circle',
    '🔴': 'red circle',
    '🟡': 'yellow circle'
};

async function fetchPexelsImage(query) {
    if (ICON_CACHE[query]) {
        return ICON_CACHE[query];
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/pexels-icon?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            ICON_CACHE[query] = data.image_url;
            return data.image_url;
        }
    } catch (error) {
        console.error('Icon fetch error:', error);
    }
    
    return null;
}

async function replaceEmojisWithImages() {
    const elements = document.querySelectorAll('*');
    
    for (const element of elements) {
        if (element.children.length === 0) { // Only text nodes
            let text = element.textContent;
            let hasEmoji = false;
            
            for (const [emoji, query] of Object.entries(ICON_MAPPING)) {
                if (text.includes(emoji)) {
                    hasEmoji = true;
                    const imageUrl = await fetchPexelsImage(query);
                    
                    if (imageUrl) {
                        text = text.replace(new RegExp(emoji, 'g'), 
                            `<img src="${imageUrl}" alt="${query}" style="width: 20px; height: 20px; vertical-align: middle; margin: 0 2px;">`
                        );
                    }
                }
            }
            
            if (hasEmoji) {
                element.innerHTML = text;
            }
        }
    }
}

// Initialize icon replacement
document.addEventListener('DOMContentLoaded', replaceEmojisWithImages);