import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if user is authenticated
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const manifestoPageId = process.env.NOTION_MANIFESTO_PAGE_ID;

  if (!notionToken) {
    return res.status(500).json({ error: 'Notion token not configured' });
  }

  if (!manifestoPageId) {
    return res.status(500).json({ error: 'Manifesto page ID not configured' });
  }

  try {
    // First, get the page properties (for the title)
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${manifestoPageId}`, {
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    if (!pageResponse.ok) {
      const errorData = await pageResponse.text();
      console.error('Notion API error (page):', pageResponse.status, errorData);
      return res.status(pageResponse.status).json({ 
        error: 'Failed to fetch manifesto page from Notion',
        details: errorData 
      });
    }

    // Then, get the page content (blocks)
    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${manifestoPageId}/children`, {
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    if (!blocksResponse.ok) {
      const errorData = await blocksResponse.text();
      console.error('Notion API error (blocks):', blocksResponse.status, errorData);
      return res.status(blocksResponse.status).json({ 
        error: 'Failed to fetch manifesto content from Notion',
        details: errorData 
      });
    }

    const pageData = await pageResponse.json();
    const blocksData = await blocksResponse.json();
    
    // Get page title
    const pageTitle = pageData.properties?.title?.title?.[0]?.text?.content || 'Reboot Manifesto';
    
    // Transform blocks into HTML content and extract navigation
    const { content, navigation } = await transformNotionBlocksToHTML(blocksData.results);

    res.status(200).json({ 
      title: pageTitle,
      content: content,
      navigation: navigation,
      lastEdited: pageData.last_edited_time
    });
  } catch (error) {
    console.error('Error fetching manifesto:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to convert Notion blocks to HTML
async function transformNotionBlocksToHTML(blocks) {
  let html = '';
  let navigation = [];
  
  for (const block of blocks) {
    switch (block.type) {
      case 'heading_1':
        const h1Text = transformRichText(block.heading_1.rich_text);
        const h1Id = h1Text.replace(/<[^>]*>/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        navigation.push({ id: h1Id, title: h1Text.replace(/<[^>]*>/g, ''), level: 1 });
        html += `<h1 id="${h1Id}" class="scroll-mt-20 text-3xl font-bold text-gray-900 mb-6 mt-10 animate-fade-in border-l-3 border-orange-400 pl-4">${h1Text}</h1>`;
        break;
      case 'heading_2':
        const h2Text = transformRichText(block.heading_2.rich_text);
        const h2Id = h2Text.replace(/<[^>]*>/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        navigation.push({ id: h2Id, title: h2Text.replace(/<[^>]*>/g, ''), level: 2 });
        html += `<h2 id="${h2Id}" class="scroll-mt-20 text-2xl font-semibold text-gray-800 mb-5 mt-8 animate-fade-in border-l-2 border-orange-300 pl-3">${h2Text}</h2>`;
        break;
      case 'heading_3':
        const h3Text = transformRichText(block.heading_3.rich_text);
        const h3Id = h3Text.replace(/<[^>]*>/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        navigation.push({ id: h3Id, title: h3Text.replace(/<[^>]*>/g, ''), level: 3 });
        html += `<h3 id="${h3Id}" class="scroll-mt-20 text-xl font-medium text-orange-600 mb-4 mt-6 animate-fade-in">${h3Text}</h3>`;
        break;
      case 'paragraph':
        const paragraphText = transformRichText(block.paragraph.rich_text);
        if (paragraphText.trim()) {
          html += `<p class="text-gray-700 leading-relaxed mb-5 animate-fade-in">${paragraphText}</p>`;
        } else {
          html += '<div class="mb-4"></div>'; // Empty paragraph = spacing
        }
        break;
      case 'bulleted_list_item':
        html += `<li class="text-gray-700 mb-2 leading-relaxed animate-fade-in before:content-['•'] before:text-orange-400 before:mr-3">${transformRichText(block.bulleted_list_item.rich_text)}</li>`;
        break;
      case 'numbered_list_item':
        html += `<li class="text-gray-700 mb-2 leading-relaxed animate-fade-in">${transformRichText(block.numbered_list_item.rich_text)}</li>`;
        break;
      case 'quote':
        html += `<blockquote class="border-l-3 border-orange-300 pl-6 py-4 my-6 bg-orange-50 rounded-r-lg animate-fade-in">
                   <p class="text-gray-800 italic text-lg leading-relaxed">"${transformRichText(block.quote.rich_text)}"</p>
                 </blockquote>`;
        break;
      case 'callout':
        const emoji = block.callout.icon?.emoji || '💡';
        html += `<div class="bg-orange-50 border border-orange-200 rounded-lg p-5 my-6 animate-fade-in">
                   <div class="flex items-start gap-3">
                     <span class="text-2xl">${emoji}</span>
                     <div class="text-orange-800 leading-relaxed">${transformRichText(block.callout.rich_text)}</div>
                   </div>
                 </div>`;
        break;
      case 'divider':
        html += '<hr class="border-gray-300 my-8 animate-fade-in" />';
        break;
      default:
        // Handle any other block types as paragraph
        if (block[block.type]?.rich_text) {
          html += `<p class="text-gray-700 leading-relaxed mb-4">${transformRichText(block[block.type].rich_text)}</p>`;
        }
        break;
    }
  }
  
  return { content: html, navigation };
}

// Helper function to transform rich text with formatting
function transformRichText(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  
  return richTextArray.map(textBlock => {
    let text = textBlock.text?.content || '';
    const annotations = textBlock.annotations;
    
    if (annotations?.code) {
      text = `<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">${text}</code>`;
    } else {
      if (annotations?.bold) text = `<strong>${text}</strong>`;
      if (annotations?.italic) text = `<em>${text}</em>`;
      if (annotations?.underline) text = `<u>${text}</u>`;
      if (annotations?.strikethrough) text = `<del>${text}</del>`;
    }
    
    // Handle links
    if (textBlock.text?.link) {
      text = `<a href="${textBlock.text.link.url}" class="text-green-600 hover:text-green-800 underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    
    return text;
  }).join('');
}