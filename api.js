// Standalone API handler for Drug Craft
// This provides a fallback when not running in Next.js environment

// Simulated API endpoint that handles combination requests
self.addEventListener('fetch', event => {
  // Only handle POST requests to the API endpoint
  if (event.request.method === 'POST' && event.request.url.endsWith('/api.js')) {
    event.respondWith(handleApiRequest(event.request));
  }
});

// Handle the API request
async function handleApiRequest(request) {
  try {
    // Parse the request body
    const data = await request.json();
    const { element1, element2 } = data;
    
    // Log the request
    console.log('API Request:', { element1, element2 });
    
    // Generate a combination
    const result = generateFallbackResponse(element1, element2);
    
    // Return the result
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('API Error:', error);
    
    // Return an error response
    return new Response(JSON.stringify({ error: 'Failed to generate combination' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

// Fallback function for generating combinations
function generateFallbackResponse(element1, element2) {
  // Simple hardcoded fallbacks based on element combinations
  const basicCombinations = {
    'plant+plant': { id: 'weed', name: 'Weed', icon: '🥬', category: 'natural' },
    'plant+chemical': { id: 'cocaine', name: 'Cocaine', icon: '❄️', category: 'drug' },
    'plant+method': { id: 'extract', name: 'Plant Extract', icon: '💧', category: 'process' },
    'plant+container': { id: 'stash', name: 'Plant Stash', icon: '🧺', category: 'equipment' },
    'chemical+chemical': { id: 'meth', name: 'Meth', icon: '💎', category: 'synthetic' },
    'method+chemical': { id: 'lab', name: 'Lab Process', icon: '🔬', category: 'process' },
    'weed+method': { id: 'joint', name: 'Joint', icon: '🚬', category: 'consumption' },
    'cocaine+method': { id: 'powder', name: 'White Powder', icon: '🤧', category: 'drug' }
  };
  
  // Create combination keys in both directions
  const combinationKey = `${element1.id}+${element2.id}`;
  const reversedKey = `${element2.id}+${element1.id}`;
  
  // Check if we have a predefined combination
  if (basicCombinations[combinationKey]) {
    return basicCombinations[combinationKey];
  } else if (basicCombinations[reversedKey]) {
    return basicCombinations[reversedKey];
  }
  
  // If no predefined combination, generate a creative one
  return generateCreativeFallback(element1, element2);
}

// Generate a creative fallback when no predetermined combination exists
function generateCreativeFallback(element1, element2) {
  const commonDrugs = [
    {name: 'Heroin', icon: '💉', category: 'opioid'},
    {name: 'LSD', icon: '🧠', category: 'psychedelic'},
    {name: 'MDMA', icon: '💊', category: 'stimulant'},
    {name: 'DMT', icon: '👁️', category: 'psychedelic'},
    {name: 'Mushrooms', icon: '🍄', category: 'natural'},
    {name: 'Prescription Pills', icon: '💊', category: 'pharmaceutical'},
    {name: 'Amphetamine', icon: '⚡', category: 'stimulant'},
    {name: 'Opium', icon: '🌺', category: 'opioid'},
    {name: 'Hash', icon: '🟤', category: 'cannabis'},
    {name: 'Ketamine', icon: '🐴', category: 'dissociative'}
  ];
  
  const randomDrug = commonDrugs[Math.floor(Math.random() * commonDrugs.length)];
  
  return {
    id: `${element1.id}_${element2.id}_${randomDrug.name.toLowerCase().replace(/\s/g, '_')}`,
    name: randomDrug.name,
    icon: randomDrug.icon,
    category: randomDrug.category,
    description: `A combination of ${element1.name} and ${element2.name}`
  };
}